"use client";

import { useState, useMemo } from "react";
import { Search, RefreshCw } from "lucide-react";
import StatCard from "./StatCard";
import EmptyState from "@/components/dashboard/EmptyState";
import KpiStrip from "@/components/dashboard/KpiStrip";
import { PIPELINE_UTILIZATION, LIVE_JOBS } from "@/lib/dashboard/mock-data";
import type { NetworkStat, PipelineUtilization, LiveJobStatus } from "@/lib/dashboard/types";

// ─── Utilization bar ───

function UtilBar({ pct }: { pct: number }) {
  const color =
    pct >= 80
      ? "bg-green-bright"
      : pct >= 50
        ? "bg-green-bright/60"
        : pct >= 20
          ? "bg-blue-bright/60"
          : "bg-fg-faint";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-tint">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-fg-faint">{pct}%</span>
    </div>
  );
}

// ─── Status badge ───

function StatusBadge({ status }: { status: PipelineUtilization["status"] | LiveJobStatus }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-green-bright/10", text: "text-green-bright", label: "Active" },
    online: { bg: "bg-green-bright/10", text: "text-green-bright", label: "online" },
    degraded: { bg: "bg-yellow-400/10", text: "text-yellow-400", label: "degraded" },
    cold: { bg: "bg-tint", text: "text-fg-label", label: "Cold" },
    completed: { bg: "bg-tint", text: "text-fg-label", label: "done" },
  };
  const { bg, text, label } = config[status] || config.cold;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${bg} ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "online" || status === "active" ? "bg-green-bright" : status === "degraded" ? "bg-yellow-400" : "bg-fg-faint"}`} />
      {label}
    </span>
  );
}

// ─── Live Job Feed ───

const REFRESH_OPTIONS = ["5s", "15s", "30s", "90s"];

function LiveJobFeed() {
  const [refreshInterval, setRefreshInterval] = useState("30s");
  const activeJobCount = LIVE_JOBS.filter((j) => j.status !== "completed").length;

  return (
    <div className="rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="border-b border-hairline px-4 py-3.5">
        {/* Row 1: title + sub on the left, LIVE badge on the right. */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-bold text-fg">Live job feed</p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              {LIVE_JOBS.length} jobs · {activeJobCount + 9} active orchestrators
            </p>
          </div>
          <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-green-bright/10 px-2 text-[11px] font-medium text-green-bright">
            <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-green-bright" />
            LIVE
          </span>
        </div>
        {/* Row 2: refresh interval segmented control. */}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div
            className="flex h-[26px] items-center gap-0.5 rounded-[4px] border border-hairline bg-dark-lighter p-0.5"
            role="tablist"
            aria-label="Refresh interval"
          >
            <RefreshCw className="ml-1 h-3 w-3 shrink-0 text-fg-disabled" />
            {REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={refreshInterval === opt}
                onClick={() => setRefreshInterval(opt)}
                className={`flex h-5 items-center rounded-[3px] px-2 text-[11.5px] font-medium transition-colors ${
                  refreshInterval === opt
                    ? "bg-pop text-fg"
                    : "text-fg-faint hover:text-fg-strong"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Column headers — outside scroll, desktop only */}
      <div className="hidden md:block overflow-x-auto">
        <div className="flex min-w-[600px] items-center gap-4 border-b border-hairline px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled">
          <span className="flex-1">Pipeline</span>
          <span className="w-44">Model</span>
          <span className="w-20 text-right">FPS</span>
          <span className="w-14 text-right">Age</span>
          <span className="w-20">Status</span>
        </div>
      </div>

      {/* Scrollable rows — desktop table, mobile card list */}
      <div className="scrollbar-dark max-h-[360px] overflow-y-auto md:overflow-x-auto">
        <div className="divide-y divide-[var(--color-border-hairline)]">
          {LIVE_JOBS.map((job) => {
            const fps =
              job.fpsIn != null
                ? `${job.fpsIn.toFixed(0)} / ${job.fpsOut?.toFixed(0)}`
                : job.latencyMs != null
                  ? `${job.latencyMs}ms`
                  : "—";
            return (
              <div key={job.id}>
                {/* Desktop row */}
                <div className="hidden md:flex min-w-[600px] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-zebra">
                  <span className="flex-1 text-sm text-fg-strong">{job.pipeline}</span>
                  <span className="w-44 truncate text-xs text-fg-faint">{job.model}</span>
                  <span className="w-20 text-right text-xs text-fg-faint">{fps}</span>
                  <span className="w-14 text-right text-[11px] text-fg-label">{job.age}</span>
                  <span className="w-20">
                    <StatusBadge status={job.status} />
                  </span>
                </div>
                {/* Mobile card */}
                <div className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-zebra md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-fg-strong">
                      {job.pipeline}
                    </span>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="truncate text-[11px] text-fg-label">
                    {job.model}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-fg-faint">
                    <span>FPS {fps}</span>
                    <span className="text-fg-disabled">·</span>
                    <span>Age {job.age}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main ───

const PIPELINE_PAGE_SIZE = 20;

export default function UtilizationTab() {
  const [search, setSearch] = useState("");
  const [pipelinePage, setPipelinePage] = useState(0);

  const kpi: NetworkStat[] = useMemo(() => {
    const active = PIPELINE_UTILIZATION.filter((p) => p.status !== "cold");
    const totalWarm = PIPELINE_UTILIZATION.reduce((s, p) => s + p.warmOrchestrators, 0);
    // Derive Active Jobs from the LIVE_JOBS feed instead of a literal so it
    // tracks reality when the mock data changes.
    const activeJobs = LIVE_JOBS.filter((j) => j.status !== "completed").length;

    return [
      { label: "Active Jobs", value: `${activeJobs}`, delta: "+3", trend: "up" as const },
      { label: "Active Pipelines", value: `${active.length}`, trend: "flat" as const },
      { label: "Warm Capabilities", value: `${totalWarm}`, delta: "+12", trend: "up" as const },
      { label: "Requests (1h)", value: "4,280", delta: "+340", trend: "up" as const },
    ];
  }, []);

  const filteredPipelines = useMemo(() => {
    if (!search) return PIPELINE_UTILIZATION;
    const q = search.toLowerCase();
    return PIPELINE_UTILIZATION.filter((p) => p.name.toLowerCase().includes(q));
  }, [search]);

  const pipelineTotalPages = Math.ceil(filteredPipelines.length / PIPELINE_PAGE_SIZE);
  const pipelinePageItems = filteredPipelines.slice(
    pipelinePage * PIPELINE_PAGE_SIZE,
    (pipelinePage + 1) * PIPELINE_PAGE_SIZE,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-7 px-7 pt-7 pb-20">
      {/* No in-tab section header — page chrome + active tab pill identify
          the section. */}

      {/* KPI cards */}
      <KpiStrip cols={4}>
        {kpi.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </KpiStrip>

      {/* Live Jobs */}
      <LiveJobFeed />

      {/* Pipelines */}
      <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        <div className="border-b border-hairline px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-bold text-fg">Pipelines</p>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                {filteredPipelines.length} active · {PIPELINE_UTILIZATION.filter((p) => p.status !== "cold").length} warm · {Math.round(
                  PIPELINE_UTILIZATION.filter((p) => p.status !== "cold").reduce((s, p) => s + p.utilizationPct, 0) /
                    PIPELINE_UTILIZATION.filter((p) => p.status !== "cold").length,
                )}% avg utilization
              </p>
            </div>
          </div>
          <div className="mt-3 flex h-[26px] w-full items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5 sm:max-w-[280px]">
            <Search className="h-3 w-3 shrink-0 text-fg-faint" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPipelinePage(0); }}
              placeholder="Search pipelines…"
              className="flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
            />
          </div>
        </div>

        {/* Column headers — outside scroll, desktop only */}
        <div className="hidden md:block overflow-x-auto">
          <div className="flex min-w-[700px] items-center gap-4 border-b border-hairline px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled">
            <span className="flex-1">Pipeline</span>
            <span className="w-16 text-right">Warm</span>
            <span className="w-16 text-right">Capacity</span>
            <span className="w-32">Utilization</span>
            <span className="w-20 text-right">Latency</span>
            <span className="w-20 text-right">Price</span>
            <span className="w-20">Status</span>
          </div>
        </div>

        {/* Paginated rows — desktop table, mobile card list. Empty state
            renders when search returns nothing instead of letting the table
            silently disappear. */}
        {filteredPipelines.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState
              variant="guided"
              icon={<Search className="h-4 w-4" />}
              title="No pipelines match your search"
              description={`No results for "${search}". Try a different name or clear the search.`}
            />
          </div>
        ) : (
        <div className="md:overflow-x-auto">
          <div className="divide-y divide-[var(--color-border-hairline)]">
            {pipelinePageItems.map((p) => (
              <div key={p.id}>
                {/* Desktop row */}
                <div className="hidden md:flex min-w-[700px] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-zebra">
                  <span className="flex-1 text-sm text-fg-strong">{p.name}</span>
                  <span className="w-16 text-right text-xs text-green-bright">
                    {p.warmOrchestrators}
                  </span>
                  <span className="w-16 text-right text-xs text-fg-faint">
                    {p.totalCapacity}
                  </span>
                  <span className="w-32">
                    <UtilBar pct={p.utilizationPct} />
                  </span>
                  <span className="w-20 text-right text-xs text-fg-faint">
                    {p.avgLatencyMs > 0 ? `${p.avgLatencyMs}ms` : "—"}
                  </span>
                  <span className="w-20 text-right text-xs text-fg-faint">
                    ${p.price}{p.priceUnit}
                  </span>
                  <span className="w-20">
                    <StatusBadge status={p.status} />
                  </span>
                </div>
                {/* Mobile card */}
                <div className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-zebra md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-fg-strong">
                      {p.name}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <UtilBar pct={p.utilizationPct} />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-fg-faint">
                    <span>
                      <span className="text-fg-disabled">Warm </span>
                      <span className="text-green-bright">{p.warmOrchestrators}</span>
                      <span className="text-fg-disabled"> / {p.totalCapacity}</span>
                    </span>
                    <span>
                      <span className="text-fg-disabled">Latency </span>
                      {p.avgLatencyMs > 0 ? `${p.avgLatencyMs}ms` : "—"}
                    </span>
                    <span>
                      <span className="text-fg-disabled">Price </span>${p.price}
                      {p.priceUnit}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Pagination */}
        {pipelineTotalPages > 1 && (
          <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5">
            <span className="text-[12px] text-fg-faint tabular-nums">
              Page {pipelinePage + 1} of {pipelineTotalPages} · {filteredPipelines.length} pipelines
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPipelinePage(Math.max(0, pipelinePage - 1))}
                disabled={pipelinePage === 0}
                className="inline-flex h-[26px] items-center rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:border-transparent disabled:hover:bg-transparent"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPipelinePage(Math.min(pipelineTotalPages - 1, pipelinePage + 1))}
                disabled={pipelinePage >= pipelineTotalPages - 1}
                className="inline-flex h-[26px] items-center rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:border-transparent disabled:hover:bg-transparent"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
