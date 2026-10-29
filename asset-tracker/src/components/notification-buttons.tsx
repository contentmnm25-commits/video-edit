"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/me";

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button className="btn-secondary" disabled={pending} onClick={() => start(() => markAllNotificationsRead())}>
      <CheckCheck className="size-4" /> Mark all read
    </button>
  );
}

/** Opening a notification marks it read. */
export function NotificationLink({ id, href, unread, children }: { id: string; href: string; unread: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={() => {
        if (unread) void markNotificationRead(id);
      }}
      className="block px-4 py-3 hover:bg-gray-50"
    >
      {children}
    </Link>
  );
}
