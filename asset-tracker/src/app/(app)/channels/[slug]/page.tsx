import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { assetChannels, assets, channels, productChannels, products, versions } from "@/db/schema";
import { ChannelQueue, type QueueRow } from "@/components/channel-queue";
import { cx, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can, channelState } from "@/lib/domain";
import { param } from "@/lib/params";

export async function generateMetadata(props: PageProps<"/channels/[slug]">) {
  const { slug } = await props.params;
  const c = await db.query.channels.findFirst({ where: eq(channels.slug, slug) });
  return { title: c?.name ?? "Channel" };
}

const TABS = [
  { key: "todo", label: "To publish" },
  { key: "live", label: "Live & current" },
  { key: "waiting", label: "Not ready yet" },
] as const;

export default async function ChannelPage(props: PageProps<"/channels/[slug]">) {
  const user = await requireUser();
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const tab = (TABS.find((t) => t.key === param(sp, "tab"))?.key ?? "todo") as (typeof TABS)[number]["key"];
  const channel = await db.query.channels.findFirst({ where: eq(channels.slug, slug) });
  if (!channel) notFound();

  const rowsRaw = await db
    .select({
      assetId: assets.id,
      assetName: assets.name,
      updatedAt: assets.updatedAt,
      productName: products.name,
      sku: products.sku,
      externalId: productChannels.externalId,
      currentVersionId: assets.currentVersionId,
      liveVersionId: assetChannels.liveVersionId,
      currentNumber: versions.number,
      thumbKey: versions.thumbKey,
      mimeType: versions.mimeType,
      note: versions.note,
      liveVersionNumber: sql<number | null>`(select v2.number from ${versions} v2 where v2.id = ${assetChannels.liveVersionId})`,
    })
    .from(assetChannels)
    .innerJoin(assets, eq(assets.id, assetChannels.assetId))
    .innerJoin(products, eq(products.id, assets.productId))
    .leftJoin(versions, eq(versions.id, assets.currentVersionId))
    .leftJoin(
      productChannels,
      and(eq(productChannels.productId, products.id), eq(productChannels.channelId, channel.id)),
    )
    .where(and(eq(assetChannels.channelId, channel.id), eq(assets.archived, false), eq(products.archived, false)))
    .orderBy(desc(assets.updatedAt));

  const withState = rowsRaw.map((r) => ({ ...r, state: channelState(r.currentVersionId, r.liveVersionId) }));
  const counts = {
    todo: withState.filter((r) => r.state === "pending" || r.state === "outdated").length,
    live: withState.filter((r) => r.state === "live").length,
    waiting: withState.filter((r) => r.state === "not_ready").length,
  };
  const visible = withState.filter((r) =>
    tab === "todo" ? r.state === "pending" || r.state === "outdated" : tab === "live" ? r.state === "live" : r.state === "not_ready",
  );
  // Outdated first: those are live listings showing the wrong creative right now.
  visible.sort((a, b) => Number(b.state === "outdated") - Number(a.state === "outdated"));

  const queueRows: QueueRow[] = visible
    .filter((r) => r.currentVersionId)
    .map((r) => ({
      assetId: r.assetId,
      assetName: r.assetName,
      productName: r.productName,
      sku: r.sku,
      externalId: r.externalId,
      state: r.state,
      currentVersionId: r.currentVersionId!,
      currentNumber: r.currentNumber ?? 0,
      hasThumb: Boolean(r.thumbKey),
      mimeType: r.mimeType ?? "",
      liveVersionNumber: r.liveVersionNumber,
      note: r.note ?? "",
      updatedAt: r.updatedAt.toISOString(),
    }));

  return (
    <>
      <PageHeader
        title={channel.name}
        description={
          counts.todo
            ? `${counts.todo} creative${counts.todo === 1 ? "" : "s"} to upload. Download each one, upload it on ${channel.name}, then mark it live.`
            : `Everything on ${channel.name} is up to date.`
        }
      />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/channels/${slug}${t.key === "todo" ? "" : `?tab=${t.key}`}`}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              tab === t.key ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label} <span className="ml-1 text-xs tabular-nums">{counts[t.key]}</span>
          </Link>
        ))}
      </div>
      <div className="card overflow-hidden">
        {tab === "waiting" ? (
          visible.length ? (
            <ul className="divide-y divide-line">
              {visible.map((r) => (
                <li key={r.assetId} className="px-4 py-3 text-sm">
                  <Link href={`/assets/${r.assetId}`} className="font-medium hover:text-accent">
                    {r.productName} — {r.assetName}
                  </Link>
                  <span className="ml-2 text-xs text-muted">No approved version yet</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing waiting on design" />
          )
        ) : queueRows.length ? (
          <ChannelQueue
            channelId={channel.id}
            channelName={channel.name}
            idLabel={channel.idLabel}
            rows={queueRows}
            canMarkLive={tab === "todo" && can(user, "mark_live")}
          />
        ) : (
          <EmptyState icon={<CheckCircle2 className="size-10 text-emerald-300" />} title={tab === "todo" ? "All caught up" : "Nothing live yet"}>
            {tab === "todo" ? `Every creative on ${channel.name} matches its current version.` : undefined}
          </EmptyState>
        )}
      </div>
    </>
  );
}
