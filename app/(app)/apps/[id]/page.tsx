"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Play,
  Code,
  FileText,
  RotateCcw,
  Activity,
  Box,
  Radio,
  ArrowUpRight,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthContext";
import DashboardSubNav from "@/components/dashboard/DashboardSubNav";
import CostTag from "@/components/dashboard/CostTag";
import KeyBadge from "@/components/dashboard/KeyBadge";
import CallsTable from "@/components/dashboard/CallsTable";
import StatusDot from "@/components/dashboard/StatusDot";
import {
  getCapabilityById,
  getPipelineById,
  pipelineToExploreApp,
  effectiveVisibility,
  setPipelineVisibility,
  organizationSlug,
  PIPELINE_APP_IDS,
  SETTINGS_API_KEYS,
  MOCK_RECENT_REQUESTS,
} from "@/lib/dashboard/mock-data";
import { getAppIcon } from "@/lib/dashboard/utils";
import PlaygroundForm from "@/components/dashboard/playground/PlaygroundForm";
import JsonInput from "@/components/dashboard/playground/JsonInput";
import PlaygroundOutput from "@/components/dashboard/playground/PlaygroundOutput";
import TranscodingOutput from "@/components/dashboard/playground/TranscodingOutput";
import CodeSnippets from "@/components/dashboard/playground/CodeSnippets";
import WebcamPlayground from "@/components/dashboard/playground/WebcamPlayground";
import AppAnalytics from "@/components/dashboard/stats/AppAnalytics";
import {
  OverviewTab,
  SettingsTab,
} from "@/components/dashboard/AppDetailView";
import type { App, PipelineVisibility } from "@/lib/dashboard/types";

// ─── Tabs ───
//
// Mirrors the Livepeer Dashboard v3 model-view tab strip. `Jobs` carries an
// optional count chip — populated at render time from jobs filtered to this
// specific model so the badge tracks reality (zero for empty, drops the chip
// entirely so we don't show "Jobs (0)").

// The consumer tabs are visible to everyone; the owner of the app additionally
// gets Overview (the deployment console chrome), Logs, and Settings — same page,
// extra tabs, gated by ownership. This is the GitHub model (everyone sees the
// repo; owners also see Settings).
type Tab =
  | "overview"
  | "playground"
  | "api"
  | "readme"
  | "stats"
  | "jobs"
  | "settings";

type TabSpec = {
  key: Tab;
  label: string;
  icon: React.ElementType;
  count?: number;
};

const TABS: TabSpec[] = [
  { key: "playground", label: "Playground", icon: Play },
  { key: "api", label: "API", icon: Code },
  { key: "readme", label: "README", icon: FileText },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "jobs", label: "Logs", icon: Activity },
];

// Owner-only tabs, bracketing the consumer set: Overview leads (the deployment
// console), Settings trails. (Runs is the single activity view — per-app raw
// log-tailing lives on the Apps-list Logs view, filterable to one app.)
const OWNER_LEAD_TABS: TabSpec[] = [
  { key: "overview", label: "Overview", icon: Box },
];
const OWNER_TRAIL_TABS: TabSpec[] = [
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

// Match a model's catalog id (e.g. "flux-schnell") against an activity row's
// model string (e.g. "flux/schnell"). The mock data uses "vendor/slug" while
// the catalog uses "slug" or "vendor-slug" — so we slugify both and check for
// a containment relationship in either direction. Keeps the filter resilient
// to small naming drift without forcing a parallel mapping table.
function modelMatchesRow(catalogId: string, runModel: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = norm(catalogId);
  const b = norm(runModel);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// ─── Playground Tab ───

function PlaygroundTab({ model }: { model: App }) {
  const [inputMode, setInputMode] = useState<"form" | "json" | "python" | "node" | "http">("form");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [inferenceTime, setInferenceTime] = useState<number | undefined>();
  const [lastRunValues, setLastRunValues] = useState<Record<string, unknown> | null>(null);

  const handleRun = useCallback(
    (values: Record<string, unknown>) => {
      setLastRunValues(values);
      setIsRunning(true);
      setResult(null);
      const time = 0.3 + Math.random() * 1.5;
      setTimeout(() => {
        setIsRunning(false);
        setInferenceTime(parseFloat(time.toFixed(1)));

        const cfg = model.playgroundConfig;
        if (!cfg) return;

        if (cfg.outputType === "text" && cfg.mockOutputText) {
          setResult(cfg.mockOutputText);
        } else if (
          (cfg.outputType === "image" ||
            cfg.outputType === "video" ||
            cfg.outputType === "audio") &&
          cfg.mockOutputUrl
        ) {
          setResult(cfg.mockOutputUrl);
        } else if (cfg.outputType === "audio") {
          setResult("audio-mock");
        } else if (cfg.outputType === "json") {
          setResult(
            JSON.stringify(
              {
                embedding: [0.023, -0.041, 0.087, 0.012, -0.056],
                model: model.id,
                usage: { prompt_tokens: 12, total_tokens: 12 },
              },
              null,
              2,
            ),
          );
        } else {
          setResult(cfg.mockOutputUrl || "Output generated successfully");
        }
      }, time * 1000);
    },
    [model],
  );

  // Ctrl+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isRunning) {
        handleRun({});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleRun, isRunning]);

  if (!model.playgroundConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Play className="h-10 w-10 text-fg-disabled" />
        <p className="mt-3 text-sm text-fg-label">
          Playground not available for this app
        </p>
      </div>
    );
  }

  if (model.playgroundConfig.playgroundVariant === "webcam") {
    return <WebcamPlayground model={model} />;
  }

  const INPUT_MODES = [
    { key: "form" as const, label: "Form" },
    { key: "json" as const, label: "JSON" },
    { key: "python" as const, label: "Python" },
    { key: "node" as const, label: "Node.js" },
    { key: "http" as const, label: "HTTP" },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left: Input */}
      <div>
        {/* Label stacks above the format picker on mobile where 5 segments + label
            would overflow; inline side-by-side from sm+ where there's room. */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-fg-label">
            Request
          </span>
          <div
            role="tablist"
            aria-label="Request format"
            className="scrollbar-none flex shrink-0 items-center overflow-x-auto rounded-lg border border-hairline bg-zebra p-0.5"
          >
            {INPUT_MODES.map((mode) => {
              const selected = inputMode === mode.key;
              return (
                <button
                  key={mode.key}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setInputMode(mode.key)}
                  className={`flex h-9 shrink-0 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus:outline-none sm:h-7 ${
                    selected
                      ? "bg-pop text-fg shadow-sm"
                      : "text-fg-faint hover:text-fg-strong"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {inputMode === "form" && (
          <PlaygroundForm
            config={model.playgroundConfig}
            onRun={handleRun}
            isRunning={isRunning}
          />
        )}
        {inputMode === "json" && (
          <JsonInput
            config={model.playgroundConfig}
            onRun={handleRun}
            isRunning={isRunning}
          />
        )}
        {(inputMode === "python" ||
          inputMode === "node" ||
          inputMode === "http") && (
          <div className="flex flex-col">
            <div className="pb-4">
              <CodeSnippets model={model} fixedLang={inputMode} />
            </div>
            <div className="flex items-center gap-2 border-t border-hairline pt-4">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-2 text-xs text-fg-label transition-colors hover:bg-hover hover:text-fg-muted focus:outline-none"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to defaults
              </button>
              <button
                type="button"
                onClick={() => handleRun({})}
                disabled={isRunning}
                className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors active:scale-[0.98] disabled:bg-tint disabled:text-fg-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/50 motion-reduce:active:scale-100"
              >
                {isRunning ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-strong border-t-white" />
                    Running...
                  </>
                ) : (
                  "Run"
                )}
              </button>
              <CostTag mode="free" />
              <span className="ml-auto text-[10px] text-fg-label">
                ctrl+enter
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Output */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-fg-faint">Output</h3>
        {model.playgroundConfig.playgroundVariant === "transcoding" ? (
          <TranscodingOutput
            result={result}
            isRunning={isRunning}
            inferenceTime={inferenceTime}
            modelName={model.name}
            posterUrl={model.playgroundConfig.mockOutputUrl}
          />
        ) : (
          <PlaygroundOutput
            outputType={model.playgroundConfig.outputType}
            result={result}
            isRunning={isRunning}
            inferenceTime={inferenceTime}
            category={model.category}
            modelName={model.name}
            mockOutputJson={model.playgroundConfig.mockOutputJson}
            model={model}
            lastRunValues={lastRunValues}
          />
        )}
      </div>
    </div>
  );
}

// ─── API Tab ───

function ApiTab({ model }: { model: App }) {
  const baseUrl = model.apiEndpoint ?? "https://gateway.livepeer.org/v1";
  const endpoint =
    model.category === "Language"
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/${model.id}`;
  const defaultKey =
    SETTINGS_API_KEYS.find((k) => k.isDefault) ?? SETTINGS_API_KEYS[0];

  return (
    <div className="space-y-6">
      {/* Auth — your key, ready to copy */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-faint">
          Your API key
        </p>
        <KeyBadge prefix={defaultKey.prefix} />
        <p className="mt-2 text-[11px] text-fg-faint">
          Drop this into the <code className="text-fg-muted">Authorization</code> header below, or{" "}
          <Link
            href="/settings?tab=tokens"
            className="text-fg-strong underline-offset-2 hover:text-fg hover:underline"
          >
            manage your keys
          </Link>
          .
        </p>
      </div>

      {/* Endpoint */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-faint">
          Endpoint
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-dark-surface p-4">
          <span className="shrink-0 rounded bg-green/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-bright">
            POST
          </span>
          <code className="min-w-0 flex-1 break-all text-xs text-fg-strong sm:text-sm">
            {endpoint}
          </code>
        </div>
      </div>

      {/* Quick start */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-faint">
          Quick start
        </p>
        <CodeSnippets model={model} />
      </div>

      {/* Pricing footer — compact, since the hero already shows the list price */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-dark-surface px-4 py-3 text-xs text-fg-faint">
        <span>
          Billed per request. Free tier covers your first 10,000 each month.
        </span>
        <Link
          href="/settings?tab=billing"
          className="text-fg-strong underline-offset-2 hover:text-fg hover:underline"
        >
          Add a payment provider →
        </Link>
      </div>
    </div>
  );
}

// ─── README Tab ───

function ReadmeTab({ model }: { model: App }) {
  if (!model.readme) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-10 w-10 text-fg-disabled" />
        <p className="mt-3 text-sm text-fg-label">No README available</p>
      </div>
    );
  }

  // Simple markdown-ish rendering (headers, code blocks, lists, tables)
  const lines = model.readme.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(
        <div
          key={`table-${elements.length}`}
          className="overflow-hidden rounded-lg border border-hairline"
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-hairline bg-dark-surface">
                {tableRows[0].map((cell, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-medium text-fg-faint"
                  >
                    {cell.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(2).map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-hairline last:border-0"
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-fg-label">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      tableRows = [];
    }
    inTable = false;
  };

  lines.forEach((line, i) => {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="scrollbar-dark overflow-x-auto rounded-lg border border-hairline bg-overlay p-4 text-xs leading-relaxed text-fg-muted"
          >
            {codeContent.trim()}
          </pre>,
        );
        codeContent = "";
        inCodeBlock = false;
      } else {
        if (inTable) flushTable();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      return;
    }

    if (line.startsWith("|")) {
      if (!inTable) inTable = true;
      const cells = line
        .split("|")
        .filter((c) => c.trim() !== "");
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="mt-5 mb-2 text-xl font-semibold text-fg first:mt-0"
        >
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="mt-5 mb-2 text-lg font-semibold text-fg first:mt-0"
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="mt-4 mb-2 text-sm font-semibold text-fg-strong first:mt-0"
        >
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- **")) {
      const match = line.match(/^- \*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
      if (match) {
        elements.push(
          <div key={i} className="flex items-start gap-2 pl-4 text-sm text-fg-faint">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-faint" aria-hidden="true" />
            <span>
              <span className="font-medium text-fg-strong">{match[1]}</span>
              <span className="text-fg-disabled"> — </span>
              {match[2]}
            </span>
          </div>,
        );
      } else {
        elements.push(
          <div key={i} className="flex items-start gap-2 pl-4 text-sm text-fg-faint">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-faint" aria-hidden="true" />
            <span>{line.slice(2).replace(/\*\*/g, "")}</span>
          </div>,
        );
      }
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex items-start gap-2 pl-4 text-sm text-fg-faint">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-faint" aria-hidden="true" />
          <span>{line.slice(2)}</span>
        </div>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed text-fg-faint">
          {line}
        </p>,
      );
    }
  });

  if (inTable) flushTable();

  return (
    <article className="rounded-xl border border-hairline bg-dark-surface p-5">
      <div className="max-w-3xl space-y-1">{elements}</div>
    </article>
  );
}

// ─── Stats Tab ───

function StatsTab({ model }: { model: App }) {
  return <AppAnalytics model={model} />;
}

// ─── Jobs Tab ───
//
// Reuses the shared `CallsTable` so this surface and the standalone `/calls`
// view render identical rows. Empty state is bespoke here because the message
// is app-specific and doesn't make sense to push into the shared component.

function JobsTab({
  model,
  runs,
}: {
  model: App;
  runs: import("@/lib/dashboard/types").AccountActivityRow[];
}) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-hairline bg-dark-card py-16 text-center">
        <Activity className="h-9 w-9 text-fg-disabled" strokeWidth={1.5} />
        <p className="mt-3 text-[13px] text-fg-faint">
          No logs yet for {model.name}
        </p>
        <p className="mt-1 text-[11.5px] text-fg-disabled">
          Calls to this app from your organization will show up here.
        </p>
      </div>
    );
  }

  return <CallsTable rows={runs} showHeader />;
}

// ─── Main Page ───

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isConnected } = useAuth();

  // The owned deployment (exists for your apps, public or private) and the
  // public catalog entry (exists for any listed app). The catalog object is the
  // render base; for a private app with no catalog listing we derive it from the
  // pipeline so the same template still works.
  const pipeline = getPipelineById(id);
  const isOwner = isConnected && PIPELINE_APP_IDS.has(id);
  const model =
    getCapabilityById(id) ??
    (pipeline ? pipelineToExploreApp(pipeline) : undefined);

  // Visibility (publish state) for the owner Settings tab.
  const [visibility, setVisibility] = useState<PipelineVisibility>(
    pipeline?.visibility ?? "private",
  );
  useEffect(() => {
    if (pipeline) setVisibility(effectiveVisibility(pipeline));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const toggleVisibility = () => {
    if (!pipeline) return;
    const next: PipelineVisibility =
      visibility === "public" ? "private" : "public";
    setPipelineVisibility(pipeline.id, next);
    setVisibility(next);
  };

  // Runs filtered to this app — drives both the Runs panel and the count chip.
  // `model` may be undefined (404 path below); run the hook unconditionally.
  const filteredRuns = useMemo(() => {
    if (!model) return [];
    return MOCK_RECENT_REQUESTS.filter((r) =>
      modelMatchesRow(model.id, r.model),
    );
  }, [model]);

  // Tab set: consumer tabs for everyone; owners get Overview (lead) + Logs &
  // Settings (trail) — same template, ownership just unlocks more tabs.
  const tabs: TabSpec[] = useMemo(() => {
    const consumer = TABS.map((t) =>
      t.key === "jobs" ? { ...t, count: filteredRuns.length } : t,
    );
    return isOwner
      ? [...OWNER_LEAD_TABS, ...consumer, ...OWNER_TRAIL_TABS]
      : consumer;
  }, [filteredRuns.length, isOwner]);

  // Default landing tab: owners land on Overview (the console chrome); everyone
  // else on Playground. A `?tab=` param overrides when the viewer has that tab.
  const defaultTab: Tab = isOwner ? "overview" : "playground";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "tab",
    ) as Tab | null;
    setActiveTab(
      requested && tabs.some((t) => t.key === requested)
        ? requested
        : defaultTab,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isOwner]);

  if (!model) {
    return (
      <main id="main-content" className="flex flex-1 flex-col bg-dark">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm text-fg-label">App not found</p>
          <Link
            href="/"
            className="mt-3 text-xs text-green-bright hover:underline focus:outline-none rounded"
          >
            Back to Explore
          </Link>
        </div>
      </main>
    );
  }

  const Icon = getAppIcon(model.category);

  // One status indicator: deploy state for owners, runtime liveness for
  // consumers. One type indicator: Live (streaming) vs Batch (request/response).
  const statusTone =
    isOwner && pipeline
      ? pipeline.status === "deployed"
        ? "green"
        : pipeline.status === "error"
          ? "red"
          : pipeline.status === "building"
            ? "amber"
            : "blue"
      : model.status === "hot"
        ? "warm"
        : "blue";
  const statusLabel =
    isOwner && pipeline
      ? pipeline.status === "deployed"
        ? "Deployed"
        : pipeline.status === "building"
          ? "Building"
          : pipeline.status === "error"
            ? "Error"
            : "Stopped"
      : model.status === "hot"
        ? "warm"
        : "cold";
  const statusStatic =
    isOwner && pipeline
      ? pipeline.status !== "deployed"
      : model.status !== "hot";
  const isLive =
    isOwner && pipeline ? pipeline.kind === "live" : Boolean(model.realtime);

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      {/* Navigation header — full-width bar carrying the organization / app
          breadcrumb (the app's owning organization for owners, the publisher for
          consumers). */}
      <div className="flex h-[44px] shrink-0 items-center border-b border-hairline bg-dark px-5">
        <nav
          className="flex items-center gap-1.5 text-[13px]"
          aria-label="Breadcrumb"
        >
          <Link
            href={`/orgs/${organizationSlug(model.provider)}`}
            className="text-fg-muted transition-colors hover:text-fg"
          >
            {model.provider}
          </Link>
          <span className="text-fg-disabled" aria-hidden="true">
            /
          </span>
          <span className="truncate font-medium text-fg">{model.name}</span>
        </nav>
      </div>

      <div className="flex-1">
        <div className="mx-auto max-w-5xl px-7 pt-7 pb-8">
          {/* Identity row — thumbnail · name · status · type · visibility ·
              Open playground. Identical for every app detail view; dense
              metrics live in the Overview / Stats tabs. */}
          <div className="flex items-start gap-4">
            {/* Thumbnail — cover image, or a bordered icon tile fallback. */}
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-subtle bg-dark-card">
              {model.coverImage ? (
                <img
                  src={model.coverImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="grid h-full w-full place-items-center text-green-bright"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-surface-raised), var(--color-dark-card))",
                    boxShadow: "0 0 24px rgba(64,191,134,0.08)",
                  }}
                  aria-hidden="true"
                >
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
                  {model.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-strong">
                  <StatusDot tone={statusTone} static={statusStatic} />
                  {statusLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-1.5 py-0.5 text-[11px] text-fg-strong">
                  {isLive ? (
                    <Radio
                      className="h-3 w-3 text-blue-bright"
                      aria-hidden="true"
                    />
                  ) : (
                    <Box className="h-3 w-3 text-fg-faint" aria-hidden="true" />
                  )}
                  {isLive ? "Live" : "Batch"}
                </span>
                {isOwner &&
                  (visibility === "public" ? (
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1 rounded-full border border-green-bright/30 bg-green/10 px-2 py-px text-[11px] text-green-bright transition-colors hover:bg-green/15"
                      title="Listed in Explore"
                    >
                      Public
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-dark-card px-2 py-px text-[11px] text-fg-faint">
                      Private
                    </span>
                  ))}
                <button
                  type="button"
                  onClick={() => setActiveTab("playground")}
                  className="ml-auto inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-subtle bg-dark-card px-2.5 text-[12px] font-medium text-fg-strong whitespace-nowrap transition-colors hover:border-strong hover:bg-hover hover:text-fg"
                >
                  <Play className="h-3 w-3 text-green-bright" aria-hidden="true" />
                  Open playground
                </button>
              </div>
              <p className="mt-2 max-w-[680px] text-[13.5px] leading-[1.5] text-fg-muted">
                {model.description}
              </p>
            </div>
          </div>

          {/* Tabs — flush document-style underline (mdv2-tabs) */}
          <div
            className="mt-6 hidden gap-0 overflow-x-auto border-b border-hairline md:flex"
            role="tablist"
            aria-label="App section"
            style={{ scrollbarWidth: "none" }}
            onKeyDown={(e) => {
              const i = tabs.findIndex((t) => t.key === activeTab);
              if (e.key === "ArrowRight") {
                e.preventDefault();
                setActiveTab(tabs[(i + 1) % tabs.length].key);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                setActiveTab(tabs[(i - 1 + tabs.length) % tabs.length].key);
              } else if (e.key === "Home") {
                e.preventDefault();
                setActiveTab(tabs[0].key);
              } else if (e.key === "End") {
                e.preventDefault();
                setActiveTab(tabs[tabs.length - 1].key);
              }
            }}
          >
            {tabs.map((tab, i) => {
              const selected = activeTab === tab.key;
              const showCount =
                typeof tab.count === "number" && tab.count > 0;
              return (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`tabpanel-${tab.key}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] transition-colors focus:outline-none ${
                    i === 0 ? "pl-0" : ""
                  } ${
                    selected
                      ? "border-green-bright text-fg"
                      : "border-transparent text-fg-faint hover:text-fg-strong"
                  }`}
                >
                  <tab.icon
                    className={`h-3.5 w-3.5 ${
                      selected ? "text-green-bright" : "text-fg-disabled"
                    }`}
                  />
                  {tab.label}
                  {showCount && (
                    <span
                      className={`ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] px-1 font-mono text-[10.5px] tabular-nums ${
                        selected
                          ? "bg-green-bright/15 text-green-bright"
                          : "bg-tint text-fg-faint"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tabs — mobile scroll strip */}
          <DashboardSubNav
            hideAt="md"
            ariaLabel="App section"
            tabs={tabs}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as Tab)}
            className="mt-6"
          />

          {/* Tab content */}
          <div
            className="mt-6 pb-12"
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {/* Owner-only tabs reuse the operator console chrome verbatim. */}
            {activeTab === "overview" && pipeline && (
              <OverviewTab app={pipeline} />
            )}
            {activeTab === "settings" && pipeline && (
              <SettingsTab
                app={pipeline}
                visibility={visibility}
                onToggleVisibility={toggleVisibility}
              />
            )}
            {activeTab === "playground" && <PlaygroundTab model={model} />}
            {activeTab === "api" && <ApiTab model={model} />}
            {activeTab === "readme" && <ReadmeTab model={model} />}
            {activeTab === "stats" && <StatsTab model={model} />}
            {activeTab === "jobs" && (
              <JobsTab model={model} runs={filteredRuns} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
