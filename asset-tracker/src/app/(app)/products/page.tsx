import Link from "next/link";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { Boxes, FileUp, Plus } from "lucide-react";
import { db } from "@/db";
import { assetChannels, assets, productChannels, products } from "@/db/schema";
import { EmptyState, PageHeader, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can, timeAgo } from "@/lib/domain";
import { param } from "@/lib/params";

export const metadata = { title: "Products" };

export default async function ProductsPage(props: PageProps<"/products">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = param(sp, "q")?.trim();
  const showArchived = param(sp, "archived") === "1";
  const term = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;

  const live = sql`${assetChannels.liveVersionId}`;
  const current = sql`${assets.currentVersionId}`;
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      brand: products.brand,
      category: products.category,
      archived: products.archived,
      updatedAt: products.updatedAt,
      assetCount: sql<number>`count(distinct ${assets.id})::int`,
      readyCount: sql<number>`count(distinct ${assets.id}) filter (where ${current} is not null)::int`,
      correctionCount: sql<number>`count(distinct ${assets.id}) filter (where ${assets.status} = 'needs_correction')::int`,
      todo: sql<number>`count(*) filter (where ${current} is not null and ${assetChannels.assetId} is not null and (${live} is null or ${live} <> ${current}))::int`,
    })
    .from(products)
    .leftJoin(assets, and(eq(assets.productId, products.id), eq(assets.archived, false)))
    .leftJoin(assetChannels, eq(assetChannels.assetId, assets.id))
    .where(
      and(
        eq(products.archived, showArchived),
        term
          ? or(
              ilike(products.name, term),
              ilike(products.sku, term),
              ilike(products.brand, term),
              sql`exists (select 1 from ${productChannels} where ${productChannels.productId} = ${products.id} and ${productChannels.externalId} ilike ${term})`,
            )
          : undefined,
      ),
    )
    .groupBy(products.id)
    .orderBy(asc(products.name))
    .limit(500);

  return (
    <>
      <PageHeader
        title="Products"
        description="Each product holds its creative slots (main image, video, A+…) and its listing ID on every channel."
        actions={
          can(user, "manage_catalog") && (
            <>
              <Link href="/products/import" className="btn-secondary">
                <FileUp className="size-4" /> Import CSV
              </Link>
              <Link href="/products/new" className="btn-primary">
                <Plus className="size-4" /> Add product
              </Link>
            </>
          )
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" action="/products">
        <input name="q" defaultValue={q} placeholder="Search name, SKU, brand or listing ID" className="input max-w-sm" />
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <button className="btn-secondary">Search</button>
        <Link href={showArchived ? "/products" : "/products?archived=1"} className="btn-ghost ml-auto">
          {showArchived ? "Show active products" : "Show archived"}
        </Link>
      </form>
      <div className="card overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">SKU</th>
                  <th className="px-3 py-2.5 text-right font-medium">Creatives ready</th>
                  <th className="px-3 py-2.5 font-medium">Attention</th>
                  <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5">
                      <Link href={`/products/${p.id}`} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted">{[p.brand, p.category].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {p.readyCount}/{p.assetCount}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.correctionCount > 0 && (
                          <Pill className="bg-red-50 text-red-700 ring-red-200">{p.correctionCount} need correction</Pill>
                        )}
                        {p.todo > 0 && <Pill className="bg-amber-50 text-amber-800 ring-amber-200">{p.todo} to publish</Pill>}
                        {!p.correctionCount && !p.todo && p.assetCount > 0 && p.readyCount === p.assetCount && (
                          <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">Up to date</Pill>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted">{timeAgo(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Boxes className="size-10" />} title={q ? "No products match" : "No products yet"}>
            {!q && "Add products one at a time or import your catalogue from a CSV."}
          </EmptyState>
        )}
      </div>
    </>
  );
}
