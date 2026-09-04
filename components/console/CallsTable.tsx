"use client";

import Link from "next/link";
import { formatCallMetric, formatRunRelativeTime } from "@/lib/console/utils";
import EnvTag from "@/components/console/EnvTag";
import StatusDot from "@/components/console/StatusDot";
import { useTickWhileActive } from "@/components/console/useTickWhileActive";
import type { AccountActivityRow } from "@/lib/console/types";

/**
 * CallsTable — the single Linear-style call list, used by:
 *   1. the History section on /home (formerly the standalone /calls view)
 *   2. the app-detail Logs tab (filtered to one app)
 *
 * Rows open the call inspector at `/home?request=<id>`, which is where the
 * drawer now lives.
 *
 * Full row vocabulary (left → right):
 *   8px status dot · mono short id · model · pipeline pill · latency|duration ·
 *   cost · via (signer) · relative time.
 *
 * History rows are quieter: relative time · model · modality pill · cost.
 *
 * The metric column adapts to the call's kind: a batch call reports **latency**
 * (one request/response), a live call reports **duration** (a streaming
 * session). The header follows the rows — "Latency" when they're all batch,
 * "Duration" when all live, "Elapsed" when mixed.
 */
export interface CallsTableProps {
  rows: AccountActivityRow[];
  showHeader?: boolean;
  bordered?: boolean;
  /** Density: `compact` (home-style) or `cozy` (standalone full-bleed). */
  density?: "compact" | "cozy";
  /** Render a per-row environment tag in the Call cell (for all-environment views). */
  showEnvironment?: boolean;
  /** Pin the column header while the rows scroll under it. Only meaningful
   *  when the caller puts this table inside a fixed-height scroll container. */
  stickyHeader?: boolean;
  /**
   * `full` — dot · call · metric · cost · via · time (the app Logs tab).
   * `requests` — call · cost · time. Signed-ticket rows carry neither a
   * latency nor a distinct signer, so on /home those columns rendered "—"
   * and a truncated "Livepeer A…" on every row.
   */
  variant?: "full" | "requests";
  /**
   * Colour for the row's leading dot, keyed off the row. When given, the dot
   * encodes *which capability* the call hit instead of the call's status. On
   * /home every row is a signed ticket, which only exists for a completed,
   * paid call, so a status dot there could only ever be green and said
   * nothing.
   */
  rowColor?: (row: AccountActivityRow) => string;
  className?: string;
}

export function modalityTag(pipeline: string): string {
  const normalized = pipeline.toLowerCase();
  const exact: Record<string, string> = {
    "audio-to-text": "a2t",
    "image-to-image": "i2i",
    "image-to-video": "i2v",
    language: "t2t",
    llm: "t2t",
    "live-transcoding": "v2v",
    "live-video-to-video": "v2v",
    "speech-to-text": "s2t",
    "text-generation": "t2t",
    "text-to-audio": "t2a",
    "text-to-image": "t2i",
    "text-to-speech": "t2s",
    "text-to-video": "t2v",
    transcoding: "v2v",
    "video-understanding": "v2t",
    "video-to-video": "v2v",
  };
  const mapped = exact[normalized];
  if (mapped) return mapped;

  const match = normalized.match(
    /^(text|image|video|audio|speech|live)-to-(text|image|video|audio|speech)$/
  );
  if (match) {
    const token = (part: string) =>
      part === "text"
        ? "t"
        : part === "image"
          ? "i"
          : part === "video"
            ? "v"
            : part === "audio"
              ? "a"
              : "s";
    return `${token(match[1]!)}2${token(match[2]!)}`;
  }

  return normalized
    .split(/[-_./|:]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 8);
}

function formatHistoryRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isFinite(then)) {
    const seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 60) return "30s";
  }

  return formatRunRelativeTime(iso).replace(/ ago$/, "");
}

export default function CallsTable({
  rows,
  showHeader = false,
  bordered = true,
  density = "compact",
  showEnvironment = false,
  stickyHeader = false,
  variant = "full",
  rowColor,
  className,
}: CallsTableProps) {
  const compact = variant === "requests";
  // Static class strings — Tailwind's JIT can't resolve interpolated arbitrary
  // values, so each density preset is spelled out in full.
  const cols = compact
    ? density === "cozy"
      ? "grid items-center gap-3 px-3 md:px-7 grid-cols-[minmax(0,1fr)_88px]"
      : "grid items-center gap-3 px-4 grid-cols-[minmax(0,1fr)_76px]"
    : density === "cozy"
      ? "grid items-center gap-3 px-5 grid-cols-[minmax(0,1fr)_80px_80px_80px_80px]"
      : "grid items-center gap-3 px-4 grid-cols-[minmax(0,1fr)_70px_70px_70px_70px]";
  const rowPadY = density === "cozy" ? "py-2.5" : "py-[7px]";

  // Metric column header follows the rows on screen (which the caller's
  // Batch/Live filter narrows): all batch → Latency, all live → Duration,
  // mixed → Elapsed.
  const kinds = new Set(rows.map((r) => r.kind));
  const metricLabel =
    kinds.size === 1 ? (kinds.has("live") ? "Duration" : "Latency") : "Elapsed";

  const nowMs = useTickWhileActive(rows.some((r) => r.status === "active"));

  const wrapperClass = [
    bordered
      ? "overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card"
      : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={wrapperClass || undefined}>
      {showHeader && (
        <div
          className={`${cols} border-b border-hairline bg-dark py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint ${
            stickyHeader ? "sticky top-0 z-10" : ""
          }`}
        >
          <span>Call</span>
          {!compact && <span className="text-right">{metricLabel}</span>}
          <span className="text-right">Cost</span>
          {!compact && <span className="text-right">Via</span>}
          {!compact && <span className="text-right">Time</span>}
        </div>
      )}
      {rows.map((row, i) => {
        const active = row.status === "active";
        const pipelineLabel = compact
          ? modalityTag(row.pipeline)
          : row.pipeline;
        const timeLabel = compact
          ? formatHistoryRelativeTime(row.timestamp)
          : formatRunRelativeTime(row.timestamp);
        const tone =
          row.status === "success"
            ? "bg-green-bright"
            : row.status === "timeout"
              ? "bg-warm"
              : "bg-red-400";
        const shadowRing =
          row.status === "success"
            ? "shadow-[0_0_0_2px_rgba(64,191,134,0.18)]"
            : "";
        return (
          <Link
            key={row.id}
            href={`/home?request=${row.id}`}
            scroll={false}
            className={`${cols} ${rowPadY} text-[12.5px] transition-colors hover:bg-hover ${
              // The header already draws its own bottom hairline; giving the
              // first row a top one too stacked them into a 2px divider.
              !compact && i > 0 ? "border-t border-hairline" : ""
            }`}
          >
            {/* Status dot sits inside the first cell, not in a column of its
                own, so the header label starts at the padding edge. */}
            <div className="flex min-w-0 items-center gap-2.5">
              {compact && (
                <span className="w-16 shrink-0 text-left text-[12.5px] text-fg-faint">
                  {timeLabel}
                </span>
              )}
              {!compact &&
                (rowColor ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: rowColor(row) }}
                    aria-hidden="true"
                  />
                ) : active ? (
                  // Liveness pulse for an in-progress session (warm per the
                  // liveness color convention).
                  <StatusDot tone="warm" size="md" />
                ) : (
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${tone} ${shadowRing}`}
                    aria-hidden="true"
                  />
                ))}
              {!compact && (
                <span className="shrink-0 font-mono text-[11.5px] text-fg-faint tabular-nums">
                  {row.id.slice(-7)}
                </span>
              )}
              <span className="min-w-0 truncate font-medium text-fg-strong">
                {row.model}
              </span>
              <span
                className={`inline-flex h-[18px] shrink-0 items-center rounded-[3px] px-1.5 font-mono text-[10.5px] text-fg-faint ${
                  compact ? "bg-foreground/3" : "border border-hairline"
                }`}
              >
                {pipelineLabel}
              </span>
              {showEnvironment && <EnvTag environmentId={row.environmentId} />}
            </div>
            {!compact && (
              <span
                className={`text-right font-mono text-[11.5px] tabular-nums ${
                  active ? "text-warm" : "text-fg-strong"
                }`}
              >
                {formatCallMetric(row, nowMs)}
              </span>
            )}
            <span
              className={`text-right text-fg ${
                compact ? "text-[12.5px]" : "font-mono text-[11.5px]"
              }`}
            >
              {row.costDisplay}
            </span>
            {!compact && (
              <span className="truncate text-right font-mono text-[11.5px] text-fg-faint">
                {row.signerLabel}
              </span>
            )}
            {!compact && (
              <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-faint">
                {timeLabel}
              </span>
            )}
          </Link>
        );
      })}
    </section>
  );
}
