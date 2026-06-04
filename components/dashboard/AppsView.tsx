"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Radio,
  ScrollText,
  Terminal,
} from "lucide-react";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import TabStrip from "@/components/dashboard/TabStrip";
import StatusDot from "@/components/dashboard/StatusDot";
import LogsView from "@/components/dashboard/LogsView";
import EnvTag from "@/components/dashboard/EnvTag";
import EnvironmentFilter, {
  ALL_ENVIRONMENTS,
} from "@/components/dashboard/EnvironmentFilter";
import {
  effectiveVisibility,
  pipelinesForEnvironment,
  getEnvironmentById,
  PIPELINES,
} from "@/lib/dashboard/mock-data";
import type {
  Pipeline,
  PipelineStatusKind,
  PipelineVisibility,
} from "@/lib/dashboard/types";

// ── Status + type presentation ───────────────────────────────────────────────

const STATUS_META: Record<
  PipelineStatusKind,
  { label: string; tone: "green" | "amber" | "red" | "blue" }
> = {
  deployed: { label: "Deployed", tone: "green" },
  building: { label: "Building", tone: "amber" },
  stopped: { label: "Stopped", tone: "blue" },
  error: { label: "Error", tone: "red" },
};

function StatusCell({ status }: { status: PipelineStatusKind }) {
  const s = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-strong">
      <StatusDot tone={s.tone} static={status !== "deployed"} />
      {s.label}
    </span>
  );
}

function TypeBadge({ kind }: { kind: Pipeline["kind"] }) {
  const live = kind === "live";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-1.5 py-0.5 text-[11px] text-fg-strong"
      title={live ? "LivePipeline · trickle transport" : "Pipeline · request/response"}
    >
      {live ? (
        <Radio className="h-3 w-3 text-blue-bright" aria-hidden="true" />
      ) : (
        <Box className="h-3 w-3 text-fg-faint" aria-hidden="true" />
      )}
      {live ? "Live" : "Batch"}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: PipelineVisibility }) {
  const isPublic = visibility === "public";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[11px]"
      style={{
        background: isPublic
          ? "color-mix(in oklab, var(--color-green-bright) 12%, transparent)"
          : "transparent",
        borderColor: isPublic
          ? "color-mix(in oklab, var(--color-green-bright) 28%, transparent)"
          : "var(--color-border-hairline)",
        color: isPublic ? "var(--color-green-bright)" : "var(--color-fg-faint)",
      }}
      title={
        isPublic
          ? "Listed in Explore — anyone can discover and call it"
          : "Private — runs only for this organization's keys"
      }
    >
      {isPublic ? "Public" : "Private"}
    </span>
  );
}

// ── Deploy command ────────────────────────────────────────────────────────────
// Deploying happens through the CLI, not the dashboard, so we surface the real
// `livepeer push` command rather than a button that pretends to deploy. The
// `--env` flag follows the page's environment filter so the copied command
// targets whatever you're looking at (defaulting to production).

function DeployCommand({ envSlug }: { envSlug: string }) {
  const [copied, setCopied] = useState(false);
  const command = `livepeer push --env ${envSlug}`;

  const copy = () => {
    navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-[6px] border border-subtle bg-dark px-3 py-2.5">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] leading-[1.7] text-fg">
        <span className="text-fg-disabled">$ </span>livepeer push{" "}
        <span className="text-fg-faint">--env {envSlug}</span>
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy command"}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-faint transition-colors hover:bg-hover hover:text-fg"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-bright" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

// Compact, always-present command strip for the populated list. Not dismissible
// — it's a reference you copy repeatedly, not a one-time tip.
function DeployStrip({ envSlug }: { envSlug: string }) {
  return (
    <div className="mb-5 flex flex-col gap-2.5 rounded-md border border-hairline bg-dark-lighter px-4 py-3 shadow-card sm:flex-row sm:items-center">
      <span className="inline-flex shrink-0 items-center gap-2 text-[12.5px] text-fg-muted">
        <Terminal className="h-3.5 w-3.5 text-fg-faint" aria-hidden="true" />
        Deploy a pipeline
      </span>
      <div className="min-w-0 flex-1">
        <DeployCommand envSlug={envSlug} />
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

const GRID =
  "grid grid-cols-[2.2fr_0.8fr_1fr_0.9fr_0.9fr_1fr_16px] items-center gap-3";

export default function AppsView() {
  const router = useRouter();
  const [tab, setTab] = useState<"apps" | "logs">("apps");

  // Make the tab addressable: /apps?tab=logs deep-links the Logs view.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "logs" || t === "apps") setTab(t);
  }, []);
  const changeTab = (key: "apps" | "logs") => {
    setTab(key);
    router.replace(key === "logs" ? "/apps?tab=logs" : "/apps", {
      scroll: false,
    });
  };
  const [envFilter, setEnvFilter] = useState(ALL_ENVIRONMENTS);

  const allEnvs = envFilter === ALL_ENVIRONMENTS;
  const apps = allEnvs ? PIPELINES : pipelinesForEnvironment(envFilter);
  const scopeLabel = allEnvs
    ? "all environments"
    : (getEnvironmentById(envFilter)?.name ?? "all environments");
  // The `--env` flag the deploy command suggests. Follows the filter; defaults
  // to production when viewing all environments.
  const deployEnvSlug = allEnvs
    ? "production"
    : (getEnvironmentById(envFilter)?.kind ?? "production");

  return (
    <>
      <DashboardPageHeader
        title="Apps"
        icon={Box}
        actions={
          <>
            <EnvironmentFilter value={envFilter} onChange={setEnvFilter} />
            <a
              href="https://docs.livepeer.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              Docs
            </a>
          </>
        }
      />

      {/* Apps (your deployments) + Logs (their aggregated runtime output) — both
          operator views of the same apps, so they live together here rather than
          as separate top-level nav items. */}
      <div className="border-b border-hairline px-5">
        <TabStrip
          tabs={[
            { key: "apps", label: "Apps", icon: Box },
            { key: "logs", label: "Logs", icon: ScrollText },
          ]}
          active={tab}
          onChange={changeTab}
          layoutId="apps-tabs"
          ariaLabel="Apps sections"
        />
      </div>

      {tab === "logs" ? (
        <LogsView />
      ) : (
        <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
          <p className="mb-6 max-w-[640px] text-[13.5px] leading-[1.55] text-fg-muted">
            Your apps — pipelines deployed with the Livepeer CLI — in{" "}
            <span className="font-medium text-fg-strong">{scopeLabel}</span>.
            Public apps are listed in Explore; private ones run only for this
            organization&apos;s keys.
          </p>

          {/* Apps table — or, when empty, the deploy explainer */}
          {apps.length === 0 ? (
          <div className="rounded-md border border-hairline bg-dark-lighter px-6 py-14 text-center shadow-card">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-md border border-hairline bg-dark-card text-fg-muted">
              <Terminal className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-fg">
              No apps in {scopeLabel} yet
            </p>
            <p className="mx-auto mt-1.5 mb-5 max-w-[460px] text-[12.5px] leading-[1.55] text-fg-muted">
              Describe your pipeline in a{" "}
              <span className="font-mono text-[11.5px] text-fg-strong">
                livepeer.yaml
              </span>{" "}
              manifest, then push it. The CLI builds the image, embeds the
              schema, and registers the capability on the network.
            </p>
            <div className="mx-auto max-w-[440px] text-left">
              <DeployCommand envSlug={deployEnvSlug} />
            </div>
          </div>
        ) : (
          <>
            <DeployStrip envSlug={deployEnvSlug} />
            <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
            <div
              className={`${GRID} border-b border-hairline bg-dark px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled`}
            >
              <div>App</div>
              <div>Type</div>
              <div>Status</div>
              <div>Visibility</div>
              <div className="text-right">Calls · 7d</div>
              <div className="text-right">p50</div>
              <div />
            </div>
            {apps.map((app) => {
              const visibility = effectiveVisibility(app);
              return (
                <Link
                  key={app.id}
                  href={`/apps/${app.id}?tab=overview`}
                  className={`${GRID} border-b border-hairline px-4 py-3.5 last:border-b-0 transition-colors hover:bg-zebra`}
                >
                  {/* App name + pipeline id */}
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-fg">
                        {app.name}
                      </span>
                      {allEnvs && <EnvTag environmentId={app.environmentId} />}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11.5px] text-fg-faint">
                      {app.pipelineId}
                    </div>
                  </div>
                  <div>
                    <TypeBadge kind={app.kind} />
                  </div>
                  <div>
                    <StatusCell status={app.status} />
                  </div>
                  <div>
                    <VisibilityBadge visibility={visibility} />
                  </div>
                  <div className="text-right font-mono text-[13px] tabular-nums text-fg-strong">
                    {app.calls7d.toLocaleString()}
                  </div>
                  <div className="text-right font-mono text-[13px] tabular-nums text-fg-strong">
                    {app.p50LatencyMs > 0 ? `${app.p50LatencyMs}ms` : "—"}
                  </div>
                  <div className="flex justify-end text-fg-disabled">
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
            </div>
          </>
        )}

          {apps.length > 0 && (
            <p className="mt-3 px-1 text-[11.5px] text-fg-disabled">
              Showing {apps.length} {apps.length === 1 ? "app" : "apps"} in{" "}
              {scopeLabel}.
            </p>
          )}
        </div>
      )}
    </>
  );
}
