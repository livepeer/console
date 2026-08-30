"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SectionHeader from "@/components/console/SectionHeader";
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
 * Usage answers three questions, in this order: what did this period cost,
 * will it run out before it resets, and what drove it. Everything on the page
 * serves one of those.
 *
 * Plans, payment methods and invoices deliberately live at
 * /settings?tab=billing — which carries a fuller version of all three — so
 * this page links there rather than restating it.
 */

type PeriodId = "7d" | "30d" | "90d";

const PERIODS: Array<{ id: PeriodId; label: string; noun: string; days: number }> =
  [
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

function fmtUnit(n: number): string {
  if (n <= 0) return "—";
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
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

/**
 * What the period cost, and whether it runs out. Consumed, projected and the
 * ceiling share one track: the answer is the shape of the bar, not a
 * reconciliation of four cards.
 */
/**
 * The period as an instrument rather than a widget: one rule carrying spend,
 * projection and the included ceiling, with the two figures anchored to the
 * ends they describe. Sans for language, mono for quantity — nothing here is
 * mono unless it is a number.
 */
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
 * The period as an instrument. The rule spans the whole runway — included,
 * then credits, then metered overage — because that is the sequence spending
 * actually follows. A rule that stopped at the included allowance made
 * crossing it look terminal when it only means you start paying.
 */
function PeriodMeter({
  loading,
  spendUsd,
  jobs,
  priorJobs,
  periodNoun,
  runway,
  projectedUsd,
  resetsAt,
}: {
  loading: boolean;
  spendUsd: number;
  jobs: number;
  priorJobs: number;
  periodNoun: string;
  runway: Runway | null;
  projectedUsd: number | null;
  resetsAt: string;
}) {
  const perJob = jobs > 0 ? spendUsd / jobs : 0;
  const delta = priorJobs > 0 ? ((jobs - priorJobs) / priorJobs) * 100 : null;

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
        className="rounded-md border border-hairline bg-dark-lighter px-6 py-5 shadow-card"
        aria-busy="true"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="w-40">
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="mt-2.5 h-8 w-36" />
          </div>
          <div className="flex w-40 flex-col items-end">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="mt-2.5 h-8 w-36" />
            <SkeletonBar className="mt-2.5 h-3 w-28" />
          </div>
        </div>
        <SkeletonBar className="mt-5 h-[3px] w-full" />
        <SkeletonBar className="mt-4 h-3 w-72" />
        <SkeletonBar className="mt-2 h-3 w-60" />
      </section>
    );
  }

  return (
    <section className="rounded-md border border-hairline bg-dark-lighter px-6 py-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint">
            Spend
          </p>
          <p className="mt-1.5 font-mono text-[32px] font-medium leading-none tracking-[-0.03em] tabular-nums text-fg">
            {fmtUsd(spendUsd)}
          </p>
        </div>
        {runway && (
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint">
              Remaining
            </p>
            <p
              className={`mt-1.5 font-mono text-[32px] font-medium leading-none tracking-[-0.03em] tabular-nums ${
                remaining <= 0 ? "text-warm" : "text-fg"
              }`}
            >
              {fmtUsd(remaining)}
            </p>
            {/* Names the right edge of the rule. Without it the limit is only
                derivable by adding spend and remaining. */}
            <p className="mt-1.5 text-[12px] text-fg-faint">
              of{" "}
              <span className="font-mono tabular-nums">{fmtUsd(ceiling)}</span>{" "}
              spend limit
            </p>
          </div>
        )}
      </div>

      {runway && (
        <div
          className="relative mt-5 h-[3px] bg-dark-card"
          role="img"
          aria-label={`${fmtUsd(runway.consumed)} spent of ${fmtUsd(ceiling)} available — ${fmtUsd(includedLeft)} included, then ${fmtUsd(runway.credits)} credits, then ${fmtUsd(runway.overage ?? 0)} metered overage`}
        >
          {projectedPct > consumedPct && (
            <div
              className="absolute inset-y-0"
              style={{
                left: `${consumedPct}%`,
                width: `${Math.max(0, projectedPct - consumedPct)}%`,
                background: willBlock
                  ? "color-mix(in srgb, var(--color-warm) 35%, transparent)"
                  : "color-mix(in srgb, var(--color-green-bright) 25%, transparent)",
              }}
            />
          )}
          <div
            className="absolute inset-y-0 left-0 bg-green-bright transition-[width] duration-[var(--motion-duration-slow)] ease-[var(--motion-easing-out)] motion-reduce:transition-none"
            style={{ width: `${consumedPct}%` }}
          />
          {/* Where included usage ends and metered overage begins. */}
          <div
            className="absolute -top-1 -bottom-1 w-px bg-border-strong"
            style={{ left: `${includedPct}%` }}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5 text-[12px] text-fg-faint">
        <p>
          <span className="font-mono tabular-nums text-fg-strong">
            {fmt(jobs)}
          </span>{" "}
          jobs
          {perJob > 0 && (
            <>
              {" · "}
              <span className="font-mono tabular-nums text-fg-strong">
                {fmtUnit(perJob)}
              </span>{" "}
              per job
            </>
          )}
          {delta !== null && (
            <>
              {" · "}
              <span
                className={`font-mono tabular-nums ${delta >= 0 ? "text-fg-strong" : "text-fg-disabled"}`}
              >
                {delta > 0 ? "+" : ""}
                {delta.toFixed(0)}%
              </span>{" "}
              vs prior {periodNoun}
            </>
          )}
        </p>
        {runway && (
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
        )}
      </div>
    </section>
  );
}

export default function UsageView() {
  const { isConnected, user } = useAuth();
  const [period, setPeriod] = useState<PeriodId>("30d");
  const active = PERIODS.find((p) => p.id === period) ?? PERIODS[1]!;

  const usageState = useAccountUsage(isConnected, { periodDays: active.days });
  const walletState = useWalletBillingState(isConnected);
  const data = usageState.status === "ready" ? usageState.data : null;

  const capabilityRows = useMemo(() => {
    if (!data) return [];
    return orderByCost(buildUsageCapabilityRows({
      current: data.current.pipelineModels,
      prior: data.prior.pipelineModels,
      period: data.period,
      dailyByPipeline: data.current.dailyByPipeline,
    }));
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
      credits: microsToUsd(
        walletState.state.wallet.balance?.usdMicros ?? "0"
      ),
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
    if (!data || !included?.resetsAt) return null;
    const byDay = new Map<string, number>();
    for (const row of data.current.dailyByPipeline) {
      byDay.set(
        row.date,
        (byDay.get(row.date) ?? 0) + microsToUsd(row.networkFeeUsdMicros)
      );
    }
    const daily = data.periodDayKeys.map((k) => byDay.get(k) ?? 0);
    if (daily.length === 0) return null;
    const window = daily.slice(-7);
    const rate = window.reduce((a, b) => a + b, 0) / Math.max(1, window.length);
    const daysLeft = Math.max(
      0,
      Math.ceil((Date.parse(included.resetsAt) - Date.now()) / 86_400_000)
    );
    if (daysLeft === 0 || rate <= 0) return null;
    return microsToUsd(included.consumedUsdMicros) + rate * daysLeft;
  }, [data, included]);

  const rangeLabel = useMemo(() => {
    if (!data) return `Last ${active.noun}`;
    const fmtDay = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    return `${fmtDay(data.period.start)} – ${fmtDay(data.period.end)}`;
  }, [data, active.noun]);

  const loading = usageState.status === "loading" || usageState.status === "idle";
  const grandReq = capabilityRows.reduce((a, c) => a + c.requestCount, 0);
  const grandSpend = capabilityRows.reduce(
    (a, c) => a + microsToUsd(c.networkFeeUsdMicros),
    0
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
      <SectionHeader
        variant="default"
        className="mb-3 flex items-end justify-between gap-3"
        title="This period"
        description={rangeLabel}
        action={
          <PeriodTabs value={period} onChange={setPeriod} disabled={loading} />
        }
      />
      <PeriodMeter
        loading={loading}
        spendUsd={data ? microsToUsd(data.current.networkFeeUsdMicros) : 0}
        jobs={data?.current.requestCount ?? 0}
        priorJobs={data?.prior.requestCount ?? 0}
        periodNoun={active.noun}
        runway={runway}
        projectedUsd={projectedUsd}
        resetsAt={resetsAt}
      />

      {usageState.status === "error" ? (
        <div className="mt-4">
          <UsageLoadError message={usageState.message} onRetry={usageState.reload} />
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
                className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5 last:border-b-0"
              >
                <SkeletonBar className="h-3.5 w-40" />
                <SkeletonBar className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        </>
      ) : capabilityRows.length === 0 ? (
        <div className="mt-4 rounded-md border border-hairline bg-dark-lighter px-4 py-14 text-center">
          <p className="text-sm text-fg-muted">No jobs in this period.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] text-fg-faint">
            Signed requests appear here within a minute of your first call.
          </p>
        </div>
      ) : (
        <>
          <SectionHeader
            variant="default"
            className="mt-7 mb-3 flex items-end justify-between gap-3"
            title="Spend by capability"
            description={`${capabilityRows.length} capabilities · ranked by cost`}
          />
          <BreakdownSection
            rows={capabilityRows}
            grandReq={grandReq}
                grandSpend={grandSpend}
          />
        </>
      )}

      {user?.id && (
        <p className="mt-8 break-all font-mono text-[10.5px] text-fg-disabled">
          Account {user.id}
        </p>
      )}
    </div>
  );
}

function BreakdownSection({
  rows,
  grandReq,
  grandSpend,
}: {
  rows: UsageCapabilityRow[];
  grandReq: number;
  grandSpend: number;
}) {
  return (
    <>
      <BreakdownTable
        rows={rows}
        grandReq={grandReq}
        grandSpend={grandSpend}
      />
    </>
  );
}

function BreakdownTable({
  rows,
  grandReq,
  grandSpend,
}: {
  rows: UsageCapabilityRow[];
  grandReq: number;
  grandSpend: number;
}) {
  const cols =
    "grid grid-cols-[minmax(0,1.7fr)_0.8fr_0.9fr_0.75fr_0.9fr_0.8fr] items-center gap-3 px-5"

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="min-w-[620px]">
      <div
        className={`${cols} border-b border-hairline bg-dark py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint`}
      >
        <div>Capability</div>
        <div className="justify-self-end whitespace-nowrap">Jobs</div>
        <div className="justify-self-end whitespace-nowrap">Trend</div>
        <div className="justify-self-end whitespace-nowrap">Change</div>
        <div className="justify-self-end whitespace-nowrap">Cost</div>
        <div className="justify-self-end whitespace-nowrap">Per job</div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-fg-faint">
          No matching capabilities.
        </p>
      ) : (
        rows.map((c) => {
          const cost = microsToUsd(c.networkFeeUsdMicros);
          const unitCost = c.requestCount > 0 ? cost / c.requestCount : 0;
          return (
            <div
              key={c.id}
              className={`${cols} border-b border-hairline py-2.5 text-[13px] text-fg-strong transition-colors last:border-b-0 hover:bg-zebra`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                <Link
                  href={`/calls?capability=${encodeURIComponent(c.id)}`}
                  className="truncate text-[13px] text-fg transition-colors hover:text-green-bright"
                  title={c.id}
                >
                  {c.name}
                </Link>
              </div>
              <div className="justify-self-end font-mono text-[13px] tabular-nums text-fg-strong">
                {fmt(c.requestCount)}
              </div>
              <div className="justify-self-end opacity-80">
                <MiniSpark data={c.data} color={c.color} height={16} width={64} />
              </div>
              <div
                className={`justify-self-end font-mono text-[12.5px] tabular-nums ${
                  c.delta >= 0 ? "text-fg-strong" : "text-fg-disabled"
                }`}
              >
                {c.delta > 0 ? "+" : ""}
                {c.delta.toFixed(0)}%
              </div>
              <div className="justify-self-end font-mono text-[13px] tabular-nums text-fg">
                {fmtSpend(cost)}
              </div>
              <div className="justify-self-end font-mono text-[12.5px] tabular-nums text-fg-faint">
                {unitCost > 0 ? `$${unitCost.toFixed(4)}` : "—"}
              </div>
            </div>
          );
        })
      )}

      <div
        className={`${cols} bg-dark py-2.5 text-[13px] font-medium text-fg-strong`}
      >
        <div>
          Total
        </div>
        <div className="justify-self-end font-mono tabular-nums text-fg">
          {fmt(grandReq)}
        </div>
        <div />
        <div />
        <div className="justify-self-end font-mono tabular-nums text-fg">
          {fmtSpend(grandSpend)}
        </div>
        <div />
      </div>
      </div>
    </div>
  );
}
