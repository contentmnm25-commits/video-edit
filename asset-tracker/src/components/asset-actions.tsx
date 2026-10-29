"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag, Loader2, Pencil, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import {
  addComment,
  clearLive,
  flagCorrection,
  markLive,
  reviewVersion,
  setAssetArchived,
  setCurrentVersion,
  updateAsset,
} from "@/app/actions/assets";
import { FormError, Modal, useCloseModal } from "@/components/modal";
import { ChannelStateBadge, cx } from "@/components/ui";
import type { AssetType } from "@/db/schema";
import { ASSET_TYPE_LABEL, needsPublishing, PRIORITY_LABEL, timeAgo, type ChannelState } from "@/lib/domain";
import type { ActionResult } from "@/lib/errors";

type Result = ActionResult<unknown> | undefined;

/** Run a server action from a button and surface its error. */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r && !r.ok) setError(r.error);
      else {
        onOk?.();
        router.refresh();
      }
    });
  return { pending, error, run };
}

/** Close the modal once a useActionState form succeeds. */
function useCloseOnSuccess(state: Result) {
  const close = useCloseModal();
  useEffect(() => {
    if (state?.ok) close();
  }, [state, close]);
}

// ─── Channels panel ────────────────────────────────────────────────────

export type ChannelRow = {
  channelId: string;
  name: string;
  idLabel: string | null;
  externalId: string | null;
  state: ChannelState;
  liveVersionNumber: number | null;
  liveAt: string | null;
  liveByName: string | null;
};

export function ChannelPanel({
  assetId,
  rows,
  currentNumber,
  canMarkLive,
}: {
  assetId: string;
  rows: ChannelRow[];
  currentNumber: number | null;
  canMarkLive: boolean;
}) {
  const { pending, error, run } = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);
  const todo = rows.filter((r) => needsPublishing(r.state));

  const mark = (ids: string[], key: string) => {
    setBusyId(key);
    run(() => markLive(assetId, ids), () => setBusyId(null));
  };

  return (
    <div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.channelId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                <ChannelStateBadge state={r.state} />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {r.externalId ? (
                  <span className="font-mono">
                    {r.idLabel ?? "ID"} {r.externalId}
                  </span>
                ) : (
                  <span className="text-gray-400">No {r.idLabel ?? "listing ID"} saved</span>
                )}
                {r.liveVersionNumber != null && (
                  <>
                    {" "}
                    · showing v{r.liveVersionNumber}
                    {r.liveByName ? `, marked by ${r.liveByName}` : ""}
                    {r.liveAt ? ` ${timeAgo(r.liveAt)}` : ""}
                  </>
                )}
              </p>
            </div>
            {canMarkLive && needsPublishing(r.state) && (
              <button
                className="btn-success btn-sm"
                disabled={pending}
                onClick={() => mark([r.channelId], r.channelId)}
                title={`I've uploaded v${currentNumber} to ${r.name}`}
              >
                {pending && busyId === r.channelId ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Mark v{currentNumber} live
              </button>
            )}
            {canMarkLive && r.liveVersionNumber != null && (
              <button
                className="btn-ghost btn-sm"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Clear the live version on ${r.name}? Use this if it was marked by mistake or taken down.`)) {
                    run(() => clearLive(assetId, r.channelId));
                  }
                }}
                title="Undo / taken down"
              >
                <Undo2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {!rows.length && (
          <li className="px-4 py-6 text-center text-sm text-muted">
            Not assigned to any channel. Edit the asset to choose where it&apos;s used.
          </li>
        )}
      </ul>
      {canMarkLive && todo.length > 1 && (
        <div className="border-t border-line px-4 py-3">
          <button className="btn-secondary btn-sm w-full" disabled={pending} onClick={() => mark(todo.map((t) => t.channelId), "all")}>
            {pending && busyId === "all" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Mark v{currentNumber} live on all {todo.length} channels
          </button>
        </div>
      )}
      {error && (
        <div className="px-4 pb-3">
          <FormError error={error} />
        </div>
      )}
    </div>
  );
}

// ─── Review ────────────────────────────────────────────────────────────

export function ReviewPanel({ versionId, number }: { versionId: string; number: number }) {
  const [state, action, pending] = useActionState<Result, FormData>(reviewVersion, undefined);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="versionId" value={versionId} />
      <textarea name="note" rows={2} className="input" placeholder="Note for the designer (required when requesting changes)" />
      <FormError error={state && !state.ok ? state.error : null} />
      <div className="flex gap-2">
        <button name="decision" value="approve" className="btn-success flex-1" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Approve v{number}
        </button>
        <button name="decision" value="reject" className="btn-danger flex-1" disabled={pending}>
          Request changes
        </button>
      </div>
    </form>
  );
}

// ─── Correction ────────────────────────────────────────────────────────

export function FlagCorrectionButton({ assetId }: { assetId: string }) {
  return (
    <Modal
      trigger={
        <>
          <Flag className="size-4" /> Flag correction
        </>
      }
      title="Flag a correction"
      description="The designer gets notified and a correction request is opened. It closes automatically when they upload the fixed version."
    >
      <FlagForm assetId={assetId} />
    </Modal>
  );
}

function FlagForm({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(flagCorrection, undefined);
  useCloseOnSuccess(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      <div>
        <label className="label" htmlFor="flag-note">
          What&apos;s wrong?
        </label>
        <textarea
          id="flag-note"
          name="note"
          rows={4}
          required
          className="input"
          placeholder="e.g. Pack size says 250ml, should be 300ml. Amazon rejected the main image: background isn't pure white."
        />
      </div>
      <div>
        <label className="label" htmlFor="flag-priority">
          Priority
        </label>
        <select id="flag-priority" name="priority" defaultValue="normal" className="input">
          {(["low", "normal", "high", "urgent"] as const).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
              {p === "urgent" ? " (also posts to Slack)" : ""}
            </option>
          ))}
        </select>
      </div>
      <FormError error={state && !state.ok ? state.error : null} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Flag correction
        </button>
      </div>
    </form>
  );
}

// ─── Comments ──────────────────────────────────────────────────────────

export function CommentForm({
  assetId,
  versions,
  defaultVersionId,
}: {
  assetId: string;
  versions: { id: string; number: number }[];
  defaultVersionId?: string | null;
}) {
  // React resets the form after the action finishes, so the textarea clears itself.
  const [state, action, pending] = useActionState<Result, FormData>(addComment, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="assetId" value={assetId} />
      <textarea name="body" rows={2} className="input" placeholder="Add a comment…" required />
      <div className="flex items-center gap-2">
        {versions.length > 0 && (
          <select name="versionId" defaultValue={defaultVersionId ?? ""} className="input w-auto py-1.5 text-xs" aria-label="About version">
            <option value="">General</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                About v{v.number}
              </option>
            ))}
          </select>
        )}
        <button className="btn-primary btn-sm ml-auto" disabled={pending}>
          {pending && <Loader2 className="size-3.5 animate-spin" />} Comment
        </button>
      </div>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}

// ─── Versions ──────────────────────────────────────────────────────────

export function MakeCurrentButton({ versionId, number }: { versionId: string; number: number }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        className="btn-ghost btn-sm"
        disabled={pending}
        onClick={() => {
          if (confirm(`Make v${number} the current version again? Channels showing the newer version will be marked outdated.`)) {
            run(() => setCurrentVersion(versionId));
          }
        }}
      >
        <RotateCcw className="size-3.5" /> Make current
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}

// ─── Edit asset ────────────────────────────────────────────────────────

export function EditAssetButton({
  asset,
  channels,
  designers,
}: {
  asset: { id: string; name: string; type: AssetType; assigneeId: string | null; channelIds: string[]; archived: boolean };
  channels: { id: string; name: string }[];
  designers: { id: string; name: string }[];
}) {
  return (
    <Modal
      trigger={
        <>
          <Pencil className="size-4" /> Edit
        </>
      }
      title="Edit asset"
    >
      <EditAssetForm asset={asset} channels={channels} designers={designers} />
    </Modal>
  );
}

function EditAssetForm({
  asset,
  channels,
  designers,
}: {
  asset: { id: string; name: string; type: AssetType; assigneeId: string | null; channelIds: string[]; archived: boolean };
  channels: { id: string; name: string }[];
  designers: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<Result, FormData>(updateAsset, undefined);
  const archive = useAction();
  const close = useCloseModal();
  useCloseOnSuccess(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="assetId" value={asset.id} />
      <AssetFields
        defaults={asset}
        channels={channels}
        designers={designers}
      />
      <FormError error={(state && !state.ok ? state.error : null) ?? archive.error} />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={asset.archived ? "btn-secondary" : "btn-danger"}
          disabled={archive.pending}
          onClick={() => {
            if (asset.archived || confirm("Archive this asset? It disappears from lists and channel queues. You can restore it later.")) {
              archive.run(() => setAssetArchived(asset.id, !asset.archived), close);
            }
          }}
        >
          {asset.archived ? "Restore asset" : "Archive"}
        </button>
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Save
        </button>
      </div>
    </form>
  );
}

/** Shared by "new asset" and "edit asset". */
export function AssetFields({
  defaults,
  channels,
  designers,
}: {
  defaults?: { name: string; type: AssetType; assigneeId: string | null; channelIds: string[] };
  channels: { id: string; name: string }[];
  designers: { id: string; name: string }[];
}) {
  const selected = new Set(defaults?.channelIds ?? channels.map((c) => c.id));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="asset-name">
            Name
          </label>
          <input
            id="asset-name"
            name="name"
            required
            defaultValue={defaults?.name}
            className="input"
            placeholder="e.g. Main image, Image 3, Product video"
          />
        </div>
        <div>
          <label className="label" htmlFor="asset-type">
            Type
          </label>
          <select id="asset-type" name="type" defaultValue={defaults?.type ?? "image"} className="input">
            {Object.entries(ASSET_TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="asset-assignee">
            Designer
          </label>
          <select id="asset-assignee" name="assigneeId" defaultValue={defaults?.assigneeId ?? ""} className="input">
            <option value="">Unassigned</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="label">Used on</legend>
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => (
            <label
              key={c.id}
              className={cx(
                "flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent-soft",
              )}
            >
              <input type="checkbox" name="channelIds" value={c.id} defaultChecked={selected.has(c.id)} className="accent-accent" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
