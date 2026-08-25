"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StackedAreaChart, {
  MiniSpark,
} from "@/components/console/StackedAreaChart";
import Button from "@/components/design-system/Button";
import { useAuth } from "@/components/console/AuthContext";
import { useAccountUsage } from "@/lib/console/useAccountUsage";
import {
  buildUsageCapabilityRows,
  formatPeriodResetLabel,
  microsToUsdDisplay,
  type UsageCapabilityRow,
} from "@/lib/console/usage-capability-display";
import ConsolePageSkeleton from "@/components/console/ConsolePageSkeleton";
import PlansPanel from "@/components/console/PlansPanel";
import WalletPanel from "@/components/console/WalletPanel";
import {
  includedUsageSummary,
  sharedPoolUsageMeter,
  type IncludedUsageSummary,
  type SharedPoolUsageMeter,
} from "@/lib/console/wallet-settlement-display";
import { useMeBillingSurface } from "@/lib/console/useMeBillingSurface";
import { useWalletBillingState } from "@/lib/console/useOwnerWallet";

const PERIOD_DAYS = 30;

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtSpend(n: number): string {
  return `$${n.toFixed(2)}`;
}

function UsageLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-sm text-fg-muted">
        Could not load usage from PymtHouse.
      </p>
      <p className="mt-2 max-w-md font-mono text-xs text-fg-faint">{message}</p>
      <Button className="mt-6" variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function AllowanceStrip({
  requestCount,
  requestLimit,
  included,
  poolMeter,
  posture,
  ownSpendUsdMicros,
  hasAccess,
  forecast,
  willExceed,
  daysToLimit,
  priorRequestCount,
  periodDelta,
  resetsAt,
}: {
  requestCount: number;
  requestLimit: number | null;
  included: IncludedUsageSummary | null;
  /** Owner-rollup: this user's spend vs remaining pool (not grant total). */
  poolMeter: SharedPoolUsageMeter | null;
  /** Set on owner_rollup. */
  posture: { label: string; canSpend: boolean } | null;
  ownSpendUsdMicros: string;
  hasAccess: boolean;
  forecast: number;
  willExceed: boolean;
  daysToLimit: number;
  priorRequestCount: number;
  periodDelta: number;
  resetsAt: string;
}) {
  const showUsdAllowance = Boolean(included) && !poolMeter;
  const usedUsd = included?.consumedUsdMicros ?? "0";
  const granted = included?.totalUsdMicros ?? "0";
  const remaining = included?.remainingUsdMicros ?? "0";
  const allowanceLabel = included?.planName?.trim()
    ? `${included.planName} included`
    : "Included this period";
  const actorLimit = poolMeter
    ? Number(
        (BigInt(poolMeter.availableUsdMicros || "0") > BigInt(0)
          ? (BigInt(poolMeter.actorUsdMicros || "0") * BigInt(10000)) /
            BigInt(poolMeter.availableUsdMicros || "1")
          : BigInt(0))
      ) / 100
    : 0;

  const usedForBar = poolMeter
    ? actorLimit
    : showUsdAllowance
      ? Number((BigInt(usedUsd) * BigInt(10000)) / BigInt(granted || "1"))
      : requestLimit
        ? (requestCount / requestLimit) * 100
        : 0;
  const pct = Math.min(100, usedForBar);
  const forecastPct = requestLimit
    ? Math.min(100, (forecast / requestLimit) * 100)
    : pct;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline bg-dark-lighter shadow-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
          {poolMeter
            ? "Your usage this period"
            : showUsdAllowance
              ? allowanceLabel
              : "Your usage this period"}
        </p>
        {showUsdAllowance && !hasAccess && (
          <span className="rounded-[3px] border border-warm/30 bg-warm/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-warm">
            Exhausted
          </span>
        )}
        {posture && (
          <span
            className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
              posture.canSpend
                ? "border-green/30 bg-green/10 text-green-bright"
                : "border-warm/30 bg-warm/10 text-warm"
            }`}
          >
            {posture.label}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        {poolMeter ? (
          <span className="font-mono text-[15px] tabular-nums leading-none text-fg-muted">
            <b className="mr-0.5 text-[24px] font-medium tracking-[-0.01em] text-fg">
              ${poolMeter.actorUsd}
            </b>
            <span className="text-fg-faint">
              {" "}
              / ${poolMeter.availableUsd} available
            </span>
          </span>
        ) : showUsdAllowance ? (
          <span className="font-mono text-[15px] tabular-nums leading-none text-fg-muted">
            <b className="mr-0.5 text-[24px] font-medium tracking-[-0.01em] text-fg">
              ${microsToUsdDisplay(remaining)}
            </b>
            <span className="text-fg-faint">
              {" "}
              / ${microsToUsdDisplay(granted)} remaining
            </span>
          </span>
        ) : requestLimit ? (
          <span className="font-mono text-[15px] tabular-nums leading-none text-fg-muted">
            <b className="mr-0.5 text-[24px] font-medium tracking-[-0.01em] text-fg">
              {fmt(requestCount)}
            </b>
            <span className="text-fg-faint"> / {fmt(requestLimit)} jobs</span>
          </span>
        ) : (
          <span className="font-mono text-[24px] font-medium tabular-nums text-fg">
            {fmt(requestCount)}
          </span>
        )}
        <span className="ml-auto font-mono text-[11.5px] text-fg-faint">
          resets {resetsAt}
        </span>
      </div>

      {(showUsdAllowance || poolMeter || requestLimit) && (
        <div className="relative h-1.5 rounded-[3px] bg-dark-card">
          <div
            className={`h-full rounded-[3px] ${
              hasAccess
                ? "bg-gradient-to-r from-green to-green-bright"
                : "bg-warm"
            }`}
            style={{ width: `${pct}%` }}
          />
          {requestLimit && (
            <div
              className="absolute -top-0.5 -bottom-0.5 w-px"
              style={{
                left: `${forecastPct}%`,
                background: "rgba(251,191,36,0.55)",
                transform: "translateX(-0.5px)",
              }}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-4 text-[12px] text-fg-muted">
        {requestLimit && willExceed ? (
          <span className="font-mono">
            Forecast <b className="font-medium text-fg">{fmt(forecast)}</b> jobs
            by {resetsAt} · over limit in{" "}
            <b className="font-medium text-warm">~{daysToLimit}d</b>
          </span>
        ) : (
          <span className="font-mono">
            <b className="font-medium text-fg">{fmt(requestCount)}</b> signed
            requests this period
            {showUsdAllowance ? (
              <>
                {" "}
                ·{" "}
                <b className="font-medium text-fg">
                  ${microsToUsdDisplay(usedUsd)}
                </b>{" "}
                consumed
              </>
            ) : (
              <>
                {" "}
                ·{" "}
                <b className="font-medium text-fg">
                  ${microsToUsdDisplay(ownSpendUsdMicros)}
                </b>{" "}
                your spend
              </>
            )}
          </span>
        )}
        <span className="font-mono text-[11.5px] text-fg-faint">
          Last period {fmt(priorRequestCount)} · {periodDelta >= 0 ? "+" : ""}
          {periodDelta.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default function UsageView() {
  const { isConnected, user } = useAuth();
  const usageState = useAccountUsage(isConnected, PERIOD_DAYS);
  const walletState = useWalletBillingState(isConnected);
  const meBilling = useMeBillingSurface(isConnected);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(100);

  const capabilityRows = useMemo(() => {
    if (usageState.status !== "ready") return [];
    return buildUsageCapabilityRows({
      current: usageState.data.current.pipelineModels,
      prior: usageState.data.prior.pipelineModels,
      period: usageState.data.period,
      dailyByPipeline: usageState.data.current.dailyByPipeline,
    });
  }, [usageState]);

  const dataMaxSpend = useMemo(
    () => Math.max(...capabilityRows.map((c) => c.spendUsd), 0.01),
    [capabilityRows]
  );

  const filteredRows = useMemo(() => {
    return capabilityRows.filter((c) => {
      const matchesPrice =
        c.spendUsd >= (priceMin / 100) * dataMaxSpend &&
        c.spendUsd <= (priceMax / 100) * dataMaxSpend;
      return matchesPrice;
    });
  }, [capabilityRows, priceMin, priceMax, dataMaxSpend]);

  const periodDayCount = useMemo(() => {
    if (usageState.status !== "ready") return PERIOD_DAYS;
    const first = capabilityRows[0]?.data.length;
    return first && first > 0 ? first : PERIOD_DAYS;
  }, [usageState, capabilityRows]);

  const forecastStats = useMemo(() => {
    if (usageState.status !== "ready") {
      return {
        forecast: 0,
        willExceed: false,
        daysToLimit: 0,
        priorRequestCount: 0,
        periodDelta: 0,
        requestCount: 0,
      };
    }
    const { current, prior } = usageState.data;
    const dayCount = capabilityRows[0]?.data.length ?? PERIOD_DAYS;
    const totalsByDay = Array.from({ length: dayCount }, (_, dayIndex) =>
      capabilityRows.reduce((sum, row) => sum + (row.data[dayIndex] ?? 0), 0)
    );
    const last7Avg =
      totalsByDay.slice(-7).reduce((a, b) => a + b, 0) /
      Math.max(1, Math.min(7, totalsByDay.length));
    const daysLeft = 6;
    const forecast = Math.round(current.requestCount + last7Avg * daysLeft);
    const grantedJobs = usageState.data.balance?.lifetimeGrantedUsdMicros
      ? null
      : 10_000;
    const limit = grantedJobs ?? 10_000;
    const willExceed = forecast > limit;
    const left = limit - current.requestCount;
    const daysToLimit =
      left > 0 && last7Avg > 0 ? Math.max(0, Math.floor(left / last7Avg)) : 0;
    const priorRequestCount = prior.requestCount;
    const periodDelta =
      priorRequestCount > 0
        ? ((current.requestCount - priorRequestCount) / priorRequestCount) * 100
        : 0;

    return {
      forecast,
      willExceed,
      daysToLimit,
      priorRequestCount,
      periodDelta,
      requestCount: current.requestCount,
    };
  }, [usageState, capabilityRows]);

  if (usageState.status === "loading" || usageState.status === "idle") {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
        <ConsolePageSkeleton
          maxWidth="6xl"
          withTabs={false}
          kpiCount={0}
          withChart
        />
      </div>
    );
  }

  if (usageState.status === "error") {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
        <UsageLoadError
          message={usageState.message}
          onRetry={usageState.reload}
        />
      </div>
    );
  }

  const { data } = usageState;
  const grandReq = filteredRows.reduce((a, c) => a + c.requestCount, 0);
  const grandSpend = filteredRows.reduce((a, c) => a + c.spendUsd, 0);

  const actorUsdMicros =
    data.current.endUserBillableUsdMicros ||
    data.current.networkFeeUsdMicros ||
    "0";
  let included: IncludedUsageSummary | null = null;
  let billedToOwner = false;
  let poolMeter: SharedPoolUsageMeter | null = null;
  if (meBilling.state.status === "ready") {
    const surface = meBilling.state.surface;
    if (surface.mode === "owner_rollup") {
      billedToOwner = true;
      if (walletState.state.status === "ready") {
        poolMeter = sharedPoolUsageMeter({
          state: walletState.state.wallet.billingState,
          actorUsdMicros,
        });
      }
    } else if (surface.state) {
      included = includedUsageSummary(surface.state);
    }
  }

  const resetsAt = included?.resetsAt
    ? new Date(included.resetsAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : formatPeriodResetLabel(data.period.end);

  const sessionBilling =
    meBilling.state.status === "ready"
      ? {
          surface: meBilling.state.surface,
          loading: false,
          reload: () => {
            void meBilling.reload();
          },
        }
      : {
          surface: null,
          loading:
            meBilling.state.status === "idle" ||
            meBilling.state.status === "loading",
          reload: () => {
            void meBilling.reload();
          },
        };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
      <p className="mb-6 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-disabled">
        Account{user?.id ? ` · ${user.id}` : ""}
      </p>

      <PlansPanel sessionBilling={sessionBilling} />

      <WalletPanel
        periodBillableUsdMicros={
          data.current.endUserBillableUsdMicros ||
          data.current.networkFeeUsdMicros ||
          null
        }
        sessionBilling={sessionBilling}
      />

      <AllowanceStrip
        requestCount={forecastStats.requestCount}
        requestLimit={null}
        included={included}
        poolMeter={poolMeter}
        posture={
          billedToOwner
            ? { label: "Billed to owner", canSpend: true }
            : null
        }
        ownSpendUsdMicros={actorUsdMicros}
        hasAccess={data.balance?.hasAccess ?? true}
        forecast={forecastStats.forecast}
        willExceed={forecastStats.willExceed}
        daysToLimit={forecastStats.daysToLimit}
        priorRequestCount={forecastStats.priorRequestCount}
        periodDelta={forecastStats.periodDelta}
        resetsAt={resetsAt}
      />

      <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
          <div>
            <p className="text-[17px] font-bold text-fg">Jobs by capability</p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              {periodDayCount} days · {fmt(data.current.requestCount)} jobs ·
              OpenMeter
            </p>
          </div>
          <div className="flex flex-wrap gap-3.5 justify-end text-[11.5px] text-fg-muted">
            {filteredRows.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                {c.name}
              </span>
            ))}
          </div>
        </div>
        <div className="px-3 pt-2 pb-2">
          {filteredRows.length > 0 ? (
            <StackedAreaChart
              series={filteredRows.map((c) => ({ name: c.name, data: c.data }))}
              colors={filteredRows.map((c) => c.color)}
              dayKeys={data.periodDayKeys}
            />
          ) : (
            <p className="py-12 text-center text-sm text-fg-faint">
              No usage in this period.
            </p>
          )}
        </div>
      </div>

      <BreakdownSection
        rows={filteredRows}
        grandReq={grandReq}
        grandSpend={grandSpend}
        priceMin={priceMin}
        priceMax={priceMax}
        dataMaxSpend={dataMaxSpend}
        onPriceChange={(min, max) => {
          setPriceMin(min);
          setPriceMax(max);
        }}
        allRows={capabilityRows}
      />

      <LimitsPanel
        balance={billedToOwner ? null : data.balance}
        included={included}
        networkFeeUsdMicros={data.current.networkFeeUsdMicros}
        endUserBillableUsdMicros={data.current.endUserBillableUsdMicros}
        requestCount={data.current.requestCount}
      />
    </div>
  );
}

function BreakdownSection({
  rows,
  grandReq,
  grandSpend,
  priceMin,
  priceMax,
  dataMaxSpend,
  onPriceChange,
  allRows,
}: {
  rows: UsageCapabilityRow[];
  grandReq: number;
  grandSpend: number;
  priceMin: number;
  priceMax: number;
  dataMaxSpend: number;
  onPriceChange: (min: number, max: number) => void;
  allRows: UsageCapabilityRow[];
}) {
  return (
    <>
      <div className="mt-7 mb-2.5 flex items-center gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint">
          Breakdown
        </span>
        <span className="rounded-full border border-hairline bg-dark-card px-1.5 py-px font-mono text-[10.5px] text-fg-faint">
          {rows.length}
        </span>
      </div>
      <BreakdownTable rows={rows} grandReq={grandReq} grandSpend={grandSpend} />
      {allRows.length > 0 && (
        <p className="mt-2 text-[10px] text-fg-disabled">
          Spend filter: ${((priceMin / 100) * dataMaxSpend).toFixed(3)} – $
          {((priceMax / 100) * dataMaxSpend).toFixed(3)} (
          <button
            type="button"
            className="underline hover:text-fg-muted"
            onClick={() => onPriceChange(0, 100)}
          >
            reset
          </button>
          )
        </p>
      )}
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
    "grid grid-cols-[1.7fr_1.5fr_0.7fr_0.7fr_1fr_0.9fr] items-center gap-2 px-4";

  const deltaColor = (d: number) => {
    if (d > 25) return "#fbbf24";
    if (d > 0) return "var(--color-fg-strong)";
    if (d < -10) return "#94a3b8";
    return "var(--color-fg-muted)";
  };

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div
        className={`${cols} border-b border-hairline bg-dark py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled`}
      >
        <div>Capability</div>
        <div className="justify-self-end">Jobs · trend</div>
        <div className="justify-self-end">Δ vs prior</div>
        <div className="justify-self-end">Share</div>
        <div className="justify-self-end">Network cost</div>
        <div className="justify-self-end">Billable</div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-fg-faint">
          No matching capabilities.
        </p>
      ) : (
        rows.map((c) => {
          const share = grandReq > 0 ? (c.requestCount / grandReq) * 100 : 0;
          const unitCost = c.requestCount > 0 ? c.spendUsd / c.requestCount : 0;
          return (
            <div
              key={c.id}
              className={`${cols} border-b border-hairline py-2.5 text-[13px] text-fg-strong transition-colors last:border-b-0 hover:bg-zebra`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                <Link
                  href={`/jobs?capability=${encodeURIComponent(c.id)}`}
                  className="truncate font-mono text-xs text-fg underline decoration-transparent underline-offset-[3px] transition-colors hover:text-green-bright hover:decoration-current"
                  title={c.id}
                >
                  {c.name}
                </Link>
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <span className="font-mono tabular-nums text-fg-strong">
                  {fmt(c.requestCount)}
                </span>
                <span className="opacity-85">
                  <MiniSpark
                    data={c.data}
                    color={c.color}
                    height={18}
                    width={70}
                  />
                </span>
              </div>
              <div
                className="justify-self-end font-mono tabular-nums"
                style={{ color: deltaColor(c.delta) }}
              >
                {c.delta > 0 ? "+" : ""}
                {c.delta.toFixed(0)}%
              </div>
              <div className="justify-self-end font-mono tabular-nums text-fg-faint">
                {share.toFixed(1)}%
              </div>
              <div className="justify-self-end font-mono tabular-nums text-fg-faint">
                ${microsToUsdDisplay(c.networkFeeUsdMicros)}
              </div>
              <div className="justify-self-end font-mono tabular-nums text-fg">
                {fmtSpend(c.spendUsd)}
                {unitCost > 0 && (
                  <span className="text-fg-disabled">
                    {" "}
                    · ${unitCost.toFixed(4)}/req
                  </span>
                )}
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
          <span className="ml-1.5 text-[11px] text-fg-faint">
            · this period
          </span>
        </div>
        <div className="justify-self-end font-mono tabular-nums text-fg">
          {fmt(grandReq)}
        </div>
        <div />
        <div />
        <div />
        <div className="justify-self-end font-mono tabular-nums text-fg">
          {fmtSpend(grandSpend)}
        </div>
      </div>
    </div>
  );
}

function LimitsPanel({
  balance,
  included,
  networkFeeUsdMicros,
  endUserBillableUsdMicros,
  requestCount,
}: {
  balance: {
    balanceUsdMicros: string;
    consumedUsdMicros: string;
    lifetimeGrantedUsdMicros: string;
    hasAccess: boolean;
  } | null;
  included: IncludedUsageSummary | null;
  networkFeeUsdMicros: string;
  endUserBillableUsdMicros: string;
  requestCount: number;
}) {
  const includedLimit = included
    ? {
        label: included.planName
          ? `${included.planName} included usage`
          : "Included usage",
        used: microsToUsdDisplay(included.consumedUsdMicros),
        max: `$${included.totalUsd}`,
        pct:
          BigInt(included.totalUsdMicros || "0") > BigInt(0)
            ? Math.min(
                100,
                Number(
                  (BigInt(included.consumedUsdMicros || "0") * BigInt(10000)) /
                    BigInt(included.totalUsdMicros || "1")
                ) / 100
              )
            : 0,
      }
    : null;
  const prepaidLimit = balance
    ? {
        label: "Prepaid credits",
        used: `$${microsToUsdDisplay(balance.balanceUsdMicros)}`,
        max: "—",
        pct: balance.hasAccess ? 40 : 100,
      }
    : null;
  const limits =
    includedLimit || prepaidLimit
      ? [includedLimit, prepaidLimit].filter(
          (row): row is NonNullable<typeof row> => row !== null
        )
      : [
          {
            label: "Signed requests",
            used: fmt(requestCount),
            max: "—",
            pct: 50,
          },
        ];

  const extra = [
    {
      label: "Network cost (metered)",
      used: `$${microsToUsdDisplay(networkFeeUsdMicros)}`,
      max: "pass-through",
      pct: 30,
    },
    {
      label: "Billable (retail estimate)",
      used: `$${microsToUsdDisplay(endUserBillableUsdMicros)}`,
      max: "—",
      pct: 45,
    },
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div>
          <p className="text-[17px] font-bold text-fg">Limits & metering</p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            OpenMeter subscription allowance · network_spend meter
          </p>
        </div>
        <Link
          href="/settings?tab=billing"
          className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5 text-[12px] text-fg-strong transition-colors hover:border-subtle hover:text-fg"
        >
          Manage plan
        </Link>
      </div>
      <div className="py-1">
        {[...limits, ...extra].map((l) => {
          const overWarn = l.pct > 80;
          return (
            <div
              key={l.label}
              className="border-b border-hairline px-4 py-2.5 last:border-b-0"
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-fg-strong">{l.label}</span>
                <span className="font-mono text-[12px] tabular-nums text-fg-faint">
                  <b className="font-medium text-fg">{l.used}</b>
                  <span className="text-fg-disabled"> / {l.max}</span>
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-[2px] bg-dark-card">
                <div
                  className="h-full rounded-[2px]"
                  style={{
                    width: `${Math.min(100, l.pct)}%`,
                    background: overWarn ? "#fbbf24" : "#40bf86",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
