"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2 } from "lucide-react";
import { createVersion, findVersionByName, prepareUpload } from "@/app/actions/assets";
import { FormError, Modal, useCloseModal } from "@/components/modal";
import { cx } from "@/components/ui";
import { formatBytes } from "@/lib/domain";

type Meta = { width: number | null; height: number | null; durationSec: number | null; thumb: Blob | null };

export function UploadVersionButton({
  assetId,
  nextNumber,
  requireApproval,
  primary,
}: {
  assetId: string;
  nextNumber: number;
  requireApproval: boolean;
  primary?: boolean;
}) {
  return (
    <Modal
      trigger={
        <>
          <CloudUpload className="size-4" /> Upload v{nextNumber}
        </>
      }
      triggerClassName={primary ? "btn-primary" : "btn-secondary"}
      title={`Upload version ${nextNumber}`}
      description={
        requireApproval
          ? "It goes to a reviewer first. Once approved, every channel team is told to update."
          : "It becomes the current version straight away, and every channel team is told to update."
      }
    >
      <UploadForm assetId={assetId} />
    </Modal>
  );
}

function UploadForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const close = useCloseModal();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  async function choose(f: File | undefined | null) {
    setError(null);
    setWarning(null);
    setFile(f ?? null);
    if (!f) return;
    try {
      const dup = await findVersionByName(assetId, f.name);
      if (dup) setWarning(`v${dup.number} was uploaded with this exact file name. Make sure this is the corrected file.`);
    } catch {
      // Only a hint; ignore failures.
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a file to upload.");
    if (note.trim().length < 3) return setError("Say what changed in this version.");
    setError(null);
    setProgress(0);
    try {
      const meta = await readMeta(file);
      const contentType = file.type || "application/octet-stream";
      const prepared = await prepareUpload({
        assetId,
        fileName: file.name,
        contentType,
        size: file.size,
        withThumb: Boolean(meta.thumb),
      });
      if (!prepared.ok) throw new Error(prepared.error);
      const { file: fileTarget, thumb: thumbTarget, fileKey, thumbKey } = prepared.data;
      await put(fileTarget.url, fileTarget.headers, file, (p) => setProgress(Math.round(p * 97)));
      if (thumbTarget && meta.thumb) await put(thumbTarget.url, thumbTarget.headers, meta.thumb);
      setProgress(99);
      const created = await createVersion({
        assetId,
        fileKey,
        thumbKey,
        fileName: file.name,
        mimeType: contentType,
        width: meta.width,
        height: meta.height,
        durationSec: meta.durationSec,
        note: note.trim(),
      });
      if (!created.ok) throw new Error(created.error);
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files[0]);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          dragging ? "border-accent bg-accent-soft" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
        )}
      >
        <CloudUpload className="mb-2 size-8 text-gray-400" />
        {file ? (
          <>
            <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted">
              {formatBytes(file.size)} · {file.type || "unknown type"} · click to change
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Drop the file here, or click to choose</p>
            <p className="text-xs text-muted">Images, videos, PDFs or any design file</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
          disabled={busy}
        />
      </div>
      {warning && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning}</p>}
      <div>
        <label className="label" htmlFor="note">
          What changed? <span className="text-red-600">*</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="input"
          placeholder="e.g. Fixed the price badge, brighter background, new claim text"
          disabled={busy}
          required
        />
        <p className="mt-1 text-xs text-muted">The listing teams see this, so they know why they need to re-upload.</p>
      </div>
      <FormError error={error} />
      {busy && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">Uploading… {progress}%. Keep this window open.</p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy || !file}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
          Upload
        </button>
      </div>
    </form>
  );
}

function put(url: string, headers: Record<string, string>, body: Blob, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.responseText?.slice(0, 200) || `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and retry."));
    xhr.send(body);
  });
}

/** Dimensions, duration and a small JPEG preview, worked out in the browser. */
async function readMeta(file: File): Promise<Meta> {
  const empty: Meta = { width: null, height: null, durationSec: null, thumb: null };
  try {
    if (file.type.startsWith("image/")) {
      const bitmap = await createImageBitmap(file);
      const thumb = await drawThumb(bitmap, bitmap.width, bitmap.height);
      const meta = { width: bitmap.width, height: bitmap.height, durationSec: null, thumb };
      bitmap.close();
      return meta;
    }
    if (file.type.startsWith("video/")) return await videoMeta(file);
  } catch {
    // Formats the browser can't decode (PSD, TIFF, HEIC…) simply get no preview.
  }
  return empty;
}

function videoMeta(file: File): Promise<Meta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (meta: Meta) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    const timer = setTimeout(
      () => done({ width: video.videoWidth || null, height: video.videoHeight || null, durationSec: finite(video.duration), thumb: null }),
      10_000,
    );
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) * 0.1);
    };
    video.onseeked = async () => {
      const thumb = await drawThumb(video, video.videoWidth, video.videoHeight).catch(() => null);
      done({ width: video.videoWidth || null, height: video.videoHeight || null, durationSec: finite(video.duration), thumb });
    };
    video.onerror = () => done({ width: null, height: null, durationSec: null, thumb: null });
    video.src = url;
  });
}

const finite = (n: number) => (Number.isFinite(n) ? n : null);

function drawThumb(source: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  const max = 640;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#fff"; // transparent PNGs get a white backdrop, like on marketplaces
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82));
}
