"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Edit2,
  Key as KeyIcon,
  Lock,
  MoreVertical,
  Plus,
  RotateCw,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import EnvTag from "@/components/console/EnvTag";
import EnvironmentFilter, {
  ALL_ENVIRONMENTS,
} from "@/components/console/EnvironmentFilter";
import { getEnvironmentById } from "@/lib/console/mock-data";

// ── Types ───────────────────────────────────────────────────────────────────

type Scope = "restricted" | "admin";

interface KeyRow {
  id: string;
  /** Environment this key belongs to. Keys are scoped per environment. */
  environmentId: string;
  name: string;
  prefix: string;
  suffix: string;
  scope: Scope;
  lastUsed: string;
  lastUsedHost: string;
  lastUsedIp: string;
  runs7d: number;
  created: string;
  createdBy: { name: string; initials: string; color: string };
  daysSinceRotation: number;
}

const SCOPES: Record<
  Scope,
  { label: string; desc: string; scopes: string; color: string }
> = {
  restricted: {
    label: "Restricted",
    desc: "Run apps, read activity and usage",
    scopes: "/v1/inference, /v1/runs, /v1/usage",
    color: "#25ABD0",
  },
  admin: {
    label: "Admin",
    desc: "Everything Restricted can do, plus manage keys, billing, and members",
    scopes: "/v1/*",
    color: "#f59e0b",
  },
};

const ROTATE_DAYS_THRESHOLD = 90;

// Mock data — mirrors the design's seed; keep it close so visual review tracks.
const KEYS: KeyRow[] = [
  {
    id: "k_01",
    environmentId: "env-production",
    name: "Production · web",
    prefix: "lp_live_x8k2",
    suffix: "m9p3",
    scope: "restricted",
    lastUsed: "12s ago",
    lastUsedHost: "us-west-2 · AWS",
    lastUsedIp: "54.218.31.4",
    runs7d: 14_820,
    created: "Mar 14, 2025",
    createdBy: { name: "Zain", initials: "ZM", color: "var(--color-green)" },
    daysSinceRotation: 49,
  },
  {
    id: "k_02",
    environmentId: "env-production",
    name: "iOS app · TestFlight",
    prefix: "lp_live_q4n7",
    suffix: "b1y8",
    scope: "restricted",
    lastUsed: "3m ago",
    lastUsedHost: "iOS device",
    lastUsedIp: "17.110.40.221",
    runs7d: 2_418,
    created: "Mar 30, 2025",
    createdBy: { name: "Zain", initials: "ZM", color: "var(--color-green)" },
    daysSinceRotation: 33,
  },
  {
    id: "k_03",
    environmentId: "env-development",
    name: "CI · GitHub Actions",
    prefix: "lp_test_a3f1",
    suffix: "d7c2",
    scope: "admin",
    lastUsed: "4 days ago",
    lastUsedHost: "GitHub Actions",
    lastUsedIp: "140.82.115.10",
    runs7d: 136,
    created: "Feb 02, 2025",
    createdBy: { name: "Maya", initials: "MK", color: "#7c3aed" },
    daysSinceRotation: 91,
  },
  {
    id: "k_04",
    environmentId: "env-development",
    name: "Local dev · laptop",
    prefix: "lp_test_k2v9",
    suffix: "p4r1",
    scope: "restricted",
    lastUsed: "1h ago",
    lastUsedHost: "localhost",
    lastUsedIp: "127.0.0.1",
    runs7d: 482,
    created: "Apr 18, 2025",
    createdBy: { name: "Maya", initials: "MK", color: "#7c3aed" },
    daysSinceRotation: 11,
  },
];

// ── Sub-components ──────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: Scope }) {
  const s = SCOPES[scope];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[11.5px] text-fg-strong"
      style={{
        background: `color-mix(in oklab, ${s.color} 12%, transparent)`,
        borderColor: `color-mix(in oklab, ${s.color} 28%, transparent)`,
      }}
    >
      <span
        className="h-[5px] w-[5px] rounded-full"
        style={{ background: s.color }}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copy"
      className={`flex w-full items-center gap-2.5 rounded-[4px] border bg-dark px-3 py-2.5 text-left transition-colors ${
        copied
          ? "border-green-bright bg-green/15"
          : "border-subtle hover:border-green hover:bg-dark-card"
      }`}
    >
      <span
        className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-fg select-all"
        style={{ scrollbarWidth: "none" }}
      >
        {value}
      </span>
      <span
        className={`grid h-[22px] w-[22px] place-items-center rounded ${
          copied ? "text-green-bright" : "text-fg-faint"
        }`}
        aria-hidden="true"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export default function KeysView() {
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scopesOpen, setScopesOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [envFilter, setEnvFilter] = useState(ALL_ENVIRONMENTS);

  // Each key belongs to one environment; show all by default, narrow on demand.
  const allEnvs = envFilter === ALL_ENVIRONMENTS;
  const keys = allEnvs
    ? KEYS
    : KEYS.filter((k) => k.environmentId === envFilter);
  const scopeLabel = allEnvs
    ? "all environments"
    : (getEnvironmentById(envFilter)?.name ?? "all environments");

  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const onCreate = () => {
    // Generate a mock full key. Stable while the banner is open.
    const random = () => Math.random().toString(36).slice(2, 10);
    setRevealedKey(`lp_live_${random()}${random()}a9k2m9p3`);
  };

  const staleKeys = keys.filter(
    (k) => k.daysSinceRotation >= ROTATE_DAYS_THRESHOLD,
  );
  const showAlert = staleKeys.length > 0 && !alertDismissed;

  return (
    <>
      <ConsolePageHeader
        title="API keys"
        icon={KeyIcon}
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
            <button
              type="button"
              onClick={onCreate}
              className="btn-primary inline-flex h-[26px] items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] font-medium transition-colors"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Create key
            </button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
        {/* Title — scope (Production) is shown by the header chip; the
            organization lives in the sidebar switcher, so no redundant crumb. */}
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
            API keys
          </h1>
          <p className="mt-2.5 max-w-[640px] text-[13.5px] leading-[1.55] text-fg-muted">
            Authenticate inference calls against{" "}
            <span className="font-mono text-[12.5px] text-fg-strong">
              api.livepeer.org
            </span>
            . Pass your key as a Bearer token in the Authorization header. Each
            key is scoped to one environment — showing{" "}
            <span className="font-medium text-fg-strong">{scopeLabel}</span>.
          </p>
        </div>

        {/* Reveal banner — shown once after creation */}
        {revealedKey && (
          <div className="relative mb-4 flex overflow-hidden rounded-md border border-green bg-gradient-to-b from-green/[0.08] to-green/[0.02]">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(700px 100px at 8% 0%, rgba(64,191,134,0.12), transparent 60%)",
              }}
              aria-hidden="true"
            />
            <div className="relative py-5 pl-5">
              <div
                className="grid h-9 w-9 place-items-center rounded bg-green text-white"
                style={{ boxShadow: "0 0 0 4px rgba(64,191,134,0.15)" }}
                aria-hidden="true"
              >
                <KeyIcon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="relative min-w-0 flex-1 px-5 py-[18px] pl-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-green-bright">
                    New key created · copy it now
                  </p>
                  <p className="mt-1 text-[14px] font-medium text-fg">
                    This is the only time you&apos;ll see the full key.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealedKey(null)}
                  aria-label="Dismiss"
                  className="grid h-6 w-6 place-items-center rounded text-fg-faint transition-colors hover:bg-hover hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <CopyField value={revealedKey} />
              <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-fg-faint">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Store it in a secrets manager — never commit it to source.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Rotation alert — only when there are stale keys */}
        {showAlert && (
          <div
            className="mb-4 flex items-start gap-3 rounded-md border px-3.5 py-3"
            style={{
              background: "rgba(251,191,36,0.06)",
              borderColor: "rgba(251,191,36,0.25)",
            }}
          >
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center text-warm">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-fg">
                {staleKeys.length === 1
                  ? "1 key hasn't been rotated in over 90 days."
                  : `${staleKeys.length} keys haven't been rotated in over 90 days.`}
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.5] text-fg-muted">
                {staleKeys.map((k) => k.name).join(" · ")} · rotate keys
                regularly to limit blast radius if leaked.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlertDismissed(true)}
              aria-label="Dismiss"
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-faint transition-colors hover:bg-hover hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Keys table */}
        <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
          <div className="grid grid-cols-[2.4fr_1.1fr_1.1fr_1.1fr_1.2fr_36px] items-center gap-3 border-b border-hairline bg-dark px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled">
            <div>Key</div>
            <div>Scope</div>
            <div className="text-right">Last used</div>
            <div className="text-right">Calls · 7d</div>
            <div>Created</div>
            <div />
          </div>
          {keys.length === 0 && (
            <div className="px-4 py-12 text-center text-[13px] text-fg-faint">
              No keys in{" "}
              <span className="text-fg-strong">{scopeLabel}</span> yet. Create
              one to start making calls.
            </div>
          )}
          {keys.map((k) => {
            const stale = k.daysSinceRotation >= ROTATE_DAYS_THRESHOLD;
            const isOpen = openMenu === k.id;
            return (
              <div
                key={k.id}
                className="relative grid grid-cols-[2.4fr_1.1fr_1.1fr_1.1fr_1.2fr_36px] items-center gap-3 border-b border-hairline px-4 py-3.5 last:border-b-0 hover:bg-zebra"
              >
                {/* Key (name + masked token) */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
                    <span className="truncate">{k.name}</span>
                    {allEnvs && <EnvTag environmentId={k.environmentId} />}
                    {stale && (
                      <span
                        // `tone-amber` is theme-aware: amber-300 in dark,
                        // amber-700 in light. Same hue, contrast-tuned per
                        // theme. See globals.css `--token-tone-amber-*`.
                        className="tone-amber ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[10.5px] font-medium align-[2px]"
                        title={`Last rotated ${k.daysSinceRotation} days ago`}
                      >
                        <AlertTriangle className="h-[9px] w-[9px]" aria-hidden="true" />
                        {k.daysSinceRotation}d
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-[11.5px] text-fg-faint">
                    {k.prefix}
                    <span className="px-0.5 text-fg-disabled">…</span>
                    {k.suffix}
                  </div>
                </div>

                {/* Scope */}
                <div>
                  <ScopeBadge scope={k.scope} />
                </div>

                {/* Last used */}
                <div className="text-right">
                  <div className="text-[12.5px] tabular-nums text-fg-strong">
                    {k.lastUsed}
                  </div>
                  <div
                    className="mt-0.5 text-[10.5px] text-fg-disabled"
                    title={k.lastUsedIp}
                  >
                    {k.lastUsedHost}
                  </div>
                </div>

                {/* Calls · 7d */}
                <div className="text-right">
                  <a
                    href={`/calls?key=${k.id}`}
                    className="font-mono text-[13px] text-fg underline decoration-transparent decoration-1 underline-offset-[3px] transition-colors hover:text-green-bright hover:decoration-current"
                  >
                    {k.runs7d.toLocaleString()}
                  </a>
                </div>

                {/* Created */}
                <div>
                  <div className="text-[12.5px] text-fg-strong">{k.created}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-faint">
                    <span
                      // `text-white` constant — these monogram tiles sit on
                      // a saturated brand fill (green / purple / etc.) and
                      // need white initials in BOTH themes; `text-fg` would
                      // render near-black on the colored bg in light mode.
                      className="grid h-4 w-4 place-items-center rounded text-[8.5px] font-semibold tracking-[0.02em] text-white"
                      style={{ background: k.createdBy.color }}
                      aria-hidden="true"
                    >
                      {k.createdBy.initials}
                    </span>
                    {k.createdBy.name}
                  </div>
                </div>

                {/* Row actions */}
                <div className="relative flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(isOpen ? null : k.id);
                    }}
                    aria-label="More actions"
                    title="More"
                    className="grid h-[26px] w-7 place-items-center rounded text-fg-faint transition-colors hover:bg-hover hover:text-fg"
                  >
                    <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div
                      ref={menuRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full z-30 mt-1 min-w-[168px] rounded-md border border-subtle bg-dark p-1 shadow-popover"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenMenu(null)}
                        className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-left text-[12.5px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
                      >
                        <Edit2 className="h-3 w-3 text-fg-faint" />
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenMenu(null)}
                        className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-left text-[12.5px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
                      >
                        <SettingsIcon className="h-3 w-3 text-fg-faint" />
                        Edit scope
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenMenu(null)}
                        className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-left text-[12.5px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
                      >
                        <RotateCw className="h-3 w-3 text-fg-faint" />
                        Rotate key
                      </button>
                      <div className="my-1 h-px bg-hairline" />
                      <button
                        type="button"
                        onClick={() => setOpenMenu(null)}
                        className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-left text-[12.5px] text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <X className="h-3 w-3" />
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scope reference — collapsible */}
        <details
          open={scopesOpen}
          onToggle={(e) => setScopesOpen(e.currentTarget.open)}
          className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-[13px] text-fg-strong transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className={`h-3.5 w-3.5 text-fg-faint transition-transform ${
                scopesOpen ? "" : "-rotate-90"
              }`}
              aria-hidden="true"
            />
            <span>Scope reference</span>
            <span className="rounded-full border border-hairline bg-dark px-1.5 py-px text-[10.5px] text-fg-faint">
              {Object.keys(SCOPES).length}
            </span>
          </summary>
          <div className="border-t border-hairline">
            {Object.entries(SCOPES).map(([id, s]) => (
              <div
                key={id}
                className="grid grid-cols-[12px_1fr_auto] items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[13px] font-medium text-fg">{s.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-fg-faint">{s.desc}</p>
                </div>
                <p className="text-right font-mono text-[10.5px] text-fg-disabled">
                  {s.scopes}
                </p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}
