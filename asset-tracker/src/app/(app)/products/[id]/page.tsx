import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, products, requests } from "@/db/schema";
import { ActivityFeed } from "@/components/activity-feed";
import { AssetTable } from "@/components/asset-table";
import { AddTemplateSlotsButton, EditProductButton, NewAssetButton } from "@/components/product-forms";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/domain";
import { isUuid, param } from "@/lib/params";
import { activeChannels, activeUsers, loadAssetCards, recentActivity } from "@/lib/queries";

export async function generateMetadata(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) return { title: "Product" };
  const p = await db.query.products.findFirst({ where: eq(products.id, id), columns: { name: true } });
  return { title: p?.name ?? "Product" };
}

export default async function ProductPage(props: PageProps<"/products/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!isUuid(id)) notFound();
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { channelIds: { with: { channel: true } } },
  });
  if (!product) notFound();
  const showArchived = param(sp, "archived") === "1";
  const requestParam = param(sp, "request");
  const forRequest = isUuid(requestParam)
    ? await db.query.requests.findFirst({ where: and(eq(requests.id, requestParam), eq(requests.productId, id)) })
    : undefined;

  const [assetIds, channels, people, activityItems] = await Promise.all([
    db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.productId, id), eq(assets.archived, showArchived)))
      .orderBy(asc(assets.createdAt), asc(assets.name)),
    activeChannels(),
    activeUsers(),
    recentActivity({ productId: id, limit: 15 }),
  ]);
  const cards = await loadAssetCards(assetIds.map((a) => a.id));
  const designers = people.filter((p) => p.role === "designer" || p.role === "admin");
  const listedChannelIds = product.channelIds.filter((c) => c.channel.active).map((c) => c.channelId);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/products" className="hover:text-ink">
            ← Products
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name} {product.archived && <Pill>Archived</Pill>}
          </span>
        }
        description={
          <>
            <span className="font-mono">{product.sku}</span>
            {[product.brand, product.category].filter(Boolean).map((x) => ` · ${x}`)}
          </>
        }
        actions={
          can(user, "manage_catalog") && (
            <>
              <EditProductButton
                product={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  brand: product.brand,
                  category: product.category,
                  notes: product.notes,
                  archived: product.archived,
                  channelIds: Object.fromEntries(product.channelIds.map((c) => [c.channelId, c.externalId])),
                }}
                channels={channels.map((c) => ({ id: c.id, name: c.name, idLabel: c.idLabel }))}
              />
              {!cards.length && !showArchived && <AddTemplateSlotsButton productId={product.id} />}
              <NewAssetButton
                productId={product.id}
                channels={channels}
                designers={designers}
                requestId={forRequest?.id}
                defaultChannelIds={listedChannelIds.length ? listedChannelIds : undefined}
              />
            </>
          )
        }
      />

      {forRequest && (
        <p className="mb-6 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 ring-1 ring-indigo-200">
          Creating an asset for the request <strong>“{forRequest.title}”</strong>. Use <strong>Add asset</strong>; the request is
          linked to it and closes when its first version is uploaded.
        </p>
      )}
      {product.channelIds.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {product.channelIds
            .sort((a, b) => a.channel.sortOrder - b.channel.sortOrder)
            .map((c) => (
              <span key={c.channelId} className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs">
                <span className="text-muted">
                  {c.channel.name} {c.channel.idLabel ?? "ID"}
                </span>{" "}
                <span className="font-mono font-medium">{c.externalId}</span>
              </span>
            ))}
        </div>
      )}
      {product.notes && <p className="mb-6 rounded-lg bg-white p-3 text-sm text-gray-700 ring-1 ring-line">{product.notes}</p>}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="border-b border-line px-4 py-3">
            <SectionTitle
              action={
                <Link href={showArchived ? `/products/${id}` : `/products/${id}?archived=1`} className="text-xs link">
                  {showArchived ? "Show active" : "Show archived"}
                </Link>
              }
            >
              {showArchived ? "Archived creatives" : "Creatives"}
            </SectionTitle>
          </div>
          <AssetTable rows={cards} empty="Add the standard slots or a single asset to start." />
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SectionTitle>Activity</SectionTitle>
          </div>
          <ActivityFeed items={activityItems} />
        </section>
      </div>
    </>
  );
}
