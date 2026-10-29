import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, type Db } from "@/db";
import { activity, notifications, users } from "@/db/schema";
import { env } from "@/lib/env";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function logActivity(
  tx: Db | Tx,
  entry: {
    actorId: string | null;
    action: string;
    productId?: string | null;
    assetId?: string | null;
    versionId?: string | null;
    channelId?: string | null;
    requestId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  await tx.insert(activity).values(entry);
}

export type Notice = {
  /** Shown in the bell, the email subject and the Slack message. */
  title: string;
  body?: string;
  /** App path, e.g. /assets/123 */
  href: string;
  recipientIds: (string | null | undefined)[];
  /** Never notify the person who did the thing. */
  actorId: string;
  /** Post to the shared Slack channel too (for events the whole company cares about). */
  slack?: boolean;
};

/**
 * Store in-app notifications, then fan out to email and Slack. External delivery
 * is best effort: a broken SMTP server must never fail an upload.
 */
export async function notify(notice: Notice) {
  const ids = [...new Set(notice.recipientIds.filter((id): id is string => Boolean(id)))].filter(
    (id) => id !== notice.actorId,
  );
  let recipients: { id: string; email: string; name: string; emailNotifications: boolean }[] = [];
  if (ids.length) {
    recipients = await db
      .select({ id: users.id, email: users.email, name: users.name, emailNotifications: users.emailNotifications })
      .from(users)
      .where(and(inArray(users.id, ids), eq(users.active, true), ne(users.id, notice.actorId)));
    if (recipients.length) {
      await db.insert(notifications).values(
        recipients.map((r) => ({ userId: r.id, title: notice.title, body: notice.body, href: notice.href })),
      );
    }
  }

  const link = `${env.appUrl}${notice.href}`;
  const jobs: Promise<unknown>[] = [];
  const emailTo = recipients.filter((r) => r.emailNotifications).map((r) => r.email);
  if (env.smtp.host && emailTo.length) jobs.push(sendEmail(emailTo, notice.title, notice.body, link));
  if (notice.slack && env.slackWebhookUrl) jobs.push(postSlack(notice.title, notice.body, link));
  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") console.error("[notify] delivery failed:", r.reason);
  }
}

let transport: Transporter | null = null;
async function sendEmail(to: string[], subject: string, body: string | undefined, link: string) {
  transport ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  const text = `${body ? `${body}\n\n` : ""}Open: ${link}`;
  const html = `<p style="font:14px/1.5 system-ui,sans-serif">${escapeHtml(body ?? "")}</p>
<p><a href="${escapeHtml(link)}" style="font:14px system-ui,sans-serif">Open in Creative Tracker →</a></p>`;
  // BCC so recipients don't see each other's addresses.
  await transport.sendMail({ from: env.smtp.from, to: env.smtp.from, bcc: to, subject, text, html });
}

async function postSlack(title: string, body: string | undefined, link: string) {
  const res = await fetch(env.slackWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: title,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*<${link}|${escapeSlack(title)}>*${body ? `\n${escapeSlack(body)}` : ""}` },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Slack responded ${res.status}`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function escapeSlack(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
