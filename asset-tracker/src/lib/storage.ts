import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, requireSecret } from "@/lib/env";

// Files never pass through server actions. The browser asks for an upload URL,
// PUTs the file straight to storage (S3/R2 presigned URL, or our local upload
// route), then registers the version. Downloads are served by
// /api/versions/[id]/file, which checks the session and then either streams
// the local file or redirects to a short-lived presigned URL.

export type UploadTarget = { url: string; headers: Record<string, string> };

const UPLOAD_TTL_SECONDS = 60 * 60;
const DOWNLOAD_TTL_SECONDS = 10 * 60;

export const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

/** Keys look like assets/<assetId>/<uuid>/<name>; reject anything else. */
export function isSafeKey(key: string) {
  return (
    /^assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,140}$/.test(key) && !key.includes("..")
  );
}

export function keyBelongsToAsset(key: string, assetId: string) {
  return isSafeKey(key) && key.startsWith(`assets/${assetId}/`);
}

export function safeFileName(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+/, "").slice(-120);
  return cleaned || "file";
}

// ─── Local driver helpers ──────────────────────────────────────────────

function localPath(key: string) {
  if (!isSafeKey(key)) throw new Error("Invalid file key");
  const full = path.join(LOCAL_ROOT, key);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid file key");
  return full;
}

function sign(payload: string) {
  return createHmac("sha256", requireSecret()).update(payload).digest("base64url");
}

export function verifyLocalUploadToken(key: string, expires: string, token: string) {
  if (!isSafeKey(key) || Number(expires) < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(`${key}:${expires}`));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function writeLocalFile(key: string, body: ReadableStream<Uint8Array>, maxBytes: number) {
  const full = localPath(key);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.part`;
  const out = fs.createWriteStream(tmp);
  let written = 0;
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.byteLength;
      if (written > maxBytes) throw new Error("File is larger than the upload limit");
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    await fsp.rename(tmp, full);
    return written;
  } catch (err) {
    out.destroy();
    await fsp.rm(tmp, { force: true });
    throw err;
  }
}

export async function statLocalFile(key: string) {
  try {
    const s = await fsp.stat(localPath(key));
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
}

export function openLocalFile(key: string, range?: { start: number; end: number }) {
  return fs.createReadStream(localPath(key), range);
}

// ─── S3 driver ─────────────────────────────────────────────────────────

let s3: S3Client | null = null;
function s3Client() {
  s3 ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    // The SDK otherwise signs a CRC32 checksum into presigned PUT URLs, which a
    // browser upload can't satisfy (R2 rejects it). Only send checksums when required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  return s3;
}
const bucket = () => {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not set");
  return b;
};

// ─── Public API ────────────────────────────────────────────────────────

export async function createUploadTarget(key: string, contentType: string): Promise<UploadTarget> {
  if (!isSafeKey(key)) throw new Error("Invalid file key");
  if (env.storageDriver === "s3") {
    const url = await getSignedUrl(
      s3Client(),
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_TTL_SECONDS },
    );
    return { url, headers: { "Content-Type": contentType } };
  }
  const expires = String(Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS);
  const params = new URLSearchParams({ key, expires, token: sign(`${key}:${expires}`) });
  return { url: `/api/uploads?${params}`, headers: { "Content-Type": contentType } };
}

/** Size in bytes if the object exists, else null. */
export async function objectSize(key: string): Promise<number | null> {
  if (!isSafeKey(key)) return null;
  if (env.storageDriver === "s3") {
    try {
      const head = await s3Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return head.ContentLength ?? 0;
    } catch {
      return null;
    }
  }
  const s = await statLocalFile(key);
  return s ? s.size : null;
}

export async function presignedDownloadUrl(
  key: string,
  opts: { fileName: string; contentType: string; inline: boolean },
) {
  const disposition = `${opts.inline ? "inline" : "attachment"}; filename="${opts.fileName}"`;
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: disposition,
      ResponseContentType: opts.contentType,
    }),
    { expiresIn: DOWNLOAD_TTL_SECONDS },
  );
}

export async function deleteObject(key: string) {
  if (!isSafeKey(key)) return;
  if (env.storageDriver === "s3") {
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } else {
    await fsp.rm(localPath(key), { force: true });
  }
}
