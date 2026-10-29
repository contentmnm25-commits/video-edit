"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channels, productChannels, products } from "@/db/schema";
import { authorize } from "@/lib/auth";
import { createAssetSlots, importProductsCsv, type ImportReport } from "@/lib/catalog";
import { attempt, UserError } from "@/lib/errors";
import { logActivity } from "@/lib/notify";
import { getSetting } from "@/lib/settings";

const productInput = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  sku: z.string().trim().min(1, "SKU is required").max(80),
  brand: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function readProductForm(formData: FormData) {
  const parsed = productInput.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    brand: formData.get("brand") || undefined,
    category: formData.get("category") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form");
  return parsed.data;
}

/** Form fields named `channel:<channelId>` carry the listing id on that channel. */
async function readChannelIds(formData: FormData) {
  const all = await db.select({ id: channels.id }).from(channels);
  return all
    .map((c) => ({ channelId: c.id, externalId: String(formData.get(`channel:${c.id}`) ?? "").trim() }))
    .filter((c) => formData.has(`channel:${c.channelId}`));
}

export async function createProduct(_prev: unknown, formData: FormData) {
  let id = "";
  const result = await attempt(async () => {
    const user = await authorize("manage_catalog");
    const input = readProductForm(formData);
    const ids = await readChannelIds(formData);
    const useTemplate = formData.get("useTemplate") === "on";
    const template = useTemplate ? await getSetting("assetTemplate") : [];
    const clash = await db.query.products.findFirst({ where: eq(products.sku, input.sku) });
    if (clash) throw new UserError(`SKU ${input.sku} already exists (${clash.name}).`);
    await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(products)
        .values({ ...input, brand: input.brand ?? null, category: input.category ?? null, notes: input.notes ?? null, createdById: user.id })
        .returning();
      id = p.id;
      const filled = ids.filter((c) => c.externalId);
      if (filled.length) await tx.insert(productChannels).values(filled.map((c) => ({ ...c, productId: p.id })));
      await createAssetSlots(tx, p.id, template, user.id);
      await logActivity(tx, { actorId: user.id, action: "product.created", productId: p.id });
    });
  });
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  redirect(`/products/${id}`);
}

export async function updateProduct(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await authorize("manage_catalog");
    const productId = z.string().uuid().parse(formData.get("productId"));
    const input = readProductForm(formData);
    const ids = await readChannelIds(formData);
    const clash = await db.query.products.findFirst({
      where: and(eq(products.sku, input.sku), ne(products.id, productId)),
    });
    if (clash) throw new UserError(`SKU ${input.sku} is already used by ${clash.name}.`);
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({ ...input, brand: input.brand ?? null, category: input.category ?? null, notes: input.notes ?? null, updatedAt: new Date() })
        .where(eq(products.id, productId));
      for (const c of ids) {
        if (c.externalId) {
          await tx
            .insert(productChannels)
            .values({ ...c, productId })
            .onConflictDoUpdate({
              target: [productChannels.productId, productChannels.channelId],
              set: { externalId: c.externalId },
            });
        } else {
          await tx
            .delete(productChannels)
            .where(and(eq(productChannels.productId, productId), eq(productChannels.channelId, c.channelId)));
        }
      }
      await logActivity(tx, { actorId: user.id, action: "product.updated", productId });
    });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function addTemplateSlots(productId: string) {
  const result = await attempt(async () => {
    const user = await authorize("manage_catalog");
    const id = z.string().uuid().parse(productId);
    const n = await createAssetSlots(db, id, await getSetting("assetTemplate"), user.id);
    if (n) await logActivity(db, { actorId: user.id, action: "product.slots_added", productId: id, meta: { count: n } });
    return { count: n };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function setProductArchived(productId: string, archived: boolean) {
  const result = await attempt(async () => {
    const user = await authorize("manage_catalog");
    const id = z.string().uuid().parse(productId);
    await db.update(products).set({ archived, updatedAt: new Date() }).where(eq(products.id, id));
    await logActivity(db, { actorId: user.id, action: archived ? "product.archived" : "product.restored", productId: id });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function importProducts(_prev: unknown, formData: FormData) {
  const result = await attempt<ImportReport>(async () => {
    const user = await authorize("manage_catalog");
    const file = formData.get("file");
    let csv = String(formData.get("csv") ?? "");
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) throw new UserError("CSV files must be under 5 MB.");
      csv = await file.text();
    }
    if (!csv.trim()) throw new UserError("Choose a CSV file or paste CSV text.");
    const template = formData.get("useTemplate") === "on" ? await getSetting("assetTemplate") : [];
    const report = await importProductsCsv(csv, user.id, template);
    await logActivity(db, {
      actorId: user.id,
      action: "product.imported",
      meta: { created: report.created, updated: report.updated, slots: report.slots },
    });
    return report;
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
