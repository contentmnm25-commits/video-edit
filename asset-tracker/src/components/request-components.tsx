"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  addRequestComment,
  assignRequest,
  createRequest,
  listAssetOptions,
  setRequestStatus,
} from "@/app/actions/requests";
import { FormError, Modal, useCloseModal } from "@/components/modal";
import type { Priority, RequestStatus, RequestType } from "@/db/schema";
import { PRIORITY_LABEL } from "@/lib/domain";
import type { ActionResult } from "@/lib/errors";

type Result = ActionResult<unknown> | undefined;

export function NewRequestButton({
  products,
  designers,
  defaultProductId,
  defaultAssetId,
}: {
  products: { id: string; name: string; sku: string }[];
  designers: { id: string; name: string }[];
  defaultProductId?: string;
  defaultAssetId?: string;
}) {
  return (
    <Modal
      trigger={
        <>
          <Plus className="size-4" /> New request
        </>
      }
      triggerClassName="btn-primary"
      title="Request a creative"
      description="Ask design for a new creative or a change. They get notified, and you're told when it's delivered."
      wide
    >
      <NewRequestForm products={products} designers={designers} defaultProductId={defaultProductId} defaultAssetId={defaultAssetId} />
    </Modal>
  );
}

function NewRequestForm({
  products,
  designers,
  defaultProductId,
  defaultAssetId,
}: {
  products: { id: string; name: string; sku: string }[];
  designers: { id: string; name: string }[];
  defaultProductId?: string;
  defaultAssetId?: string;
}) {
  const [state, action, pending] = useActionState<Result, FormData>(createRequest, undefined);
  const close = useCloseModal();
  const router = useRouter();
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [assetOptions, setAssetOptions] = useState<{ id: string; name: string }[]>([]);
  const [type, setType] = useState<RequestType>(defaultAssetId ? "correction" : "new_creative");

  useEffect(() => {
    if (state?.ok) {
      close();
      router.refresh();
    }
  }, [state, close, router]);

  useEffect(() => {
    if (!defaultProductId) return;
    let cancelled = false;
    listAssetOptions(defaultProductId).then((opts) => {
      if (!cancelled) setAssetOptions(opts);
    });
    return () => {
      cancelled = true;
    };
  }, [defaultProductId]);

  const chooseProduct = (id: string) => {
    setProductId(id);
    setAssetOptions([]);
    if (id) listAssetOptions(id).then(setAssetOptions);
  };

  return (
    <form action={action} className="space-y-4">
      <div className="flex gap-2">
        {(["new_creative", "correction"] as const).map((t) => (
          <label key={t} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line p-3 text-sm has-checked:border-accent has-checked:bg-accent-soft">
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="accent-accent" />
            <span>
              <span className="block font-medium">{t === "new_creative" ? "New creative" : "Correction"}</span>
              <span className="block text-xs text-muted">{t === "new_creative" ? "Something that doesn't exist yet" : "Fix an existing creative"}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="r-product">
            Product
          </label>
          <select id="r-product" name="productId" required value={productId} onChange={(e) => chooseProduct(e.target.value)} className="input">
            <option value="">Choose…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-asset">
            Asset {type === "correction" ? "" : "(optional)"}
          </label>
          <select id="r-asset" name="assetId" defaultValue={defaultAssetId ?? ""} required={type === "correction"} className="input" disabled={!productId}>
            <option value="">{type === "correction" ? "Choose…" : "New / not created yet"}</option>
            {assetOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="r-title">
          Title
        </label>
        <input id="r-title" name="title" required className="input" placeholder="e.g. Diwali offer banner for Blinkit" />
      </div>
      <div>
        <label className="label" htmlFor="r-desc">
          Details
        </label>
        <textarea id="r-desc" name="description" rows={4} className="input" placeholder="Sizes, copy, references, deadlines…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="r-priority">
            Priority
          </label>
          <select id="r-priority" name="priority" defaultValue="normal" className="input">
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-due">
            Needed by
          </label>
          <input id="r-due" name="dueDate" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="r-assignee">
            Designer
          </label>
          <select id="r-assignee" name="assigneeId" defaultValue="" className="input">
            <option value="">Auto / anyone</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormError error={state && !state.ok ? state.error : null} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Send request
        </button>
      </div>
    </form>
  );
}

export function RequestControls({
  requestId,
  status,
  assigneeId,
  designers,
  canEdit,
  productId,
  hasAsset,
}: {
  requestId: string;
  status: RequestStatus;
  assigneeId: string | null;
  designers: { id: string; name: string }[];
  canEdit: boolean;
  productId: string;
  hasAsset: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<{ ok: boolean; error?: string } | ActionResult<undefined>>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok && "error" in r) setError(r.error ?? "Failed");
      router.refresh();
    });
  if (!canEdit) return null;
  const open = status === "open" || status === "in_progress";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={assigneeId ?? ""}
        onChange={(e) => act(() => assignRequest(requestId, e.target.value || null))}
        className="input w-auto py-1 text-xs"
        aria-label="Assignee"
        disabled={pending}
      >
        <option value="">Unassigned</option>
        {designers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {status === "open" && (
        <button className="btn-secondary btn-sm" disabled={pending} onClick={() => act(() => setRequestStatus(requestId, "in_progress"))}>
          Start
        </button>
      )}
      {open && !hasAsset && (
        <Link href={`/products/${productId}?request=${requestId}`} className="btn-secondary btn-sm">
          Create the asset
        </Link>
      )}
      {open && (
        <>
          <button className="btn-success btn-sm" disabled={pending} onClick={() => act(() => setRequestStatus(requestId, "done"))}>
            Mark done
          </button>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => act(() => setRequestStatus(requestId, "cancelled"))}>
            Cancel
          </button>
        </>
      )}
      {!open && (
        <button className="btn-ghost btn-sm" disabled={pending} onClick={() => act(() => setRequestStatus(requestId, "open"))}>
          Reopen
        </button>
      )}
      {pending && <Loader2 className="size-3.5 animate-spin text-muted" />}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function RequestCommentForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(addRequestComment, undefined);
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input name="body" className="input py-1.5" placeholder="Reply…" required />
      <button className="btn-secondary btn-sm" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Send"}
      </button>
      {state && !state.ok && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
