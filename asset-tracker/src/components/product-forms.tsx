"use client";

import Link from "next/link";
import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createAsset } from "@/app/actions/assets";
import { addTemplateSlots, createProduct, importProducts, setProductArchived, updateProduct } from "@/app/actions/products";
import { AssetFields } from "@/components/asset-actions";
import { FormError, Modal, useCloseModal } from "@/components/modal";
import type { ActionResult } from "@/lib/errors";
import type { ImportReport } from "@/lib/catalog";

type Result = ActionResult<unknown> | undefined;
type ChannelOpt = { id: string; name: string; idLabel: string | null };

type ProductDefaults = {
  id?: string;
  name?: string;
  sku?: string;
  brand?: string | null;
  category?: string | null;
  notes?: string | null;
  channelIds?: Record<string, string>;
};

function ProductFields({ defaults, channels }: { defaults?: ProductDefaults; channels: ChannelOpt[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-name">
            Product name
          </label>
          <input id="p-name" name="name" required defaultValue={defaults?.name} className="input" placeholder="e.g. Steel Sipper Bottle 300ml" />
        </div>
        <div>
          <label className="label" htmlFor="p-sku">
            SKU
          </label>
          <input id="p-sku" name="sku" required defaultValue={defaults?.sku} className="input font-mono" placeholder="SIP-300-BLU" />
        </div>
        <div>
          <label className="label" htmlFor="p-brand">
            Brand
          </label>
          <input id="p-brand" name="brand" defaultValue={defaults?.brand ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-category">
            Category
          </label>
          <input id="p-category" name="category" defaultValue={defaults?.category ?? ""} className="input" placeholder="e.g. Feeding" />
        </div>
      </div>
      {channels.length > 0 && (
        <fieldset>
          <legend className="label">Listing IDs (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map((c) => (
              <div key={c.id}>
                <label className="mb-0.5 block text-xs text-muted" htmlFor={`ch-${c.id}`}>
                  {c.name} {c.idLabel ? `(${c.idLabel})` : ""}
                </label>
                <input
                  id={`ch-${c.id}`}
                  name={`channel:${c.id}`}
                  defaultValue={defaults?.channelIds?.[c.id] ?? ""}
                  className="input font-mono"
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label className="label" htmlFor="p-notes">
          Notes
        </label>
        <textarea id="p-notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ""} className="input" />
      </div>
    </>
  );
}

export function NewProductForm({ channels, template }: { channels: ChannelOpt[]; template: string[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(createProduct, undefined);
  return (
    <form action={action} className="card space-y-5 p-5">
      <ProductFields channels={channels} />
      {template.length > 0 && (
        <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm">
          <input type="checkbox" name="useTemplate" defaultChecked className="mt-0.5 accent-accent" />
          <span>
            Create the standard asset slots
            <span className="block text-xs text-muted">{template.join(" · ")}</span>
          </span>
        </label>
      )}
      <FormError error={state && !state.ok ? state.error : null} />
      <div className="flex justify-end gap-2">
        <Link href="/products" className="btn-ghost">
          Cancel
        </Link>
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Add product
        </button>
      </div>
    </form>
  );
}

export function EditProductButton({ product, channels }: { product: ProductDefaults & { id: string; archived: boolean }; channels: ChannelOpt[] }) {
  return (
    <Modal trigger="Edit product" title="Edit product" wide>
      <EditProductForm product={product} channels={channels} />
    </Modal>
  );
}

function EditProductForm({ product, channels }: { product: ProductDefaults & { id: string; archived: boolean }; channels: ChannelOpt[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(updateProduct, undefined);
  const close = useCloseModal();
  const router = useRouter();
  const [archiving, start] = useTransition();
  useEffect(() => {
    if (state?.ok) close();
  }, [state, close]);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={product.id} />
      <ProductFields defaults={product} channels={channels} />
      <FormError error={state && !state.ok ? state.error : null} />
      <div className="flex justify-between gap-2">
        <button
          type="button"
          className={product.archived ? "btn-secondary" : "btn-danger"}
          disabled={archiving}
          onClick={() => {
            if (product.archived || confirm("Archive this product? Its creatives disappear from lists and channel queues.")) {
              start(async () => {
                await setProductArchived(product.id, !product.archived);
                close();
                router.refresh();
              });
            }
          }}
        >
          {product.archived ? "Restore product" : "Archive product"}
        </button>
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Save
        </button>
      </div>
    </form>
  );
}

export function NewAssetButton({
  productId,
  channels,
  designers,
  requestId,
  defaultChannelIds,
}: {
  productId: string;
  channels: { id: string; name: string }[];
  designers: { id: string; name: string }[];
  requestId?: string;
  defaultChannelIds?: string[];
}) {
  return (
    <Modal
      trigger={
        <>
          <Plus className="size-4" /> Add asset
        </>
      }
      triggerClassName="btn-secondary"
      title="Add an asset slot"
      description="A slot is one creative position, like “Main image” or “Product video”. Every upload into it becomes a new version."
    >
      <NewAssetForm productId={productId} channels={channels} designers={designers} requestId={requestId} defaultChannelIds={defaultChannelIds} />
    </Modal>
  );
}

function NewAssetForm({
  productId,
  channels,
  designers,
  requestId,
  defaultChannelIds,
}: {
  productId: string;
  channels: { id: string; name: string }[];
  designers: { id: string; name: string }[];
  requestId?: string;
  defaultChannelIds?: string[];
}) {
  const [state, action, pending] = useActionState<Result, FormData>(createAsset, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {requestId && <input type="hidden" name="requestId" value={requestId} />}
      <AssetFields
        channels={channels}
        designers={designers}
        defaults={defaultChannelIds ? { name: "", type: "image", assigneeId: null, channelIds: defaultChannelIds } : undefined}
      />
      <FormError error={state && !state.ok ? state.error : null} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Create asset
        </button>
      </div>
    </form>
  );
}

export function AddTemplateSlotsButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await addTemplateSlots(productId);
          router.refresh();
        })
      }
    >
      {pending && <Loader2 className="size-4 animate-spin" />} Add standard slots
    </button>
  );
}

export function ImportForm({ channels, template }: { channels: ChannelOpt[]; template: string[] }) {
  const [state, action, pending] = useActionState<ActionResult<ImportReport> | undefined, FormData>(importProducts, undefined);
  const sample = [
    ["name", "sku", "brand", "category", ...channels.map((c) => c.name), "assets"].join(","),
    ["Steel Sipper 300ml", "SIP-300", "Acme", "Feeding", ...channels.map((_, i) => (i === 0 ? "B0ABCDE123" : "")), ""].join(","),
  ].join("\n");
  return (
    <form action={action} className="card space-y-5 p-5">
      <div>
        <label className="label" htmlFor="file">
          CSV file
        </label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="csv">
          …or paste CSV
        </label>
        <textarea id="csv" name="csv" rows={6} className="input font-mono text-xs" placeholder={sample} />
        <p className="mt-1 text-xs text-muted">
          Required columns: <code>name</code>, <code>sku</code>. Optional: <code>brand</code>, <code>category</code>,{" "}
          <code>notes</code>, one column per channel named after it ({channels.map((c) => c.name).join(", ")}) holding its listing
          ID, and <code>assets</code> with slot names separated by <code>|</code>. Existing SKUs are updated, not duplicated.
        </p>
      </div>
      {template.length > 0 && (
        <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm">
          <input type="checkbox" name="useTemplate" defaultChecked className="mt-0.5 accent-accent" />
          <span>
            Give new products the standard asset slots when the row has no <code>assets</code> column
            <span className="block text-xs text-muted">{template.join(" · ")}</span>
          </span>
        </label>
      )}
      {state && !state.ok && <FormError error={state.error} />}
      {state?.ok && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-medium">
            Imported: {state.data.created} new, {state.data.updated} updated, {state.data.slots} asset slots created.
          </p>
          {state.data.unknownColumns.length > 0 && (
            <p className="mt-1 text-amber-800">Ignored columns (no matching channel): {state.data.unknownColumns.join(", ")}</p>
          )}
          {state.data.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-red-700">
              {state.data.errors.slice(0, 20).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Link href="/products" className="mt-2 inline-block link">
            Go to products →
          </Link>
        </div>
      )}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Import
        </button>
      </div>
    </form>
  );
}
