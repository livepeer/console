"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  AccessAction,
  AdminAccessList,
  BulkAccessOutcome,
  BulkAccessRequest,
} from "@/lib/platform/contracts";
import {
  freezeAccessRequests,
  normalizeOutcomes,
  retryableRequests,
  toggleSelection,
} from "./access-selection";

const control =
  "rounded border border-hairline bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40";
type Filter = "waiting" | "approved" | "revoked" | "all";

export default function AccessManager() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("waiting");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminAccessList | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [confirmation, setConfirmation] = useState<BulkAccessRequest[] | null>(
    null
  );
  const [batch, setBatch] = useState<BulkAccessRequest[] | null>(null);
  const [outcomes, setOutcomes] = useState<BulkAccessOutcome[]>([]);
  const [working, setWorking] = useState(false);
  const mutationLock = useRef(false);
  const selectionLock = useRef(false);
  const labels = useRef(new Map<string, string>());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setList(null);
    setError("");
    const params = new URLSearchParams({
      search: query,
      state: filter,
      page: String(page),
      pageSize: "50",
    });
    void fetch(`/api/admin/access?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401 || response.status === 403
              ? "Your administrator session is unavailable. Sign in through the waitlist again."
              : "Could not load entries. Try refreshing the list."
          );
        const result = (await response.json()) as AdminAccessList;
        if (controller.signal.aborted) return;
        result.rows.forEach((row) => labels.current.set(row.id, row.email));
        setList(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Could not load entries."
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filter, page, query, reload]);

  async function selectMatching() {
    if (selectionLock.current || mutationLock.current) return;
    selectionLock.current = true;
    setSelecting(true);
    setError("");
    // Capture filters now. The returned IDs remain fixed as filters/pages change.
    const params = new URLSearchParams({ search: query, state: filter });
    try {
      const response = await fetch(`/api/admin/access/selection?${params}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          "Could not freeze this selection. Nothing was changed."
        );
      const result = (await response.json()) as {
        signupIds: string[];
        total: number;
      };
      if (
        !Array.isArray(result.signupIds) ||
        result.signupIds.some((id) => typeof id !== "string") ||
        result.signupIds.length !== result.total
      )
        throw new Error(
          "The selection response was incomplete. Nothing was changed."
        );
      setSelected(new Set(result.signupIds));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Selection failed.");
    } finally {
      selectionLock.current = false;
      setSelecting(false);
    }
  }

  function propose(action: AccessAction) {
    if (selected.size && !mutationLock.current)
      setConfirmation(freezeAccessRequests(selected, action));
  }

  async function execute(
    requests: BulkAccessRequest[],
    previous: BulkAccessOutcome[] = []
  ) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setWorking(true);
    setConfirmation(null);
    setBatch(requests);
    setError("");
    const merged = new Map(previous.map((item) => [item.signupId, item]));
    try {
      for (const request of retryableRequests(requests, previous)) {
        let next: BulkAccessOutcome[];
        try {
          const response = await fetch("/api/admin/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          });
          next = response.ok
            ? normalizeOutcomes(request, await response.json())
            : request.signupIds.map((signupId) => ({
                signupId,
                outcome: "failed",
                code: `http_${response.status}`,
              }));
        } catch {
          next = request.signupIds.map((signupId) => ({
            signupId,
            outcome: "failed",
            code: "network_error",
          }));
        }
        // A failed retry must not obscure a previously committed per-record success.
        for (const item of next) {
          const old = merged.get(item.signupId);
          if (!old || old.outcome === "failed" || item.outcome !== "failed")
            merged.set(item.signupId, item);
        }
        setOutcomes([...merged.values()]);
      }
    } finally {
      mutationLock.current = false;
      setWorking(false);
      setReload((value) => value + 1);
    }
  }

  const locked = working || selecting || !!batch || !!confirmation;
  const pageIds = list?.rows.map((row) => row.id) ?? [];
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const failed = outcomes.filter((item) => item.outcome === "failed").length;
  const pages = Math.max(1, Math.ceil((list?.total ?? 0) / 50));

  return (
    <section className="mt-10" aria-labelledby="access-management-title">
      <h2 id="access-management-title" className="text-xl">
        Console access
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        Approval unlocks Console and MCP. It does not grant administrator
        permissions or marketing consent.
      </p>
      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <label className="grid gap-1 text-xs">
          Search by email
          <input
            className={control}
            value={search}
            disabled={working || selecting}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          className={control}
          disabled={working || selecting}
          type="submit"
        >
          Search
        </button>
        <label className="grid gap-1 text-xs">
          Access status
          <select
            className={control}
            value={filter}
            disabled={working || selecting}
            onChange={(event) => {
              setFilter(event.target.value as Filter);
              setPage(1);
            }}
          >
            <option value="waiting">Waiting</option>
            <option value="approved">Approved</option>
            <option value="revoked">Revoked</option>
            <option value="all">All entries</option>
          </select>
        </label>
        <button
          type="button"
          className={control}
          disabled={working || selecting}
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh list
        </button>
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-sm" role="status">
          {selected.size} selected across all pages
        </span>
        <button
          type="button"
          className={control}
          disabled={locked || loading}
          onClick={() => void selectMatching()}
        >
          {selecting
            ? "Freezing selection…"
            : "Select all matching (replace selection)"}
        </button>
        <button
          type="button"
          className={control}
          disabled={locked || !selected.size}
          onClick={() => setSelected(new Set())}
        >
          Clear selection
        </button>
        <button
          type="button"
          className={`${control} bg-foreground text-background`}
          disabled={locked || !selected.size}
          onClick={() => propose("approve")}
        >
          Approve selected
        </button>
        <button
          type="button"
          className={control}
          disabled={locked || !selected.size}
          onClick={() => propose("revoke")}
        >
          Revoke selected
        </button>
      </div>
      <p className="mt-2 text-xs text-fg-faint">
        Selections remain fixed when you change filters or pages. Review the
        exact selection before confirming.
      </p>
      {error && (
        <p className="mt-4 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      <div
        className="mt-5 overflow-x-auto border-y border-hairline"
        aria-busy={loading}
      >
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-hairline text-fg-muted">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  aria-label="Select this page"
                  checked={allPageSelected}
                  disabled={locked || !pageIds.length}
                  onChange={(event) =>
                    setSelected((old) =>
                      toggleSelection(old, pageIds, event.target.checked)
                    )
                  }
                />
              </th>
              {[
                "Email",
                "Waitlist",
                "Console access",
                "Newsletter",
                "Joined",
              ].map((label) => (
                <th className="p-3 font-medium" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {list?.rows.map((row) => (
              <tr key={row.id}>
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.email}`}
                    checked={selected.has(row.id)}
                    disabled={locked}
                    onChange={(event) =>
                      setSelected((old) =>
                        toggleSelection(old, [row.id], event.target.checked)
                      )
                    }
                  />
                </td>
                <td className="p-3">{row.email}</td>
                <td className="p-3">{row.waitlistStatus}</td>
                <td className="p-3">
                  {row.accessState === "pending" ? "Waiting" : row.accessState}
                </td>
                <td className="p-3">
                  {row.newsletterSubscribed ? "Subscribed" : "Not subscribed"}
                </td>
                <td className="p-3">
                  {new Date(row.joinedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(!list || !list.rows.length) && (
              <tr>
                <td className="p-6 text-fg-muted" colSpan={6}>
                  {loading
                    ? "Loading entries…"
                    : error
                      ? "Entries unavailable."
                      : "No matching entries."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm">
        <button
          type="button"
          className={control}
          disabled={working || selecting || loading || page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {pages} · {list?.total ?? 0} entries
        </span>
        <button
          type="button"
          className={control}
          disabled={working || selecting || loading || page >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
      {batch && (
        <section
          className="mt-6 rounded border border-hairline p-4"
          aria-label="Bulk action results"
        >
          <p role="status">
            {working ? "Processing selection…" : "Selection processed."}{" "}
            {outcomes.length} of{" "}
            {batch.reduce(
              (total, request) => total + request.signupIds.length,
              0
            )}{" "}
            outcomes recorded; {failed} need retry.
          </p>
          <p className="mt-2 text-xs text-fg-muted">
            Retries reuse the original request IDs. Already completed approvals
            do not send another invitation.
          </p>
          <div className="my-3 flex gap-3">
            <button
              type="button"
              className={control}
              disabled={working || !failed}
              onClick={() => void execute(batch, outcomes)}
            >
              Retry failed records
            </button>
            <button
              type="button"
              className={control}
              disabled={working}
              onClick={() => {
                setBatch(null);
                setOutcomes([]);
                setSelected(new Set());
              }}
            >
              Start another selection
            </button>
          </div>
          <details>
            <summary className="cursor-pointer">
              Per-record outcomes and request IDs
            </summary>
            <ul className="mt-3 max-h-72 overflow-auto text-xs">
              {outcomes.map((item) => (
                <li className="py-1" key={item.signupId}>
                  {labels.current.get(item.signupId) ?? item.signupId}:{" "}
                  {item.outcome}
                  {item.code ? ` (${item.code})` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-3 break-all text-xs text-fg-faint">
              Requests: {batch.map((request) => request.requestId).join(", ")}
            </p>
          </details>
        </section>
      )}
      <Dialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogTitle>
            {confirmation?.[0]?.action === "approve" ? "Approve" : "Revoke"}{" "}
            {confirmation?.reduce(
              (total, request) => total + request.signupIds.length,
              0
            )}{" "}
            selected entries?
          </DialogTitle>
          <DialogDescription>
            This is a frozen selection of record IDs, not a live filter.
            Approval invitations are transactional. Revocation blocks subsequent
            protected requests; it does not cancel running external jobs.
          </DialogDescription>
          <details>
            <summary className="cursor-pointer">
              Review exact selected records
            </summary>
            <ul className="mt-3 max-h-52 overflow-auto text-xs">
              {confirmation
                ?.flatMap((request) => request.signupIds)
                .map((id) => (
                  <li key={id} className="py-1 break-all">
                    {labels.current.get(id)
                      ? `${labels.current.get(id)} · `
                      : ""}
                    {id}
                  </li>
                ))}
            </ul>
          </details>
          <div className="flex gap-3">
            <button
              type="button"
              className={control}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={control}
              onClick={() => {
                if (confirmation) void execute(confirmation);
              }}
            >
              Confirm {confirmation?.[0]?.action}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
