"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown, Filter, Plus, Search, X } from "lucide-react";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import JobsTable from "@/components/dashboard/JobsTable";
import { MOCK_RECENT_REQUESTS } from "@/lib/dashboard/mock-data";

// ── Filter pill ─────────────────────────────────────────────────────────────

function FilterPill({
  label,
  value,
  onClear,
  dashed,
}: {
  label: string;
  value?: string;
  onClear?: () => void;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border px-2 text-[11.5px] text-fg-strong transition-colors ${
        dashed
          ? "border-dashed border-hairline text-fg-muted hover:border-subtle hover:text-fg-strong"
          : "border-hairline bg-dark-card hover:bg-dark-lighter"
      }`}
    >
      <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-fg-faint">
        {label}
      </span>
      {value && <span>{value}</span>}
      {onClear ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 grid h-3.5 w-3.5 place-items-center border-l border-hairline pl-1 text-fg-faint hover:text-fg"
          aria-label={`Clear ${label} filter`}
        >
          <X className="h-2.5 w-2.5" />
        </span>
      ) : (
        <ChevronDown className="h-3 w-3 text-fg-faint" aria-hidden="true" />
      )}
    </button>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

/**
 * JobsView — full Jobs list per the Livepeer Dashboard design (Apr 2026).
 *
 * Linear "issue list" pattern: filter bar (Status / Model / Time pills + add
 * filter + search) above a flush panel of compact rows. Status uses the same
 * 8px dot vocabulary as the Home recent-jobs panel so the two surfaces feel
 * like one component.
 */
export default function JobsView() {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_RECENT_REQUESTS;
    return MOCK_RECENT_REQUESTS.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q) ||
        r.pipeline.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <DashboardPageHeader
        title="Jobs"
        icon={Activity}
        actions={
          <button
            type="button"
            className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
          >
            <Filter className="h-3 w-3" aria-hidden="true" />
            Display
          </button>
        }
      />

      {/* Filter bar — Linear-style sub-toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-dark px-5 py-2.5">
        <FilterPill label="Status" value="all" />
        <FilterPill label="Model" value="any" />
        <FilterPill label="Time" value="last 24h" onClear={() => {}} />
        <button
          type="button"
          className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-dashed border-hairline px-2 text-[11.5px] text-fg-muted transition-colors hover:border-subtle hover:text-fg-strong"
        >
          <Plus className="h-2.5 w-2.5" aria-hidden="true" />
          Filter
        </button>
        <div className="ml-auto flex w-[280px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5 py-1">
          <Search className="h-3 w-3 text-fg-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs by id, prompt, or model…"
            className="flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
          />
        </div>
      </div>

      {/* Jobs list — shared `JobsTable` (cozy density for the standalone full-bleed view) */}
      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[13px] text-fg-faint">
            No jobs match &ldquo;{query}&rdquo;
          </p>
        </div>
      ) : (
        <JobsTable
          rows={rows}
          showHeader
          bordered={false}
          density="cozy"
        />
      )}
    </>
  );
}
