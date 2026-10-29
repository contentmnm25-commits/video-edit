import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, or, type SQL } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { db } from "@/db";
import { comments, requests, type RequestStatus } from "@/db/schema";
import { NewRequestButton, RequestCommentForm, RequestControls } from "@/components/request-components";
import { Avatar, cx, EmptyState, PageHeader, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can, daysAgo, PRIORITY_LABEL, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, timeAgo } from "@/lib/domain";
import { param } from "@/lib/params";
import { activeUsers, productOptions } from "@/lib/queries";

export const metadata = { title: "Requests" };

const COLUMNS: { status: RequestStatus; title: string }[] = [
  { status: "open", title: "Open" },
  { status: "in_progress", title: "In progress" },
  { status: "done", title: "Done (last 30 days)" },
];

const PRIORITY_STYLE = {
  urgent: "bg-red-600 text-white ring-red-600",
  high: "bg-red-50 text-red-700 ring-red-200",
  normal: "",
  low: "bg-gray-50 text-gray-500 ring-gray-200",
} as const;

export default async function RequestsPage(props: PageProps<"/requests">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const mine = param(sp, "mine") === "1";
  const raised = param(sp, "raised") === "1";
  const openId = param(sp, "open");

  const since = daysAgo(30);
  const filters: (SQL | undefined)[] = [
    or(inArray(requests.status, ["open", "in_progress"]), and(eq(requests.status, "done"), gte(requests.updatedAt, since))),
    mine ? eq(requests.assigneeId, user.id) : undefined,
    raised ? eq(requests.requestedById, user.id) : undefined,
  ];
  const [list, products, people] = await Promise.all([
    db.query.requests.findMany({
      where: and(...filters),
      orderBy: [desc(requests.priority), asc(requests.dueDate), desc(requests.createdAt)],
      limit: 300,
      with: {
        product: { columns: { id: true, name: true, sku: true } },
        asset: { columns: { id: true, name: true } },
        requestedBy: { columns: { id: true, name: true, avatarUrl: true } },
        assignee: { columns: { id: true, name: true, avatarUrl: true } },
      },
    }),
    productOptions(),
    activeUsers(),
  ]);
  const thread = list.length
    ? await db.query.comments.findMany({
        where: inArray(
          comments.requestId,
          list.map((r) => r.id),
        ),
        orderBy: [asc(comments.createdAt)],
        with: { author: { columns: { name: true } } },
      })
    : [];
  const designers = people.filter((p) => p.role === "designer" || p.role === "admin");
  const today = new Date().toISOString().slice(0, 10);

  const tab = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      className={cx(
        "rounded-lg px-3 py-1.5 text-sm",
        active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-gray-100 hover:text-ink",
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Requests"
        description="New creatives and corrections asked of design. Corrections close themselves when the fixed version is approved."
        actions={can(user, "request") && <NewRequestButton products={products} designers={designers} />}
      />
      <div className="mb-4 flex flex-wrap gap-1">
        {tab("Everything", "/requests", !mine && !raised)}
        {tab("Assigned to me", "/requests?mine=1", mine)}
        {tab("Raised by me", "/requests?raised=1", raised)}
      </div>
      {list.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ClipboardList className="size-10" />} title="No requests">
            When someone needs a new creative or a fix, it shows up here.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = list.filter((r) => r.status === col.status);
            return (
              <section key={col.status} className="min-w-0">
                <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
                  {col.title} <span className="text-xs font-normal text-muted tabular-nums">{items.length}</span>
                </h2>
                <div className="space-y-3">
                  {items.map((r) => {
                    const overdue = r.dueDate && r.dueDate < today && (r.status === "open" || r.status === "in_progress");
                    const replies = thread.filter((c) => c.requestId === r.id);
                    return (
                      <article
                        key={r.id}
                        id={r.id}
                        className={cx("card p-4", openId === r.id && "ring-2 ring-accent")}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill className={r.type === "correction" ? "bg-red-50 text-red-700 ring-red-200" : "bg-indigo-50 text-indigo-700 ring-indigo-200"}>
                            {REQUEST_TYPE_LABEL[r.type]}
                          </Pill>
                          {r.priority !== "normal" && <Pill className={PRIORITY_STYLE[r.priority]}>{PRIORITY_LABEL[r.priority]}</Pill>}
                          {r.dueDate && (
                            <Pill className={overdue ? "bg-red-50 text-red-700 ring-red-200" : undefined}>
                              {overdue ? "Overdue · " : "Due "}
                              {new Date(r.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </Pill>
                          )}
                        </div>
                        <h3 className="mt-2 text-sm font-semibold">{r.title}</h3>
                        <p className="mt-0.5 text-xs text-muted">
                          <Link href={`/products/${r.product.id}`} className="hover:text-ink">
                            {r.product.name}
                          </Link>
                          {r.asset && (
                            <>
                              {" · "}
                              <Link href={`/assets/${r.asset.id}`} className="link">
                                {r.asset.name}
                              </Link>
                            </>
                          )}
                        </p>
                        {r.description && <p className="mt-2 line-clamp-4 text-sm whitespace-pre-line text-gray-700">{r.description}</p>}
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                          <Avatar name={r.requestedBy?.name ?? "?"} src={r.requestedBy?.avatarUrl} size={18} />
                          <span>
                            {r.requestedBy?.name ?? "Someone"} · {timeAgo(r.createdAt)}
                          </span>
                          {r.assignee && (
                            <span className="ml-auto flex items-center gap-1">
                              → <Avatar name={r.assignee.name} src={r.assignee.avatarUrl} size={18} /> {r.assignee.name.split(" ")[0]}
                            </span>
                          )}
                        </div>
                        {r.status === "done" && r.closedAt && (
                          <p className="mt-2 text-xs text-emerald-700">
                            {REQUEST_STATUS_LABEL.done} {timeAgo(r.closedAt)}
                            {r.resolvedVersionId ? " by a new upload" : ""}
                          </p>
                        )}
                        <details className="mt-3 border-t border-line pt-3" open={openId === r.id}>
                          <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
                            {replies.length ? `${replies.length} comment${replies.length === 1 ? "" : "s"}` : "Comment"} & actions
                          </summary>
                          <div className="mt-3 space-y-3">
                            {replies.map((c) => (
                              <p key={c.id} className="text-sm">
                                <span className="font-medium">{c.author?.name ?? "Someone"}</span>{" "}
                                <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span>
                                <span className="block whitespace-pre-line text-gray-700">{c.body}</span>
                              </p>
                            ))}
                            {can(user, "comment") && <RequestCommentForm requestId={r.id} />}
                            <RequestControls
                              requestId={r.id}
                              status={r.status}
                              assigneeId={r.assigneeId}
                              designers={designers}
                              canEdit={can(user, "request")}
                              productId={r.product.id}
                              hasAsset={Boolean(r.asset)}
                            />
                          </div>
                        </details>
                      </article>
                    );
                  })}
                  {!items.length && <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">Nothing here</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
