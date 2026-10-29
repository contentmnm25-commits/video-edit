"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Layers,
  Menu,
  Settings,
  Store,
  X,
} from "lucide-react";
import { cx } from "@/components/ui";

export type NavChannel = { slug: string; name: string; toPublish: number };

export function Sidebar({
  workspaceName,
  channels,
  isAdmin,
}: {
  workspaceName: string;
  channels: NavChannel[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const item = (href: string, label: string, Icon: typeof Bell, badge?: number) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      className={cx(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
        active(href) ? "bg-accent-soft font-medium text-accent" : "text-gray-700 hover:bg-gray-100",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 tabular-nums">
          {badge}
        </span>
      ) : null}
    </Link>
  );

  return (
    <>
      <button
        className="fixed top-2.5 left-3 z-40 rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white">
            <Layers className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold">{workspaceName}</span>
          <button className="ml-auto rounded p-1 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          <div className="space-y-0.5">
            {item("/", "Dashboard", LayoutDashboard)}
            {item("/assets", "All creatives", Layers)}
            {item("/products", "Products", Boxes)}
            {item("/requests", "Requests", ClipboardList)}
            {item("/notifications", "Notifications", Bell)}
          </div>
          <div>
            <div className="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
              Channels · to publish
            </div>
            <div className="space-y-0.5">
              {channels.map((c) => item(`/channels/${c.slug}`, c.name, Store, c.toPublish))}
              {!channels.length && <p className="px-2.5 text-xs text-muted">No channels yet.</p>}
            </div>
          </div>
          {isAdmin && <div className="space-y-0.5">{item("/admin", "Admin", Settings)}</div>}
        </nav>
      </aside>
    </>
  );
}
