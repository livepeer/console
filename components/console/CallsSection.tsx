"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import SectionHeader from "@/components/console/SectionHeader";
import CallsTable from "@/components/console/CallsTable";
import CallDetailDrawer from "@/components/console/CallDetailDrawer";
import { useAuth } from "@/components/console/AuthContext";
import { useAccountRequests } from "@/lib/console/useAccountRequests";
import type { AccountActivityRow } from "@/lib/console/types";
import { CAPABILITY_COLOR_OTHER } from "@/lib/console/usage-capability-display";

const EMPTY_ROWS: AccountActivityRow[] = [];

/**
 * The call log is a *window*, not a page section that grows without limit.
 * The viewport is fixed and scrolls internally, with the column header
 * pinned, so the page stays a known length however many calls load.
 * The height is the same in every state — loading, empty, error, full — so
 * nothing below it jumps as data arrives.
 */
const VIEWPORT = "h-[420px]";

/**
 * The per-call log, rendered underneath Spend by capability on /usage.
 *
 * It shares the breakdown table's vocabulary — header, row rhythm, footer —
 * so the two read as one system. Its only control is search; a Live/Batch
 * split was here once and came out: it's a pipeline-implementation
 * distinction, not something a creator sorts their work by.
 *
 * Search is lifted to the caller so a capability row in the spend table can
 * drive it: clicking a capability filters this list instead of navigating.
 * `/calls` still resolves — it redirects here, preserving `?request=`.
 */
export default function CallsSection({
  query,
  onQueryChange,
  colorByCapability,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  /** Capability display name → series colour, from the breakdown table, so
   *  each call's dot matches the capability row it rolls up into. */
  colorByCapability: ReadonlyMap<string, string>;
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
            r.pipeline.toLowerCase().includes(q)
        )
      : allRows;
    return [...scoped].sort(
      (a, b) =>
        (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1)
    );
  }, [allRows, query]);

  // The drawer closes back to /usage — the page it now lives on.
  const closeDrawer = () => router.push("/usage", { scroll: false });

  // Further pages load as the window is scrolled: a sentinel row sits under
  // the last loaded call and, when it scrolls into view, fetches the next
  // page in place. The window is a fixed-height frame with its own footer
  // outside the scroll, so there is no page footer for auto-loading to push
  // away — the usual reason to prefer a button — and the scrollbar already
  // expresses "there is more".
  //
  // While a search is active the sentinel becomes an explicit "Search older
  // calls" action instead. Search only covers loaded rows, so auto-loading
  // under a filter would page through the whole history looking for matches
  // the moment the few it found left the sentinel on screen.
  const windowRef = useRef<HTMLDivElement>(null);
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
    const root = windowRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      // Start the fetch a little before the sentinel is actually reached so
      // the next page is usually there by the time the scroll gets to it.
      { root, rootMargin: "0px 0px 120px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
    // `loadMore` is recreated every render; the observer only needs to be
    // rebuilt when what it guards changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, allRows.length, loadingMore]);

  const loading = requests.status === "loading" || requests.status === "idle";

  /** Every non-table state fills the same window, so nothing below shifts. */
  const Placeholder = ({ children }: { children: React.ReactNode }) => (
    <div
      className={`flex ${VIEWPORT} flex-col items-center justify-center gap-2 px-5 text-center`}
    >
      {children}
    </div>
  );

  return (
    <>
      <SectionHeader
        variant="default"
        className="mt-7 mb-3 flex flex-wrap items-end justify-between gap-3"
        title="Calls"
        description="Every signed request this billing cycle"
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
              placeholder="Search id, model, capability…"
              aria-label="Search calls"
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

      <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        {loading ? (
          <div className={`${VIEWPORT} overflow-hidden`} aria-busy="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center justify-between border-b border-hairline px-5 py-3 last:border-b-0 motion-reduce:animate-none"
              >
                <div className="h-3.5 w-48 rounded bg-dark-card" />
                <div className="h-3 w-16 rounded bg-dark-card" />
              </div>
            ))}
          </div>
        ) : requests.status === "error" ? (
          <Placeholder>
            <p className="text-[13px] text-fg-muted">
              Could not load signed requests.
            </p>
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
            {/* Search only covers loaded rows — the API filters by cursor and
                limit, nothing else — so an empty result must not read as
                "this call doesn't exist" while more pages remain. */}
            <p className="text-[13px] text-fg-faint">
              {query
                ? requests.nextCursor
                  ? `No loaded calls match “${query}”`
                  : `No calls match “${query}”`
                : "No signed requests this billing cycle"}
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
                    {loadingMore ? "Searching…" : "Search older calls"}
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
          <div ref={windowRef} className={`${VIEWPORT} overflow-y-auto`}>
            <CallsTable
              rows={rows}
              showHeader
              stickyHeader
              bordered={false}
              density="cozy"
              variant="requests"
              rowColor={(row) =>
                colorByCapability.get(row.model) ?? CAPABILITY_COLOR_OTHER
              }
            />
            {nextCursor && (
              <div
                ref={sentinelRef}
                className="flex h-[40px] items-center justify-center border-t border-hairline text-[12px] text-fg-faint"
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
                    {loadingMore ? "Searching…" : "Search older calls"}
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
          </div>
        )}

        {/* Footer sits outside the scroll window, in the same 40px band the
            breakdown's Total row uses (border-t, bg-dark, 12.5px). It only
            reports — loading happens in the window above. */}
        {!loading && requests.status === "ready" && allRows.length > 0 && (
          <div className="flex min-h-[40px] items-center justify-between gap-3 border-t border-hairline bg-dark px-5 py-1.5 text-[12.5px] text-fg-faint">
            <p>
              {query ? (
                <>
                  <span className="font-mono text-[11.5px] tabular-nums text-fg-strong">
                    {fmtCount(rows.length)}
                  </span>{" "}
                  of {fmtCount(allRows.length)} loaded match
                </>
              ) : requests.nextCursor ? (
                <>
                  <span className="font-mono text-[11.5px] tabular-nums text-fg-strong">
                    {fmtCount(allRows.length)}
                  </span>{" "}
                  loaded
                </>
              ) : (
                <>
                  All{" "}
                  <span className="font-mono text-[11.5px] tabular-nums text-fg-strong">
                    {fmtCount(allRows.length)}
                  </span>{" "}
                  loaded
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <CallDetailDrawer
        row={shownRow}
        open={!!openCall}
        onClose={closeDrawer}
      />
    </>
  );
}

function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}
