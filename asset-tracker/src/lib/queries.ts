import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  activity,
  assetChannels,
  assets,
  channels,
  notifications,
  productChannels,
  products,
  requests,
  users,
  type AssetStatus,
  type AssetType,
} from "@/db/schema";
import { channelState, type ChannelState } from "@/lib/domain";

// ─── Assets list ───────────────────────────────────────────────────────

export type ChannelFilterState = ChannelState | "to_publish";

export type AssetFilters = {
  q?: string;
  status?: AssetStatus;
  type?: AssetType;
  productId?: string;
  assigneeId?: string;
  channelId?: string;
  state?: ChannelFilterState;
  /** Restrict a state filter to these channels (e.g. "my channels"). */
  channelIds?: string[];
};

const PAGE_SIZE = 50;

function stateCondition(state: ChannelFilterState): SQL {
  const live = sql`${assetChannels.liveVersionId}`;
  const current = sql`${assets.currentVersionId}`;
  switch (state) {
    case "not_ready":
      return sql`${current} is null`;
    case "pending":
      return sql`${current} is not null and ${live} is null`;
    case "outdated":
      return sql`${current} is not null and ${live} is not null and ${live} <> ${current}`;
    case "live":
      return sql`${live} = ${current}`;
    case "to_publish":
      return sql`${current} is not null and (${live} is null or ${live} <> ${current})`;
  }
}

function assetWhere(f: AssetFilters): SQL {
  const conds: (SQL | undefined)[] = [eq(assets.archived, false), eq(products.archived, false)];
  if (f.q?.trim()) {
    const term = `%${f.q.trim().replace(/[%_]/g, "\\$&")}%`;
    conds.push(
      or(
        ilike(assets.name, term),
        ilike(products.name, term),
        ilike(products.sku, term),
        sql`exists (select 1 from ${productChannels} where ${productChannels.productId} = ${products.id} and ${productChannels.externalId} ilike ${term})`,
      ),
    );
  }
  if (f.status) conds.push(eq(assets.status, f.status));
  if (f.type) conds.push(eq(assets.type, f.type));
  if (f.productId) conds.push(eq(assets.productId, f.productId));
  if (f.assigneeId) conds.push(eq(assets.assigneeId, f.assigneeId));
  if (f.channelId || f.state || f.channelIds) {
    const inner: SQL[] = [sql`${assetChannels.assetId} = ${assets.id}`];
    if (f.channelId) inner.push(sql`${assetChannels.channelId} = ${f.channelId}`);
    if (f.channelIds) {
      if (!f.channelIds.length) return sql`false`;
      inner.push(inArray(assetChannels.channelId, f.channelIds) as SQL);
    }
    if (f.state) inner.push(stateCondition(f.state));
    conds.push(sql`exists (select 1 from ${assetChannels} where ${sql.join(inner, sql` and `)})`);
  }
  return and(...conds)!;
}

export async function listAssets(filters: AssetFilters, page = 1, pageSize = PAGE_SIZE) {
  const where = assetWhere(filters);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(assets)
    .innerJoin(products, eq(products.id, assets.productId))
    .where(where);
  const idRows = await db
    .select({ id: assets.id })
    .from(assets)
    .innerJoin(products, eq(products.id, assets.productId))
    .where(where)
    .orderBy(desc(assets.updatedAt), asc(assets.id))
    .limit(pageSize)
    .offset((Math.max(page, 1) - 1) * pageSize);
  const rows = await loadAssetCards(idRows.map((r) => r.id));
  return { rows, total, page, pageSize };
}

/** Assets with everything a list row or card needs, in the order of `ids`. */
export async function loadAssetCards(ids: string[]) {
  if (!ids.length) return [];
  const found = await db.query.assets.findMany({
    where: inArray(assets.id, ids),
    with: {
      product: { columns: { id: true, name: true, sku: true } },
      currentVersion: {
        columns: { id: true, number: true, mimeType: true, thumbKey: true, createdAt: true, fileName: true },
      },
      assignee: { columns: { id: true, name: true, avatarUrl: true } },
      channels: {
        with: {
          channel: { columns: { id: true, name: true, slug: true, sortOrder: true, active: true } },
          liveVersion: { columns: { id: true, number: true } },
        },
      },
    },
  });
  const byId = new Map(found.map((a) => [a.id, a]));
  return ids
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({
      ...a,
      channels: a.channels
        .filter((c) => c.channel.active)
        .sort((x, y) => x.channel.sortOrder - y.channel.sortOrder)
        .map((c) => ({
          channel: c.channel,
          liveVersionNumber: c.liveVersion?.number ?? null,
          liveAt: c.liveAt,
          state: channelState(a.currentVersionId, c.liveVersionId),
        })),
    }));
}

export type AssetCard = Awaited<ReturnType<typeof loadAssetCards>>[number];

// ─── Single asset ──────────────────────────────────────────────────────

export async function getAssetDetail(id: string) {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
    with: {
      product: { with: { channelIds: true } },
      assignee: { columns: { id: true, name: true, avatarUrl: true, email: true } },
      versions: {
        orderBy: (v, { desc }) => [desc(v.number)],
        with: {
          uploadedBy: { columns: { id: true, name: true, avatarUrl: true } },
          reviewedBy: { columns: { id: true, name: true } },
        },
      },
      channels: {
        with: {
          channel: true,
          liveVersion: { columns: { id: true, number: true } },
          liveBy: { columns: { id: true, name: true } },
        },
      },
    },
  });
  if (!asset) return null;
  const current = asset.versions.find((v) => v.id === asset.currentVersionId) ?? null;
  return {
    ...asset,
    current,
    channels: asset.channels
      .filter((c) => c.channel.active)
      .sort((x, y) => x.channel.sortOrder - y.channel.sortOrder)
      .map((c) => ({
        ...c,
        externalId: asset.product.channelIds.find((p) => p.channelId === c.channelId)?.externalId ?? null,
        state: channelState(asset.currentVersionId, c.liveVersionId),
      })),
  };
}

export type AssetDetail = NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>;

// ─── Dashboard numbers ─────────────────────────────────────────────────

export async function channelSummary() {
  const live = sql`${assetChannels.liveVersionId}`;
  const current = sql`${assets.currentVersionId}`;
  const rows = await db
    .select({
      id: channels.id,
      name: channels.name,
      slug: channels.slug,
      live: sql<number>`count(${assets.id}) filter (where ${current} is not null and ${live} = ${current})::int`,
      outdated: sql<number>`count(${assets.id}) filter (where ${current} is not null and ${live} is not null and ${live} <> ${current})::int`,
      pending: sql<number>`count(${assets.id}) filter (where ${current} is not null and ${live} is null)::int`,
      notReady: sql<number>`count(${assets.id}) filter (where ${current} is null)::int`,
    })
    .from(channels)
    .leftJoin(assetChannels, eq(assetChannels.channelId, channels.id))
    .leftJoin(
      assets,
      and(
        eq(assets.id, assetChannels.assetId),
        eq(assets.archived, false),
        sql`${assets.productId} in (select ${products.id} from ${products} where ${products.archived} = false)`,
      ),
    )
    .where(eq(channels.active, true))
    .groupBy(channels.id)
    .orderBy(asc(channels.sortOrder), asc(channels.name));
  return rows;
}

export async function assetStatusCounts() {
  const rows = await db
    .select({ status: assets.status, n: sql<number>`count(*)::int` })
    .from(assets)
    .innerJoin(products, eq(products.id, assets.productId))
    .where(and(eq(assets.archived, false), eq(products.archived, false)))
    .groupBy(assets.status);
  const counts: Record<AssetStatus, number> = { in_progress: 0, in_review: 0, ready: 0, needs_correction: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export async function openRequestCount(assigneeId?: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(requests)
    .where(
      and(
        inArray(requests.status, ["open", "in_progress"]),
        assigneeId ? eq(requests.assigneeId, assigneeId) : undefined,
      ),
    );
  return n;
}

// ─── Activity & notifications ──────────────────────────────────────────

export async function recentActivity(opts: { assetId?: string; productId?: string; limit?: number } = {}) {
  return db.query.activity.findMany({
    where: and(
      opts.assetId ? eq(activity.assetId, opts.assetId) : undefined,
      opts.productId ? eq(activity.productId, opts.productId) : undefined,
    ),
    orderBy: [desc(activity.createdAt)],
    limit: opts.limit ?? 20,
    with: {
      actor: { columns: { id: true, name: true, avatarUrl: true } },
      asset: { columns: { id: true, name: true } },
      product: { columns: { id: true, name: true, sku: true } },
      version: { columns: { id: true, number: true } },
      channel: { columns: { id: true, name: true } },
    },
  });
}

export type ActivityItem = Awaited<ReturnType<typeof recentActivity>>[number];

export async function unreadNotificationCount(userId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return n;
}

// ─── Reference data ────────────────────────────────────────────────────

export function activeChannels() {
  return db.query.channels.findMany({
    where: eq(channels.active, true),
    orderBy: [asc(channels.sortOrder), asc(channels.name)],
  });
}

export function allChannels() {
  return db.query.channels.findMany({ orderBy: [asc(channels.sortOrder), asc(channels.name)] });
}

export function activeUsers() {
  return db.query.users.findMany({
    where: eq(users.active, true),
    orderBy: [asc(users.name)],
    columns: { id: true, name: true, email: true, role: true, team: true, avatarUrl: true },
  });
}

export async function userChannelIds(userId: string) {
  const rows = await db.query.userChannels.findMany({ where: (uc, { eq }) => eq(uc.userId, userId) });
  return rows.map((r) => r.channelId);
}

export function productOptions() {
  return db.query.products.findMany({
    where: eq(products.archived, false),
    orderBy: [asc(products.name)],
    columns: { id: true, name: true, sku: true },
  });
}
