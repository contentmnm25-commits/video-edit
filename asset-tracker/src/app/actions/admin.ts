"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channels, roleEnum, teamEnum, userChannels, users } from "@/db/schema";
import { authorize } from "@/lib/auth";
import { slugify } from "@/lib/domain";
import { attempt, UserError } from "@/lib/errors";
import { logActivity } from "@/lib/notify";
import { setSetting } from "@/lib/settings";

const uuid = z.string().uuid();
const refresh = () => revalidatePath("/", "layout");

const userInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.enum(roleEnum.enumValues),
  team: z.enum(teamEnum.enumValues).nullable(),
  channelIds: z.array(uuid),
});

function readUserForm(formData: FormData) {
  const parsed = userInput.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    team: formData.get("team") || null,
    channelIds: formData.getAll("channelIds"),
  });
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form");
  return parsed.data;
}

async function replaceUserChannels(userId: string, channelIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(userChannels).where(eq(userChannels.userId, userId));
    if (channelIds.length) await tx.insert(userChannels).values(channelIds.map((channelId) => ({ userId, channelId })));
  });
}

/** Add someone ahead of their first sign-in (needed when their domain isn't auto-allowed). */
export async function inviteUser(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const admin = await authorize("admin");
    const email = z.string().trim().toLowerCase().email("Enter a valid email").parse(formData.get("email"));
    const input = readUserForm(formData);
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new UserError(`${email} already has access.`);
    const [u] = await db.insert(users).values({ email, name: input.name, role: input.role, team: input.team }).returning();
    await replaceUserChannels(u.id, input.channelIds);
    await logActivity(db, { actorId: admin.id, action: "user.invited", meta: { email, role: input.role } });
  });
  if (result.ok) refresh();
  return result;
}

export async function updateUser(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const admin = await authorize("admin");
    const userId = uuid.parse(formData.get("userId"));
    const input = readUserForm(formData);
    const active = formData.get("active") === "on";
    if (userId === admin.id && (input.role !== "admin" || !active)) {
      throw new UserError("You can't remove your own admin access. Ask another admin.");
    }
    if (input.role !== "admin" || !active) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, userId)));
      if (n === 0) throw new UserError("There must be at least one active admin.");
    }
    await db.update(users).set({ name: input.name, role: input.role, team: input.team, active }).where(eq(users.id, userId));
    await replaceUserChannels(userId, input.channelIds);
    await logActivity(db, { actorId: admin.id, action: "user.updated", meta: { userId, role: input.role, active } });
  });
  if (result.ok) refresh();
  return result;
}

const channelInput = z.object({
  name: z.string().trim().min(1, "Channel name is required").max(60),
  idLabel: z.string().trim().max(30).nullable(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveChannel(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const admin = await authorize("admin");
    const id = formData.get("channelId") ? uuid.parse(formData.get("channelId")) : null;
    const parsed = channelInput.safeParse({
      name: formData.get("name"),
      idLabel: formData.get("idLabel") || null,
      sortOrder: formData.get("sortOrder") || 0,
    });
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form");
    const input = parsed.data;
    if (id) {
      const active = formData.get("active") === "on";
      await db.update(channels).set({ ...input, active }).where(eq(channels.id, id));
    } else {
      const slug = slugify(input.name).toLowerCase() || "channel";
      const clash = await db.query.channels.findFirst({ where: eq(channels.slug, slug) });
      if (clash) throw new UserError(`A channel called ${clash.name} already exists.`);
      await db.insert(channels).values({ ...input, slug });
    }
    await logActivity(db, { actorId: admin.id, action: id ? "channel.updated" : "channel.created", meta: { name: input.name } });
  });
  if (result.ok) refresh();
  return result;
}

export async function saveWorkspaceSettings(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const admin = await authorize("admin");
    const requireApproval = formData.get("requireApproval") === "on";
    const workspaceName = z.string().trim().min(1).max(60).parse(formData.get("workspaceName") || "Creative Tracker");
    const assetTemplate = String(formData.get("assetTemplate") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    await setSetting("requireApproval", requireApproval);
    await setSetting("workspaceName", workspaceName);
    await setSetting("assetTemplate", assetTemplate);
    await logActivity(db, { actorId: admin.id, action: "settings.updated", meta: { requireApproval } });
  });
  if (result.ok) refresh();
  return result;
}
