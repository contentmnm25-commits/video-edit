import { describe, expect, it } from "vitest";
import { createUploadTarget, isSafeKey, keyBelongsToAsset, safeFileName, verifyLocalUploadToken } from "@/lib/storage";

const asset = "3f1c2a8e-1111-4222-8333-444455556666";
const folder = "9a8b7c6d-1111-4222-8333-444455556666";

describe("storage keys", () => {
  it("accepts only well-formed keys", () => {
    expect(isSafeKey(`assets/${asset}/${folder}/main.jpg`)).toBe(true);
    expect(isSafeKey(`assets/${asset}/${folder}/../../etc/passwd`)).toBe(false);
    expect(isSafeKey(`/etc/passwd`)).toBe(false);
    expect(isSafeKey(`assets/${asset}/${folder}/a b.jpg`)).toBe(false);
  });
  it("ties uploads to their asset", () => {
    expect(keyBelongsToAsset(`assets/${asset}/${folder}/x.jpg`, asset)).toBe(true);
    expect(keyBelongsToAsset(`assets/${folder}/${asset}/x.jpg`, asset)).toBe(false);
  });
  it("sanitises file names", () => {
    expect(safeFileName("My Final (v2).PNG")).toBe("My-Final-v2-.PNG");
    expect(safeFileName("////")).toBe("file");
  });
  it("signs local upload URLs and rejects tampering", async () => {
    const key = `assets/${asset}/${folder}/main.jpg`;
    const target = await createUploadTarget(key, "image/jpeg");
    const p = new URL(target.url, "http://x").searchParams;
    expect(verifyLocalUploadToken(p.get("key")!, p.get("expires")!, p.get("token")!)).toBe(true);
    const other = `assets/${asset}/${folder}/other.jpg`;
    expect(verifyLocalUploadToken(other, p.get("expires")!, p.get("token")!)).toBe(false);
    expect(verifyLocalUploadToken(key, "1", p.get("token")!)).toBe(false);
  });
});
