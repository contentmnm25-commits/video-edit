import Link from "next/link";
import { assetStatusEnum, assetTypeEnum } from "@/db/schema";
import { AssetTable } from "@/components/asset-table";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ASSET_STATUS_LABEL, ASSET_TYPE_LABEL } from "@/lib/domain";
import { isUuid, param, pick } from "@/lib/params";
import { activeChannels, activeUsers, listAssets, productOptions, userChannelIds, type AssetFilters } from "@/lib/queries";

export const metadata = { title: "All creatives" };

const STATES = ["to_publish", "pending", "outdated", "live", "not_ready"] as const;
const STATE_LABEL: Record<(typeof STATES)[number], string> = {
  to_publish: "To publish or outdated",
  pending: "To publish (never live)",
  outdated: "Outdated",
  live: "Live & current",
  not_ready: "Not ready",
};

export default async function AssetsPage(props: PageProps<"/assets">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const [channels, people, products] = await Promise.all([activeChannels(), activeUsers(), productOptions()]);

  const channelSlug = param(sp, "channel");
  const channel = channels.find((c) => c.slug === channelSlug);
  const assigneeParam = param(sp, "assignee");
  const mine = param(sp, "mine") === "1";
  const filters: AssetFilters = {
    q: param(sp, "q"),
    status: pick(param(sp, "status"), assetStatusEnum.enumValues),
    type: pick(param(sp, "type"), assetTypeEnum.enumValues),
    productId: isUuid(param(sp, "product")) ? param(sp, "product") : undefined,
    assigneeId: assigneeParam === "me" ? user.id : isUuid(assigneeParam) ? assigneeParam : undefined,
    channelId: channel?.id,
    state: pick(param(sp, "state"), STATES),
    channelIds: mine ? await userChannelIds(user.id) : undefined,
  };
  const page = Math.max(1, Number(param(sp, "page") ?? 1) || 1);
  const { rows, total, pageSize } = await listAssets(filters, page);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) next.set(k, v);
    next.set("page", String(p));
    return `/assets?${next}`;
  };

  return (
    <>
      <PageHeader
        title="All creatives"
        description={`${total} creative${total === 1 ? "" : "s"}${hasFilters ? " match these filters" : ""}. Each row shows the current version and what every channel is showing.`}
      />
      <form className="card mb-4 grid grid-cols-2 gap-3 p-3 md:grid-cols-4 xl:grid-cols-7" action="/assets">
        <input name="q" defaultValue={filters.q} placeholder="Search…" className="input col-span-2 md:col-span-4 xl:col-span-1" aria-label="Search" />
        <select name="product" defaultValue={filters.productId ?? ""} className="input" aria-label="Product">
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
        <select name="channel" defaultValue={channel?.slug ?? ""} className="input" aria-label="Channel">
          <option value="">Any channel</option>
          {channels.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="state" defaultValue={filters.state ?? ""} className="input" aria-label="Channel state">
          <option value="">Any channel state</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {STATE_LABEL[s]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="input" aria-label="Status">
          <option value="">Any status</option>
          {assetStatusEnum.enumValues.map((s) => (
            <option key={s} value={s}>
              {ASSET_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={filters.type ?? ""} className="input" aria-label="Type">
          <option value="">Any type</option>
          {assetTypeEnum.enumValues.map((t) => (
            <option key={t} value={t}>
              {ASSET_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select name="assignee" defaultValue={assigneeParam ?? ""} className="input" aria-label="Designer">
          <option value="">Any designer</option>
          <option value="me">Assigned to me</option>
          {people
            .filter((p) => p.role === "designer" || p.role === "admin")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        {mine && <input type="hidden" name="mine" value="1" />}
        <div className="col-span-2 flex items-center gap-2 md:col-span-4 xl:col-span-7">
          <button className="btn-primary btn-sm">Apply filters</button>
          {hasFilters && (
            <Link href="/assets" className="btn-ghost btn-sm">
              Clear
            </Link>
          )}
          {mine && <span className="text-xs text-muted">Showing only your channels.</span>}
        </div>
      </form>
      <div className="card overflow-hidden">
        <AssetTable
          rows={rows}
          empty={hasFilters ? "Try removing a filter." : "Add a product to create its asset slots, then upload versions."}
        />
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="btn-secondary btn-sm">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={pageHref(page + 1)} className="btn-secondary btn-sm">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
