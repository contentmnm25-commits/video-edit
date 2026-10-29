"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Loader2 } from "lucide-react";
import { bulkMarkLive, markLive } from "@/app/actions/assets";
import { ChannelStateBadge, Thumb } from "@/components/ui";
import { timeAgo, type ChannelState } from "@/lib/domain";

export type QueueRow = {
  assetId: string;
  assetName: string;
  productName: string;
  sku: string;
  externalId: string | null;
  state: ChannelState;
  currentVersionId: string;
  currentNumber: number;
  hasThumb: boolean;
  mimeType: string;
  liveVersionNumber: number | null;
  note: string;
  updatedAt: string;
};

export function ChannelQueue({
  channelId,
  channelName,
  idLabel,
  rows,
  canMarkLive,
}: {
  channelId: string;
  channelName: string;
  idLabel: string | null;
  rows: QueueRow[];
  canMarkLive: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string } | { ok: true; data: unknown }>) => {
    setBusy(key);
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok && "error" in r) setError(r.error ?? "Failed");
      else setSelected(new Set());
      setBusy(null);
      router.refresh();
    });
  };

  return (
    <div>
      {canMarkLive && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-gray-50/70 px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.assetId)))}
              className="accent-accent"
            />
            Select all
          </label>
          <span className="text-xs text-muted">{selected.size} selected</span>
          <button
            className="btn-success btn-sm ml-auto"
            disabled={!selected.size || pending}
            onClick={() => run("bulk", () => bulkMarkLive(channelId, [...selected]))}
          >
            {busy === "bulk" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Mark selected live on {channelName}
          </button>
        </div>
      )}
      {error && <p className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.assetId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {canMarkLive && (
              <input
                type="checkbox"
                checked={selected.has(r.assetId)}
                onChange={() => toggle(r.assetId)}
                className="accent-accent"
                aria-label={`Select ${r.productName} ${r.assetName}`}
              />
            )}
            <Link href={`/assets/${r.assetId}`}>
              <Thumb versionId={r.currentVersionId} hasThumb={r.hasThumb} mimeType={r.mimeType} className="size-14" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/assets/${r.assetId}`} className="font-medium hover:text-accent">
                  {r.productName} — {r.assetName}
                </Link>
                <ChannelStateBadge state={r.state} />
              </p>
              <p className="mt-0.5 text-xs text-muted">
                <span className="font-mono">{r.sku}</span>
                {r.externalId && (
                  <>
                    {" "}
                    · {idLabel ?? "ID"} <span className="font-mono">{r.externalId}</span>
                  </>
                )}{" "}
                · {r.state === "outdated" ? `${channelName} shows v${r.liveVersionNumber}, current is v${r.currentNumber}` : `v${r.currentNumber}`}{" "}
                · {timeAgo(r.updatedAt)}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-gray-600">What changed: {r.note}</p>
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <a href={`/api/versions/${r.currentVersionId}/file?download=1`} className="btn-secondary btn-sm">
                <Download className="size-3.5" /> v{r.currentNumber}
              </a>
              {canMarkLive && (
                <button
                  className="btn-success btn-sm"
                  disabled={pending}
                  onClick={() => run(r.assetId, () => markLive(r.assetId, [channelId]))}
                >
                  {busy === r.assetId ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Mark live
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
