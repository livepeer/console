"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import SectionHeader from "@/components/console/SectionHeader";
import CallsSection from "@/components/console/CallsSection";
import { MiniSpark } from "@/components/console/StackedAreaChart";
import Button from "@/components/design-system/Button";
import { useAuth } from "@/components/console/AuthContext";
import { useAccountUsage } from "@/lib/console/useAccountUsage";
import {
  buildUsageCapabilityRows,
  formatPeriodResetLabel,
  microsToUsd,
  type UsageCapabilityRow,
} from "@/lib/console/usage-capability-display";
import { useWalletBillingState } from "@/lib/console/useOwnerWallet";
import {
  includedUsageSummary,
  type IncludedUsageSummary,
} from "@/lib/console/wallet-settlement-display";

/**
 * Usage answers three questions, in order: what this period cost, whether it
 * runs out before it resets, and what drove it — then lists the calls.
 *
 * Three blocks, and no more. The page briefly carried a spend-per-day chart
 * and a Jobs / Per job / Projected KPI strip underneath the meter. Both came
 * out: the projection line already says whether the money runs out, which
 * is the only thing a creator decides on; a daily curve restated it at
 * 180px, and the strip counted API calls for someone who made forty videos.
 * On a page whose brief is "hide everything that isn't essential", they were
 * furniture.
 *
 * There is exactly one hero figure (spend). "Remaining" is the meter's
 * right-hand label, not a second hero — the sidebar already carries it on
 * every route.
 *
 * The breakdown and the call log share one table vocabulary: the same header
 * recipe, the same row rhythm, the same footer. Clicking a capability filters
 * the calls instead of navigating; `/calls` redirects here.
 */

type PeriodId = "7d" | "30d" | "90d";

const PERIODS: Array<{
  id: PeriodId;
  label: string;
  noun: string;
  days: number;
}> = [
  { id: "7d", label: "7d", noun: "7 days", days: 7 },
  { id: "30d", label: "30d", noun: "30 days", days: 30 },
  { id: "90d", label: "90d", noun: "90 days", days: 90 },
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtSpend(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtUsd(n: number): string {
  return n >= 1000
    ? `$${Math.round(n).toLocaleString("en-US")}`
    : `$${n.toFixed(2)}`;
}

/** Cost-descending, so the ranking matches the column the eye lands on. */
function orderByCost(rows: UsageCapabilityRow[]): UsageCapabilityRow[] {
  return [...rows].sort(
    (a, b) =>
      microsToUsd(b.networkFeeUsdMicros) - microsToUsd(a.networkFeeUsdMicros)
  );
}

function SkeletonBar({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-dark-card motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

function UsageLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-hairline bg-dark-lighter px-5 py-16 text-center">
      <p className="text-sm text-fg-muted">Usage didn&apos;t load.</p>
      <p className="mt-2 max-w-md font-mono text-xs text-fg-faint">{message}</p>
      <Button className="mt-6" variant="secondary" size="xs" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function PeriodTabs({
  value,
  onChange,
  disabled,
}: {
  value: PeriodId;
  onChange: (id: PeriodId) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Reporting period"
      className="inline-flex items-center gap-px rounded-[5px] border border-hairline bg-dark p-px"
    >
      {PERIODS.map((p) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={`rounded-[4px] px-2 py-1 font-mono text-[11px] transition-colors duration-[var(--motion-duration-fast)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-bright/30 disabled:opacity-50 ${
              active
                ? "bg-dark-card text-fg"
                : "text-fg-faint hover:bg-hover hover:text-fg-strong"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── The instrument ─────────────────────────────────────────────────────────

type Runway = {
  /** Included allowance for the cycle. */
  includedTotal: number;
  /** Included already consumed. */
  consumed: number;
  /** Prepaid credit balance. */
  credits: number;
  /** Metered overage still available, or null when overage is not eligible. */
  overage: number | null;
};

/**
 * The figure and the rule it sits on. The rule spans the whole runway —
 * included, then credits, then metered overage — because that is the
 * sequence spending actually follows. Its unfilled track is a lighter step
 * of the same green, so the state reads across the whole bar rather than
 * stopping where the fill does.
 */
function Instrument({
  loading,
  spendUsd,
  runway,
  projectedUsd,
  resetsAt,
}: {
  loading: boolean;
  spendUsd: number;
  runway: Runway | null;
  projectedUsd: number | null;
  resetsAt: string;
}) {
  const includedLeft = runway
    ? Math.max(0, runway.includedTotal - runway.consumed)
    : 0;
  // Everything still spendable before the account is blocked.
  const remaining = runway
    ? includedLeft + runway.credits + (runway.overage ?? 0)
    : 0;
  const ceiling = runway ? runway.consumed + remaining : 0;
  const overCeiling =
    runway && projectedUsd && projectedUsd > ceiling
      ? projectedUsd - ceiling
      : 0;
  const willBlock = overCeiling > 0;
  const intoOverage =
    runway && projectedUsd && projectedUsd > runway.includedTotal
      ? Math.min(projectedUsd, ceiling) - runway.includedTotal
      : 0;

  const scaleMax = Math.max(ceiling, willBlock ? projectedUsd! : 0);
  const pct = (v: number) =>
    scaleMax > 0 ? Math.min(100, (v / scaleMax) * 100) : 0;
  const consumedPct = pct(runway?.consumed ?? 0);
  const projectedPct = projectedUsd ? pct(projectedUsd) : consumedPct;
  const includedPct = runway ? pct(runway.includedTotal) : 100;

  if (loading) {
    return (
      <section
        className="rounded-md border border-hairline bg-dark-lighter px-6 pt-5 pb-5 shadow-card"
        aria-busy="true"
      >
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="mt-3 h-10 w-44" />
        <SkeletonBar className="mt-5 h-[3px] w-full" />
        <SkeletonBar className="mt-3 h-3 w-72" />
      </section>
    );
  }

  return (
    <section className="rounded-md border border-hairline bg-dark-lighter px-6 pt-5 pb-5 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint">
        Spend this period
      </p>
      {/* The one hero. Mono because it is a figure (house rule); no
          tabular-nums because it stands alone — equal-width digits make a
          display-size number read loose. */}
      <p className="mt-1.5 font-mono text-[40px] font-medium leading-none tracking-[-0.03em] text-fg">
        {fmtUsd(spendUsd)}
      </p>

      {runway && (
        <>
          <div
            className="relative mt-5 h-[3px] rounded-full bg-green-subtle"
            role="img"
            aria-label={`${fmtUsd(runway.consumed)} spent of ${fmtUsd(ceiling)} available — ${fmtUsd(includedLeft)} included, then ${fmtUsd(runway.credits)} credits, then ${fmtUsd(runway.overage ?? 0)} metered overage`}
          >
            {projectedPct > consumedPct && (
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${consumedPct}%`,
                  width: `${Math.max(0, projectedPct - consumedPct)}%`,
                  background: willBlock
                    ? "color-mix(in srgb, var(--color-warm) 35%, transparent)"
                    : "color-mix(in srgb, var(--color-green-bright) 30%, transparent)",
                }}
              />
            )}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-green-bright transition-[width] duration-[var(--motion-duration-slow)] ease-[var(--motion-easing-out)] motion-reduce:transition-none"
              style={{ width: `${consumedPct}%` }}
            />
            {/* Where included usage ends and metered overage begins. */}
            <div
              className="absolute -top-1 -bottom-1 w-px bg-border-strong"
              style={{ left: `${includedPct}%` }}
              aria-hidden="true"
            />
          </div>

          <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[12px] text-fg-faint">
            <p className={willBlock ? "text-warm" : undefined}>
              {projectedUsd === null ? (
                <>Resets {resetsAt}</>
              ) : willBlock ? (
                <>
                  Projected{" "}
                  <span className="font-mono tabular-nums">
                    {fmtUsd(projectedUsd)}
                  </span>{" "}
                  by {resetsAt} — over your limit by{" "}
                  <span className="font-mono tabular-nums">
                    {fmtUsd(overCeiling)}
                  </span>
                </>
              ) : intoOverage > 0 ? (
                <>
                  Projected{" "}
                  <span className="font-mono tabular-nums">
                    {fmtUsd(projectedUsd)}
                  </span>{" "}
                  by {resetsAt} ·{" "}
                  <span className="font-mono tabular-nums">
                    {fmtUsd(intoOverage)}
                  </span>{" "}
                  billed as overage
                </>
              ) : (
                <>
                  Projected{" "}
                  <span className="font-mono tabular-nums">
                    {fmtUsd(projectedUsd)}
                  </span>{" "}
                  by {resetsAt} · within included
                </>
              )}
            </p>
            <p>
              <span
                className={`font-mono tabular-nums ${remaining <= 0 ? "text-warm" : "text-fg-strong"}`}
              >
                {fmtUsd(remaining)}
              </span>{" "}
              left of{" "}
              <span className="font-mono tabular-nums">{fmtUsd(ceiling)}</span>
            </p>
          </div>
        </>
      )}
    </section>
  );
}

// ─── The view ───────────────────────────────────────────────────────────────

export default function UsageView() {
  const { isConnected, user } = useAuth();
  const [period, setPeriod] = useState<PeriodId>("30d");
  const active = PERIODS.find((p) => p.id === period) ?? PERIODS[1]!;
  // Clicking a capability in the table filters the call list below instead
  // of navigating — the two now live on one page.
  const [callsQuery, setCallsQuery] = useState("");
  const callsRef = useRef<HTMLDivElement>(null);
  // Takes the capability's display name: it's built by the same
  // `humanizePipelineModel` the call mapper uses for `row.model`, so it
  // matches exactly what the search box searches.
  const focusCapability = useCallback((capabilityName: string) => {
    setCallsQuery(capabilityName);
    callsRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, []);

  const usageState = useAccountUsage(isConnected, { periodDays: active.days });
  const walletState = useWalletBillingState(isConnected);
  const fresh = usageState.status === "ready" ? usageState.data : null;

  // Refetch keeps the frame. Switching 7d → 30d re-fetches, and the hook
  // reports `loading` with no data for a beat; rendering skeletons there
  // made the whole page jump. Hold the last payload and dim it instead —
  // the skeleton is only for the very first load, when there is nothing to
  // hold.
  const lastDataRef = useRef<typeof fresh>(null);
  if (fresh) lastDataRef.current = fresh;
  const data = fresh ?? lastDataRef.current;
  const refetching = usageState.status === "loading" && data !== null;

  const capabilityRows = useMemo(() => {
    if (!data) return [];
    return orderByCost(
      buildUsageCapabilityRows({
        current: data.current.pipelineModels,
        prior: data.prior.pipelineModels,
        period: data.period,
        dailyByPipeline: data.current.dailyByPipeline,
      })
    );
  }, [data]);

  /** Capability display name → series colour, shared with the call list so
   *  a call's dot matches its row in the breakdown. Keyed by display name
   *  because that is what the call rows carry (and what the filter uses). */
  const colorByCapability = useMemo(
    () => new Map(capabilityRows.map((c) => [c.name, c.color] as const)),
    [capabilityRows]
  );

  /** Total fee per day, for the burn-rate projection. */
  const dailyTotal = useMemo(() => {
    if (!data) return null;
    const index = new Map(data.periodDayKeys.map((k, i) => [k, i] as const));
    const total = new Array<number>(data.periodDayKeys.length).fill(0);
    for (const row of data.current.dailyByPipeline) {
      const i = index.get(row.date);
      if (i === undefined) continue;
      total[i] = (total[i] ?? 0) + microsToUsd(row.networkFeeUsdMicros);
    }
    return total;
  }, [data]);

  const included: IncludedUsageSummary | null =
    walletState.state.status === "ready"
      ? includedUsageSummary(walletState.state.wallet.billingState)
      : null;

  const runway: Runway | null = useMemo(() => {
    if (walletState.state.status !== "ready" || !included) return null;
    const funding = walletState.state.wallet.billingState.funding;
    const overage = funding.overage;
    return {
      includedTotal: microsToUsd(included.totalUsdMicros),
      consumed: microsToUsd(included.consumedUsdMicros),
      credits: microsToUsd(walletState.state.wallet.balance?.usdMicros ?? "0"),
      overage:
        overage.eligible && overage.remaining
          ? microsToUsd(overage.remaining.usdMicros)
          : null,
    };
  }, [walletState.state, included]);

  const resetsAt = included?.resetsAt
    ? new Date(included.resetsAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : data
      ? formatPeriodResetLabel(data.period.end)
      : "—";

  /**
   * The allowance is measured in network cost, so the burn rate comes from the
   * same meter — a projection built on billable retail would read high against
   * a balance it never touches.
   */
  const projectedUsd = useMemo(() => {
    if (!dailyTotal || !included?.resetsAt) return null;
    const window = dailyTotal.slice(-7);
    if (window.length === 0) return null;
    const rate = window.reduce((a, b) => a + b, 0) / Math.max(1, window.length);
    const daysLeft = Math.max(
      0,
      Math.ceil((Date.parse(included.resetsAt) - Date.now()) / 86_400_000)
    );
    if (daysLeft === 0 || rate <= 0) return null;
    return microsToUsd(included.consumedUsdMicros) + rate * daysLeft;
  }, [dailyTotal, included]);

  const rangeLabel = useMemo(() => {
    if (!data) return `Last ${active.noun}`;
    const fmtDay = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    return `${fmtDay(data.period.start)} – ${fmtDay(data.period.end)}`;
  }, [data, active.noun]);

  const loading =
    (usageState.status === "loading" || usageState.status === "idle") &&
    data === null;
  const grandReq = capabilityRows.reduce((a, c) => a + c.requestCount, 0);
  const grandSpend = capabilityRows.reduce(
    (a, c) => a + microsToUsd(c.networkFeeUsdMicros),
    0
  );
  const spendUsd = data ? microsToUsd(data.current.networkFeeUsdMicros) : 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
      {/* The one filter row. It scopes the instrument and the table; the
          call log is per billing cycle and says so in its own header. */}
      <SectionHeader
        variant="default"
        className="mb-3 flex items-end justify-between gap-3"
        title={rangeLabel}
        description={`Last ${active.noun}`}
        action={
          <PeriodTabs value={period} onChange={setPeriod} disabled={loading} />
        }
      />

      <div
        className={`transition-opacity duration-[var(--motion-duration-base)] ${
          refetching ? "opacity-60" : ""
        }`}
        aria-busy={refetching || undefined}
      >
        <Instrument
          loading={loading}
          spendUsd={spendUsd}
          runway={runway}
          projectedUsd={projectedUsd}
          resetsAt={resetsAt}
        />

        {usageState.status === "error" ? (
          <div className="mt-4">
            <UsageLoadError
              message={usageState.message}
              onRetry={usageState.reload}
            />
          </div>
        ) : loading ? (
          <>
            <SectionHeader
              variant="default"
              className="mt-7 mb-3 flex items-end justify-between gap-3"
              title="Spend by capability"
              description="Loading…"
            />
            <div
              className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card"
              aria-busy="true"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3 last:border-b-0"
                >
                  <SkeletonBar className="h-3.5 w-40" />
                  <SkeletonBar className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          </>
        ) : capabilityRows.length === 0 ? (
          <>
            {/* Same heading as the populated table so the section keeps its
                name when empty. The card is a short note, not a window: the
                call log directly below is the tall one, and stacking two
                look-alike "no calls" boxes read as a duplicate. */}
            <SectionHeader
              variant="default"
              className="mt-7 mb-3 flex items-end justify-between gap-3"
              title="Spend by capability"
              description={`No spend in the last ${active.noun}`}
            />
            <div className="rounded-md border border-hairline bg-dark-lighter px-4 py-8 text-center shadow-card">
              <p className="text-sm text-fg-muted">Nothing to rank yet.</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] text-fg-faint">
                Once you&apos;ve made calls, each capability appears here ranked
                by what it cost.
              </p>
            </div>
          </>
        ) : (
          <>
            <SectionHeader
              variant="default"
              className="mt-7 mb-3 flex items-end justify-between gap-3"
              title="Spend by capability"
              description="Ranked by cost"
            />
            <BreakdownTable
              rows={capabilityRows}
              grandReq={grandReq}
              grandSpend={grandSpend}
              onSelectCapability={focusCapability}
            />
          </>
        )}
      </div>

      <div ref={callsRef} className="scroll-mt-4">
        <CallsSection
          query={callsQuery}
          onQueryChange={setCallsQuery}
          colorByCapability={colorByCapability}
        />
      </div>

      {user?.id && (
        <p className="mt-8 break-all font-mono text-[10.5px] text-fg-disabled">
          Account {user.id}
        </p>
      )}
    </div>
  );
}

// ─── Spend by capability ────────────────────────────────────────────────────

/**
 * Shares its vocabulary with the call log below — the same header recipe
 * (sans, 11px, uppercase: column labels are language), the same row rhythm,
 * the same footer band — so the two tables read as one system. The count
 * column is "Calls", the same noun the log uses; the page used to say jobs,
 * requests and calls for the same thing.
 */
export const TABLE_HEAD_CLASS =
  "border-b border-hairline bg-dark py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint";
export const TABLE_FOOT_CLASS =
  "border-t border-hairline bg-dark py-2.5 text-[12.5px]";

function BreakdownTable({
  rows,
  grandReq,
  grandSpend,
  onSelectCapability,
}: {
  rows: UsageCapabilityRow[];
  grandReq: number;
  grandSpend: number;
  /** Filters the call list below to this capability, by display name. */
  onSelectCapability: (capabilityName: string) => void;
}) {
  const cols =
    "grid grid-cols-[minmax(0,1.9fr)_0.8fr_0.9fr_0.9fr_0.8fr] items-center gap-3 px-5";

  return (
    <div className="overflow-x-auto rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="min-w-[560px]">
        <div className={`${cols} ${TABLE_HEAD_CLASS}`}>
          <div>Capability</div>
          <div className="justify-self-end whitespace-nowrap">Calls</div>
          <div className="justify-self-end whitespace-nowrap">Trend</div>
          <div className="justify-self-end whitespace-nowrap">Cost</div>
          <div className="justify-self-end whitespace-nowrap">Per call</div>
        </div>

        <div className="max-h-[340px] overflow-y-auto">
          {rows.map((c) => {
            const cost = microsToUsd(c.networkFeeUsdMicros);
            const unitCost = c.requestCount > 0 ? cost / c.requestCount : 0;
            return (
              <div
                key={c.id}
                className={`${cols} border-b border-hairline py-2.5 text-[12.5px] text-fg-strong transition-colors last:border-b-0 hover:bg-hover`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.color }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => onSelectCapability(c.name)}
                    className="truncate rounded-[3px] text-left font-medium text-fg-strong transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-bright/30"
                    title={`Show calls for ${c.name}`}
                  >
                    {c.name}
                  </button>
                </div>
                <div className="justify-self-end font-mono text-[11.5px] tabular-nums text-fg-strong">
                  {fmt(c.requestCount)}
                </div>
                <div className="justify-self-end opacity-90">
                  <MiniSpark
                    data={c.data}
                    color={c.color}
                    height={16}
                    width={64}
                  />
                </div>
                <div className="justify-self-end font-mono text-[11.5px] tabular-nums text-fg">
                  {fmtSpend(cost)}
                </div>
                <div className="justify-self-end font-mono text-[11.5px] tabular-nums text-fg-faint">
                  {unitCost > 0 ? `$${unitCost.toFixed(4)}` : "—"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total sits outside the scroll region so it stays put while the
            rows move under it. */}
        <div
          className={`${cols} ${TABLE_FOOT_CLASS} font-medium text-fg-strong`}
        >
          <div>Total</div>
          <div className="justify-self-end font-mono text-[11.5px] tabular-nums text-fg">
            {fmt(grandReq)}
          </div>
          <div />
          <div className="justify-self-end font-mono text-[11.5px] tabular-nums text-fg">
            {fmtSpend(grandSpend)}
          </div>
          <div />
        </div>
      </div>
    </div>
  );
}
