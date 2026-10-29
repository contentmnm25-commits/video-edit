import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { logout } from "@/app/actions/me";
import { Avatar } from "@/components/ui";
import { Sidebar, type NavChannel } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/domain";
import { env } from "@/lib/env";
import { channelSummary, unreadNotificationCount } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [unread, summary, settings] = await Promise.all([
    unreadNotificationCount(user.id),
    channelSummary(),
    getSettings(),
  ]);
  const channels: NavChannel[] = summary.map((c) => ({
    slug: c.slug,
    name: c.name,
    toPublish: c.pending + c.outdated,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar
        workspaceName={settings.workspaceName}
        channels={channels}
        isAdmin={can(user, "admin")}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <form action="/assets" className="relative ml-10 max-w-md flex-1 lg:ml-0">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
            <input
              name="q"
              type="search"
              placeholder="Search product, SKU, ASIN or asset…"
              className="input pl-9"
              aria-label="Search assets"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/notifications"
              className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-4 font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100">
                <Avatar name={user.name} src={user.avatarUrl} size={28} />
                <span className="hidden text-left sm:block">
                  <span className="block text-sm leading-4 font-medium">{user.name}</span>
                  <span className="block text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
                </span>
              </summary>
              <div className="absolute right-0 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
                <div className="truncate border-b border-line px-3 py-2 text-xs text-muted">{user.email}</div>
                <Link href="/settings" className="block px-3 py-2 hover:bg-gray-50">
                  My channels & alerts
                </Link>
                <form action={logout}>
                  <button className="block w-full px-3 py-2 text-left text-red-700 hover:bg-red-50">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        {env.devLogin && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-800">
            Demo mode: password-free sign-in is on. Set <code>ALLOW_DEV_LOGIN=false</code> before real use.
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
