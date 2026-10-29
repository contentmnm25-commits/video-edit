import { Readable } from "node:stream";
import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { versions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { downloadName } from "@/lib/domain";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/notify";
import { openLocalFile, presignedDownloadUrl, statLocalFile } from "@/lib/storage";

// GET /api/versions/:id/file             → inline (previews, <video> with seeking)
// GET /api/versions/:id/file?download=1  → attachment named SKU_Asset_v3.ext
// GET /api/versions/:id/file?thumb=1     → the JPEG thumbnail
export async function GET(request: NextRequest, ctx: RouteContext<"/api/versions/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });

  const version = await db.query.versions.findFirst({
    where: eq(versions.id, id),
    with: { asset: { with: { product: { columns: { sku: true, id: true } } } } },
  });
  if (!version) return new Response("Not found", { status: 404 });

  const thumb = request.nextUrl.searchParams.has("thumb");
  const download = request.nextUrl.searchParams.has("download");
  const key = thumb ? version.thumbKey : version.fileKey;
  if (!key) return new Response("No thumbnail", { status: 404 });
  const contentType = thumb ? "image/jpeg" : version.mimeType;
  const fileName = thumb
    ? "thumb.jpg"
    : downloadName(version.asset.product.sku, version.asset.name, version.number, version.fileName);

  if (download) {
    await logActivity(db, {
      actorId: user.id,
      action: "version.downloaded",
      productId: version.asset.product.id,
      assetId: version.assetId,
      versionId: version.id,
      meta: { number: version.number },
    });
  }

  if (env.storageDriver === "s3") {
    const url = await presignedDownloadUrl(key, { fileName, contentType, inline: !download });
    return Response.redirect(url, 302);
  }

  const stat = await statLocalFile(key);
  if (!stat) return new Response("File missing from storage", { status: 404 });
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
    "Accept-Ranges": "bytes",
    // Versions are immutable, so browsers may cache them; the session check still runs on revalidation.
    "Cache-Control": "private, max-age=3600",
    // Uploaded files are untrusted: never let one run script on this origin (e.g. an SVG or HTML file).
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  });

  // Range support lets <video> seek without downloading the whole file.
  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match && (match[1] || match[2])) {
    let start: number;
    let end: number;
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    } else {
      start = Math.max(stat.size - Number(match[2]), 0);
      end = stat.size - 1;
    }
    if (start > end || start >= stat.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(openLocalFile(key, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }
  headers.set("Content-Length", String(stat.size));
  return new Response(Readable.toWeb(openLocalFile(key)) as ReadableStream, { status: 200, headers });
}
