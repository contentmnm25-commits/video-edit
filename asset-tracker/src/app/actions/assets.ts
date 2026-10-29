"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assetChannels,
  assetTypeEnum,
  assets,
  channels,
  comments,
  products,
  requests,
  userChannels,
  users,
  versions,
} from "@/db/schema";
import { authorize } from "@/lib/auth";
import { afterUpload, approvalBecomesCurrent } from "@/lib/domain";
import { env } from "@/lib/env";
import { attempt, UserError } from "@/lib/errors";
import { logActivity, notify } from "@/lib/notify";
import { getSetting } from "@/lib/settings";
import { createUploadTarget, keyBelongsToAsset, objectSize, safeFileName, type UploadTarget } from "@/lib/storage";

const uuid = z.string().uuid();

function refresh() {
  revalidatePath("/", "layout");
}

async function loadAsset(assetId: string) {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
    with: { product: { columns: { id: true, name: true, sku: true } } },
  });
  if (!asset) throw new UserError("That asset no longer exists.");
  return asset;
}

const label = (a: { name: string; product: { name: string } }) => `${a.product.name} — ${a.name}`;

/** People who look after any of the asset's channels. They are the ones who must publish. */
async function channelOwnerIds(assetId: string) {
  const rows = await db
    .selectDistinct({ id: userChannels.userId })
    .from(userChannels)
    .innerJoin(assetChannels, eq(assetChannels.channelId, userChannels.channelId))
    .where(eq(assetChannels.assetId, assetId));
  return rows.map((r) => r.id);
}

async function idsWithRole(roles: ("admin" | "reviewer" | "designer")[]) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, roles), eq(users.active, true)));
  return rows.map((r) => r.id);
}

// ─── Create / edit ─────────────────────────────────────────────────────

const assetInput = z.object({
  name: z.string().trim().min(1, "Give the asset a name").max(120),
  type: z.enum(assetTypeEnum.enumValues),
  assigneeId: uuid.nullable(),
  channelIds: z.array(uuid),
});

function readAssetForm(formData: FormData) {
  const parsed = assetInput.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    assigneeId: formData.get("assigneeId") || null,
    channelIds: formData.getAll("channelIds"),
  });
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form");
  return parsed.data;
}

export async function createAsset(_prev: unknown, formData: FormData) {
  let id = "";
  const result = await attempt(async () => {
    const user = await authorize("manage_catalog");
    const productId = uuid.parse(formData.get("productId"));
    const requestId = formData.get("requestId") ? uuid.parse(formData.get("requestId")) : null;
    const input = readAssetForm(formData);
    const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) throw new UserError("Product not found.");
    const clash = await db.query.assets.findFirst({
      where: and(eq(assets.productId, productId), eq(assets.name, input.name)),
    });
    if (clash) {
      throw new UserError(
        `"${input.name}" already exists for this product. Upload a new version of it instead of creating a duplicate.`,
      );
    }
    await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({ productId, name: input.name, type: input.type, assigneeId: input.assigneeId, createdById: user.id })
        .returning();
      id = asset.id;
      if (input.channelIds.length) {
        await tx.insert(assetChannels).values(input.channelIds.map((channelId) => ({ assetId: asset.id, channelId })));
      }
      if (requestId) {
        await tx
          .update(requests)
          .set({ assetId: asset.id, status: "in_progress", updatedAt: new Date() })
          .where(and(eq(requests.id, requestId), eq(requests.productId, productId)));
      }
      await logActivity(tx, { actorId: user.id, action: "asset.created", productId, assetId: asset.id });
    });
    if (input.assigneeId) {
      await notify({
        title: `You were assigned ${product.name} — ${input.name}`,
        href: `/assets/${id}`,
        recipientIds: [input.assigneeId],
        actorId: user.id,
      });
    }
  });
  if (!result.ok) return result;
  refresh();
  redirect(`/assets/${id}`);
}

export async function updateAsset(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await authorize("manage_catalog");
    const assetId = uuid.parse(formData.get("assetId"));
    const input = readAssetForm(formData);
    const asset = await loadAsset(assetId);
    if (input.name !== asset.name) {
      const clash = await db.query.assets.findFirst({
        where: and(eq(assets.productId, asset.productId), eq(assets.name, input.name)),
      });
      if (clash) throw new UserError(`"${input.name}" already exists for this product.`);
    }
    await db.transaction(async (tx) => {
      await tx
        .update(assets)
        .set({ name: input.name, type: input.type, assigneeId: input.assigneeId, updatedAt: new Date() })
        .where(eq(assets.id, assetId));
      const existing = await tx.select().from(assetChannels).where(eq(assetChannels.assetId, assetId));
      const keep = new Set(input.channelIds);
      const removed = existing.filter((c) => !keep.has(c.channelId)).map((c) => c.channelId);
      const added = input.channelIds.filter((id) => !existing.some((c) => c.channelId === id));
      if (removed.length) {
        await tx
          .delete(assetChannels)
          .where(and(eq(assetChannels.assetId, assetId), inArray(assetChannels.channelId, removed)));
      }
      if (added.length) {
        await tx.insert(assetChannels).values(added.map((channelId) => ({ assetId, channelId })));
      }
      await logActivity(tx, { actorId: user.id, action: "asset.updated", productId: asset.productId, assetId });
    });
    if (input.assigneeId && input.assigneeId !== asset.assigneeId) {
      await notify({
        title: `You were assigned ${label(asset)}`,
        href: `/assets/${assetId}`,
        recipientIds: [input.assigneeId],
        actorId: user.id,
      });
    }
  });
  if (result.ok) refresh();
  return result;
}

export async function setAssetArchived(assetId: string, archived: boolean) {
  const result = await attempt(async () => {
    const user = await authorize("manage_catalog");
    const asset = await loadAsset(uuid.parse(assetId));
    await db.update(assets).set({ archived, updatedAt: new Date() }).where(eq(assets.id, asset.id));
    await logActivity(db, {
      actorId: user.id,
      action: archived ? "asset.archived" : "asset.restored",
      productId: asset.productId,
      assetId: asset.id,
    });
  });
  if (result.ok) refresh();
  return result;
}

// ─── Upload a new version ──────────────────────────────────────────────

const prepareInput = z.object({
  assetId: uuid,
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive(),
  withThumb: z.boolean(),
});

/** Step 1: get URLs the browser can PUT the file (and its thumbnail) to. */
export async function prepareUpload(input: z.infer<typeof prepareInput>) {
  return attempt(async () => {
    await authorize("upload");
    const data = prepareInput.parse(input);
    await loadAsset(data.assetId);
    if (data.size > env.maxUploadBytes) {
      throw new UserError(`That file is over the ${Math.round(env.maxUploadBytes / 1024 / 1024)} MB limit.`);
    }
    const folder = `assets/${data.assetId}/${randomUUID()}`;
    const fileKey = `${folder}/${safeFileName(data.fileName)}`;
    const thumbKey = data.withThumb ? `${folder}/thumb.jpg` : null;
    const file: UploadTarget = await createUploadTarget(fileKey, data.contentType);
    const thumb: UploadTarget | null = thumbKey ? await createUploadTarget(thumbKey, "image/jpeg") : null;
    return { fileKey, thumbKey, file, thumb };
  });
}

const versionInput = z.object({
  assetId: uuid,
  fileKey: z.string(),
  thumbKey: z.string().nullable(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSec: z.number().nonnegative().nullable(),
  note: z.string().trim().min(3, "Say what changed in this version (at least a few words)").max(2000),
});

/** Step 2: once the bytes are in storage, record the version and tell people. */
export async function createVersion(input: z.infer<typeof versionInput>) {
  const result = await attempt(async () => {
    const user = await authorize("upload");
    const parsed = versionInput.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form");
    const data = parsed.data;
    if (!keyBelongsToAsset(data.fileKey, data.assetId)) throw new UserError("Upload doesn't match this asset.");
    if (data.thumbKey && !keyBelongsToAsset(data.thumbKey, data.assetId)) throw new UserError("Bad thumbnail.");
    const size = await objectSize(data.fileKey);
    if (size == null) throw new UserError("The file didn't finish uploading. Please try again.");
    const thumbKey = data.thumbKey && (await objectSize(data.thumbKey)) != null ? data.thumbKey : null;

    const asset = await loadAsset(data.assetId);
    const requireApproval = await getSetting("requireApproval");
    const outcome = afterUpload(requireApproval);

    const { version, resolvedRequests } = await db.transaction(async (tx) => {
      // Lock the asset row so two simultaneous uploads can't both become "v4".
      await tx.execute(sql`select id from ${assets} where ${assets.id} = ${asset.id} for update`);
      const [{ last }] = await tx
        .select({ last: max(versions.number) })
        .from(versions)
        .where(eq(versions.assetId, asset.id));
      const [version] = await tx
        .insert(versions)
        .values({
          assetId: asset.id,
          number: (last ?? 0) + 1,
          fileKey: data.fileKey,
          fileName: data.fileName,
          mimeType: data.mimeType,
          sizeBytes: size,
          width: data.width,
          height: data.height,
          durationSec: data.durationSec,
          thumbKey,
          note: data.note,
          review: outcome.review,
          reviewedById: outcome.review === "approved" ? user.id : null,
          reviewedAt: outcome.review === "approved" ? new Date() : null,
          uploadedById: user.id,
        })
        .returning();
      await tx
        .update(assets)
        .set({
          status: outcome.assetStatus,
          updatedAt: new Date(),
          ...(outcome.becomesCurrent ? { currentVersionId: version.id } : {}),
        })
        .where(eq(assets.id, asset.id));

      // Uploading answers any open request for this asset; nobody has to close it by hand.
      let resolvedRequests: { id: string; requestedById: string | null }[] = [];
      if (outcome.becomesCurrent) {
        resolvedRequests = await tx
          .update(requests)
          .set({ status: "done", resolvedVersionId: version.id, closedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(requests.assetId, asset.id), inArray(requests.status, ["open", "in_progress"])))
          .returning({ id: requests.id, requestedById: requests.requestedById });
      }
      await logActivity(tx, {
        actorId: user.id,
        action: outcome.becomesCurrent ? "version.published" : "version.submitted",
        productId: asset.productId,
        assetId: asset.id,
        versionId: version.id,
        meta: { number: version.number, note: data.note },
      });
      return { version, resolvedRequests };
    });

    if (outcome.becomesCurrent) {
      await announceNewCurrent(asset, version, user.id, resolvedRequests.map((r) => r.requestedById));
    } else {
      await notify({
        title: `Review needed: ${label(asset)} v${version.number}`,
        body: data.note,
        href: `/assets/${asset.id}`,
        recipientIds: await idsWithRole(["reviewer", "admin"]),
        actorId: user.id,
      });
    }
    return { versionId: version.id, number: version.number };
  });
  if (result.ok) refresh();
  return result;
}

async function announceNewCurrent(
  asset: Awaited<ReturnType<typeof loadAsset>>,
  version: { id: string; number: number; note: string; uploadedById: string | null },
  actorId: string,
  extraRecipients: (string | null)[] = [],
) {
  const channelRows = await db
    .select({ name: channels.name })
    .from(assetChannels)
    .innerJoin(channels, eq(channels.id, assetChannels.channelId))
    .where(and(eq(assetChannels.assetId, asset.id), eq(channels.active, true)))
    .orderBy(channels.sortOrder);
  const where = channelRows.length ? ` Update it on: ${channelRows.map((c) => c.name).join(", ")}.` : "";
  await notify({
    title: `${label(asset)} → v${version.number} ready to publish`,
    body: `What changed: ${version.note}.${where}`,
    href: `/assets/${asset.id}`,
    recipientIds: [...(await channelOwnerIds(asset.id)), ...extraRecipients, version.uploadedById, asset.assigneeId],
    actorId,
    slack: true,
  });
}

// ─── Review ────────────────────────────────────────────────────────────

export async function reviewVersion(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await authorize("review");
    const versionId = uuid.parse(formData.get("versionId"));
    const decision = z.enum(["approve", "reject"]).parse(formData.get("decision"));
    const note = String(formData.get("note") ?? "").trim();
    if (decision === "reject" && note.length < 3) throw new UserError("Tell the designer what needs to change.");

    const version = await db.query.versions.findFirst({ where: eq(versions.id, versionId) });
    if (!version) throw new UserError("Version not found.");
    if (version.review !== "pending") throw new UserError("This version has already been reviewed.");
    const asset = await loadAsset(version.assetId);

    let becameCurrent = false;
    let resolved: { requestedById: string | null }[] = [];
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from ${assets} where ${assets.id} = ${asset.id} for update`);
      const fresh = await tx.query.assets.findFirst({
        where: eq(assets.id, asset.id),
        with: { currentVersion: { columns: { number: true } } },
      });
      await tx
        .update(versions)
        .set({
          review: decision === "approve" ? "approved" : "rejected",
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: note || null,
        })
        .where(eq(versions.id, version.id));

      const stillPending = await tx.query.versions.findFirst({
        where: and(eq(versions.assetId, asset.id), eq(versions.review, "pending")),
        columns: { id: true },
      });

      if (decision === "approve") {
        becameCurrent = approvalBecomesCurrent(version.number, fresh?.currentVersion?.number);
        await tx
          .update(assets)
          .set({
            status: stillPending ? "in_review" : "ready",
            updatedAt: new Date(),
            ...(becameCurrent ? { currentVersionId: version.id } : {}),
          })
          .where(eq(assets.id, asset.id));
        if (becameCurrent) {
          resolved = await tx
            .update(requests)
            .set({ status: "done", resolvedVersionId: version.id, closedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(requests.assetId, asset.id), inArray(requests.status, ["open", "in_progress"])))
            .returning({ requestedById: requests.requestedById });
        }
      } else {
        await tx
          .update(assets)
          .set({ status: stillPending ? "in_review" : "needs_correction", updatedAt: new Date() })
          .where(eq(assets.id, asset.id));
        await tx.insert(comments).values({ assetId: asset.id, versionId: version.id, authorId: user.id, body: note });
      }
      await logActivity(tx, {
        actorId: user.id,
        action: decision === "approve" ? "version.approved" : "version.rejected",
        productId: asset.productId,
        assetId: asset.id,
        versionId: version.id,
        meta: { number: version.number, note },
      });
    });

    if (decision === "approve" && becameCurrent) {
      await announceNewCurrent(asset, version, user.id, resolved.map((r) => r.requestedById));
    } else if (decision === "reject") {
      await notify({
        title: `Changes requested: ${label(asset)} v${version.number}`,
        body: note,
        href: `/assets/${asset.id}`,
        recipientIds: [version.uploadedById, asset.assigneeId],
        actorId: user.id,
      });
    }
  });
  if (result.ok) refresh();
  return result;
}

/** Make an older approved version current again (rollback). */
export async function setCurrentVersion(versionId: string) {
  const result = await attempt(async () => {
    const user = await authorize("set_current");
    const version = await db.query.versions.findFirst({ where: eq(versions.id, uuid.parse(versionId)) });
    if (!version) throw new UserError("Version not found.");
    if (version.review !== "approved") throw new UserError("Only approved versions can be made current.");
    const asset = await loadAsset(version.assetId);
    if (asset.currentVersionId === version.id) return;
    await db.transaction(async (tx) => {
      await tx
        .update(assets)
        .set({ currentVersionId: version.id, status: "ready", updatedAt: new Date() })
        .where(eq(assets.id, asset.id));
      await logActivity(tx, {
        actorId: user.id,
        action: "version.made_current",
        productId: asset.productId,
        assetId: asset.id,
        versionId: version.id,
        meta: { number: version.number },
      });
    });
    await announceNewCurrent(
      asset,
      { ...version, note: `Rolled back to v${version.number} (${version.note})` },
      user.id,
    );
  });
  if (result.ok) refresh();
  return result;
}

// ─── Publishing status per channel ─────────────────────────────────────

/** "I've uploaded the current version to these channels." */
export async function markLive(assetId: string, channelIds: string[]) {
  const result = await attempt(async () => {
    const user = await authorize("mark_live");
    const asset = await loadAsset(uuid.parse(assetId));
    const ids = z.array(uuid).min(1).parse(channelIds);
    if (!asset.currentVersionId) throw new UserError("There is no approved version to publish yet.");
    const current = await db.query.versions.findFirst({ where: eq(versions.id, asset.currentVersionId) });
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(assetChannels)
        .set({ liveVersionId: asset.currentVersionId, liveAt: new Date(), liveById: user.id })
        .where(and(eq(assetChannels.assetId, asset.id), inArray(assetChannels.channelId, ids)))
        .returning({ channelId: assetChannels.channelId });
      for (const row of updated) {
        await logActivity(tx, {
          actorId: user.id,
          action: "channel.marked_live",
          productId: asset.productId,
          assetId: asset.id,
          versionId: asset.currentVersionId,
          channelId: row.channelId,
          meta: { number: current?.number },
        });
      }
    });
  });
  if (result.ok) refresh();
  return result;
}

/** Many assets at once on one channel, from the channel queue. */
export async function bulkMarkLive(channelId: string, assetIds: string[]) {
  const result = await attempt(async () => {
    const user = await authorize("mark_live");
    const cId = uuid.parse(channelId);
    const ids = z.array(uuid).min(1).max(500).parse(assetIds);
    const targets = await db
      .select({ id: assets.id, productId: assets.productId, currentVersionId: assets.currentVersionId })
      .from(assets)
      .where(and(inArray(assets.id, ids), sql`${assets.currentVersionId} is not null`));
    await db.transaction(async (tx) => {
      for (const a of targets) {
        const updated = await tx
          .update(assetChannels)
          .set({ liveVersionId: a.currentVersionId, liveAt: new Date(), liveById: user.id })
          .where(and(eq(assetChannels.assetId, a.id), eq(assetChannels.channelId, cId)))
          .returning({ assetId: assetChannels.assetId });
        if (updated.length) {
          await logActivity(tx, {
            actorId: user.id,
            action: "channel.marked_live",
            productId: a.productId,
            assetId: a.id,
            versionId: a.currentVersionId,
            channelId: cId,
          });
        }
      }
    });
    return { count: targets.length };
  });
  if (result.ok) refresh();
  return result;
}

/** Undo a mistaken "mark live", or record that the creative was taken down. */
export async function clearLive(assetId: string, channelId: string) {
  const result = await attempt(async () => {
    const user = await authorize("mark_live");
    const asset = await loadAsset(uuid.parse(assetId));
    const cId = uuid.parse(channelId);
    await db.transaction(async (tx) => {
      await tx
        .update(assetChannels)
        .set({ liveVersionId: null, liveAt: null, liveById: null })
        .where(and(eq(assetChannels.assetId, asset.id), eq(assetChannels.channelId, cId)));
      await logActivity(tx, {
        actorId: user.id,
        action: "channel.cleared",
        productId: asset.productId,
        assetId: asset.id,
        channelId: cId,
      });
    });
  });
  if (result.ok) refresh();
  return result;
}

// ─── Corrections & comments ────────────────────────────────────────────

export async function flagCorrection(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await authorize("flag_correction");
    const asset = await loadAsset(uuid.parse(formData.get("assetId")));
    const note = String(formData.get("note") ?? "").trim();
    const priority = z.enum(["low", "normal", "high", "urgent"]).parse(formData.get("priority") || "normal");
    if (note.length < 3) throw new UserError("Describe what needs to be corrected.");
    let requestId = "";
    await db.transaction(async (tx) => {
      await tx.update(assets).set({ status: "needs_correction", updatedAt: new Date() }).where(eq(assets.id, asset.id));
      const [req] = await tx
        .insert(requests)
        .values({
          type: "correction",
          priority,
          title: `Correction: ${asset.name}`,
          description: note,
          productId: asset.productId,
          assetId: asset.id,
          requestedById: user.id,
          assigneeId: asset.assigneeId,
        })
        .returning();
      requestId = req.id;
      await tx.insert(comments).values({
        assetId: asset.id,
        versionId: asset.currentVersionId,
        requestId: req.id,
        authorId: user.id,
        body: note,
      });
      await logActivity(tx, {
        actorId: user.id,
        action: "asset.correction_flagged",
        productId: asset.productId,
        assetId: asset.id,
        requestId: req.id,
        meta: { note, priority },
      });
    });
    const lastUploader = await db.query.versions.findFirst({
      where: eq(versions.assetId, asset.id),
      orderBy: [desc(versions.number)],
      columns: { uploadedById: true },
    });
    await notify({
      title: `${priority === "urgent" ? "URGENT " : ""}Correction needed: ${label(asset)}`,
      body: note,
      href: `/assets/${asset.id}`,
      recipientIds: asset.assigneeId
        ? [asset.assigneeId, lastUploader?.uploadedById]
        : [lastUploader?.uploadedById, ...(await idsWithRole(["designer"]))],
      actorId: user.id,
      slack: priority === "urgent",
    });
    return { requestId };
  });
  if (result.ok) refresh();
  return result;
}

export async function addComment(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await authorize("comment");
    const asset = await loadAsset(uuid.parse(formData.get("assetId")));
    const versionId = formData.get("versionId") ? uuid.parse(formData.get("versionId")) : null;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) throw new UserError("Write a comment first.");
    if (body.length > 4000) throw new UserError("That comment is too long.");
    await db.insert(comments).values({ assetId: asset.id, versionId, authorId: user.id, body });
    const participants = await db
      .selectDistinct({ id: comments.authorId })
      .from(comments)
      .where(eq(comments.assetId, asset.id));
    await notify({
      title: `${user.name} commented on ${label(asset)}`,
      body,
      href: `/assets/${asset.id}#comments`,
      recipientIds: [asset.assigneeId, ...participants.map((p) => p.id)],
      actorId: user.id,
    });
  });
  if (result.ok) refresh();
  return result;
}

/** Used by the upload dialog to warn about duplicate uploads of the same file. */
export async function findVersionByName(assetId: string, fileName: string) {
  await authorize("upload");
  return db.query.versions.findFirst({
    where: and(eq(versions.assetId, uuid.parse(assetId)), eq(versions.fileName, fileName)),
    columns: { number: true },
  });
}
