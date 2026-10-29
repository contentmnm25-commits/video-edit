import "server-only";
import Papa from "papaparse";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Db } from "@/db";
import { assetChannels, assets, channels, productChannels, products } from "@/db/schema";
import { guessAssetType } from "@/lib/domain";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Create the standard asset slots for a product, each used on every channel the
 * product is listed on (or all active channels when no listing ids are known yet).
 * Existing slots with the same name are left alone.
 */
export async function createAssetSlots(tx: Tx | Db, productId: string, names: string[], actorId: string | null) {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!wanted.length) return 0;
  const existing = await tx
    .select({ name: assets.name })
    .from(assets)
    .where(and(eq(assets.productId, productId), inArray(assets.name, wanted)));
  const missing = wanted.filter((n) => !existing.some((e) => e.name === n));
  if (!missing.length) return 0;

  const listed = await tx
    .select({ channelId: productChannels.channelId })
    .from(productChannels)
    .innerJoin(channels, eq(channels.id, productChannels.channelId))
    .where(and(eq(productChannels.productId, productId), eq(channels.active, true)));
  const channelIds = listed.length
    ? listed.map((l) => l.channelId)
    : (await tx.select({ id: channels.id }).from(channels).where(eq(channels.active, true))).map((c) => c.id);

  const created = await tx
    .insert(assets)
    .values(missing.map((name) => ({ productId, name, type: guessAssetType(name), createdById: actorId })))
    .returning({ id: assets.id });
  if (channelIds.length) {
    await tx
      .insert(assetChannels)
      .values(created.flatMap((a) => channelIds.map((channelId) => ({ assetId: a.id, channelId }))));
  }
  return created.length;
}

export type ImportReport = {
  created: number;
  updated: number;
  slots: number;
  errors: string[];
  unknownColumns: string[];
};

const BASE_COLUMNS = ["name", "sku", "brand", "category", "notes", "assets"];

/**
 * Bulk create/update products from CSV. Columns: name, sku, brand, category, notes,
 * assets (slot names separated by | or ;), plus one column per channel (by name or
 * slug, e.g. "Amazon") holding that channel's listing id. Rows are matched on SKU.
 */
export async function importProductsCsv(csv: string, actorId: string, templateSlots: string[]): Promise<ImportReport> {
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const report: ImportReport = { created: 0, updated: 0, slots: 0, errors: [], unknownColumns: [] };
  for (const e of parsed.errors.slice(0, 5)) report.errors.push(`Row ${(e.row ?? 0) + 2}: ${e.message}`);

  const allChannels = await db.select().from(channels);
  const headers = parsed.meta.fields ?? [];
  const channelColumns = new Map<string, string>();
  for (const h of headers) {
    const key = h.toLowerCase();
    if (BASE_COLUMNS.includes(key)) continue;
    const ch = allChannels.find(
      (c) => c.slug === key || c.name.toLowerCase() === key || `${c.name} ${c.idLabel ?? ""}`.trim().toLowerCase() === key,
    );
    if (ch) channelColumns.set(h, ch.id);
    else report.unknownColumns.push(h);
  }
  const col = (row: Record<string, string>, name: string) => {
    const header = headers.find((h) => h.toLowerCase() === name);
    return header ? (row[header] ?? "").trim() : "";
  };

  if (!headers.some((h) => h.toLowerCase() === "sku") || !headers.some((h) => h.toLowerCase() === "name")) {
    report.errors.unshift('The CSV needs at least "name" and "sku" columns.');
    return report;
  }

  for (const [i, row] of parsed.data.entries()) {
    const rowNo = i + 2;
    const sku = col(row, "sku");
    const name = col(row, "name");
    if (!sku || !name) {
      report.errors.push(`Row ${rowNo}: name and sku are required.`);
      continue;
    }
    try {
      await db.transaction(async (tx) => {
        const fields = {
          name,
          brand: col(row, "brand") || null,
          category: col(row, "category") || null,
          notes: col(row, "notes") || null,
        };
        const existing = await tx.query.products.findFirst({ where: eq(products.sku, sku) });
        let productId: string;
        if (existing) {
          await tx
            .update(products)
            .set({ ...fields, archived: false, updatedAt: new Date() })
            .where(eq(products.id, existing.id));
          productId = existing.id;
          report.updated++;
        } else {
          const [p] = await tx.insert(products).values({ ...fields, sku, createdById: actorId }).returning();
          productId = p.id;
          report.created++;
        }
        for (const [header, channelId] of channelColumns) {
          const externalId = (row[header] ?? "").trim();
          if (!externalId) continue;
          await tx
            .insert(productChannels)
            .values({ productId, channelId, externalId })
            .onConflictDoUpdate({ target: [productChannels.productId, productChannels.channelId], set: { externalId } });
        }
        const slotList = col(row, "assets");
        const slotNames = slotList ? slotList.split(/[|;]/) : existing ? [] : templateSlots;
        report.slots += await createAssetSlots(tx, productId, slotNames, actorId);
      });
    } catch (err) {
      report.errors.push(`Row ${rowNo} (${sku}): ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  return report;
}
