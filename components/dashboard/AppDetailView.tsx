"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Box,
  ChevronLeft,
  FileJson,
  Globe,
  Lock,
  Play,
  Radio,
  ScrollText,
  Settings as SettingsIcon,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import TabStrip, { type TabStripItem } from "@/components/dashboard/TabStrip";
import StatusDot from "@/components/dashboard/StatusDot";
import KpiStrip from "@/components/dashboard/KpiStrip";
import KpiCard from "@/components/dashboard/KpiCard";
import CopyButton from "@/components/dashboard/CopyButton";
import {
  getPipelineById,
  effectiveVisibility,
  setPipelineVisibility,
  deploymentsForPipeline,
  getEnvironmentById,
  pipelineToExploreApp,
} from "@/lib/dashboard/mock-data";
import { formatPrice } from "@/lib/dashboard/utils";
import type {
  App,
  Pipeline,
  PipelineStatusKind,
  PipelineVisibility,
} from "@/lib/dashboard/types";

type TabKey = "overview" | "logs" | "settings";

const STATUS_META: Record<
  PipelineStatusKind,
  { label: string; tone: "green" | "amber" | "red" | "blue" }
> = {
  deployed: { label: "Deployed", tone: "green" },
  building: { label: "Building", tone: "amber" },
  stopped: { label: "Stopped", tone: "blue" },
  error: { label: "Error", tone: "red" },
};

function formatDeployed(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Not found ─────────────────────────────────────────────────────────────────

function AppNotFound() {
  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <div className="mx-auto w-full max-w-[1024px] px-7 pt-20 text-center">
        <p className="text-[15px] font-medium text-fg">App not found</p>
        <p className="mt-1.5 text-[13px] text-fg-muted">
          This pipeline doesn&apos;t exist or isn&apos;t in the current
          environment.
        </p>
        <Link
          href="/apps"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-green-bright hover:text-green-light"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Apps
        </Link>
      </div>
    </main>
  );
}

// ── Detail rows ───────────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled">
        {label}
      </span>
      <span className="min-w-0 text-[13px] text-fg-strong">{children}</span>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-fg-faint" aria-hidden="true" />
        <span className="text-[13px] font-medium text-fg">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

/**
 * OverviewTab — the app's front page, shown to anyone (consumer or owner).
 *
 * It renders from the catalog `model` (App), which exists for every app, so it
 * works for the public apps a consumer browses from Explore — not just the
 * org's own deployments. The deployment manifest (`pipeline`) is optional: when
 * present (the org's deployment-backed apps) it adds the Deployment + Schema
 * cards and the per-route endpoint list; when absent (a public catalog app) a
 * lighter Details card stands in so the tab is still useful.
 */
export function OverviewTab({
  model,
  pipeline,
}: {
  model: App;
  pipeline?: Pipeline;
}) {
  // Call endpoint — the deployed pipelineId when we have it, else the catalog
  // slug. Live apps stream over a websocket; batch apps are request/response.
  const slug = pipeline?.pipelineId ?? model.id;
  const isLive = pipeline ? pipeline.kind === "live" : Boolean(model.realtime);
  const baseUrl = isLive
    ? `wss://api.livepeer.org/live/${slug}`
    : `https://api.livepeer.org/run/${slug}`;

  // The request schema is derived from the deployment manifest, so it's only
  // available for deployment-backed apps.
  const schema = useMemo(() => {
    if (!pipeline) return null;
    if (pipeline.kind === "live") {
      return JSON.stringify(
        {
          pipeline_id: pipeline.pipelineId,
          transport: "trickle",
          channels: ["video", "events", "data"],
          params: { type: "object", additionalProperties: true },
        },
        null,
        2,
      );
    }
    return JSON.stringify(
      {
        pipeline_id: pipeline.pipelineId,
        input: { type: "object", required: ["input"] },
        output: { type: "object" },
        streaming: pipeline.name.includes("SSE"),
      },
      null,
      2,
    );
  }, [pipeline]);

  return (
    <div className="flex flex-col gap-5">
      {/* Headline stats — from the catalog model, available for every app.
          Warm-orchestrator count is a liveness/capacity signal for the caller. */}
      <KpiStrip cols={4}>
        <KpiCard label="Calls · 7d" value={model.runs7d.toLocaleString()} />
        <KpiCard
          label="p50 latency"
          value={model.latency > 0 ? String(model.latency) : "—"}
          unit={model.latency > 0 ? "ms" : undefined}
        />
        <KpiCard label="Uptime" value={model.uptime.toFixed(1)} unit="%" />
        <KpiCard
          label="Warm orchestrators"
          value={String(model.orchestrators)}
        />
      </KpiStrip>

      {pipeline ? (
        <Card title="Deployment" icon={Box}>
          <MetaRow label="Pipeline ID">
            <span className="font-mono text-[12.5px]">{pipeline.pipelineId}</span>
          </MetaRow>
          <MetaRow label="Entrypoint">
            <span className="font-mono text-[12.5px]">{pipeline.entrypoint}</span>
          </MetaRow>
          <MetaRow label="Image">
            <span className="font-mono text-[12px] text-fg-muted">
              {pipeline.image}
            </span>
          </MetaRow>
          <MetaRow label="Version">
            <span className="font-mono text-[12.5px]">{pipeline.version}</span>
          </MetaRow>
          <MetaRow label="GPU">
            {pipeline.gpu ? (
              <span className="font-mono text-[12.5px]">{pipeline.gpu}</span>
            ) : (
              <span className="text-fg-faint">CPU</span>
            )}
          </MetaRow>
          <MetaRow label="Last deployed">
            {formatDeployed(pipeline.lastDeployedAt)}
          </MetaRow>
          <MetaRow label="Deployed by">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="grid h-4 w-4 place-items-center rounded text-[8.5px] font-semibold text-white"
                style={{ background: pipeline.createdBy.color }}
                aria-hidden="true"
              >
                {pipeline.createdBy.initials}
              </span>
              {pipeline.createdBy.name}
            </span>
          </MetaRow>
          <MetaRow label="Environments">
            <span className="flex flex-wrap items-center gap-1.5">
              {deploymentsForPipeline(pipeline.pipelineId).map((d) => {
                const env = getEnvironmentById(d.environmentId);
                const dotColor =
                  env?.kind === "production"
                    ? "var(--color-green-bright)"
                    : "var(--color-blue-bright)";
                return (
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[11.5px] text-fg-strong"
                  >
                    <span
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: dotColor }}
                      aria-hidden="true"
                    />
                    {env?.name ?? d.environmentId}
                  </span>
                );
              })}
            </span>
          </MetaRow>
        </Card>
      ) : (
        <Card title="Details" icon={ScrollText}>
          <MetaRow label="Provider">{model.provider}</MetaRow>
          <MetaRow label="Category">
            <span className="font-mono text-[12.5px]">{model.category}</span>
          </MetaRow>
          <MetaRow label="Type">
            {isLive ? "Live · streaming" : "Batch · request/response"}
          </MetaRow>
          <MetaRow label="Pricing">
            <span className="font-mono text-[12.5px]">{formatPrice(model)}</span>
          </MetaRow>
        </Card>
      )}

      <Card title="Endpoint" icon={Globe}>
        <div className="border-b border-hairline px-4 py-3 last:border-b-0">
          <div className="flex items-center gap-2 rounded-[6px] border border-subtle bg-dark px-3 py-2">
            <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12.5px] text-fg">
              {baseUrl}
            </span>
            <CopyButton value={baseUrl} iconOnly />
          </div>
        </div>
        {pipeline && (
          <div className="px-1 py-1">
            {pipeline.endpoints.map((e) => (
              <div
                key={`${e.method} ${e.path}`}
                className="flex items-center gap-3 rounded-[4px] px-3 py-2"
              >
                <span className="w-12 shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-green-bright">
                  {e.method}
                </span>
                <span className="font-mono text-[12.5px] text-fg-strong">
                  {e.path}
                </span>
                {e.description && (
                  <span className="ml-auto truncate text-[11.5px] text-fg-faint">
                    {e.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {schema && (
        <Card title="Schema" icon={FileJson}>
          <div className="px-4 py-3">
            <pre className="overflow-x-auto rounded-[6px] border border-subtle bg-dark px-3 py-2.5 font-mono text-[12px] leading-[1.6] text-fg-muted">
              {schema}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Logs ──────────────────────────────────────────────────────────────────────

type LogLine = { t: string; level: "info" | "warn" | "error"; msg: string };

function buildLogs(app: Pipeline): LogLine[] {
  if (app.status === "building") {
    return [
      { t: "08:55:02", level: "info", msg: `Building image for ${app.pipelineId}…` },
      { t: "08:55:04", level: "info", msg: "Resolving python packages" },
      { t: "08:55:39", level: "info", msg: "Running prepare step (caching weights)" },
      { t: "08:56:10", level: "info", msg: "Pushing layers to registry" },
      { t: "08:56:22", level: "warn", msg: "Image is large (4.2 GB) — first cold start may be slow" },
    ];
  }
  if (app.status === "error") {
    return [
      { t: "22:01:00", level: "info", msg: "Session started — events channel open" },
      { t: "22:01:00", level: "info", msg: `setup() complete · model=whisper-tiny.en` },
      { t: "22:01:08", level: "info", msg: "emit_data: transcript segment 1" },
      { t: "22:01:09", level: "error", msg: "data SSE proxy torn down before final emit_data (go-livepeer#3922)" },
      { t: "22:01:09", level: "error", msg: "5 records emitted → 3 delivered" },
    ];
  }
  if (app.kind === "live") {
    return [
      { t: "17:30:00", level: "info", msg: "Session started — allocating video track" },
      { t: "17:30:00", level: "info", msg: "heartbeat task started" },
      { t: "17:30:01", level: "info", msg: "process_video: 24.0 fps in / 23.8 fps out" },
      { t: "17:30:11", level: "info", msg: "heartbeat" },
      { t: "17:30:21", level: "info", msg: "process_video: 24.0 fps in / 23.9 fps out" },
    ];
  }
  return [
    { t: "14:09:00", level: "info", msg: `POST /predict · 200 · ${app.p50LatencyMs}ms` },
    { t: "14:09:01", level: "info", msg: "POST /predict · 200 · 71ms" },
    { t: "14:09:02", level: "info", msg: "POST /predict · 200 · 59ms" },
    { t: "14:09:03", level: "warn", msg: "POST /predict · 200 · 184ms (slow — orchestrator cold)" },
    { t: "14:09:04", level: "info", msg: "POST /predict · 200 · 63ms" },
  ];
}

export function LogsTab({ app }: { app: Pipeline }) {
  const logs = buildLogs(app);
  const levelColor: Record<LogLine["level"], string> = {
    info: "text-fg-faint",
    warn: "text-warm",
    error: "text-red-400",
  };
  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-fg">
          <ScrollText className="h-3.5 w-3.5 text-fg-faint" aria-hidden="true" />
          Logs
        </span>
        {app.status === "deployed" && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-faint">
            <StatusDot tone="green" />
            live
          </span>
        )}
      </div>
      <div className="bg-dark px-4 py-3 font-mono text-[12px] leading-[1.8]">
        {logs.map((l, i) => (
          <div key={i} className="flex gap-3 whitespace-pre-wrap">
            <span className="shrink-0 text-fg-disabled tabular-nums">{l.t}</span>
            <span className={`shrink-0 w-10 uppercase ${levelColor[l.level]}`}>
              {l.level}
            </span>
            <span className="text-fg-muted">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings (incl. publish) ──────────────────────────────────────────────────

export function SettingsTab({
  app,
  visibility,
  onToggleVisibility,
}: {
  app: Pipeline;
  visibility: PipelineVisibility;
  onToggleVisibility: () => void;
}) {
  const isPublic = visibility === "public";
  return (
    <div className="flex flex-col gap-5">
      {/* Publish / visibility */}
      <Card title="Visibility" icon={isPublic ? Globe : Lock}>
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-fg">
              {isPublic ? "Public — listed in Explore" : "Private"}
            </p>
            <p className="mt-1 max-w-[460px] text-[12.5px] leading-[1.5] text-fg-muted">
              {isPublic ? (
                <>
                  Anyone can discover and call this pipeline. It appears as a
                  card in{" "}
                  <Link
                    href="/"
                    className="text-green-bright underline decoration-green-bright/40 underline-offset-2 hover:text-green-light"
                  >
                    Explore
                  </Link>
                  . Unpublish to remove it.
                </>
              ) : (
                "Only this organization's keys can call this pipeline. Publish to list it in Explore for public consumption."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleVisibility}
            className={
              isPublic
                ? "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[6px] border border-hairline bg-dark-card px-3 text-[12.5px] font-medium text-fg-strong transition-colors hover:border-subtle hover:text-fg"
                : "btn-primary inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[6px] px-3 text-[12.5px] font-medium transition-colors"
            }
          >
            {isPublic ? (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Make private
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                Publish to Explore
              </>
            )}
          </button>
        </div>
      </Card>

      {/* Environment variables (mock) */}
      <Card title="Environment variables" icon={SettingsIcon}>
        <MetaRow label="MODEL_REVISION">
          <span className="font-mono text-[12.5px]">main</span>
        </MetaRow>
        <MetaRow label="HF_TOKEN">
          <span className="font-mono text-[12.5px] text-fg-faint">
            ••••••••••••
          </span>
        </MetaRow>
        <MetaRow label="LOG_LEVEL">
          <span className="font-mono text-[12.5px]">info</span>
        </MetaRow>
      </Card>

      {/* Danger zone */}
      <div className="overflow-hidden rounded-md border border-red-400/25 bg-red-400/[0.04]">
        <div className="border-b border-red-400/15 px-4 py-2.5">
          <span className="text-[13px] font-medium text-red-400">
            Danger zone
          </span>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-fg-muted">
            Stopping halts the deployment; deleting removes{" "}
            <span className="font-mono text-[11.5px] text-fg-strong">
              {app.pipelineId}
            </span>{" "}
            from this environment.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="inline-flex h-[30px] items-center gap-1.5 rounded-[6px] border border-hairline bg-dark-card px-3 text-[12.5px] text-fg-strong transition-colors hover:border-subtle hover:text-fg"
            >
              <Square className="h-3 w-3" aria-hidden="true" />
              Stop
            </button>
            <button
              type="button"
              className="inline-flex h-[30px] items-center gap-1.5 rounded-[6px] border border-red-400/30 px-3 text-[12.5px] text-red-400 transition-colors hover:bg-red-400/10"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
// The clean operator header — status · type · visibility badges, "Deployed in"
// env pills, and an Open-playground action. Rendered on the unified app page for
// the owner (a consumer sees the catalog-style header instead). Renders just the
// content; the caller supplies the page container.
export function AppDetailHeader({
  app,
  visibility,
  onOpenPlayground,
  coverImage,
  Icon = Box,
}: {
  app: Pipeline;
  visibility: PipelineVisibility;
  onOpenPlayground: () => void;
  coverImage?: string;
  Icon?: React.ElementType;
}) {
  const status = STATUS_META[app.status];
  const deployments = deploymentsForPipeline(app.pipelineId);
  return (
    <>
      {/* Breadcrumb */}
      <Link
        href="/apps"
        className="inline-flex items-center gap-1.5 text-[12px] text-fg-faint transition-colors hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Apps
      </Link>

      <div className="mt-3 flex items-start gap-4">
        {/* Thumbnail — cover image, or a bordered icon tile fallback. */}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-subtle bg-dark-card">
          {coverImage ? (
            <img
              src={coverImage}
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
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
          {app.name}
        </h1>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-strong">
          <StatusDot tone={status.tone} static={app.status !== "deployed"} />
          {status.label}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-1.5 py-0.5 text-[11px] text-fg-strong"
          title={
            app.kind === "live"
              ? "LivePipeline · trickle transport"
              : "Pipeline · request/response"
          }
        >
          {app.kind === "live" ? (
            <Radio className="h-3 w-3 text-blue-bright" aria-hidden="true" />
          ) : (
            <Box className="h-3 w-3 text-fg-faint" aria-hidden="true" />
          )}
          {app.kind === "live" ? "Live" : "Batch"}
        </span>
        {visibility === "public" && (
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-green-bright/30 bg-green/10 px-2 py-px text-[11px] text-green-bright transition-colors hover:bg-green/15"
            title="Listed in Explore"
          >
            Public
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}

        <button
          type="button"
          onClick={onOpenPlayground}
          className="ml-auto inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-subtle bg-dark-card px-2.5 text-[12px] font-medium text-fg-strong transition-colors hover:border-strong hover:bg-hover hover:text-fg"
          title="Open the playground for this app"
        >
          <Play className="h-3 w-3 text-green-bright" aria-hidden="true" />
          Open playground
        </button>
      </div>
      <p className="mt-2 max-w-[680px] text-[13.5px] leading-[1.5] text-fg-muted">
        {app.description}
      </p>

      {/* Deployed in — the environments this app is deployed to. */}
      {deployments.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled">
            Deployed in
          </span>
          {deployments.map((d) => {
            const env = getEnvironmentById(d.environmentId);
            const active = d.id === app.id;
            const dotColor =
              env?.kind === "production"
                ? "var(--color-green-bright)"
                : "var(--color-blue-bright)";
            return (
              <Link
                key={d.id}
                href={`/apps/${d.id}`}
                aria-current={active ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors ${
                  active
                    ? "border-subtle bg-dark-card text-fg-strong"
                    : "border-hairline text-fg-faint hover:border-subtle hover:text-fg-strong"
                }`}
              >
                <span
                  className="h-[5px] w-[5px] rounded-full"
                  style={{ background: dotColor }}
                  aria-hidden="true"
                />
                {env?.name ?? d.environmentId}
              </Link>
            );
          })}
        </div>
      )}
        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AppDetailView({ appId }: { appId: string }) {
  const app = getPipelineById(appId);
  const [tab, setTab] = useState<TabKey>("overview");
  const [visibility, setVisibility] = useState<PipelineVisibility>(
    app?.visibility ?? "private",
  );

  // Hydrate visibility from the persisted override after mount (avoids SSR
  // mismatch). The deployment's environment is shown inline via the "Deployed
  // in" pills, so there's no global environment state to sync.
  useEffect(() => {
    if (!app) return;
    setVisibility(effectiveVisibility(app));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  if (!app) return <AppNotFound />;

  const status = STATUS_META[app.status];

  // Environments this pipeline is deployed to, for the "Deployed in" pills.
  const deployments = deploymentsForPipeline(app.pipelineId);

  const toggleVisibility = () => {
    const next: PipelineVisibility =
      visibility === "public" ? "private" : "public";
    setPipelineVisibility(app.id, next);
    setVisibility(next);
  };

  const tabs: TabStripItem<TabKey>[] = [
    { key: "overview", label: "Overview", icon: Box },
    { key: "logs", label: "Logs", icon: Terminal },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <div className="mx-auto w-full max-w-[1024px] px-7 pt-7">
        {/* Breadcrumb */}
        <Link
          href="/apps"
          className="inline-flex items-center gap-1.5 text-[12px] text-fg-faint transition-colors hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Apps
        </Link>

        {/* Title row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
            {app.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-strong">
            <StatusDot tone={status.tone} static={app.status !== "deployed"} />
            {status.label}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-1.5 py-0.5 text-[11px] text-fg-strong"
            title={
              app.kind === "live"
                ? "LivePipeline · trickle transport"
                : "Pipeline · request/response"
            }
          >
            {app.kind === "live" ? (
              <Radio className="h-3 w-3 text-blue-bright" aria-hidden="true" />
            ) : (
              <Box className="h-3 w-3 text-fg-faint" aria-hidden="true" />
            )}
            {app.kind === "live" ? "Live" : "Batch"}
          </span>
          {visibility === "public" && (
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full border border-green-bright/30 bg-green/10 px-2 py-px text-[11px] text-green-bright transition-colors hover:bg-green/15"
              title="Listed in Explore"
            >
              Public
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}

          {/* Reverse of "Manage app" — jump to the consumer/playground face of
              this same pipeline. */}
          <Link
            href={`/apps/${app.id}`}
            className="ml-auto inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-subtle bg-dark-card px-2.5 text-[12px] font-medium text-fg-strong transition-colors hover:border-strong hover:bg-hover hover:text-fg"
            title="Open the consumer playground for this pipeline"
          >
            <Play className="h-3 w-3 text-green-bright" aria-hidden="true" />
            Open playground
          </Link>
        </div>
        <p className="mt-2 max-w-[680px] text-[13.5px] leading-[1.5] text-fg-muted">
          {app.description}
        </p>

        {/* Deployed in — the environments this pipeline is deployed to. The
            same pipelineId can have a deployment per environment; selecting one
            navigates to that deployment (and syncs the env switcher). */}
        {deployments.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled">
              Deployed in
            </span>
            {deployments.map((d) => {
              const env = getEnvironmentById(d.environmentId);
              const active = d.id === app.id;
              const dotColor =
                env?.kind === "production"
                  ? "var(--color-green-bright)"
                  : "var(--color-blue-bright)";
              return (
                <Link
                  key={d.id}
                  href={`/apps/${d.id}`}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors ${
                    active
                      ? "border-subtle bg-dark-card text-fg-strong"
                      : "border-hairline text-fg-faint hover:border-subtle hover:text-fg-strong"
                  }`}
                >
                  <span
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ background: dotColor }}
                    aria-hidden="true"
                  />
                  {env?.name ?? d.environmentId}
                </Link>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-5 border-b border-hairline">
          <TabStrip
            tabs={tabs}
            active={tab}
            onChange={setTab}
            layoutId="app-detail-tabs"
            ariaLabel="App detail sections"
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto w-full max-w-[1024px] px-7 pb-20 pt-6">
        {tab === "overview" && (
          <OverviewTab model={pipelineToExploreApp(app)} pipeline={app} />
        )}
        {tab === "logs" && <LogsTab app={app} />}
        {tab === "settings" && (
          <SettingsTab
            app={app}
            visibility={visibility}
            onToggleVisibility={toggleVisibility}
          />
        )}
      </div>
    </main>
  );
}
