import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { MarkAllReadButton, NotificationLink } from "@/components/notification-buttons";
import { cx, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/domain";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const list = await db.query.notifications.findMany({
    where: eq(notifications.userId, user.id),
    orderBy: [desc(notifications.createdAt)],
    limit: 100,
  });
  const unread = list.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={unread > 0 && <MarkAllReadButton />}
      />
      <div className="card overflow-hidden">
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id} className={cx(!n.readAt && "bg-indigo-50/40")}>
                <NotificationLink id={n.id} href={n.href ?? "/"} unread={!n.readAt}>
                  <div className="flex gap-3">
                    <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} />
                    <div className="min-w-0">
                      <p className={cx("text-sm", !n.readAt && "font-semibold")}>{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}
                      <p className="mt-0.5 text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </NotificationLink>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Bell className="size-10" />} title="No notifications yet">
            You&apos;ll hear here when a creative on your channels changes, a review is needed, or a correction is assigned to you.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
