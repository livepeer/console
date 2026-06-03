"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScrollText, Search, Upload } from "lucide-react";
import StatusDot from "@/components/dashboard/StatusDot";
import { PIPELINES } from "@/lib/dashboard/mock-data";
import type { Pipeline } from "@/lib/dashboard/types";

// Per-app accent for tagging lines in the aggregated stream.
const APP_COLORS = ["#40bf86", "#25abd0", "#8b5cf6", "#e5a536", "#d94f70"];

type Level = "info" | "warn" | "error";
interface LogLine {
  id: string;
  time: string;
  appId: string;
  appName: string;
  color: string;
  level: Level;
  msg: string;
}

const LEVEL_COLOR: Record<Level, string> = {
  info: "text-fg-faint",
  warn: "text-warm",
  error: "text-red-400",
};

// Shared grid template — keeps the column header aligned with the log rows.
const LOG_GRID = "grid grid-cols-[84px_180px_60px_minmax(0,1fr)] gap-3";

// The lines a single app emits, derived from its kind + status — mirrors the
// per-app Logs tab on the App detail page, aggregated here across the env.
function appLines(app: Pipeline): { level: Level; msg: string }[] {
  if (app.status === "building") {
    return [
      { level: "info", msg: `building image ${app.image.split("/").pop()}` },
      { level: "info", msg: "resolving python packages" },
      { level: "info", msg: "running prepare step (caching weights)" },
      { level: "warn", msg: "image is large (4.2 GB) — first cold start may be slow" },
    ];
  }
  if (app.status === "error") {
    return [
      { level: "info", msg: "session started — events channel open" },
      { level: "info", msg: "setup() complete · model=whisper-tiny.en" },
      { level: "error", msg: "data SSE proxy torn down before final emit_data (go-livepeer#3922)" },
      { level: "error", msg: "5 records emitted → 3 delivered" },
    ];
  }
  if (app.kind === "live") {
    return [
      { level: "info", msg: "/stream/start · session 8f2a · allocating video track" },
      { level: "info", msg: "process_video: 24.0 fps in / 23.8 fps out" },
      { level: "info", msg: "heartbeat" },
      { level: "info", msg: "process_video: 24.0 fps in / 23.9 fps out" },
    ];
  }
  return [
    { level: "info", msg: `POST /predict · 200 · ${app.p50LatencyMs || 60}ms` },
    { level: "info", msg: "POST /predict · 200 · 71ms" },
    { level: "warn", msg: "POST /predict · 200 · 184ms (slow — orchestrator cold)" },
    { level: "info", msg: "POST /predict · 200 · 63ms" },
  ];
}

function fmtTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor(totalSeconds / 60) % 60;
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Aggregate every app's lines into one chronological stream (oldest → newest,
// like a tail). Round-robin interleave so apps appear mixed, then stamp
// monotonically increasing times.
function buildLogs(apps: Pipeline[]): LogLine[] {
  const active = apps.filter((a) => a.status !== "stopped");
  const perApp = active.map((app, i) => ({
    app,
    color: APP_COLORS[i % APP_COLORS.length],
    lines: appLines(app),
  }));
  const maxLen = perApp.reduce((m, p) => Math.max(m, p.lines.length), 0);

  const merged: Omit<LogLine, "id" | "time">[] = [];
  for (let li = 0; li < maxLen; li++) {
    for (const p of perApp) {
      const line = p.lines[li];
      if (line)
        merged.push({
          appId: p.app.id,
          appName: p.app.name,
          color: p.color,
          level: line.level,
          msg: line.msg,
        });
    }
  }

  // Base ~14:32:00; each line +2–4s so timestamps read like a live tail.
  const base = 14 * 3600 + 32 * 60;
  return merged.map((m, idx) => ({
    id: `log-${idx}`,
    time: fmtTime(base + idx * 3),
    ...m,
  }));
}

export default function LogsView() {
  // Logs is a live operational tail across every deployed app, all environments
  // at once. One entry per app — multi-environment deployments are deduped by
  // pipelineId so the source list and filter pills don't show an app twice.
  const apps = useMemo(() => {
    const seen = new Set<string>();
    return PIPELINES.filter((p) => {
      if (seen.has(p.pipelineId)) return false;
      seen.add(p.pipelineId);
      return true;
    });
  }, []);
  const activeApps = apps.filter((a) => a.status !== "stopped");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const logs = useMemo(() => buildLogs(apps), [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (appFilter === "all" || l.appId === appFilter) &&
        (!q ||
          l.msg.toLowerCase().includes(q) ||
          l.appName.toLowerCase().includes(q)),
    );
  }, [logs, appFilter, query]);

  return (
    <>
      {activeApps.length === 0 ? (
        <div className="mx-auto w-full max-w-[1100px] px-7 pt-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-hairline bg-dark-card text-fg-muted">
            <ScrollText className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <p className="mt-4 text-[15px] font-medium text-fg">No logs yet</p>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-fg-muted">
            Deploy an app and its runtime logs will stream here.
          </p>
          <Link
            href="/apps"
            className="btn-primary mt-4 inline-flex h-[28px] items-center gap-1.5 rounded-[4px] px-3 text-[12.5px] font-medium transition-colors"
          >
            <Upload className="h-3 w-3" aria-hidden="true" />
            Deploy an app
          </Link>
        </div>
      ) : (
        <>
          {/* Filter bar — app filter pills + search */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-dark px-5 py-2.5">
            <span className="inline-flex items-center gap-1.5 pr-1 text-[11.5px] text-fg-faint">
              <StatusDot tone="green" />
              live
            </span>
            <span className="mx-1 h-3.5 w-px bg-hairline" aria-hidden="true" />
            <FilterPill
              label="All apps"
              active={appFilter === "all"}
              onClick={() => setAppFilter("all")}
            />
            {activeApps.map((app, i) => (
              <FilterPill
                key={app.id}
                label={app.name}
                color={APP_COLORS[i % APP_COLORS.length]}
                active={appFilter === app.id}
                onClick={() => setAppFilter(app.id)}
              />
            ))}
            <div className="ml-auto flex w-[260px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5 py-1">
              <Search className="h-3 w-3 text-fg-faint" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter logs…"
                className="flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
              />
            </div>
          </div>

          {/* Column header — aligns with the grid rows below. */}
          <div className={`${LOG_GRID} border-b border-hairline bg-dark px-5 py-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled`}>
            <span>Time</span>
            <span>Source</span>
            <span>Level</span>
            <span>Message</span>
          </div>

          {/* Log stream */}
          <div className="flex-1 overflow-y-auto bg-dark font-mono text-[12px]">
            {filtered.length === 0 ? (
              <p className="py-10 text-center font-sans text-[13px] text-fg-faint">
                No log lines match your filter.
              </p>
            ) : (
              filtered.map((l) => (
                <div
                  key={l.id}
                  className={`${LOG_GRID} items-baseline px-5 py-[5px] leading-[1.5] transition-colors hover:bg-zebra`}
                >
                  <span className="tabular-nums text-fg-disabled">{l.time}</span>
                  <span
                    className="inline-flex min-w-0 items-center gap-1.5"
                    title={l.appName}
                  >
                    <span
                      className="h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: l.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-fg-muted">{l.appName}</span>
                  </span>
                  <span className={`uppercase ${LEVEL_COLOR[l.level]}`}>
                    {l.level}
                  </span>
                  <span className="truncate text-fg-strong" title={l.msg}>
                    {l.msg}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

function FilterPill({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border px-2 text-[11.5px] transition-colors ${
        active
          ? "border-subtle bg-dark-card text-fg"
          : "border-hairline text-fg-faint hover:bg-dark-card hover:text-fg-strong"
      }`}
    >
      {color && (
        <span
          className="h-[5px] w-[5px] rounded-full"
          style={{ background: color }}
          aria-hidden="true"
        />
      )}
      {label}
    </button>
  );
}
