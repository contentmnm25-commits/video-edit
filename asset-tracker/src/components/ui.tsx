import Link from "next/link";
import type { ReactNode } from "react";
import { Film, FileText, ImageIcon } from "lucide-react";
import type { AssetStatus } from "@/db/schema";
import {
  ASSET_STATUS_LABEL,
  CHANNEL_STATE_LABEL,
  fileKind,
  initials,
  type ChannelState,
} from "@/lib/domain";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs text-muted">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<AssetStatus, string> = {
  in_progress: "bg-gray-100 text-gray-700 ring-gray-200",
  in_review: "bg-violet-50 text-violet-700 ring-violet-200",
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  needs_correction: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  return <Pill className={STATUS_STYLE[status]}>{ASSET_STATUS_LABEL[status]}</Pill>;
}

export const CHANNEL_STATE_STYLE: Record<ChannelState, string> = {
  not_ready: "bg-gray-50 text-gray-500 ring-gray-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  outdated: "bg-red-50 text-red-700 ring-red-200",
  live: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const CHANNEL_DOT: Record<ChannelState, string> = {
  not_ready: "bg-gray-300",
  pending: "bg-amber-500",
  outdated: "bg-red-500",
  live: "bg-emerald-500",
};

export function ChannelStateBadge({ state }: { state: ChannelState }) {
  return <Pill className={CHANNEL_STATE_STYLE[state]}>{CHANNEL_STATE_LABEL[state]}</Pill>;
}

/** Compact "Amazon v2 ●" chip used in tables. */
export function ChannelChip({
  name,
  state,
  liveVersionNumber,
}: {
  name: string;
  state: ChannelState;
  liveVersionNumber: number | null;
}) {
  const title =
    state === "live"
      ? `${name}: showing the current version`
      : state === "outdated"
        ? `${name}: still showing v${liveVersionNumber}, needs updating`
        : state === "pending"
          ? `${name}: not published yet`
          : `${name}: nothing approved yet`;
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        CHANNEL_STATE_STYLE[state],
      )}
    >
      <span className={cx("size-1.5 rounded-full", CHANNEL_DOT[state])} />
      {name}
      {liveVersionNumber != null && <span className="opacity-70">v{liveVersionNumber}</span>}
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        className ?? "bg-gray-100 text-gray-700 ring-gray-200",
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 24,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.max(9, size * 0.4) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <span
      style={style}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Thumbnail for a version, falling back to an icon when there is none. */
export function Thumb({
  versionId,
  hasThumb,
  mimeType,
  className,
}: {
  versionId?: string | null;
  hasThumb?: boolean;
  mimeType?: string | null;
  className?: string;
}) {
  const kind = mimeType ? fileKind(mimeType) : "other";
  const Icon = kind === "video" ? Film : kind === "image" ? ImageIcon : FileText;
  return (
    <div
      className={cx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 ring-1 ring-line",
        className ?? "size-12",
      )}
    >
      {versionId && hasThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/versions/${versionId}/file?thumb=1`} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <Icon className="size-1/3 text-gray-400" aria-hidden />
      )}
      {kind === "video" && versionId && hasThumb && (
        <span className="absolute right-1 bottom-1 rounded bg-black/60 p-0.5">
          <Film className="size-3 text-white" aria-hidden />
        </span>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-gray-300">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  href,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "default" | "amber" | "red" | "violet" | "emerald";
  hint?: string;
}) {
  const toneClass = {
    default: "text-ink",
    amber: "text-amber-600",
    red: "text-red-600",
    violet: "text-violet-600",
    emerald: "text-emerald-600",
  }[tone];
  const body = (
    <>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={cx("mt-1 text-3xl font-semibold tabular-nums", value === 0 ? "text-gray-300" : toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition hover:border-gray-300 hover:shadow-sm">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}
