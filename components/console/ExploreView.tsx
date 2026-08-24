"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  List,
  Flame,
  Snowflake,
  X,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  Star,
  Search,
} from "lucide-react";
import { useExploreModels } from "@/lib/console/useExploreModels";
import Button from "@/components/design-system/Button";
import Drawer from "@/components/design-system/Drawer";
import { getAppIcon, formatRuns } from "@/lib/console/utils";
import { useStarredApps } from "@/lib/console/useStarredApps";
import AppCard from "@/components/console/AppCard";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import ConsolePageSkeleton from "@/components/console/ConsolePageSkeleton";
import type { App, AppCategory } from "@/lib/console/types";

const VALID_CATEGORIES: AppCategory[] = [
  "Video Generation",
  "Video Editing",
  "Video Understanding",
  "Live Transcoding",
  "Image Generation",
  "Speech",
  "Language",
];

// ─── Constants ───

type AvailabilityFilter = "all" | "warm" | "cold";

const VIDEO_CATEGORIES: { label: AppCategory; icon: ReturnType<typeof getAppIcon> }[] = [
  { label: "Video Generation", icon: getAppIcon("Video Generation") },
  { label: "Video Editing", icon: getAppIcon("Video Editing") },
  { label: "Video Understanding", icon: getAppIcon("Video Understanding") },
  { label: "Live Transcoding", icon: getAppIcon("Live Transcoding") },
];

const OTHER_CATEGORIES: { label: AppCategory; icon: ReturnType<typeof getAppIcon> }[] = [
  { label: "Image Generation", icon: getAppIcon("Image Generation") },
  { label: "Speech", icon: getAppIcon("Speech") },
  { label: "Language", icon: getAppIcon("Language") },
];

const PRICE_BUCKETS = 20;

// ─── Empty State ───

function ExploreEmptyState({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      {/* Geometric placeholder — three concentric squares riffing on the
          Livepeer symbol's grid construction. Quiet brand reminder. */}
      <div className="relative flex h-20 w-20 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-2xl border border-hairline" />
        <span className="absolute inset-2 rounded-xl border border-subtle" />
        <span className="absolute inset-4 rounded-lg border border-strong" />
        <Search className="relative h-5 w-5 text-fg-faint" />
      </div>
      <h3 className="mt-6 text-base font-semibold tracking-tight text-fg text-balance">
        No capabilities match your filters
      </h3>
      <p className="mt-2 max-w-sm text-sm text-fg-faint">
        Try loosening your filters or browse everything available on the network.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Button onClick={onClearFilters} variant="secondary" size="sm">
          Clear filters
        </Button>
        <div className="text-xs">
          <span className="text-fg-label">Missing something? </span>
          <a
            href="https://docs.livepeer.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-bright underline decoration-green-bright/40 underline-offset-4 transition-colors hover:text-green-light hover:decoration-green-bright"
          >
            Publish a capability
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── List Item ───

// Shared grid template for list view header + rows. Columns:
//   28px icon | 1fr name+meta | 60px p50 | 60px p95 | 60px GPUs | 78px price | 80px 7d jobs
const LIST_GRID =
  "grid grid-cols-[28px_minmax(0,1fr)_60px_60px_60px_78px_80px] items-center gap-3";

function formatLatencyShort(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function ListHeaderRow() {
  return (
    <div
      className={`${LIST_GRID} border-b border-hairline px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.05em] text-fg-disabled`}
      role="row"
    >
      <div />
      <div role="columnheader">App</div>
      <div role="columnheader" className="text-right">p50</div>
      <div role="columnheader" className="text-right">p95</div>
      <div role="columnheader" className="text-right">GPUs</div>
      <div role="columnheader" className="text-right">Price</div>
      <div role="columnheader" className="text-right">7d jobs</div>
    </div>
  );
}

function ModelListItem({ model, href }: { model: App; href?: string }) {
  const Icon = getAppIcon(model.category);
  const isWarm = model.status === "hot";
  const price = model.pricing.amount;
  const priceDecimals = price < 0.01 ? 4 : 3;

  return (
    <Link
      href={href ?? `/apps/${model.id}`}
      className={`${LIST_GRID} border-b border-hairline px-2 py-2 text-[12.5px] transition-colors hover:bg-hover`}
    >
      {/* Icon thumbnail (24px square, bordered) */}
      <div
        className="grid h-6 w-6 place-items-center rounded-[4px] border border-hairline bg-dark-card text-fg-strong"
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </div>

      {/* Name + provider + status pill + category */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 truncate font-semibold text-fg">
          {model.name}
        </span>
        <span className="shrink-0 text-[12.5px] text-fg-faint">
          {model.provider}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10.5px] lowercase tracking-[0.02em] ${
            isWarm
              ? "border-warm/20 bg-warm/[0.08] text-warm"
              : "border-hairline text-fg-faint"
          }`}
        >
          {isWarm ? (
            <span className="h-1.5 w-1.5 rounded-full bg-warm" aria-hidden="true" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-fg-faint" aria-hidden="true" />
          )}
          {isWarm ? "warm" : "cold"}
        </span>
        <span className="truncate text-[12.5px] text-fg-faint">
          · {model.category}
        </span>
      </div>

      {/* p50 latency */}
      <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
        {formatLatencyShort(model.latency)}
      </span>

      {/* p95 latency — assume ~1.65× p50 for mock parity */}
      <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
        {formatLatencyShort(Math.round(model.latency * 1.65))}
      </span>

      {/* GPUs */}
      <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
        {model.orchestrators}
      </span>

      {/* Price */}
      <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
        ${price.toFixed(priceDecimals)}
        <span className="text-fg-disabled">/{model.pricing.unit}</span>
      </span>

      {/* 7d jobs */}
      <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
        {formatRuns(model.runs7d)}
      </span>
    </Link>
  );
}

// ─── Price Range Filter ───

function buildPriceHistogram(models: App[]) {
  const prices = models.map((m) => m.pricing.amount);
  const maxPrice = Math.max(...prices, 0.01);
  const bucketSize = maxPrice / PRICE_BUCKETS;
  const buckets = Array.from({ length: PRICE_BUCKETS }, (_, i) => ({
    range: +(bucketSize * (i + 1)).toFixed(4),
    count: 0,
  }));
  for (const p of prices) {
    const idx = Math.min(Math.floor(p / bucketSize), PRICE_BUCKETS - 1);
    buckets[idx].count++;
  }
  return { buckets, maxPrice };
}

function PriceRangeFilter({
  min,
  max,
  onChange,
  models,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  models: App[];
}) {
  const { buckets, maxPrice } = useMemo(() => buildPriceHistogram(models), [models]);
  const minPrice = (min / 100) * maxPrice;
  const maxPriceValue = (max / 100) * maxPrice;

  const minBucketIdx = Math.min(
    Math.floor((min / 100) * PRICE_BUCKETS),
    PRICE_BUCKETS - 1,
  );
  const maxBucketIdx = Math.min(
    Math.floor((max / 100) * PRICE_BUCKETS),
    PRICE_BUCKETS - 1,
  );

  const isFiltered = min > 0 || max < 100;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-3">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-disabled">
          Price Range
        </p>
        {isFiltered && (
          <button
            type="button"
            onClick={() => onChange(0, 100)}
            className="flex items-center gap-1 text-[11px] text-fg-faint transition-colors hover:text-fg-muted"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
      <div className="px-3">
      <div className="flex h-12 items-end gap-px">
        {buckets.map((bucket, i) => {
          const maxCount = Math.max(...buckets.map((b) => b.count), 1);
          const height = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 100, 8) : 0;
          const active = i >= minBucketIdx && i <= maxBucketIdx;
          return (
            <div
              key={i}
              className="flex-1 transition-colors duration-150"
              style={{
                height: `${height}%`,
                backgroundColor: active
                  ? "rgb(64, 191, 134)"
                  : "var(--color-pop)",
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-1 h-5">
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-pop" />
        <div
          className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full"
          style={{
            left: `${min}%`,
            right: `${100 - max}%`,
            backgroundColor: "rgba(64, 191, 134, 0.5)",
          }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={min}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v < max) onChange(v, max);
          }}
          className="price-range-thumb pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
          style={{ zIndex: min > 90 ? 4 : 3 }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v > min) onChange(min, v);
          }}
          className="price-range-thumb pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
          style={{ zIndex: 3 }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-fg-faint">
        <span>${minPrice.toFixed(3)}</span>
        <span>${maxPriceValue.toFixed(3)}</span>
      </div>
      <p className="mt-2 text-[10px] text-fg-disabled">
        List price per model unit (request, minute, or token). See each card for the exact unit.
      </p>
      </div>
    </div>
  );
}

// ─── Filter Pill — Linear-style mono-key + value chip used in the toolbar ──

function ExploreFilterPill({
  label,
  value,
  onClick,
  onClear,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2 text-[12px] text-fg-strong transition-colors hover:bg-dark-lighter"
    >
      <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-fg-faint">
        {label}
      </span>
      <span className="lowercase">{value}</span>
      {onClear ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 grid h-3.5 w-3.5 place-items-center border-l border-hairline pl-1 text-fg-faint transition-colors hover:text-fg"
          aria-label={`Clear ${label}`}
        >
          <X className="h-2.5 w-2.5" />
        </span>
      ) : (
        <ChevronDown
          className="h-3 w-3 text-fg-faint"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

// ─── Explore catalog ───
//
// The public app catalog. Rendered at `/` for signed-out visitors (the landing)
// and at `/explore` for everyone via the sidebar nav. Signed-in visitors who
// hit `/` are redirected to /home by the root page; this component itself does
// no auth gating.

export default function ExploreView() {
  return (
    <Suspense
      fallback={
        <ConsolePageSkeleton
          maxWidth="7xl"
          withTabs
          kpiCount={0}
          withChart={false}
        />
      }
    >
      <ExplorePageInner />
    </Suspense>
  );
}

function ExploreLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-sm text-fg-muted">Could not load capabilities from Discovery Service.</p>
      <p className="mt-2 max-w-md font-mono text-xs text-fg-faint">{message}</p>
      <Button className="mt-6" variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function ExplorePageInner() {
  const exploreState = useExploreModels();
  const { status, models, reload } = exploreState;
  const searchParams = useSearchParams();
  const initialCategory = (() => {
    const qp = searchParams.get("category");
    return qp && VALID_CATEGORIES.includes(qp as AppCategory)
      ? (qp as AppCategory)
      : null;
  })();
  const initialFavorites = searchParams.get("starred") === "1";
  const { isStarred, starredIds } = useStarredApps();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<AppCategory | null>(initialCategory);
  // Sort is locked to the recommended ordering (warm + realtime tier, then runs7d desc).
  // The v3 design exposes no sort selector — ordering happens by default.
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(initialFavorites);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(100);

  const dataMaxPrice = useMemo(
    () => Math.max(...models.map((m) => m.pricing.amount), 0.01),
    [models],
  );

  const filtered = useMemo(() => {
    const result = models.filter((m) => {
      if (availabilityFilter === "warm" && m.status !== "hot") return false;
      if (availabilityFilter === "cold" && m.status !== "cold") return false;
      if (favoritesOnly && !isStarred(m.id)) return false;
      const matchesSearch =
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.provider.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !category || m.category === category;
      const price = m.pricing.amount;
      const matchesPrice = price >= (priceMin / 100) * dataMaxPrice && price <= (priceMax / 100) * dataMaxPrice;
      return matchesSearch && matchesCategory && matchesPrice;
    });

    // Recommended sort: featured first, then tiered by (realtime, warm),
    // then by 7-day run count. The v3 design exposes no sort selector, so this
    // is always-on and deterministic.
    result.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      const tier = (m: App) => (m.realtime ? 0 : 2) + (m.status === "hot" ? 0 : 1);
      const tierDiff = tier(a) - tier(b);
      if (tierDiff !== 0) return tierDiff;
      return b.runs7d - a.runs7d;
    });

    return result;
  }, [models, search, category, availabilityFilter, favoritesOnly, isStarred, priceMin, priceMax, dataMaxPrice]);

  if (status === "loading" && models.length === 0) {
    return (
      <main id="main-content" className="flex flex-1 flex-col bg-dark">
        <ConsolePageHeader title="Explore" icon={LayoutGrid} />
        <ConsolePageSkeleton maxWidth="7xl" withTabs kpiCount={0} withChart={false} />
      </main>
    );
  }

  if (status === "error") {
    return (
      <main id="main-content" className="flex flex-1 flex-col bg-dark">
        <ConsolePageHeader title="Explore" icon={LayoutGrid} />
        <ExploreLoadError
          message={exploreState.status === "error" ? exploreState.error : "Unknown error"}
          onRetry={reload}
        />
      </main>
    );
  }

  const activeFilters = [
    ...(category
      ? [{ label: category, onClear: () => setCategory(null) }]
      : []),
    ...(availabilityFilter !== "all"
      ? [{ label: availabilityFilter === "warm" ? "Warm" : "Cold", onClear: () => setAvailabilityFilter("all") }]
      : []),
    ...(favoritesOnly
      ? [{ label: "Starred", onClear: () => setFavoritesOnly(false) }]
      : []),
  ];

  const ALL_CATEGORIES = [...VIDEO_CATEGORIES, ...OTHER_CATEGORIES];

  const tabKeys: ({ key: "all"; label: string } | { key: AppCategory; label: string })[] = [
    { key: "all", label: "All" },
    ...ALL_CATEGORIES.map((c) => ({ key: c.label, label: c.label })),
  ];

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <ConsolePageHeader
        title="Explore"
        icon={LayoutGrid}
        actions={
          <>
            {/* Grid / list view toggle — segmented control per v3 `.view-toggle` */}
            <div
              className="flex h-[26px] items-center rounded-[4px] border border-hairline bg-dark-lighter p-0.5"
              role="tablist"
              aria-label="View"
            >
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={`flex h-5 w-6 items-center justify-center rounded-[3px] transition-colors ${
                  view === "grid"
                    ? "bg-pop text-fg"
                    : "text-fg-faint hover:text-fg-strong"
                }`}
              >
                <LayoutGrid className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
                className={`flex h-5 w-6 items-center justify-center rounded-[3px] transition-colors ${
                  view === "list"
                    ? "bg-pop text-fg"
                    : "text-fg-faint hover:text-fg-strong"
                }`}
              >
                <List className="h-3 w-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              Display
            </button>
          </>
        }
      />

      {/* Tabstrip — flush full-width, hairline border-bottom. Active tab gets
          green-bright underline (8px inset both sides) + count chip. Per the
          Livepeer Dashboard v3 design (`.tabstrip` / `.tab` in styles.css). */}
      <div
        className="scrollbar-none flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-hairline px-5"
        role="tablist"
        aria-label="App category"
      >
        {tabKeys.map((tab) => {
          const isActive = (tab.key === "all" && category === null) || tab.key === category;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setCategory(tab.key === "all" ? null : tab.key)}
              className={`relative inline-flex shrink-0 items-center gap-1.5 px-3 py-[11px] text-[13px] transition-colors ${
                isActive
                  ? "font-medium text-fg"
                  : "text-fg-muted hover:text-fg-strong"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="rounded-[3px] border border-hairline bg-dark-card px-1.5 py-px font-mono text-[10.5px] text-fg-faint tabular-nums">
                  {filtered.length}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute right-2 left-2 -bottom-px h-0.5 rounded-t-[2px] bg-green-bright"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar — pills + dashed `+ Filter` + right-aligned search.
          Per `.filter-bar` in the Livepeer Dashboard v3 design. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-dark px-5 py-2.5">
        <ExploreFilterPill
          label="Status"
          value={
            availabilityFilter === "all"
              ? "warm, cold"
              : availabilityFilter === "warm"
                ? "warm"
                : "cold"
          }
          onClick={() => setFilterDrawerOpen(true)}
        />
        {(priceMin > 0 || priceMax < 100) && (
          <ExploreFilterPill
            label="Price"
            value={`≤ $${((priceMax / 100) * dataMaxPrice).toFixed(3)}`}
            onClear={() => {
              setPriceMin(0);
              setPriceMax(100);
            }}
          />
        )}
        {favoritesOnly && (
          <ExploreFilterPill
            label="Starred"
            value={`${starredIds.length}`}
            onClear={() => setFavoritesOnly(false)}
          />
        )}
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-dashed border-hairline px-2 text-[11.5px] text-fg-muted transition-colors hover:border-subtle hover:text-fg-strong"
        >
          <Plus className="h-2.5 w-2.5" aria-hidden="true" />
          Filter
        </button>

        {/* Right-aligned search — 280px per design */}
        <div className="ml-auto flex h-[26px] w-[280px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5">
          <Search
            className="h-3 w-3 shrink-0 text-fg-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps…"
            className="flex-1 bg-transparent text-[13px] text-fg-strong placeholder:text-fg-faint outline-none"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {filtered.length === 0 ? (
          <div className="flex-1">
            <ExploreEmptyState
              onClearFilters={() => {
                setSearch("");
                setCategory(null);
                setAvailabilityFilter("all");
                setFavoritesOnly(false);
                setPriceMin(0);
                setPriceMax(100);
              }}
            />
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-3 px-5 pt-4 pb-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((model) => (
              <AppCard key={model.id} model={model} />
            ))}
          </div>
        ) : (
          <div className="px-5 pb-8">
            <ListHeaderRow />
            {filtered.map((model) => (
              <ModelListItem key={model.id} model={model} />
            ))}
          </div>
        )}
      </div>

      {/* Filter drawer — Availability / Starred / Price. Categories live
          in the horizontal pill row above; only secondary filters live
          here. Used at all breakpoints. */}
      <Drawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        title="Filters"
        ariaLabel="Filters"
      >
        <div className="space-y-4 px-5 py-4">
          {/* Availability */}
          <div>
            <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-fg-muted">
              Availability
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setAvailabilityFilter(availabilityFilter === "warm" ? "all" : "warm")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  availabilityFilter === "warm"
                    ? "bg-warm-subtle font-medium text-warm"
                    : "text-fg-strong hover:bg-tint"
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                Warm
              </button>
              <button
                onClick={() => setAvailabilityFilter(availabilityFilter === "cold" ? "all" : "cold")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  availabilityFilter === "cold"
                    ? "bg-blue/10 font-medium text-blue-bright"
                    : "text-fg-strong hover:bg-tint"
                }`}
              >
                <Snowflake className="h-3.5 w-3.5" />
                Cold
              </button>
            </div>
          </div>

          <div className="h-px bg-tint" />

          {/* Starred */}
          <div>
            <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-fg-muted">
              Starred
            </p>
            <button
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              disabled={starredIds.length === 0}
              className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                favoritesOnly
                  ? "bg-warm-subtle font-medium text-warm"
                  : "text-fg-strong hover:bg-tint disabled:cursor-not-allowed disabled:opacity-40"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${favoritesOnly ? "fill-warm" : ""}`} />
              Starred only
              {starredIds.length > 0 && (
                <span className={`ml-auto text-[11px] ${favoritesOnly ? "text-warm/70" : "text-fg-label"}`}>
                  {starredIds.length}
                </span>
              )}
            </button>
          </div>

          <div className="h-px bg-tint" />

          {/* Price range */}
          <PriceRangeFilter
            min={priceMin}
            max={priceMax}
            onChange={(min, max) => { setPriceMin(min); setPriceMax(max); }}
            models={models}
          />
        </div>

        {/* Sticky footer — always visible, no layout shift */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-hairline bg-dark px-5 py-3">
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setAvailabilityFilter("all");
              setFavoritesOnly(false);
              setPriceMin(0);
              setPriceMax(100);
            }}
            disabled={activeFilters.length === 0}
            className="text-sm text-fg-muted underline decoration-white/30 underline-offset-2 transition-colors hover:text-fg disabled:no-underline disabled:text-fg-disabled disabled:cursor-default"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(false)}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Show {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </button>
        </div>
      </Drawer>
    </main>
  );
}
