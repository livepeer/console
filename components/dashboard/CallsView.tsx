"use client";

import { useMemo, useState } from "react";
import { Activity, Filter, Search } from "lucide-react";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import CallsTable from "@/components/dashboard/CallsTable";
import EnvironmentFilter, {
  ALL_ENVIRONMENTS,
} from "@/components/dashboard/EnvironmentFilter";
import {
  recentRequestsForEnvironment,
  MOCK_RECENT_REQUESTS,
} from "@/lib/dashboard/mock-data";

type KindFilter = "all" | "batch" | "live";

const KIND_TABS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "batch", label: "Batch" },
];

/**
 * CallsView — the standalone /calls list: every call this organization made
 * across the network (what counts toward its usage). A Batch / Live segmented
 * filter splits the two invocation shapes the Runner SDK exposes — batch
 * `predict` request/response vs live streaming `session` — and the table's
 * metric column follows suit (latency for batch, session duration for live).
 */
export default function CallsView() {
  const [query, setQuery] = useState("");
  const [envFilter, setEnvFilter] = useState(ALL_ENVIRONMENTS);
  const [kind, setKind] = useState<KindFilter>("all");

  const allEnvs = envFilter === ALL_ENVIRONMENTS;

  // Env-scoped set drives the segmented-filter counts (before the kind filter).
  const envScoped = useMemo(
    () =>
      allEnvs ? MOCK_RECENT_REQUESTS : recentRequestsForEnvironment(envFilter),
    [allEnvs, envFilter],
  );
  const counts = useMemo(
    () => ({
      all: envScoped.length,
      batch: envScoped.filter((r) => r.kind === "batch").length,
      live: envScoped.filter((r) => r.kind === "live").length,
    }),
    [envScoped],
  );

  const rows = useMemo(() => {
    let scoped = kind === "all" ? envScoped : envScoped.filter((r) => r.kind === kind);
    const q = query.trim().toLowerCase();
    if (q) {
      scoped = scoped.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q) ||
          r.pipeline.toLowerCase().includes(q),
      );
    }
    // Live, in-progress sessions float to the top — they're happening now.
    // (Array.sort is stable, so terminal rows keep their newest-first order.)
    return [...scoped].sort(
      (a, b) =>
        (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1),
    );
  }, [envScoped, kind, query]);

  return (
    <>
      <DashboardPageHeader
        title="Calls"
        icon={Activity}
        actions={
          <>
            <EnvironmentFilter value={envFilter} onChange={setEnvFilter} />
            <button
              type="button"
              className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
            >
              <Filter className="h-3 w-3" aria-hidden="true" />
              Display
            </button>
          </>
        }
      />

      {/* Filter bar — Batch / Live segmented control + search. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-dark px-5 py-2.5">
        <div
          className="inline-flex items-center rounded-[5px] border border-hairline bg-dark-card p-0.5"
          role="tablist"
          aria-label="Filter calls by kind"
        >
          {KIND_TABS.map((t) => {
            const active = kind === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setKind(t.key)}
                className={`inline-flex h-[24px] items-center gap-1.5 rounded-[3px] px-2.5 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors ${
                  active
                    ? "bg-dark-lighter text-fg shadow-card"
                    : "text-fg-faint hover:text-fg-strong"
                }`}
              >
                {t.label}
                <span
                  className={`tabular-nums ${active ? "text-fg-faint" : "text-fg-disabled"}`}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex w-[280px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5 py-1">
          <Search className="h-3 w-3 text-fg-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search calls by id, prompt, or model…"
            className="flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
          />
        </div>
      </div>

      {/* Calls list — shared `CallsTable` (cozy density for the full-bleed view) */}
      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[13px] text-fg-faint">
            {query
              ? `No calls match “${query}”`
              : `No ${kind === "all" ? "" : kind + " "}calls in this view`}
          </p>
        </div>
      ) : (
        <CallsTable
          rows={rows}
          showHeader
          bordered={false}
          density="cozy"
          showEnvironment={allEnvs}
        />
      )}
    </>
  );
}
