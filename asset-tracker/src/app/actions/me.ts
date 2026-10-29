"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications, userChannels, users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { attempt, UserError } from "@/lib/errors";

export async function devLogin(formData: FormData) {
  if (!env.devLogin) throw new Error("Dev login is disabled");
  const userId = z.string().uuid().parse(formData.get("userId"));
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !user.active) redirect("/login?error=inactive");
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function savePreferences(_prev: unknown, formData: FormData) {
  const result = await attempt(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UserError("You are signed out.");
    const channelIds = z.array(z.string().uuid()).parse(formData.getAll("channelIds"));
    const emailNotifications = formData.get("emailNotifications") === "on";
    await db.update(users).set({ emailNotifications }).where(eq(users.id, user.id));
    await db.transaction(async (tx) => {
      await tx.delete(userChannels).where(eq(userChannels.userId, user.id));
      if (channelIds.length) {
        await tx.insert(userChannels).values(channelIds.map((channelId) => ({ userId: user.id, channelId })));
      }
    });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, z.string().uuid().parse(id)), eq(notifications.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}
