"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Filter, Search } from "lucide-react";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import CallsTable from "@/components/dashboard/CallsTable";
import CallDetailDrawer from "@/components/dashboard/CallDetailDrawer";
import EnvironmentFilter, {
  ALL_ENVIRONMENTS,
} from "@/components/dashboard/EnvironmentFilter";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useAccountRequests } from "@/lib/dashboard/useAccountRequests";
import type { AccountActivityRow } from "@/lib/dashboard/types";

type KindFilter = "all" | "batch" | "live";

const KIND_TABS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "batch", label: "Batch" },
];

const EMPTY_ROWS: AccountActivityRow[] = [];

/**
 * CallsView — the standalone /calls list: every signed-ticket request this
 * account made (PymtHouse OpenMeter history). A Batch / Live segmented filter
 * splits invocation shapes inferred from pipeline. Clicking a row opens the
 * per-call inspector via `?request={id}`.
 */
export default function CallsView() {
  return (
    <Suspense fallback={null}>
      <CallsViewInner />
    </Suspense>
  );
}

function CallsViewInner() {
  const { user } = useAuth();
  const requests = useAccountRequests(user?.id?.trim());
  const [query, setQuery] = useState("");
  const [envFilter, setEnvFilter] = useState(ALL_ENVIRONMENTS);
  const [kind, setKind] = useState<KindFilter>("all");

  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request");

  const allRows = requests.status === "ready" ? requests.rows : EMPTY_ROWS;

  const openCall = requestId
    ? (allRows.find((r) => r.id === requestId) ?? null)
    : null;
  const [shownRow, setShownRow] = useState<AccountActivityRow | null>(null);
  useEffect(() => {
    if (openCall) setShownRow(openCall);
  }, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allEnvs = envFilter === ALL_ENVIRONMENTS;

  const envScoped = useMemo(
    () =>
      allEnvs ? allRows : allRows.filter((r) => r.environmentId === envFilter),
    [allEnvs, allRows, envFilter],
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

      {requests.status === "loading" || requests.status === "idle" ? (
        <div className="space-y-0 px-5 py-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center justify-between border-t border-hairline py-3 first:border-t-0"
            >
              <div className="h-4 w-48 rounded bg-tint" />
              <div className="h-3 w-16 rounded bg-tint" />
            </div>
          ))}
        </div>
      ) : requests.status === "error" ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[13px] text-fg-muted">Could not load signed-ticket requests.</p>
          <p className="mt-2 font-mono text-[11px] text-fg-faint">{requests.message}</p>
          <button
            type="button"
            onClick={() => void requests.reload()}
            className="mt-4 font-mono text-[11.5px] uppercase tracking-[0.04em] text-fg-faint transition-colors hover:text-fg"
          >
            Retry
          </button>
        </div>
      ) : !requests.openMeterConfigured ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[13px] text-fg-faint">
            OpenMeter is not configured, so per-request history is unavailable.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[13px] text-fg-faint">
            {query
              ? `No calls match “${query}”`
              : `No ${kind === "all" ? "" : kind + " "}signed-ticket requests this billing cycle`}
          </p>
        </div>
      ) : (
        <>
          <CallsTable
            rows={rows}
            showHeader
            bordered={false}
            density="cozy"
            showEnvironment={allEnvs}
          />
          {requests.nextCursor ? (
            <div className="flex justify-center border-t border-hairline px-5 py-4">
              <button
                type="button"
                onClick={() => void requests.loadMore()}
                className="font-mono text-[11.5px] uppercase tracking-[0.04em] text-fg-faint transition-colors hover:text-fg"
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}

      <CallDetailDrawer
        row={shownRow}
        open={!!openCall}
        onClose={() => router.push("/calls")}
      />
    </>
  );
}
