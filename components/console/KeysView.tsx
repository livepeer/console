"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Key as KeyIcon,
  Lock,
  Loader2,
  MoreVertical,
  Plus,
  X,
} from "lucide-react";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import { useAuth } from "@/components/console/AuthContext";
import { useApiKeys } from "@/lib/console/useApiKeys";
import type { DashboardApiKeyRow } from "@/lib/console/pymthouse-keys";

type CredentialFormat = "bearer" | "token";

function CopyField({
  value,
  wrap = false,
}: {
  value: string;
  /** Multi-line wrap for long base64 python-gateway tokens. */
  wrap?: boolean;
}) {
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
      className={`flex w-full items-start gap-2.5 rounded-[4px] border bg-dark px-3 py-2.5 text-left transition-colors ${
        copied
          ? "border-green-bright bg-green/15"
          : "border-subtle hover:border-green hover:bg-dark-card"
      }`}
    >
      <span
        className={`flex-1 font-mono text-[13px] text-fg select-all ${
          wrap
            ? "max-h-28 overflow-y-auto break-all whitespace-pre-wrap leading-relaxed"
            : "overflow-x-auto whitespace-nowrap"
        }`}
        style={wrap ? undefined : { scrollbarWidth: "none" }}
      >
        {value}
      </span>
      <span
        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded ${
          copied ? "text-green-bright" : "text-fg-faint"
        }`}
        aria-hidden="true"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
}

function FormatSlider({
  value,
  onChange,
}: {
  value: CredentialFormat;
  onChange: (next: CredentialFormat) => void;
}) {
  return (
    <fieldset
      aria-label="Credential format"
      className="relative m-0 inline-grid w-[8.5rem] min-w-0 grid-cols-2 rounded-[4px] border border-green/40 bg-dark p-px"
    >
      <div
        className={`pointer-events-none absolute top-px bottom-px w-[calc(50%-1px)] rounded-[3px] bg-green shadow-sm transition-[left] duration-200 ease-out motion-reduce:transition-none ${
          value === "bearer" ? "left-px" : "left-[calc(50%)]"
        }`}
        aria-hidden
      />
      {(["bearer", "token"] as const).map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={`relative z-10 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide transition-colors duration-200 motion-reduce:transition-none ${
              selected ? "text-white" : "text-fg-faint hover:text-fg-strong"
            }`}
          >
            {option === "bearer" ? "Bearer" : "Token"}
          </button>
        );
      })}
    </fieldset>
  );
}

function RevealedCredential({
  apiKey,
  sdkToken,
}: {
  apiKey: string;
  sdkToken: string | null;
}) {
  const [format, setFormat] = useState<CredentialFormat>(
    sdkToken ? "token" : "bearer"
  );
  const hasToken = Boolean(sdkToken?.trim());
  const showToken = hasToken && format === "token";
  const value = showToken ? sdkToken!.trim() : apiKey;

  return (
    <div className="space-y-2.5">
      {hasToken ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11.5px] text-fg-muted">
            {showToken ? (
              <>
                <a
                  href="https://github.com/livepeer/livepeer-python-gateway"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-bright underline decoration-green/40 underline-offset-2 transition-colors hover:text-fg hover:decoration-green"
                >
                  Python gateway
                </a>{" "}
                <code className="rounded bg-dark px-1 py-0.5 font-mono text-[10.5px] text-fg-strong">
                  --token
                </code>{" "}
                (base64)
              </>
            ) : (
              <>
                Authorization: Bearer{" "}
                <span className="font-mono text-[11px] text-fg-strong">
                  pmth_*
                </span>
              </>
            )}
          </p>
          <FormatSlider value={format} onChange={setFormat} />
        </div>
      ) : null}
      <CopyField value={value} wrap={showToken} />
    </div>
  );
}

/** Masked table token — single mono string so prefix/ellipsis/suffix never drift. */
function MaskedToken({ prefix, suffix }: { prefix: string; suffix: string }) {
  const masked = `${prefix}…${suffix}`;
  return (
    <div
      className="mt-1 truncate font-mono text-[11.5px] tracking-tight text-fg-faint"
      title={masked}
    >
      {masked}
    </div>
  );
}

function KeysTableSkeletonRow() {
  return (
    <div
      className="grid grid-cols-[2.4fr_1.1fr_1.2fr_36px] items-center gap-3 border-b border-hairline px-4 py-3.5"
      aria-busy="true"
      aria-label="Creating API key"
    >
      <div className="min-w-0 space-y-1.5">
        <div className="h-3.5 w-[7.5rem] animate-pulse rounded bg-hover" />
        <div className="h-3 w-[11rem] animate-pulse rounded bg-hover/70 font-mono" />
      </div>
      <div className="h-5 w-[4.25rem] animate-pulse rounded-full bg-hover" />
      <div className="h-3.5 w-[5.5rem] animate-pulse rounded bg-hover" />
      <div />
    </div>
  );
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysSince(iso: string): number {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) {
    return 0;
  }
  return Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000));
}

export default function KeysView() {
  const { isConnected } = useAuth();
  const { state, createKey, insertKey, revokeKey, reload } =
    useApiKeys(isConnected);

  const [revealed, setRevealed] = useState<{
    apiKey: string;
    id: string;
    sdkToken: string | null;
  } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scopesOpen, setScopesOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  const keys: DashboardApiKeyRow[] = state.status === "ready" ? state.keys : [];
  const ROTATE_DAYS_THRESHOLD = 90;
  const staleKeys = keys.filter(
    (k) => daysSince(k.createdAt) >= ROTATE_DAYS_THRESHOLD
  );
  const showAlert = staleKeys.length > 0 && !alertDismissed;

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

  const onCreate = async () => {
    setActionError(null);
    setCreating(true);
    try {
      const created = await createKey("Dashboard SDK");
      // Same paint: drop skeleton, insert row, show full-key banner.
      insertKey(created.row);
      setRevealed({
        apiKey: created.apiKey,
        id: created.id,
        sdkToken: created.sdkToken,
      });
      setCreating(false);
      void reload({ soft: true });
      queueMicrotask(() => {
        revealRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    } catch (error) {
      setCreating(false);
      setActionError(
        error instanceof Error ? error.message : "Could not create API key"
      );
    }
  };

  const onRevoke = async (keyId: string) => {
    setActionError(null);
    try {
      await revokeKey(keyId);
      setOpenMenu(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not revoke API key"
      );
    }
  };

  const loading = state.status === "loading" || state.status === "idle";
  const loadError = state.status === "error" ? state.message : null;

  return (
    <>
      <ConsolePageHeader
        title="API keys"
        icon={KeyIcon}
        actions={
          <>
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
              onClick={() => void onCreate()}
              disabled={creating || loading}
              className="btn-primary inline-flex h-[26px] items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3 w-3" aria-hidden="true" />
              )}
              Create key
            </button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
        <div className="mb-6">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-disabled">
            Workspace · Authentication
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-fg">
            API keys
          </h1>
          <p className="mt-2.5 max-w-[640px] text-[13.5px] leading-[1.55] text-fg-muted">
            Long-lived{" "}
            <span className="font-mono text-[12.5px] text-fg-strong">
              pmth_*
            </span>{" "}
            bearer tokens for the SDK and CLI, plus a base64{" "}
            <span className="font-mono text-[12.5px] text-fg-strong">
              --token
            </span>{" "}
            for the{" "}
            <a
              href="https://github.com/livepeer/livepeer-python-gateway"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-strong underline decoration-hairline underline-offset-2 transition-colors hover:text-green-bright"
            >
              Python gateway
            </a>
            . The SDK exchanges your key for a short-lived signer session before
            streaming — no device login required on every run.
          </p>
        </div>

        {(loadError || actionError) && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-300">
            {actionError ?? loadError}
            {loadError && (
              <button
                type="button"
                onClick={() => void reload()}
                className="ml-3 underline decoration-dotted underline-offset-2"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {revealed && (
          <div
            ref={revealRef}
            role="status"
            aria-live="polite"
            className="relative mb-4 flex overflow-hidden rounded-md border border-green bg-gradient-to-b from-green/[0.08] to-green/[0.02]"
          >
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
                  onClick={() => setRevealed(null)}
                  aria-label="Dismiss"
                  className="grid h-6 w-6 place-items-center rounded text-fg-faint transition-colors hover:bg-hover hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <RevealedCredential
                apiKey={revealed.apiKey}
                sdkToken={revealed.sdkToken}
              />
              <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-fg-faint">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Store it in a secrets manager — never commit it to source.
                </span>
              </div>
            </div>
          </div>
        )}

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
                Rotate keys regularly to limit blast radius if leaked.
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

        <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
          <div className="grid grid-cols-[2.4fr_1.1fr_1.2fr_36px] items-center gap-3 border-b border-hairline bg-dark px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled">
            <div>Key</div>
            <div>Scope</div>
            <div>Created</div>
            <div />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-[13px] text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading keys…
            </div>
          )}

          {!loading && keys.length === 0 && !creating && (
            <div className="px-4 py-12 text-center text-[13px] text-fg-muted">
              No API keys yet. Create one to use with the SDK.
            </div>
          )}

          {!loading && creating && <KeysTableSkeletonRow />}

          {!loading &&
            keys.map((k) => {
              const stale = daysSince(k.createdAt) >= ROTATE_DAYS_THRESHOLD;
              const isOpen = openMenu === k.id;
              const isJustCreated = revealed?.id === k.id;
              const displayName = k.label?.trim() || "SDK key";
              return (
                <div
                  key={k.id}
                  className={`relative grid grid-cols-[2.4fr_1.1fr_1.2fr_36px] items-center gap-3 border-b border-hairline px-4 py-3.5 last:border-b-0 ${
                    isJustCreated
                      ? "bg-green/[0.06] ring-1 ring-inset ring-green/25"
                      : "hover:bg-zebra"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-fg">
                      {displayName}
                      {stale && (
                        <span
                          className="tone-amber ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[10.5px] font-medium align-[2px]"
                          title={`Created ${daysSince(k.createdAt)} days ago`}
                        >
                          <AlertTriangle
                            className="h-[9px] w-[9px]"
                            aria-hidden="true"
                          />
                          {daysSince(k.createdAt)}d
                        </span>
                      )}
                    </div>
                    <MaskedToken prefix={k.prefix} suffix={k.suffix} />
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-dark px-2 py-px font-mono text-[10.5px] text-fg-strong">
                      sign:job
                    </span>
                  </div>

                  <div>
                    <div className="text-[12.5px] text-fg-strong">
                      {formatCreatedAt(k.createdAt)}
                    </div>
                  </div>

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
                      <MoreVertical
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && (
                      <div
                        ref={menuRef}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full z-30 mt-1 min-w-[168px] rounded-md border border-subtle bg-dark p-1 shadow-popover"
                      >
                        <button
                          type="button"
                          onClick={() => void onRevoke(k.id)}
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
            <span>SDK usage</span>
          </summary>
          <div className="border-t border-hairline px-4 py-3.5">
            <p className="text-[12.5px] leading-relaxed text-fg-muted">
              Pass the key to{" "}
              <span className="font-mono text-fg-strong">
                exchangeApiKeyForSigner
              </span>{" "}
              with your dashboard origin as{" "}
              <span className="font-mono text-fg-strong">facadeUrl</span>, call{" "}
              <span className="font-mono text-fg-strong">
                POST /api/pymthouse/keys/exchange
              </span>{" "}
              on the dashboard, or exchange directly on the issuer at{" "}
              <span className="font-mono text-fg-strong">
                POST …/apps/{"{clientId}"}/oidc/token
              </span>{" "}
              (RFC 8693,{" "}
              <span className="font-mono text-fg-strong">subject_token</span> =
              API key). The response includes{" "}
              <span className="font-mono text-fg-strong">signer_url</span> for
              direct remote-signer calls. See{" "}
              <span className="font-mono text-fg-strong">
                @pymthouse/builder-sdk/examples/stream-with-api-key.mjs
              </span>
              .
            </p>
          </div>
        </details>
      </div>
    </>
  );
}
