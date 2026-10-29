import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/domain";
import { env } from "@/lib/env";
import { statLocalFile, verifyLocalUploadToken, writeLocalFile } from "@/lib/storage";

// Receives browser uploads when STORAGE_DRIVER=local. With S3/R2 the browser
// uploads straight to the bucket and this route is never used.
export async function PUT(request: NextRequest) {
  if (env.storageDriver !== "local") return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!can(user, "upload")) return new Response("Forbidden", { status: 403 });
  const p = request.nextUrl.searchParams;
  const key = p.get("key") ?? "";
  if (!verifyLocalUploadToken(key, p.get("expires") ?? "", p.get("token") ?? "")) {
    return new Response("Upload link expired or invalid", { status: 403 });
  }
  if (!request.body) return new Response("Empty body", { status: 400 });
  // Versions are immutable: a signed link can't be reused to replace a stored file.
  if (await statLocalFile(key)) return new Response("File already uploaded", { status: 409 });
  try {
    const size = await writeLocalFile(key, request.body, env.maxUploadBytes);
    return Response.json({ ok: true, size });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Upload failed", { status: 400 });
  }
}
