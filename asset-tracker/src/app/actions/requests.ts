"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assets, comments, priorityEnum, products, requestStatusEnum, requests, users } from "@/db/schema";
import { authorize } from "@/lib/auth";
import { REQUEST_STATUS_LABEL } from "@/lib/domain";
import { attempt, UserError } from "@/lib/errors";
import { logActivity, notify } from "@/lib/notify";

const uuid = z.string().uuid();

const requestInput = z.object({
  type: z.enum(["new_creative", "correction"]),
  title: z.string().trim().min(3, "Give the request a short title").max(200),
  description: z.string().trim().max(4000).optional(),
  productId: uuid,
  assetId: uuid.nullable(),
  assigneeId: uuid.nullable(),
  priority: z.enum(priorityEnum.enumValues),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export async function createRequest(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await authorize("request");
    const parsed = requestInput.safeParse({
      type: formData.get("type"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      productId: formData.get("productId"),
      assetId: formData.get("assetId") || null,
      assigneeId: formData.get("assigneeId") || null,
      priority: formData.get("priority") || "normal",
      dueDate: formData.get("dueDate") || null,
    });
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form");
    const input = parsed.data;
    const product = await db.query.products.findFirst({ where: eq(products.id, input.productId) });
    if (!product) throw new UserError("Pick a product.");
    let assigneeId = input.assigneeId;
    if (input.assetId) {
      const asset = await db.query.assets.findFirst({
        where: and(eq(assets.id, input.assetId), eq(assets.productId, input.productId)),
      });
      if (!asset) throw new UserError("That asset doesn't belong to the chosen product.");
      assigneeId ??= asset.assigneeId;
    }
    let id = "";
    await db.transaction(async (tx) => {
      const [req] = await tx
        .insert(requests)
        .values({ ...input, assigneeId, description: input.description ?? null, requestedById: user.id })
        .returning();
      id = req.id;
      if (input.type === "correction" && input.assetId) {
        await tx
          .update(assets)
          .set({ status: "needs_correction", updatedAt: new Date() })
          .where(eq(assets.id, input.assetId));
      }
      await logActivity(tx, {
        actorId: user.id,
        action: "request.created",
        productId: input.productId,
        assetId: input.assetId,
        requestId: req.id,
        meta: { title: input.title, type: input.type },
      });
    });
    const designers = assigneeId
      ? [assigneeId]
      : (await db.select({ id: users.id }).from(users).where(and(eq(users.role, "designer"), eq(users.active, true)))).map(
          (u) => u.id,
        );
    await notify({
      title: `${input.priority === "urgent" ? "URGENT " : ""}New request: ${input.title}`,
      body: `${product.name}${input.description ? ` — ${input.description}` : ""}`,
      href: `/requests?open=${id}`,
      recipientIds: designers,
      actorId: user.id,
      slack: input.priority === "urgent",
    });
    return { id };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function setRequestStatus(requestId: string, status: string) {
  const result = await attempt(async () => {
    const user = await authorize("request");
    const id = uuid.parse(requestId);
    const next = z.enum(requestStatusEnum.enumValues).parse(status);
    const req = await db.query.requests.findFirst({ where: eq(requests.id, id) });
    if (!req) throw new UserError("Request not found.");
    const closing = next === "done" || next === "cancelled";
    await db.transaction(async (tx) => {
      await tx
        .update(requests)
        .set({
          status: next,
          closedAt: closing ? new Date() : null,
          updatedAt: new Date(),
          // Starting work on an unassigned request claims it.
          assigneeId: next === "in_progress" && !req.assigneeId ? user.id : req.assigneeId,
        })
        .where(eq(requests.id, id));
      await logActivity(tx, {
        actorId: user.id,
        action: "request.status",
        productId: req.productId,
        assetId: req.assetId,
        requestId: id,
        meta: { status: next, title: req.title },
      });
    });
    if (closing || next === "in_progress") {
      await notify({
        title: `${req.title}: ${REQUEST_STATUS_LABEL[next]}`,
        body: `Updated by ${user.name}`,
        href: `/requests?open=${id}`,
        recipientIds: [req.requestedById, req.assigneeId],
        actorId: user.id,
      });
    }
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function assignRequest(requestId: string, assigneeId: string | null) {
  const result = await attempt(async () => {
    const user = await authorize("request");
    const id = uuid.parse(requestId);
    const to = assigneeId ? uuid.parse(assigneeId) : null;
    const [req] = await db
      .update(requests)
      .set({ assigneeId: to, updatedAt: new Date() })
      .where(eq(requests.id, id))
      .returning();
    if (!req) throw new UserError("Request not found.");
    if (to) {
      await notify({
        title: `Assigned to you: ${req.title}`,
        href: `/requests?open=${id}`,
        recipientIds: [to],
        actorId: user.id,
      });
    }
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function addRequestComment(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await authorize("comment");
    const id = uuid.parse(formData.get("requestId"));
    const body = String(formData.get("body") ?? "").trim();
    if (!body) throw new UserError("Write a comment first.");
    const req = await db.query.requests.findFirst({ where: eq(requests.id, id) });
    if (!req) throw new UserError("Request not found.");
    await db.insert(comments).values({ requestId: id, assetId: req.assetId, authorId: user.id, body });
    await notify({
      title: `${user.name} commented on “${req.title}”`,
      body,
      href: `/requests?open=${id}`,
      recipientIds: [req.requestedById, req.assigneeId],
      actorId: user.id,
    });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Asset choices for the "new request" form once a product is picked. */
export async function listAssetOptions(productId: string) {
  await authorize("request");
  return db.query.assets.findMany({
    where: and(eq(assets.productId, uuid.parse(productId)), eq(assets.archived, false)),
    columns: { id: true, name: true },
    orderBy: (a, { asc }) => [asc(a.name)],
  });
}
