"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import SectionHeader from "@/components/console/SectionHeader";
import CallsTable, { modalityTag } from "@/components/console/CallsTable";
import CallDetailDrawer from "@/components/console/CallDetailDrawer";
import { useAuth } from "@/components/console/AuthContext";
import { useAccountRequests } from "@/lib/console/useAccountRequests";
import type { AccountActivityRow } from "@/lib/console/types";

const EMPTY_ROWS: AccountActivityRow[] = [];

const PLACEHOLDER_CLASS =
  "flex min-h-[180px] flex-col items-center justify-center gap-2 px-5 py-10 text-center";

/**
 * The per-call log on /home. Its only control is search; a Live/Batch split
 * was here once and came out: it's a pipeline-implementation distinction, not
 * something a creator sorts their work by.
 *
 * `/calls` still resolves — it redirects here, preserving `?request=`.
 */
export default function CallsSection({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (next: string) => void;
}) {
  const { isConnected } = useAuth();
  const requests = useAccountRequests(isConnected);

  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request");

  const allRows = requests.status === "ready" ? requests.rows : EMPTY_ROWS;

  const openCall = requestId
    ? (allRows.find((r) => r.id === requestId) ?? null)
    : null;

  // `shownRow` outlives `openCall` so the drawer keeps its content through the
  // close animation. Keyed on `openCall`, not the param: arriving cold at
  // `?request=<id>` runs the effect while rows are still loading, and it has
  // to re-run when they arrive.
  const [shownRow, setShownRow] = useState<AccountActivityRow | null>(null);
  useEffect(() => {
    if (openCall) setShownRow(openCall);
  }, [openCall]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = q
      ? allRows.filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.model.toLowerCase().includes(q) ||
            r.pipeline.toLowerCase().includes(q) ||
            modalityTag(r.pipeline).includes(q)
        )
      : allRows;
    return [...scoped].sort(
      (a, b) =>
        (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1)
    );
  }, [allRows, query]);

  // The drawer closes back to /home — the page it now lives on.
  const closeDrawer = () => router.push("/home", { scroll: false });
  const selectDrawerRow = (next: AccountActivityRow) => {
    router.push(`/home?request=${next.id}`, { scroll: false });
  };

  // Further pages load as the page is scrolled. While a search is active the
  // sentinel becomes an explicit action instead, because search only covers
  // loaded rows.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await requests.loadMore();
    } finally {
      setLoadingMore(false);
    }
  };

  const nextCursor = requests.status === "ready" ? requests.nextCursor : null;
  const loadMoreError =
    requests.status === "ready" ? requests.loadMoreError : null;
  const searching = query.trim().length > 0;
  const autoLoad = !!nextCursor && !searching && !loadMoreError;

  useEffect(() => {
    if (!autoLoad) return;
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "0px 0px 360px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
    // `loadMore` is recreated every render; the observer only needs to be
    // rebuilt when what it guards changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, allRows.length, loadingMore]);

  const loading = requests.status === "loading" || requests.status === "idle";

  const Placeholder = ({ children }: { children: React.ReactNode }) => (
    <div className={PLACEHOLDER_CLASS}>{children}</div>
  );

  return (
    <>
      <SectionHeader
        variant="default"
        className="mb-3 flex flex-wrap items-end justify-between gap-3 px-3 md:px-7"
        title="History"
        action={
          <div className="flex h-[26px] w-[240px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark px-2.5 focus-within:ring-1 focus-within:ring-green-bright/30">
            <Search
              className="h-3 w-3 shrink-0 text-fg-faint"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search model or modality…"
              aria-label="Search history"
              className="min-w-0 flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className="-mr-1 shrink-0 rounded-[3px] p-0.5 text-fg-faint transition-colors hover:text-fg"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        }
      />

      {loading ? (
        <div aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center justify-between px-3 py-3 motion-reduce:animate-none md:px-7"
            >
              <div className="h-3.5 w-48 rounded bg-dark-card" />
              <div className="h-3 w-16 rounded bg-dark-card" />
            </div>
          ))}
        </div>
      ) : requests.status === "error" ? (
        <Placeholder>
          <p className="text-[13px] text-fg-muted">Could not load history.</p>
          <p className="max-w-md font-mono text-[11px] text-fg-faint">
            {requests.message}
          </p>
          <button
            type="button"
            onClick={() => void requests.reload()}
            className="mt-2 text-[12px] text-fg-faint transition-colors hover:text-fg"
          >
            Retry
          </button>
        </Placeholder>
      ) : !requests.openMeterConfigured ? (
        <Placeholder>
          <p className="text-[13px] text-fg-faint">
            Per-request history isn&apos;t available for this account yet.
          </p>
        </Placeholder>
      ) : rows.length === 0 ? (
        <Placeholder>
          <p className="text-[13px] text-fg-muted">
            {query
              ? requests.nextCursor
                ? `No loaded history matches “${query}”`
                : `No history matches “${query}”`
              : "No history yet"}
          </p>
          {query && (
            <div className="flex items-center gap-2">
              {requests.nextCursor && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  aria-busy={loadingMore || undefined}
                  className="btn-outline inline-flex h-[26px] items-center rounded-[4px] px-2.5 text-[12px] font-medium transition-colors disabled:opacity-60"
                >
                  {loadingMore ? "Searching…" : "Search older history"}
                </button>
              )}
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className="inline-flex h-[26px] items-center rounded-[4px] px-2.5 text-[12px] text-fg-faint transition-colors hover:text-fg"
              >
                Clear search
              </button>
            </div>
          )}
        </Placeholder>
      ) : (
        <>
          <CallsTable
            rows={rows}
            bordered={false}
            density="cozy"
            variant="requests"
          />
          {nextCursor && (
            <div
              ref={sentinelRef}
              className="flex h-[40px] items-center justify-center text-[12px] text-fg-faint"
              aria-live="polite"
            >
              {loadMoreError ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="inline-flex h-[26px] items-center rounded-[4px] px-2.5 transition-colors hover:text-fg"
                >
                  Couldn&apos;t load more · Retry
                </button>
              ) : searching ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  aria-busy={loadingMore || undefined}
                  className="inline-flex h-[26px] items-center rounded-[4px] px-2.5 transition-colors hover:text-fg disabled:opacity-60"
                >
                  {loadingMore ? "Searching…" : "Search older history"}
                </button>
              ) : loadingMore ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2
                    className="h-3 w-3 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Loading more…
                </span>
              ) : null}
            </div>
          )}
        </>
      )}

      <CallDetailDrawer
        row={shownRow}
        rows={
          openCall && !rows.some((candidate) => candidate.id === openCall.id)
            ? allRows
            : rows
        }
        open={!!openCall}
        onClose={closeDrawer}
        onSelectRow={selectDrawerRow}
      />
    </>
  );
}
