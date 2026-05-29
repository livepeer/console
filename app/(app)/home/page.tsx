"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  House,
  Activity,
} from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  MODELS,
  MOCK_RECENT_REQUESTS,
  ACCOUNT_USAGE_SUMMARY,
} from "@/lib/dashboard/mock-data";
import { generateSparklineData, getModelIcon } from "@/lib/dashboard/utils";
import Banner from "@/components/dashboard/Banner";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import FirstRunChecklist, {
  FIRST_RUN_CHANGED_EVENT,
  FIRST_RUN_DISMISSED_KEY,
} from "@/components/dashboard/FirstRunChecklist";
import CapabilityLeaderboardPanel from "@/components/dashboard/CapabilityLeaderboardPanel";
import KpiCard from "@/components/dashboard/KpiCard";
import KpiStrip from "@/components/dashboard/KpiStrip";
import JobsTable from "@/components/dashboard/JobsTable";
import SectionHeader from "@/components/dashboard/SectionHeader";
import type { ModelCategory } from "@/lib/dashboard/types";

// ─── Mock data ───

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

// ─── Helpers for the workspace home ───
//
// (`WelcomeCard`, `FeaturedCapabilities`, `BrowseByCategory`, and
// `GettingStartedStrip` previously lived here as the signed-out body of
// /home. The v4 prototype replaces that marketing-style page with a
// route-specific `SignInWall`, so those components are gone — `git log` if
// you need them back. Browse-by-category and the marketing pitch now live on
// /, which is the public landing for logged-out users.)

// Map a recent-request pipeline string to a category so we can pick an icon
// for runs whose model isn't in the MODELS list (mock data has /-shaped names
// like "daydream/video-v2"). Falls back to a generic activity icon.
const PIPELINE_TO_CATEGORY: Record<string, ModelCategory> = {
  "video-to-video": "Video Editing",
  "live-video-to-video": "Video Editing",
  "live-transcoding": "Live Transcoding",
  "text-to-image": "Image Generation",
  language: "Language",
  "audio-to-text": "Speech",
  "video-understanding": "Video Understanding",
  "text-to-speech": "Speech",
  "image-to-video": "Video Generation",
};

// Best-effort lookup from a recent-request row to a Model in our MODELS list.
// Matches on name fragment (provider or model slug). Used for the "Run again"
// CTA target — falls back to / search if no match.
function findModelForRunRow(rowModel: string) {
  const slug = rowModel.split("/").pop() ?? rowModel;
  const provider = rowModel.split("/")[0] ?? "";
  return (
    MODELS.find((m) =>
      m.name.toLowerCase().replace(/\s+/g, "").includes(slug.toLowerCase().replace(/-/g, "")),
    ) ??
    MODELS.find((m) => m.provider.toLowerCase().includes(provider.toLowerCase())) ??
    null
  );
}

// ─── Last Run Hero — most prominent element on the workspace home ───

function LastRunHero() {
  const last = MOCK_RECENT_REQUESTS[0];
  if (!last) return null;

  const Icon =
    getModelIcon(PIPELINE_TO_CATEGORY[last.pipeline]) ?? Activity;
  const matchedModel = findModelForRunRow(last.model);
  const playgroundHref = matchedModel
    ? `/models/${matchedModel.id}?tab=playground`
    : `/?q=${encodeURIComponent(last.model.split("/").pop() ?? last.model)}`;

  const isSuccess = last.status === "success";

  return (
    <section>
      <p className="text-[10px] uppercase tracking-wider text-fg-label">
        Last job · {formatRelativeTime(last.timestamp)}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-hairline">
            <Icon className="h-4 w-4 text-fg-strong" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="flex items-baseline gap-2.5">
              <span className="font-mono text-base text-fg">{last.model}</span>
              <span className="text-[11px] tabular-nums text-fg-faint">
                {formatLatency(last.latencyMs)}
              </span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-[13px] text-fg-faint">
              <span
                className={`inline-flex items-center gap-1.5 ${
                  isSuccess ? "text-green-bright" : "text-fg-faint"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isSuccess ? "bg-green-bright" : "bg-fg-faint"
                  }`}
                  aria-hidden="true"
                />
                {last.status}
              </span>
              <span className="text-fg-disabled">·</span>
              <span>{last.pipeline}</span>
              <span className="text-fg-disabled">·</span>
              <span>via {last.signerLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={`/settings?tab=usage&request=${last.id}`}
            className="text-[13px] text-fg-muted transition-colors hover:text-fg"
          >
            Inspect
          </Link>
          <Link
            href={playgroundHref}
            className="btn-primary inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13px] font-medium transition-colors"
          >
            Open in playground
            <kbd
              aria-hidden="true"
              className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[3px] bg-overlay px-1 text-[10px] font-medium leading-none text-white/85"
            >
              R
            </kbd>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Pinned — recently-used + starred models, one-click re-launch ───

function PinnedCapabilities() {
  // Build the pinned set: distinct models from recent runs (priority) + starred.
  const recentNames = Array.from(
    new Set(MOCK_RECENT_REQUESTS.map((r) => r.model)),
  );
  const recentModels = recentNames
    .map((name) => findModelForRunRow(name))
    .filter((m): m is (typeof MODELS)[number] => Boolean(m));

  // Take up to 4 (one row on lg).
  const seen = new Set<string>();
  const pinned = recentModels
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .slice(0, 4);

  if (pinned.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Pinned"
        action={
          <Link
            href="/"
            className="text-xs text-fg-muted transition-colors hover:text-fg"
          >
            See all capabilities →
          </Link>
        }
        className="mb-3"
      />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {pinned.map((model) => {
          const Icon = getModelIcon(model.category);
          return (
            <li key={model.id}>
              <Link
                href={`/models/${model.id}?tab=playground`}
                className="group flex h-full items-center gap-3 rounded-md border border-hairline px-3 py-3 transition-colors hover:border-subtle hover:bg-zebra"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zebra">
                  <Icon className="h-4 w-4 text-fg-strong" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-fg-label">
                    {model.provider.toLowerCase().replace(/\s+/g, "-")}
                  </p>
                  <p className="truncate text-sm text-fg">{model.name}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Recent jobs panel ─────────────────────────────────────────────────────
//
// Per the v5 prototype, "Recent jobs" is a panel with its own head (title +
// "Across all capabilities" sub + "View all →" action). The jobs table sits
// flush below the head sharing the same rounded border. The previous version
// rendered a free-standing `<SectionHeader>` above an already-bordered
// `JobsTable`, which made it look like two stacked panels.

function RecentJobsPanel() {
  const rows = MOCK_RECENT_REQUESTS.slice(0, 8);

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="guided"
        icon={<Activity className="h-4 w-4" />}
        title="No jobs yet"
        description="Run inference to see your jobs here — status, latency, and time per request."
        action={{ label: "Browse capabilities", href: "/" }}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div>
          <p className="text-[17px] font-bold text-fg">Recent jobs</p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Across all capabilities
          </p>
        </div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-[12px] text-fg-faint transition-colors hover:text-fg"
        >
          View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      {/* Shared `JobsTable` rendered borderless so the panel's outer chrome
          provides the rounded edge — keeps row vocabulary identical to
          /jobs and the model-detail Jobs tab. */}
      <JobsTable rows={rows} showHeader bordered={false} />
    </section>
  );
}

// ─── Home page header — chrome bar with Period selector + actions ───

function HomePageHeader() {
  return (
    <DashboardPageHeader
      title="Home"
      icon={House}
      actions={
        <>
          <button
            type="button"
            className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
          >
            <span className="text-fg-faint">Period</span>
            <span>7d</span>
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
          <Link
            href="/usage"
            className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
          >
            <BarChart3 className="h-3 w-3" aria-hidden="true" />
            View usage
          </Link>
        </>
      }
    />
  );
}

// ─── Greeting block — eyebrow + 'Good morning, {name}' + live indicator ───

function Greeting({
  workspace,
  firstName,
}: {
  workspace: string;
  firstName: string;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-faint">
          Workspace · {workspace}
        </p>
        <h1 className="mt-1.5 text-[28px] font-bold tracking-[-0.02em] text-fg">
          {greeting}, {firstName}
        </h1>
      </div>
      <p className="font-mono text-[12px] text-fg-faint">
        Last refresh: just now · live
      </p>
    </div>
  );
}

// ─── Home KPI strip — 4 stats with sparklines ───

function HomeKpis() {
  // Stable mock sparklines per render (regenerate only on mount)
  const reqSpark = useMemo(() => generateSparklineData(30), []);
  const latSpark = useMemo(() => generateSparklineData(30), []);
  const errSpark = useMemo(() => generateSparklineData(30), []);
  const spendSpark = useMemo(() => generateSparklineData(30), []);

  return (
    <KpiStrip cols={4}>
      <KpiCard
        label="Jobs · 7d"
        value="17,374"
        delta="+18.2%"
        trend="up"
        spark={reqSpark}
        sparkColor="#40BF86"
      />
      <KpiCard
        label="p95 latency"
        value="284"
        unit="ms"
        delta="−12ms"
        trend="down"
        spark={latSpark}
        sparkColor="#25ABD0"
      />
      <KpiCard
        label="Error rate"
        value="0.84"
        unit="%"
        delta="−0.2pp"
        trend="down"
        spark={errSpark}
        sparkColor="#fbbf24"
      />
      <KpiCard
        label="Spend · MTD"
        value="$5.70"
        delta="+$1.80"
        trend="up"
        spark={spendSpark}
        sparkColor="#1E9960"
      />
    </KpiStrip>
  );
}

// (`UsageByCapabilityPanel` and `PinnedCapabilitiesPanel` previously lived
// here as the home view's two-column bottom section. The v5 prototype
// replaces both with a single full-width sortable leaderboard —
// `CapabilityLeaderboardPanel`. `git log` if you need them back.)

// ─── Capacity Banner — slim free-tier callout at the top of Home ───
//
// Per the Livepeer Console design (Apr 2026): always visible, quiet, with the
// exact remaining quota and an inline accent action. No threshold gating —
// the banner is ambient context, not an alert.

function CapacityBanner() {
  const used = ACCOUNT_USAGE_SUMMARY.freeTierUsed;
  const limit = ACCOUNT_USAGE_SUMMARY.freeTierLimit;
  const remaining = Math.max(0, limit - used);

  return (
    <Banner
      icon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      }
      action={{ label: "Add a payment provider", href: "/settings?tab=billing" }}
    >
      <span className="font-medium text-fg">You&apos;re on the free tier</span>
      <span className="text-fg-faint"> · {remaining.toLocaleString()} requests left this month · resets in {ACCOUNT_USAGE_SUMMARY.freeTierResetIn}</span>
    </Banner>
  );
}


// ─── Home Page ───
//
// Workspace pattern (CCO rethink): the home is for getting back to work,
// not reading a stats report. Composition top-to-bottom:
//   1. Last run hero — the most likely next action is "do that again"
//   2. Pinned capabilities — recent + starred, one-click re-launch
//   3. Your runs — slim list of recent inferences
//   4. Capacity footnote — free tier as a quiet line, not a hero
//
// Stats (errors, p50, spend, 30d volume) live on /settings?tab=usage
// where they belong. The home stays focused on "your work".

export default function HomePage() {
  const { isConnected, isLoading, user } = useAuth();
  const router = useRouter();

  // Signed-out users redirect to / — the public landing.
  // The Home view is workspace-only (KPIs, recent runs, capability
  // leaderboard), and a SignInWall on the root /home URL was the
  // wrong default: visitors arrived at a sign-in gate before they'd had a
  // chance to see what's on the platform. Explore is the discovery surface
  // and the right entry point for unauthenticated visitors.
  useEffect(() => {
    if (!isLoading && (!isConnected || !user)) {
      router.replace("/");
    }
  }, [isLoading, isConnected, user, router]);

  // Signed-in users get the inline first-run checklist unless they've
  // dismissed it (via Skip, "I've made my first call", or by clicking through
  // to the playground). Quickstart in the sidebar footer clears this flag to
  // re-open the checklist. Mock-only gate: in production we'd ALSO check
  // server-side run history, but in mock mode the flag alone is the source
  // of truth (MOCK_RECENT_REQUESTS is always non-empty for the workspace demo).
  const [firstRunDismissed, setFirstRunDismissed] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () =>
      setFirstRunDismissed(
        window.localStorage.getItem(FIRST_RUN_DISMISSED_KEY) === "1",
      );
    read();
    // Cross-tab updates via storage; same-tab updates (e.g. Quickstart click in
    // the sidebar) via a custom event since storage events don't fire in the
    // window that wrote the value.
    const onStorage = (e: StorageEvent) => {
      if (e.key === FIRST_RUN_DISMISSED_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(FIRST_RUN_CHANGED_EVENT, read);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FIRST_RUN_CHANGED_EVENT, read);
    };
  }, []);

  if (isLoading) return null;

  const showFirstRun = isConnected && firstRunDismissed === false;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FIRST_RUN_DISMISSED_KEY, "1");
    }
    setFirstRunDismissed(true);
  };

  // Workspace name + greeting first-name (stand-ins until real workspaces +
  // proper user profile fields exist; matches the design spec).
  const workspace = "Flipbook";
  const firstName = (user?.name?.split(" ")[0] ?? "there");

  // Signed-out users are redirected to / via the useEffect
  // above; render nothing in the meantime (one frame max) so they don't see
  // a flash of workspace-mock data before the redirect lands.
  if (!isConnected || !user) {
    return null;
  }

  // Hold off rendering signed-in content for one frame while we read the
  // localStorage flag, so the workspace doesn't flash before the checklist.
  if (firstRunDismissed === null) {
    return <main id="main-content" className="flex flex-1 flex-col bg-dark" />;
  }

  // Signed-in workspace home — Linear / Livepeer Console structure:
  //   chrome bar  → greeting → KPIs → free-tier banner → quickstart (when not
  //   dismissed) → recent runs → usage chart + pinned capabilities grid.
  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <HomePageHeader />
      <div className="flex-1 overflow-y-auto">
        {/* Per-section margins instead of uniform `space-y-N` — the home
         *  rhythm has three different gaps depending on adjacency:
         *    Greeting→KPIs / KPIs→Banner: 16px (tight cluster of context)
         *    Banner→{section group}: 28px (proper section break)
         *    SectionHeader→panel: 10px (built into SectionHeader's pb-2.5)
         *    panel→panel: 28px (proper section break)
         *  See the design prototype `views.jsx` HomeView for the source rhythm. */}
        <div className="mx-auto w-full max-w-[1200px] px-7 pt-7 pb-20">
          <Greeting workspace={workspace} firstName={firstName} />
          <div className="mt-4">
            <HomeKpis />
          </div>
          <div className="mt-4">
            <CapacityBanner />
          </div>

          {!showFirstRun ? null : (
            // SectionHeader contributes its own pt-7 (28px above) + pb-2.5
            // (10px below) — no wrapper margin needed.
            <>
              <SectionHeader
                title="Quickstart"
                count="2 of 4 done"
                action={
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1 text-fg-faint transition-colors hover:text-fg-strong"
                  >
                    Skip ✕
                  </button>
                }
              />
              <FirstRunChecklist onDismiss={handleDismiss} />
            </>
          )}

          {/* Recent jobs — panel-with-head (no external SectionHeader above
              it) per the v5 prototype. 28px gap matches design's marginTop. */}
          <div className="mt-7">
            <RecentJobsPanel />
          </div>

          {/* Capability leaderboard — replaces the previous 2-column
              "stacked-area chart + Pinned capabilities" grid. The home view
              now has a single full-width "Usage by capability" panel that
              answers what's growing / costing / failing, not just "look at
              this chart of run counts." */}
          <div className="mt-7">
            <CapabilityLeaderboardPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
