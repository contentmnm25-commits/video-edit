import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assets, versions } from "@/db/schema";
import { CompareSlider } from "@/components/compare-slider";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fileKind, formatBytes, timeAgo } from "@/lib/domain";
import { isUuid, param } from "@/lib/params";

export const metadata = { title: "Compare versions" };

export default async function ComparePage(props: PageProps<"/assets/[id]/compare">) {
  await requireUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const a = param(sp, "a");
  const b = param(sp, "b");
  if (!isUuid(id) || !isUuid(a) || !isUuid(b)) notFound();
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
    with: { product: { columns: { name: true } } },
  });
  const pair = await db.query.versions.findMany({
    where: and(eq(versions.assetId, id), inArray(versions.id, [a, b])),
    with: { uploadedBy: { columns: { name: true } } },
  });
  if (!asset || pair.length !== 2) notFound();
  const [older, newer] = pair.sort((x, y) => x.number - y.number);
  const bothImages = fileKind(older.mimeType) === "image" && fileKind(newer.mimeType) === "image";

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/assets/${id}`} className="hover:text-ink">
            ← {asset.product.name} — {asset.name}
          </Link>
        }
        title={`v${older.number} vs v${newer.number}`}
        description={`What changed in v${newer.number}: “${newer.note}”`}
      />
      {bothImages && (
        <section className="card mb-6 p-4">
          <h2 className="mb-3 text-sm font-semibold">Overlay. Drag the slider to compare.</h2>
          <CompareSlider
            before={`/api/versions/${older.id}/file`}
            after={`/api/versions/${newer.id}/file`}
            beforeLabel={`v${older.number}`}
            afterLabel={`v${newer.number}`}
          />
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {[older, newer].map((v) => (
          <section key={v.id} className="card overflow-hidden">
            <div className="flex min-h-64 items-center justify-center bg-gray-50 p-3">
              {fileKind(v.mimeType) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/versions/${v.id}/file`} alt={`v${v.number}`} className="max-h-[60vh] max-w-full object-contain" />
              ) : fileKind(v.mimeType) === "video" ? (
                <video src={`/api/versions/${v.id}/file`} controls preload="metadata" className="max-h-[60vh] w-full bg-black" />
              ) : (
                <p className="text-sm text-muted">No preview for {v.fileName}</p>
              )}
            </div>
            <div className="border-t border-line p-4 text-sm">
              <p className="font-semibold">v{v.number}</p>
              <p className="mt-1 text-gray-700">“{v.note}”</p>
              <p className="mt-1 text-xs text-muted">
                {v.fileName} · {formatBytes(v.sizeBytes)}
                {v.width && v.height ? ` · ${v.width}×${v.height}px` : ""} · {v.uploadedBy?.name ?? "someone"} ·{" "}
                {timeAgo(v.createdAt)}
              </p>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
