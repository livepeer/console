"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import SectionHeader from "@/components/console/SectionHeader";
import CallsTable from "@/components/console/CallsTable";
import CallDetailDrawer from "@/components/console/CallDetailDrawer";
import { useAuth } from "@/components/console/AuthContext";
import { useRunDetail, useRunHistory } from "@/lib/console/useRunHistory";
import { runToActivity } from "@/lib/console/run-activity";
import type { AccountActivityRow } from "@/lib/console/types";
import { Button } from "@/components/ui/button";

export default function CallsSection({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (next: string) => void;
}) {
  const { isConnected, user } = useAuth();
  const [seedingPreview, setSeedingPreview] = useState(false);
  const ownerKey = user ? `${user.canonicalUserId}:${user.id}` : undefined;
  const history = useRunHistory(
    "/api/console/runs",
    isConnected,
    {
      search: query.trim(),
    },
    ownerKey
  );
  const requestId = useSearchParams().get("request");
  const detail = useRunDetail(
    "/api/console/runs",
    requestId,
    ownerKey,
    isConnected
  );
  const historyReload = history.reload;
  const detailReload = detail.reload;
  const synced = useRef(new Set<string>());
  const visibleRunIds = useMemo(() => {
    const ids = history.page?.items.map((run) => run.id) ?? [];
    const openId =
      detail.detail?.id ??
      (requestId && ids.includes(requestId) ? requestId : null);
    return openId
      ? [openId, ...ids.filter((id) => id !== openId)]
      : ids;
  }, [detail.detail?.id, history.page, requestId]);
  useEffect(() => {
    if (!isConnected || !ownerKey || !visibleRunIds.length) return;
    const key = `${ownerKey}:${visibleRunIds.join(",")}`;
    if (synced.current.has(key)) return;
    synced.current.add(key);
    const controller = new AbortController();
    void fetch("/api/console/runs/billing-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runIds: visibleRunIds.slice(0, 50) }),
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ changedRunIds: string[] }>;
      })
      .then((result) => {
        if (!result?.changedRunIds.length || controller.signal.aborted) return;
        historyReload();
        if (
          detail.detail?.id &&
          result.changedRunIds.includes(detail.detail.id)
        )
          detailReload();
      })
      .catch(() => undefined); // Billing availability never gates Neon history.
    return () => controller.abort();
  }, [detail.detail?.id, detailReload, historyReload, isConnected, ownerKey, visibleRunIds]);
  const router = useRouter();
  const recorded = useMemo(
    () =>
      history.page?.items.map((run) => runToActivity(run)) ?? [],
    [history.page]
  );
  const rows = recorded;
  const found = rows.find(
    (row) => row.id === requestId || row.gatewayRequestId === requestId
  );
  const openRow =
    detail.detail &&
    (detail.detail.id === requestId ||
      detail.detail.gatewayRequestId === requestId)
      ? runToActivity(detail.detail)
      : (found ?? null);
  const select = (row: AccountActivityRow) =>
    router.push("/home?request=" + encodeURIComponent(row.id), {
      scroll: false,
    });
  const seedPreview = async () => {
    setSeedingPreview(true);
    try {
      const response = await fetch("/api/console/runs/preview-fixtures", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("preview_fixture_failed");
      synced.current.clear();
      history.reload();
    } finally {
      setSeedingPreview(false);
    }
  };
  return (
    <>
      <SectionHeader
        variant="default"
        title="History"
        className="mb-3 flex flex-wrap items-end justify-between gap-3 px-3 md:px-7"
        action={
          <div className="flex h-[26px] w-[240px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark px-2.5 focus-within:ring-1 focus-within:ring-green-bright/30">
            <Search
              className="h-3 w-3 shrink-0 text-fg-faint"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search model or modality…"
              aria-label="Search history"
              className="min-w-0 flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className="-mr-1 shrink-0 p-0.5 text-fg-faint"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        }
      />
      <section aria-label="History records">
        {history.loading && (
          <p role="status" className="px-7 py-8 text-sm text-fg-faint">
            Loading history…
          </p>
        )}
        {history.error && (
          <p role="alert" className="px-7 py-4 text-sm text-fg-faint">
            {history.error}{" "}
            <button
              type="button"
              className="underline"
              onClick={history.page ? history.loadMore : history.reload}
            >
              Retry
            </button>
          </p>
        )}
        <CallsTable
          rows={recorded}
          bordered={false}
          density="cozy"
          variant="requests"
          onSelectRow={select}
        />
        {!history.loading && !history.error && !recorded.length && (
          <div className="px-7 py-8 text-sm text-fg-faint">
            <p>{query ? "No history matches this search." : "No history yet."}</p>
            {!query &&
              process.env.NEXT_PUBLIC_CONSOLE_PREVIEW_FIXTURES === "1" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={seedingPreview}
                  onClick={() => void seedPreview()}
                >
                  {seedingPreview
                    ? "Creating verification records…"
                    : "Create preview verification records"}
                </Button>
              )}
          </div>
        )}
        {history.page?.nextCursor && (
          <div className="flex justify-center py-3">
            <button
              type="button"
              onClick={history.loadMore}
              disabled={history.loadingMore}
              className="text-xs text-fg-muted"
            >
              {history.loadingMore ? "Loading…" : "Load older history"}
            </button>
          </div>
        )}
      </section>
      {requestId && !openRow && detail.error && (
        <p role="alert" className="px-7 text-sm text-fg-muted">
          {detail.error}{" "}
          <button type="button" onClick={detail.reload} className="underline">
            Retry
          </button>
        </p>
      )}
      <CallDetailDrawer
        row={openRow}
        rows={rows}
        open={!!openRow}
        onClose={() => router.push("/home", { scroll: false })}
        onSelectRow={select}
        detail={detail.detail}
        detailLoading={detail.loading}
        detailError={detail.error}
        onRetryDetail={detail.reload}
      />
    </>
  );
}
