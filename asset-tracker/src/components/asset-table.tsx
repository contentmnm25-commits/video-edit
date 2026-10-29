import Link from "next/link";
import { Layers } from "lucide-react";
import { ChannelChip, EmptyState, StatusBadge, Thumb, Avatar } from "@/components/ui";
import { ASSET_TYPE_LABEL, timeAgo } from "@/lib/domain";
import type { AssetCard } from "@/lib/queries";

export function AssetTable({ rows, empty }: { rows: AssetCard[]; empty?: React.ReactNode }) {
  if (!rows.length) {
    return (
      <EmptyState icon={<Layers className="size-10" />} title="No creatives here">
        {empty}
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium text-muted">
            <th className="px-4 py-2.5">Creative</th>
            <th className="px-3 py-2.5">Latest</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Channels</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Designer</th>
            <th className="px-4 py-2.5 text-right whitespace-nowrap">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((a) => (
            <tr key={a.id} className="group hover:bg-gray-50/70">
              <td className="px-4 py-2.5">
                <Link href={`/assets/${a.id}`} className="flex items-center gap-3">
                  <Thumb
                    versionId={a.currentVersion?.id}
                    hasThumb={Boolean(a.currentVersion?.thumbKey)}
                    mimeType={a.currentVersion?.mimeType}
                    className="size-11"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink group-hover:text-accent">{a.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {a.product.name} · <span className="font-mono">{a.product.sku}</span> · {ASSET_TYPE_LABEL[a.type]}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5 font-medium tabular-nums">
                {a.currentVersion ? `v${a.currentVersion.number}` : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex max-w-md flex-wrap gap-1">
                  {a.channels.map((c) => (
                    <ChannelChip
                      key={c.channel.id}
                      name={c.channel.name}
                      state={c.state}
                      liveVersionNumber={c.liveVersionNumber}
                    />
                  ))}
                  {!a.channels.length && <span className="text-xs text-gray-400">No channels</span>}
                </div>
              </td>
              <td className="px-3 py-2.5">
                {a.assignee ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Avatar name={a.assignee.name} src={a.assignee.avatarUrl} size={20} />
                    <span className="text-xs">{a.assignee.name.split(" ")[0]}</span>
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap text-muted">{timeAgo(a.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
