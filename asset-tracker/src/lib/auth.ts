import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { can, type Action } from "@/lib/domain";
import { env } from "@/lib/env";
import { UserError } from "@/lib/errors";

export const SESSION_COOKIE = "ct_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  // Opportunistic cleanup so the table doesn't grow forever.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in, active user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user || !user.active) return null;
  // Throttle last-seen writes to once every 10 minutes.
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 600_000) {
    await db.update(users).set({ lastSeenAt: sql`now()` }).where(eq(users.id, user.id));
  }
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function authorize(action: Action): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UserError("You are signed out. Refresh the page and sign in again.");
  if (!can(user, action)) throw new UserError("You don't have permission to do that.");
  return user;
}

export async function requireAdminPage(): Promise<User> {
  const user = await requireUser();
  if (!can(user, "admin")) redirect("/");
  return user;
}

/**
 * Decide whether a Google account may sign in, creating the user on first login
 * when their email domain is allowed. Returns null when access is refused.
 */
export async function findOrCreateUserForLogin(profile: {
  email: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<User | null> {
  const email = profile.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  const forceAdmin = env.adminEmails.includes(email);

  if (existing) {
    if (!existing.active) return null;
    const [updated] = await db
      .update(users)
      .set({
        avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
        // Keep an admin-assigned name if they already have one.
        name: existing.name || profile.name,
        role: forceAdmin ? "admin" : existing.role,
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const domain = email.split("@")[1] ?? "";
  if (!forceAdmin && !env.allowedDomains.includes(domain)) return null;

  // The very first person in becomes admin so someone can configure the workspace.
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [created] = await db
    .insert(users)
    .values({
      email,
      name: profile.name || email.split("@")[0],
      avatarUrl: profile.avatarUrl ?? null,
      role: forceAdmin || count === 0 ? "admin" : "member",
    })
    .returning();
  return created;
}
