import Link from "next/link";
import { Avatar } from "@/components/ui";
import { REQUEST_STATUS_LABEL, timeAgo } from "@/lib/domain";
import type { ActivityItem } from "@/lib/queries";
import type { RequestStatus } from "@/db/schema";

function describe(a: ActivityItem): string {
  const v = a.version ? `v${a.version.number}` : a.meta?.number ? `v${a.meta.number}` : "";
  const ch = a.channel?.name ?? "a channel";
  switch (a.action) {
    case "version.published":
      return `uploaded ${v} — now the current version`;
    case "version.submitted":
      return `uploaded ${v} for review`;
    case "version.approved":
      return `approved ${v}`;
    case "version.rejected":
      return `requested changes on ${v}`;
    case "version.made_current":
      return `made ${v} the current version again`;
    case "version.downloaded":
      return `downloaded ${v}`;
    case "channel.marked_live":
      return `marked ${v} live on ${ch}`;
    case "channel.cleared":
      return `cleared the live version on ${ch}`;
    case "asset.created":
      return "created this asset";
    case "asset.updated":
      return "edited asset details";
    case "asset.archived":
      return "archived this asset";
    case "asset.restored":
      return "restored this asset";
    case "asset.correction_flagged":
      return "flagged a correction";
    case "request.created":
      return `raised a request${a.meta?.title ? `: “${a.meta.title}”` : ""}`;
    case "request.status":
      return `set a request to ${REQUEST_STATUS_LABEL[a.meta?.status as RequestStatus] ?? a.meta?.status}`;
    case "product.created":
      return "added this product";
    case "product.updated":
      return "edited product details";
    case "product.slots_added":
      return `added ${a.meta?.count ?? ""} standard asset slots`;
    case "product.archived":
      return "archived this product";
    case "product.restored":
      return "restored this product";
    case "product.imported":
      return `imported products (${a.meta?.created ?? 0} new, ${a.meta?.updated ?? 0} updated)`;
    default:
      return a.action.replace(/[._]/g, " ");
  }
}

export function ActivityFeed({ items, showSubject = true }: { items: ActivityItem[]; showSubject?: boolean }) {
  if (!items.length) return <p className="px-4 py-6 text-center text-sm text-muted">Nothing has happened yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 px-4 py-3">
          <Avatar name={a.actor?.name ?? "System"} src={a.actor?.avatarUrl} size={26} />
          <div className="min-w-0 text-sm">
            <p className="text-gray-800">
              <span className="font-medium text-ink">{a.actor?.name ?? "Someone"}</span> {describe(a)}
              {showSubject && a.asset && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/assets/${a.asset.id}`} className="link">
                    {a.product?.name ? `${a.product.name} — ` : ""}
                    {a.asset.name}
                  </Link>
                </>
              )}
              {showSubject && !a.asset && a.product && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/products/${a.product.id}`} className="link">
                    {a.product.name}
                  </Link>
                </>
              )}
            </p>
            {typeof a.meta?.note === "string" && a.meta.note && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">“{a.meta.note}”</p>
            )}
            <p className="mt-0.5 text-xs text-gray-400" title={a.createdAt.toLocaleString("en-IN")}>
              {timeAgo(a.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
