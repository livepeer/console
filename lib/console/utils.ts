import {
  Film,
  Wand2,
  ScanSearch,
  Radio,
  ImageIcon,
  Mic2,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { App, AppCategory, AccountActivityRow } from "./types";

const CATEGORY_ICONS: Record<AppCategory, LucideIcon> = {
  "Video Generation": Film,
  "Video Editing": Wand2,
  "Video Understanding": ScanSearch,
  "Live Transcoding": Radio,
  "Image Generation": ImageIcon,
  Speech: Mic2,
  Language: MessageSquare,
};

export function getAppIcon(category: AppCategory): LucideIcon {
  return CATEGORY_ICONS[category] ?? MessageSquare;
}

export function formatRuns(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Call-row formatters ────────────────────────────────────────────────────
//
// Shared by every surface that renders an `AccountActivityRow`: the home
// "Recent activity" panel, the standalone /calls view, and the app-detail
// Logs tab. Centralized here so all of them speak the same vocabulary (e.g.
// "284ms" vs "1.2s", "2m 18s" vs "45s", "5m ago" vs "yesterday").

export function formatRunLatency(ms: number | null): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

/**
 * The right "how long" value for a call row:
 *  - active (live, in progress) → elapsed since it started, ticking
 *  - completed live            → final session duration
 *  - batch                     → request latency
 * Pass `nowMs` (a ticking clock) so active rows update live.
 */
export function formatCallMetric(
  row: AccountActivityRow,
  nowMs?: number
): string {
  if (row.status === "active") {
    const startedMs = new Date(row.timestamp).getTime();
    const elapsed = Math.max(0, (nowMs ?? Date.now()) - startedMs);
    return formatRunDuration(elapsed);
  }
  return row.kind === "live"
    ? formatRunDuration(row.durationMs)
    : formatRunLatency(row.latencyMs);
}

/** Live-session length: "45s", "2m 18s", "1h 4m". "—" when absent. */
export function formatRunDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (totalMin < 60) return s === 0 ? `${totalMin}m` : `${totalMin}m ${s}s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatRunRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export const NEW_MODEL_WINDOW_DAYS = 30;

export function isModelNew(model: { releasedAt?: string }): boolean {
  if (!model.releasedAt) return false;
  const released = new Date(model.releasedAt).getTime();
  if (Number.isNaN(released)) return false;
  return Date.now() - released < NEW_MODEL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function formatPrice(model: App): string {
  if (
    model.pricing.inputPrice !== undefined &&
    model.pricing.outputPrice !== undefined
  ) {
    return `$${model.pricing.inputPrice} in / $${model.pricing.outputPrice} out /${model.pricing.unit}`;
  }
  return `$${model.pricing.amount} /${model.pricing.unit}`;
}

// Per-call cost estimate displayed in playground (CostTag mode="cost") and
// in code-snippet annotations. Resolution by unit:
//   Request / Step: one unit per call
//   Second / Minute: derived from inferenceTime when known, else one unit
//   M Tokens: one call ≈ ~500 output tokens (rough mock; tokens not tracked)
// Returned as a short USD string; sub-penny estimates render as "<$0.01" so
// expense badges never expose fractional pennies.
export function estimateCallCost(
  model: App,
  inferenceTimeSeconds?: number
): string {
  const { amount, unit } = model.pricing;
  let cost: number;
  switch (unit) {
    case "Second":
      cost = amount * (inferenceTimeSeconds ?? 1);
      break;
    case "Minute":
      cost = amount * ((inferenceTimeSeconds ?? 60) / 60);
      break;
    case "M Tokens":
      cost = amount * (500 / 1_000_000);
      break;
    case "Request":
    case "Step":
    default:
      cost = amount;
  }
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

// Stable mock request ID — used by RequestIdChip in playground output and
// (later) anywhere we want to show "this is what a real request ID looks like."
// Format mirrors common provider conventions (Stripe, OpenAI): `req_<12 hex>`.
export function generateMockRequestId(): string {
  const hex = Math.random().toString(16).slice(2, 14).padEnd(12, "0");
  return `req_${hex}`;
}

export function generateMockUsageData(days: number = 30) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const base = 1200 + Math.sin(i * 0.3) * 400;
    const requests = Math.round(base + Math.random() * 600);
    data.push({
      date: date.toISOString().split("T")[0],
      requests,
      cost: parseFloat((requests * 0.0032).toFixed(2)),
    });
  }
  return data;
}

const CATEGORY_GRADIENTS: Record<AppCategory, string> = {
  "Video Generation":
    "linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0f3460 100%)",
  "Video Editing":
    "linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 50%, #4a1942 100%)",
  "Video Understanding":
    "linear-gradient(135deg, #0a1a0a 0%, #1a2e1a 50%, #0f3d2e 100%)",
  "Live Transcoding":
    "linear-gradient(135deg, #0a1628 0%, #102030 50%, #1a3040 100%)",
  "Image Generation":
    "linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 50%, #4a1942 100%)",
  Speech: "linear-gradient(135deg, #1a1a1a 0%, #2a1f1a 50%, #3d2b1a 100%)",
  Language: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
};

export function getCategoryGradient(category: AppCategory): string {
  return CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Language;
}

export function computeAxisTicks<T, K extends keyof T>(
  data: T[],
  key: K,
  targetCount: number = 6
): Array<T[K]> {
  if (data.length === 0) return [];
  if (data.length <= targetCount) return data.map((d) => d[key]);
  const step = (data.length - 1) / (targetCount - 1);
  const ticks: Array<T[K]> = [];
  const seen = new Set<T[K]>();
  for (let i = 0; i < targetCount; i++) {
    const index = Math.round(i * step);
    const value = data[index][key];
    if (!seen.has(value)) {
      seen.add(value);
      ticks.push(value);
    }
  }
  return ticks;
}

export function generateSparklineData(points: number = 7): number[] {
  const data = [];
  let value = 50 + Math.random() * 30;
  for (let i = 0; i < points; i++) {
    value += (Math.random() - 0.45) * 15;
    data.push(Math.max(10, Math.round(value)));
  }
  return data;
}
