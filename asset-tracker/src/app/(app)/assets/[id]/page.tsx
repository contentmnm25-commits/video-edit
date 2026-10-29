import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { AlertTriangle, Columns2, Download, ExternalLink, FileText } from "lucide-react";
import { db } from "@/db";
import { comments, requests } from "@/db/schema";
import { ActivityFeed } from "@/components/activity-feed";
import {
  ChannelPanel,
  CommentForm,
  EditAssetButton,
  FlagCorrectionButton,
  MakeCurrentButton,
  ReviewPanel,
  type ChannelRow,
} from "@/components/asset-actions";
import { Avatar, cx, PageHeader, Pill, SectionTitle, StatusBadge, Thumb } from "@/components/ui";
import { UploadVersionButton } from "@/components/upload-version";
import { requireUser } from "@/lib/auth";
import {
  ASSET_TYPE_LABEL,
  can,
  fileKind,
  formatBytes,
  formatDuration,
  PRIORITY_LABEL,
  timeAgo,
} from "@/lib/domain";
import { isUuid } from "@/lib/params";
import { activeChannels, activeUsers, getAssetDetail, recentActivity } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(props: PageProps<"/assets/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) return { title: "Asset" };
  const a = await getAssetDetail(id);
  return { title: a ? `${a.product.name} — ${a.name}` : "Asset" };
}

export default async function AssetPage(props: PageProps<"/assets/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!isUuid(id)) notFound();
  const asset = await getAssetDetail(id);
  if (!asset) notFound();

  const [assetComments, openRequests, activityItems, channels, people, requireApproval] = await Promise.all([
    db.query.comments.findMany({
      where: eq(comments.assetId, id),
      orderBy: [asc(comments.createdAt)],
      with: {
        author: { columns: { id: true, name: true, avatarUrl: true } },
        version: { columns: { number: true } },
      },
    }),
    db.query.requests.findMany({
      where: and(eq(requests.assetId, id), inArray(requests.status, ["open", "in_progress"])),
      orderBy: [desc(requests.createdAt)],
      with: { requestedBy: { columns: { name: true } } },
    }),
    recentActivity({ assetId: id, limit: 15 }),
    activeChannels(),
    activeUsers(),
    getSetting("requireApproval"),
  ]);

  const selectedId = typeof sp.v === "string" ? sp.v : undefined;
  const shown =
    asset.versions.find((v) => v.id === selectedId) ?? asset.current ?? asset.versions[0] ?? null;
  const pendingReview = asset.versions.filter((v) => v.review === "pending");
  const nextNumber = (asset.versions[0]?.number ?? 0) + 1;
  const designers = people.filter((p) => p.role === "designer" || p.role === "admin");
  const previous = shown ? asset.versions.find((v) => v.number < shown.number && v.review !== "rejected") : undefined;

  const channelRows: ChannelRow[] = asset.channels.map((c) => ({
    channelId: c.channelId,
    name: c.channel.name,
    idLabel: c.channel.idLabel,
    externalId: c.externalId,
    state: c.state,
    liveVersionNumber: c.liveVersion?.number ?? null,
    liveAt: c.liveAt?.toISOString() ?? null,
    liveByName: c.liveBy?.name ?? null,
  }));

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link href="/products" className="hover:text-ink">
              Products
            </Link>{" "}
            /{" "}
            <Link href={`/products/${asset.product.id}`} className="hover:text-ink">
              {asset.product.name}
            </Link>{" "}
            · <span className="font-mono">{asset.product.sku}</span>
          </>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {asset.name}
            <StatusBadge status={asset.status} />
            {asset.archived && <Pill>Archived</Pill>}
          </span>
        }
        description={
          asset.current
            ? `Current version: v${asset.current.number}, approved ${timeAgo(asset.current.reviewedAt ?? asset.current.createdAt)}`
            : "No approved version yet"
        }
        actions={
          <>
            {can(user, "flag_correction") && asset.current && <FlagCorrectionButton assetId={asset.id} />}
            {can(user, "manage_catalog") && (
              <EditAssetButton
                asset={{
                  id: asset.id,
                  name: asset.name,
                  type: asset.type,
                  assigneeId: asset.assigneeId,
                  channelIds: asset.channels.map((c) => c.channelId),
                  archived: asset.archived,
                }}
                channels={channels}
                designers={designers}
              />
            )}
            {can(user, "upload") && (
              <UploadVersionButton assetId={asset.id} nextNumber={nextNumber} requireApproval={requireApproval} primary />
            )}
          </>
        }
      />

      {openRequests.length > 0 && (
        <div className="mb-4 space-y-2">
          {openRequests.map((r) => (
            <div key={r.id} className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-red-900">
                  {r.title}
                  {r.priority !== "normal" && <span className="ml-2 text-xs uppercase">{PRIORITY_LABEL[r.priority]}</span>}
                </p>
                {r.description && <p className="mt-0.5 whitespace-pre-line text-red-800">{r.description}</p>}
                <p className="mt-1 text-xs text-red-700/80">
                  Raised by {r.requestedBy?.name ?? "someone"} {timeAgo(r.createdAt)}. Closes automatically when the next version is
                  approved.
                </p>
              </div>
              <Link href={`/requests?open=${r.id}`} className="text-xs font-medium whitespace-nowrap text-red-700 hover:underline">
                Open request
              </Link>
            </div>
          ))}
        </div>
      )}

      {pendingReview.map((v) => (
        <div key={v.id} className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-start gap-4">
            <Thumb versionId={v.id} hasThumb={Boolean(v.thumbKey)} mimeType={v.mimeType} className="size-16" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-violet-900">
                v{v.number} is waiting for review
              </p>
              <p className="mt-0.5 text-sm text-violet-900/80">“{v.note}”</p>
              <p className="mt-1 text-xs text-violet-800/70">
                Uploaded by {v.uploadedBy?.name ?? "someone"} {timeAgo(v.createdAt)} ·{" "}
                <Link href={`/assets/${asset.id}?v=${v.id}`} className="underline">
                  Preview
                </Link>
                {asset.current && (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/assets/${asset.id}/compare?a=${asset.current.id}&b=${v.id}`} className="underline">
                      Compare with v{asset.current.number}
                    </Link>
                  </>
                )}
              </p>
            </div>
            {can(user, "review") && (
              <div className="w-full sm:w-80">
                <ReviewPanel versionId={v.id} number={v.number} />
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card overflow-hidden">
            {shown ? (
              <>
                <Preview versionId={shown.id} mimeType={shown.mimeType} fileName={shown.fileName} />
                <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      v{shown.number}
                      {shown.id === asset.currentVersionId && (
                        <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">Current</Pill>
                      )}
                      {shown.review === "pending" && <Pill className="bg-violet-50 text-violet-700 ring-violet-200">In review</Pill>}
                      {shown.review === "rejected" && <Pill className="bg-red-50 text-red-700 ring-red-200">Changes requested</Pill>}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">“{shown.note}”</p>
                    <p className="mt-1 text-xs text-muted">
                      {shown.fileName} · {formatBytes(shown.sizeBytes)}
                      {shown.width && shown.height ? ` · ${shown.width}×${shown.height}px` : ""}
                      {shown.durationSec ? ` · ${formatDuration(shown.durationSec)}` : ""} · by {shown.uploadedBy?.name ?? "someone"}{" "}
                      {timeAgo(shown.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previous && (
                      <Link href={`/assets/${asset.id}/compare?a=${previous.id}&b=${shown.id}`} className="btn-secondary btn-sm">
                        <Columns2 className="size-3.5" /> Compare with v{previous.number}
                      </Link>
                    )}
                    <a href={`/api/versions/${shown.id}/file`} target="_blank" className="btn-secondary btn-sm">
                      <ExternalLink className="size-3.5" /> Full size
                    </a>
                    <a href={`/api/versions/${shown.id}/file?download=1`} className="btn-primary btn-sm">
                      <Download className="size-3.5" /> Download v{shown.number}
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <FileText className="mb-3 size-10 text-gray-300" />
                <p className="text-sm font-medium">Nothing uploaded yet</p>
                <p className="mt-1 text-sm text-muted">
                  {can(user, "upload")
                    ? "Upload the first version to get started."
                    : "The designer hasn't uploaded this creative yet."}
                </p>
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <SectionTitle>Version history</SectionTitle>
            </div>
            {asset.versions.length ? (
              <ul className="divide-y divide-line">
                {asset.versions.map((v) => {
                  const isCurrent = v.id === asset.currentVersionId;
                  return (
                    <li key={v.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", shown?.id === v.id && "bg-gray-50")}>
                      <Link href={`/assets/${asset.id}?v=${v.id}`} scroll={false}>
                        <Thumb versionId={v.id} hasThumb={Boolean(v.thumbKey)} mimeType={v.mimeType} className="size-12" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <Link href={`/assets/${asset.id}?v=${v.id}`} scroll={false} className="font-semibold hover:text-accent">
                            v{v.number}
                          </Link>
                          {isCurrent && <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">Current</Pill>}
                          {v.review === "pending" && <Pill className="bg-violet-50 text-violet-700 ring-violet-200">In review</Pill>}
                          {v.review === "rejected" && <Pill className="bg-red-50 text-red-700 ring-red-200">Changes requested</Pill>}
                          <span className="truncate text-gray-700">{v.note}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {v.uploadedBy?.name ?? "Someone"} · {timeAgo(v.createdAt)} · {formatBytes(v.sizeBytes)}
                          {v.reviewNote ? ` · Review: “${v.reviewNote}”` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isCurrent && v.review === "approved" && can(user, "set_current") && (
                          <MakeCurrentButton versionId={v.id} number={v.number} />
                        )}
                        {asset.current && !isCurrent && (
                          <Link
                            href={`/assets/${asset.id}/compare?a=${v.id}&b=${asset.current.id}`}
                            className="btn-ghost btn-sm"
                            title={`Compare with v${asset.current.number}`}
                          >
                            <Columns2 className="size-3.5" />
                          </Link>
                        )}
                        <a href={`/api/versions/${v.id}/file?download=1`} className="btn-ghost btn-sm" title={`Download v${v.number}`}>
                          <Download className="size-3.5" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted">No versions yet.</p>
            )}
          </section>

          <section id="comments" className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <SectionTitle>Comments</SectionTitle>
            </div>
            {assetComments.length > 0 && (
              <ul className="divide-y divide-line">
                {assetComments.map((c) => (
                  <li key={c.id} className="flex gap-3 px-4 py-3">
                    <Avatar name={c.author?.name ?? "?"} src={c.author?.avatarUrl} size={26} />
                    <div className="min-w-0 text-sm">
                      <p>
                        <span className="font-medium">{c.author?.name ?? "Someone"}</span>{" "}
                        <span className="text-xs text-muted">
                          {timeAgo(c.createdAt)}
                          {c.version ? ` · about v${c.version.number}` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-gray-800">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {can(user, "comment") && (
              <div className="border-t border-line p-4 first:border-0">
                <CommentForm
                  assetId={asset.id}
                  versions={asset.versions.map((v) => ({ id: v.id, number: v.number }))}
                  defaultVersionId={shown?.id}
                />
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <SectionTitle>Where it&apos;s live</SectionTitle>
              <p className="-mt-2 text-xs text-muted">
                After uploading to a channel, mark it live here so everyone can see it&apos;s up to date.
              </p>
            </div>
            <ChannelPanel
              assetId={asset.id}
              rows={channelRows}
              currentNumber={asset.current?.number ?? null}
              canMarkLive={can(user, "mark_live") && Boolean(asset.current)}
            />
          </section>

          <section className="card p-4 text-sm">
            <SectionTitle>Details</SectionTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted">Product</dt>
              <dd>
                <Link href={`/products/${asset.product.id}`} className="link">
                  {asset.product.name}
                </Link>
              </dd>
              <dt className="text-muted">SKU</dt>
              <dd className="font-mono">{asset.product.sku}</dd>
              <dt className="text-muted">Type</dt>
              <dd>{ASSET_TYPE_LABEL[asset.type]}</dd>
              <dt className="text-muted">Designer</dt>
              <dd>{asset.assignee?.name ?? <span className="text-gray-400">Unassigned</span>}</dd>
              <dt className="text-muted">Versions</dt>
              <dd>{asset.versions.length}</dd>
              <dt className="text-muted">Created</dt>
              <dd>{timeAgo(asset.createdAt)}</dd>
            </dl>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <SectionTitle>History</SectionTitle>
            </div>
            <ActivityFeed items={activityItems} showSubject={false} />
          </section>
        </div>
      </div>
    </>
  );
}

function Preview({ versionId, mimeType, fileName }: { versionId: string; mimeType: string; fileName: string }) {
  const kind = fileKind(mimeType);
  const src = `/api/versions/${versionId}/file`;
  if (kind === "image") {
    return (
      <div className="flex items-center justify-center bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] bg-[length:20px_20px] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={fileName} className="max-h-[60vh] w-auto max-w-full object-contain" />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className="bg-black">
        <video key={versionId} src={src} controls preload="metadata" className="max-h-[60vh] w-full" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 px-6 py-16 text-center">
      <FileText className="mb-2 size-10 text-gray-400" />
      <p className="text-sm font-medium">{fileName}</p>
      <p className="mt-1 text-xs text-muted">No preview for this file type. Download it to open.</p>
    </div>
  );
}
