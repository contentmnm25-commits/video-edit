import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { requests } from "@/db/schema";
import { ActivityFeed } from "@/components/activity-feed";
import { AssetTable } from "@/components/asset-table";
import { PageHeader, Pill, SectionTitle, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PRIORITY_LABEL, REQUEST_TYPE_LABEL, timeAgo } from "@/lib/domain";
import {
  assetStatusCounts,
  channelSummary,
  listAssets,
  openRequestCount,
  recentActivity,
  userChannelIds,
} from "@/lib/queries";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [summary, counts, openRequests, activityItems, myChannelIds] = await Promise.all([
    channelSummary(),
    assetStatusCounts(),
    openRequestCount(),
    recentActivity({ limit: 12 }),
    userChannelIds(user.id),
  ]);
  const toPublish = summary.reduce((n, c) => n + c.pending, 0);
  const outdated = summary.reduce((n, c) => n + c.outdated, 0);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hi ${firstName}`}
        description="What's ready, what's live, and what still needs updating on each channel."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="To publish" value={toPublish} tone="amber" href="/assets?state=pending" hint="New, never published" />
        <StatCard label="Outdated on a channel" value={outdated} tone="red" href="/assets?state=outdated" hint="Channel shows an old version" />
        <StatCard label="Waiting for review" value={counts.in_review} tone="violet" href="/assets?status=in_review" />
        <StatCard label="Needs correction" value={counts.needs_correction} tone="red" href="/assets?status=needs_correction" />
        <StatCard label="Open requests" value={openRequests} href="/requests" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <SectionTitle>Channel health</SectionTitle>
              <p className="-mt-2 text-xs text-muted">Counts are per creative. Pick a channel to see its to-do list.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Channel</th>
                    <th className="px-3 py-2 text-right font-medium">Live & current</th>
                    <th className="px-3 py-2 text-right font-medium">Outdated</th>
                    <th className="px-3 py-2 text-right font-medium">To publish</th>
                    <th className="px-3 py-2 text-right font-medium">Not ready</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {summary.map((c) => {
                    const total = c.live + c.outdated + c.pending;
                    const pct = total ? Math.round((c.live / total) * 100) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50/70">
                        <td className="px-4 py-2.5">
                          <Link href={`/channels/${c.slug}`} className="font-medium hover:text-accent">
                            {c.name}
                          </Link>
                          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100" title={`${pct}% up to date`}>
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <Num value={c.live} className="text-emerald-700" />
                        <Num value={c.outdated} className="text-red-600" />
                        <Num value={c.pending} className="text-amber-700" />
                        <Num value={c.notReady} className="text-gray-500" />
                        <td className="px-4 py-2.5 text-right">
                          <Link href={`/channels/${c.slug}`} className="inline-flex items-center text-xs text-accent">
                            Open <ArrowRight className="ml-0.5 size-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {!summary.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted">
                        No channels yet.{" "}
                        <Link href="/admin?tab=channels" className="link">
                          Admins can add them here.
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <MyQueue userId={user.id} role={user.role} myChannelIds={myChannelIds} />
        </div>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SectionTitle>Recent activity</SectionTitle>
          </div>
          <ActivityFeed items={activityItems} />
        </section>
      </div>
    </>
  );
}

function Num({ value, className }: { value: number; className: string }) {
  return (
    <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${value ? className : "text-gray-300"}`}>{value}</td>
  );
}

async function MyQueue({
  userId,
  role,
  myChannelIds,
}: {
  userId: string;
  role: string;
  myChannelIds: string[];
}) {
  if (role === "designer") {
    const [corrections, myRequests] = await Promise.all([
      listAssets({ assigneeId: userId, status: "needs_correction" }, 1, 10),
      db.query.requests.findMany({
        where: and(eq(requests.assigneeId, userId), inArray(requests.status, ["open", "in_progress"])),
        orderBy: [desc(requests.priority), asc(requests.dueDate), desc(requests.createdAt)],
        limit: 8,
        with: { product: { columns: { name: true } } },
      }),
    ]);
    return (
      <>
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SectionTitle action={<Link href={`/assets?assignee=me&status=needs_correction`} className="text-xs link">See all</Link>}>
              Corrections assigned to you
            </SectionTitle>
          </div>
          <AssetTable rows={corrections.rows} empty="Nothing to fix. Nice." />
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SectionTitle action={<Link href="/requests?mine=1" className="text-xs link">See all</Link>}>
              Your open requests
            </SectionTitle>
          </div>
          {myRequests.length ? (
            <ul className="divide-y divide-line">
              {myRequests.map((r) => (
                <li key={r.id}>
                  <Link href={`/requests?open=${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted">
                        {REQUEST_TYPE_LABEL[r.type]} · {r.product.name} · {timeAgo(r.createdAt)}
                        {r.dueDate ? ` · due ${r.dueDate}` : ""}
                      </p>
                    </div>
                    {r.priority !== "normal" && (
                      <Pill className={r.priority === "urgent" || r.priority === "high" ? "bg-red-50 text-red-700 ring-red-200" : undefined}>
                        {PRIORITY_LABEL[r.priority]}
                      </Pill>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted">No open requests assigned to you.</p>
          )}
        </section>
      </>
    );
  }

  if (role === "reviewer" || role === "admin") {
    const review = await listAssets({ status: "in_review" }, 1, 10);
    if (review.total || role === "reviewer") {
      return (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SectionTitle action={<Link href="/assets?status=in_review" className="text-xs link">See all {review.total}</Link>}>
              Waiting for your review
            </SectionTitle>
          </div>
          <AssetTable rows={review.rows} empty="Nothing waiting for review." />
        </section>
      );
    }
  }

  if (!myChannelIds.length) {
    return (
      <section className="card p-5">
        <SectionTitle>Your to-publish list</SectionTitle>
        <p className="text-sm text-muted">
          Tell us which channels you look after and this becomes your personal to-do list. You&apos;ll also get alerts
          when one of their creatives changes.{" "}
          <Link href="/settings" className="link">
            Choose my channels
          </Link>
        </p>
      </section>
    );
  }
  const queue = await listAssets({ state: "to_publish", channelIds: myChannelIds }, 1, 10);
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <SectionTitle action={<Link href="/assets?state=to_publish&mine=1" className="text-xs link">See all {queue.total}</Link>}>
          To publish on your channels
        </SectionTitle>
      </div>
      <AssetTable rows={queue.rows} empty="All your channels are up to date." />
    </section>
  );
}
