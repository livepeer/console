"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ExternalLink, TrendingUp, Search } from "lucide-react";
import PeriodToggle from "./PeriodToggle";
import { SimpleChartTooltip } from "./ChartTooltip";
import EmptyState from "@/components/dashboard/EmptyState";
import {
  PAYMENT_HISTORY,
  PAYMENT_STATS,
  PAYMENT_TRANSACTIONS,
} from "@/lib/dashboard/mock-data";
import { computeAxisTicks } from "@/lib/dashboard/utils";

// ─── Period options ───

type Period = "30d" | "3m" | "all";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "30d", label: "30D" },
  { key: "3m", label: "3M" },
  { key: "all", label: "All" },
];

// ─── Summary card ───

function SummaryCard({
  label,
  eth,
  usd,
}: {
  label: string;
  eth: number;
  usd: number;
}) {
  return (
    <div className="rounded-md border border-hairline bg-dark-lighter shadow-card px-5 py-4">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-faint">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-fg">
        ${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
      <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-green-bright">
        <TrendingUp className="h-3 w-3" />
        <span className="tabular-nums">{eth.toFixed(2)} ETH</span>
      </div>
    </div>
  );
}

// ─── Pagination ───

const PAGE_SIZE = 10;

// ─── Main ───

export default function PaymentsTab() {
  const [period, setPeriod] = useState<Period>("3m");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const chartData = useMemo(() => {
    const days = period === "30d" ? 30 : period === "3m" ? 90 : PAYMENT_HISTORY.length;
    return PAYMENT_HISTORY.slice(-days);
  }, [period]);
  const xTicks = useMemo(() => computeAxisTicks(chartData, "date", 6), [chartData]);

  const filteredTxs = useMemo(() => {
    if (!search) return PAYMENT_TRANSACTIONS;
    const q = search.toLowerCase();
    return PAYMENT_TRANSACTIONS.filter(
      (tx) =>
        tx.orchestrator.toLowerCase().includes(q) ||
        tx.pipeline.toLowerCase().includes(q) ||
        tx.txHash.toLowerCase().includes(q),
    );
  }, [search]);

  const totalPages = Math.ceil(filteredTxs.length / PAGE_SIZE);
  const pageTxs = filteredTxs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-7 px-7 pt-7 pb-20">
      {/* No in-tab section header — page chrome + active tab pill identify
          the section. */}

      {/* Revenue chart */}
      <div className="rounded-md border border-hairline bg-dark-lighter shadow-card px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-faint">
              Network revenue
            </p>
            <p className="mt-1.5 font-mono text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] tabular-nums text-fg">
              ${(chartData.reduce((s, r) => s + r.volumeUsd, 0) / 1000).toFixed(1)}k
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">
              Daily fees paid to orchestrators for inference work.
            </p>
          </div>
          <PeriodToggle value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        </div>

        <div className="mt-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="15%">
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--color-fg-label)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => v.slice(5)}
                ticks={xTicks}
                interval={0}
                padding={{ right: 8 }}
              />
              <YAxis
                tick={{ fill: "var(--color-fg-label)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<SimpleChartTooltip />} cursor={{ fill: "var(--color-zebra)" }} />
              <Bar
                dataKey="volumeUsd"
                fill="var(--chart-revenue)"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="24 Hours"
          eth={PAYMENT_STATS.lastDay.eth}
          usd={PAYMENT_STATS.lastDay.usd}
        />
        <SummaryCard
          label="30 Days"
          eth={PAYMENT_STATS.lastMonth.eth}
          usd={PAYMENT_STATS.lastMonth.usd}
        />
        <div className="col-span-2 sm:col-span-1">
          <SummaryCard
            label="All Time"
            eth={PAYMENT_STATS.allTime.eth}
            usd={PAYMENT_STATS.allTime.usd}
          />
        </div>
      </div>

      {/* Recent payments table */}
      <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        <div className="border-b border-hairline px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-bold text-fg">Recent payments</p>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                {filteredTxs.length} payments{search ? ` matching "${search}"` : " · all-time"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex h-[26px] w-full items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5 sm:max-w-[280px]">
            <Search className="h-3 w-3 shrink-0 text-fg-faint" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search payments…"
              className="flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
            />
          </div>
        </div>

        {filteredTxs.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState
              variant="guided"
              icon={<Search className="h-4 w-4" />}
              title="No payments match your search"
              description={`No results for "${search}". Try a different orchestrator, pipeline, or tx hash — or clear the search.`}
            />
          </div>
        ) : (
        <div className="md:overflow-x-auto">
          {/* Header — desktop only */}
          <div className="hidden md:flex min-w-[700px] items-center gap-4 border-b border-hairline px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled">
            <span className="w-36">Date</span>
            <span className="w-28">Orchestrator</span>
            <span className="flex-1">Pipeline</span>
            <span className="w-24 text-right">ETH</span>
            <span className="w-24 text-right">USD</span>
            <span className="w-28 text-right">Block</span>
            <span className="w-8" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--color-border-hairline)]">
            {pageTxs.map((tx) => {
              const dateStr = new Date(tx.date).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div key={tx.id}>
                  {/* Desktop row */}
                  <div className="hidden md:flex min-w-[700px] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-zebra">
                    <span className="w-36 text-xs tabular-nums text-fg-faint">{dateStr}</span>
                    <span className="w-28 truncate text-xs text-fg-muted">{tx.orchestrator}</span>
                    <span className="flex-1 text-xs text-fg-faint">{tx.pipeline}</span>
                    <span className="w-24 text-right text-xs tabular-nums text-fg-strong">
                      {tx.amountEth.toFixed(4)}
                    </span>
                    <span className="w-24 text-right text-xs tabular-nums text-fg-faint">
                      ${tx.amountUsd.toFixed(2)}
                    </span>
                    <span className="w-28 text-right text-[11px] tabular-nums text-fg-label">
                      {tx.block.toLocaleString()}
                    </span>
                    <a
                      href={`https://arbiscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-6 w-8 items-center justify-center text-fg-disabled transition-colors hover:text-fg-muted"
                      title="View on Arbiscan"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {/* Mobile card */}
                  <a
                    href={`https://arbiscan.io/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-zebra md:hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-xs text-fg-strong">
                        {tx.pipeline}
                      </span>
                      <span className="shrink-0 text-sm text-fg">
                        {tx.amountEth.toFixed(4)}{" "}
                        <span className="text-xs text-fg-label">ETH</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-fg-label">
                      <span>{dateStr} · {tx.orchestrator}</span>
                      <span>${tx.amountUsd.toFixed(2)}</span>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5">
            <span className="text-[12px] text-fg-faint tabular-nums">
              Page {page + 1} of {totalPages} · {filteredTxs.length} payments
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="inline-flex h-[26px] items-center rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:border-transparent disabled:hover:bg-transparent"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex h-[26px] items-center rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:border-transparent disabled:hover:bg-transparent"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
