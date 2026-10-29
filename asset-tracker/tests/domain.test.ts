import { describe, expect, it } from "vitest";
import {
  afterUpload,
  approvalBecomesCurrent,
  can,
  channelState,
  downloadName,
  formatBytes,
  guessAssetType,
  needsPublishing,
  timeAgo,
} from "@/lib/domain";

describe("channelState", () => {
  it("is not_ready until a version is approved", () => {
    expect(channelState(null, null)).toBe("not_ready");
  });
  it("is pending when the channel never had it marked live", () => {
    expect(channelState("v3", null)).toBe("pending");
  });
  it("is live only when the channel shows the current version", () => {
    expect(channelState("v3", "v3")).toBe("live");
  });
  it("is outdated when the channel shows any other version, including after a rollback", () => {
    expect(channelState("v3", "v2")).toBe("outdated");
    expect(channelState("v2", "v3")).toBe("outdated");
  });
  it("needsPublishing covers pending and outdated only", () => {
    expect(["not_ready", "pending", "outdated", "live"].filter((s) => needsPublishing(s as never))).toEqual([
      "pending",
      "outdated",
    ]);
  });
});

describe("version workflow", () => {
  it("publishes straight away without approval", () => {
    expect(afterUpload(false)).toEqual({ review: "approved", assetStatus: "ready", becomesCurrent: true });
  });
  it("holds the upload for review with approval on", () => {
    expect(afterUpload(true)).toEqual({ review: "pending", assetStatus: "in_review", becomesCurrent: false });
  });
  it("never lets a late approval of an older version roll the asset back", () => {
    expect(approvalBecomesCurrent(4, 3)).toBe(true);
    expect(approvalBecomesCurrent(2, 3)).toBe(false);
    expect(approvalBecomesCurrent(1, null)).toBe(true);
  });
});

describe("permissions", () => {
  it("only designers and admins upload", () => {
    expect(can({ role: "designer" }, "upload")).toBe(true);
    expect(can({ role: "member" }, "upload")).toBe(false);
  });
  it("viewers are read-only", () => {
    for (const a of ["upload", "review", "mark_live", "comment", "request", "admin"] as const) {
      expect(can({ role: "viewer" }, a)).toBe(false);
    }
  });
  it("deactivated users can do nothing", () => {
    expect(can({ role: "admin", active: false }, "admin")).toBe(false);
  });
});

describe("naming and formatting", () => {
  it("renames downloads consistently", () => {
    expect(downloadName("SIP-300", "Main image", 3, "FINAL_final v2 (1).PNG")).toBe("SIP-300_Main-image_v3.png");
    expect(downloadName("A/B", "Vidéo 1", 1, "noext")).toBe("A-B_Video-1_v1");
  });
  it("guesses asset types from slot names", () => {
    expect(guessAssetType("Product video")).toBe("video");
    expect(guessAssetType("A+ content")).toBe("a_plus");
    expect(guessAssetType("Brand Story")).toBe("a_plus");
    expect(guessAssetType("Store banner")).toBe("banner");
    expect(guessAssetType("Image 4")).toBe("image");
  });
  it("formats sizes and times", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(0)).toBe("0 B");
    const now = new Date("2026-01-10T12:00:00Z");
    expect(timeAgo(new Date("2026-01-10T11:59:50Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-01-10T09:00:00Z"), now)).toBe("3 hours ago");
    expect(timeAgo(new Date("2026-01-09T12:00:00Z"), now)).toBe("1 day ago");
  });
});
