// Pure business rules and display labels. No database or framework imports,
// so this file is shared by server code, client components and unit tests.

import type { AssetStatus, AssetType, Priority, RequestStatus, RequestType, Role, Team } from "@/db/schema";

// ─── Channel state ─────────────────────────────────────────────────────

/**
 * Where an asset stands on one channel.
 * - not_ready: no approved version exists yet, nothing to publish
 * - pending:   an approved version exists but this channel has never had it marked live
 * - outdated:  the channel shows an older (or rolled-back) version, not the current one
 * - live:      the channel shows the current version
 */
export type ChannelState = "not_ready" | "pending" | "outdated" | "live";

export function channelState(
  currentVersionId: string | null | undefined,
  liveVersionId: string | null | undefined,
): ChannelState {
  if (!currentVersionId) return "not_ready";
  if (!liveVersionId) return "pending";
  return liveVersionId === currentVersionId ? "live" : "outdated";
}

/** Channel states that mean "someone has to go and upload this". */
export function needsPublishing(state: ChannelState) {
  return state === "pending" || state === "outdated";
}

export const CHANNEL_STATE_LABEL: Record<ChannelState, string> = {
  not_ready: "Not ready",
  pending: "To publish",
  outdated: "Outdated",
  live: "Live",
};

// ─── Permissions ───────────────────────────────────────────────────────

export type Action =
  | "upload"
  | "review"
  | "set_current"
  | "mark_live"
  | "flag_correction"
  | "comment"
  | "manage_catalog"
  | "request"
  | "admin";

const ALLOWED: Record<Action, Role[]> = {
  upload: ["admin", "designer"],
  review: ["admin", "reviewer"],
  set_current: ["admin", "designer", "reviewer"],
  mark_live: ["admin", "reviewer", "member"],
  flag_correction: ["admin", "designer", "reviewer", "member"],
  comment: ["admin", "designer", "reviewer", "member"],
  manage_catalog: ["admin", "designer", "reviewer", "member"],
  request: ["admin", "designer", "reviewer", "member"],
  admin: ["admin"],
};

export function can(user: { role: Role; active?: boolean } | null | undefined, action: Action) {
  if (!user || user.active === false) return false;
  return ALLOWED[action].includes(user.role);
}

// ─── Version workflow ──────────────────────────────────────────────────

/** What happens to an asset when a new version is uploaded. */
export function afterUpload(requireApproval: boolean): {
  review: "pending" | "approved";
  assetStatus: AssetStatus;
  becomesCurrent: boolean;
} {
  return requireApproval
    ? { review: "pending", assetStatus: "in_review", becomesCurrent: false }
    : { review: "approved", assetStatus: "ready", becomesCurrent: true };
}

/**
 * Approving a version only makes it current if it is newer than the current one,
 * so approving an old pending upload late can't silently roll the asset back.
 */
export function approvalBecomesCurrent(
  approvedNumber: number,
  currentNumber: number | null | undefined,
) {
  return currentNumber == null || approvedNumber > currentNumber;
}

// ─── File naming ───────────────────────────────────────────────────────

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function fileExtension(fileName: string) {
  const match = /\.([a-zA-Z0-9]{1,8})$/.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

/** Consistent download name, whatever the designer called the file: SKU_Asset-name_v3.jpg */
export function downloadName(sku: string, assetName: string, versionNumber: number, original: string) {
  const ext = fileExtension(original);
  const base = `${slugify(sku) || "asset"}_${slugify(assetName) || "file"}_v${versionNumber}`;
  return ext ? `${base}.${ext}` : base;
}

/** Best guess of an asset's type from its slot name, for templates and CSV import. */
export function guessAssetType(name: string): AssetType {
  const n = name.toLowerCase();
  if (/video|reel|film|clip/.test(n)) return "video";
  if (/a\+|a-plus|aplus|ebc|enhanced|brand story/.test(n)) return "a_plus";
  if (/banner|store|header|carousel/.test(n)) return "banner";
  if (/social|insta|story|post|ugc/.test(n)) return "social";
  return "image";
}

export function fileKind(mimeType: string): "image" | "video" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "other";
}

// ─── Labels ────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  designer: "Designer",
  reviewer: "Reviewer",
  member: "Team member",
  viewer: "Viewer",
};

export const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including people, channels and settings",
  designer: "Uploads new versions, works on requests",
  reviewer: "Approves or rejects versions, marks live",
  member: "Downloads, marks live, raises requests and corrections",
  viewer: "Read-only access and downloads",
};

export const TEAM_LABEL: Record<Team, string> = {
  design: "Design",
  marketing: "Marketing",
  content: "Content",
  listing: "Listing",
  qcom: "Quick commerce",
  ecom: "E-commerce",
  other: "Other",
};

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  image: "Listing image",
  video: "Video",
  a_plus: "A+ content",
  banner: "Banner",
  social: "Social",
  other: "Other",
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  in_progress: "In progress",
  in_review: "In review",
  ready: "Ready",
  needs_correction: "Needs correction",
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  new_creative: "New creative",
  correction: "Correction",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

// ─── Formatting ────────────────────────────────────────────────────────

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function timeAgo(date: Date | string | null | undefined, now: Date = new Date()) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diff < 45) return "just now";
  const steps: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
  ];
  if (diff < 3600) return plural(Math.round(diff / steps[0][0]), steps[0][1]);
  if (diff < 86400) return plural(Math.round(diff / steps[1][0]), steps[1][1]);
  if (diff < 604800) return plural(Math.round(diff / steps[2][0]), steps[2][1]);
  if (diff < 2592000) return plural(Math.round(diff / steps[3][0]), steps[3][1]);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function daysAgo(days: number, now: Date = new Date()) {
  return new Date(now.getTime() - days * 86400_000);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
