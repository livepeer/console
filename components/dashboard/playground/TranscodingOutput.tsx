"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Radio } from "lucide-react";
import type { ReactNode } from "react";
import CopyButton from "@/components/dashboard/CopyButton";
import StatusDot from "@/components/dashboard/StatusDot";

interface TranscodingOutputProps {
  result: string | null;
  isRunning: boolean;
  inferenceTime?: number;
  modelName?: string;
  /** Mock image used as the "current frame" poster inside the HLS player. */
  posterUrl?: string;
}

// ─── Default rendition ladder ─────────────────────────────────────────────────
// Matches the Livepeer `POST /stream` default profiles when none are supplied
// (docs: 240p/360p/480p/720p). Ordered top-down so the table reads from the
// highest rendition the player will pick first.
interface Rendition {
  label: string;
  width: number;
  height: number;
  bitrate: string;
  fps: number;
}

const DEFAULT_LADDER: Rendition[] = [
  { label: "720p", width: 1280, height: 720, bitrate: "3 Mbps", fps: 30 },
  { label: "480p", width: 854, height: 480, bitrate: "1.6 Mbps", fps: 30 },
  { label: "360p", width: 640, height: 360, bitrate: "800 kbps", fps: 30 },
  { label: "240p", width: 426, height: 240, bitrate: "250 kbps", fps: 30 },
];

// Stable mock IDs — regenerated per run so copy chips feel "real".
function randHex(len: number) {
  let out = "";
  const chars = "abcdef0123456789";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function CopyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-dark-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-fg-label">
          {label}
        </span>
        <CopyButton
          value={value}
          label="Copy"
          ariaLabel={`Copy ${label}`}
          size="xs"
        />
      </div>
      <code className="break-all font-mono text-xs text-fg-strong">{value}</code>
    </div>
  );
}

// ─── Player frame shell ──────────────────────────────────────────────────────
// A single aspect-video container reused by empty / loading / result states so
// the output's top slot never resizes — only the stuff *below* it changes.
// Surface color matches dark-surface (same as other playground output cards),
// not pure black — that way the rounded corners read as a card on a dark page,
// not a black void.
function PlayerFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-hairline bg-dark-surface">
      {children}
    </div>
  );
}

function HlsPlayerMock({
  activeRendition,
  onRenditionChange,
  posterUrl,
}: {
  activeRendition: Rendition;
  onRenditionChange: (r: Rendition) => void;
  posterUrl?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  return (
    <PlayerFrame>
      {/* Poster "current frame" — cross-fades in like ImageOutput so the reveal feels
          like playback starting. Darkened so overlay chrome stays legible. */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          decoding="async"
          onLoad={() => setPosterLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover brightness-75 transition-opacity duration-700 ease-out ${
            posterLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Live badge */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-overlay px-2 py-1 backdrop-blur-sm">
        <StatusDot tone="red" />
        <span className="text-[10px] font-semibold tracking-wider text-fg">LIVE</span>
      </div>

      {/* Rendition switcher */}
      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-overlay px-2 py-1 text-[10px] font-medium text-fg backdrop-blur-sm hover:bg-overlay focus:outline-none"
        >
          <span className="font-mono">{activeRendition.label}</span>
          <span className="text-fg-faint">▾</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 min-w-[120px] rounded-lg border border-hairline bg-dark-card p-1 shadow-popover backdrop-blur-sm">
            {DEFAULT_LADDER.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  onRenditionChange(r);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-tint focus:outline-none ${
                  r.label === activeRendition.label ? "text-fg" : "text-fg-muted"
                }`}
              >
                <span className="font-mono">{r.label}</span>
                <span className="text-fg-label">{r.bitrate}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Play affordance — centered, purely ornamental (no real playback). */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-[var(--color-border-strong)]">
          <Play className="h-5 w-5 translate-x-0.5 fill-white text-fg" />
        </div>
      </div>

      {/* Resolution stamp */}
      <div className="absolute bottom-3 right-3 rounded-md bg-overlay px-2 py-1 font-mono text-[10px] text-fg-strong backdrop-blur-sm">
        {activeRendition.width}×{activeRendition.height} · {activeRendition.fps}fps
      </div>
    </PlayerFrame>
  );
}

function TranscodingEmpty({ modelName }: { modelName?: string }) {
  return (
    <PlayerFrame>
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-hover">
          <Radio className="h-6 w-6 text-fg-muted" strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="text-sm text-fg-faint">Ready to create a stream</p>
        <p className="max-w-sm text-xs text-fg-label">
          {modelName
            ? `Run ${modelName} to get an HLS playback URL, rendition ladder, and RTMP ingest.`
            : "Fill in the form and click Run"}
        </p>
      </div>
    </PlayerFrame>
  );
}

function TranscodingLoading() {
  return (
    <PlayerFrame>
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-subtle border-t-green-bright" />
        <p className="animate-pulse text-xs text-fg-faint">Provisioning stream…</p>
      </div>
    </PlayerFrame>
  );
}

export default function TranscodingOutput({
  result,
  isRunning,
  inferenceTime,
  modelName,
  posterUrl,
}: TranscodingOutputProps) {
  const [viewMode, setViewMode] = useState<"preview" | "json">("preview");
  const [activeRendition, setActiveRendition] = useState<Rendition>(DEFAULT_LADDER[0]);

  // Regenerate mock IDs per successful result so copy chips don't look static.
  const ids = useMemo(() => {
    if (!result) return null;
    const playbackId = randHex(16);
    const streamKey = `${randHex(4)}-${randHex(4)}-${randHex(4)}-${randHex(4)}`;
    const id = `${randHex(8)}-${randHex(4)}-${randHex(4)}-${randHex(4)}-${randHex(12)}`;
    return {
      id,
      playbackId,
      streamKey,
      hlsUrl: `https://playback.frameworks.network/hls/${playbackId}/index.m3u8`,
      rtmpUrl: `rtmp://rtmp.frameworks.network/live/${streamKey}`,
      whipUrl: `https://playback.frameworks.network/webrtc/${streamKey}`,
    };
  }, [result]);

  // Reset to top rendition on new result.
  useEffect(() => {
    if (result) setActiveRendition(DEFAULT_LADDER[0]);
  }, [result]);

  const state: "loading" | "empty" | "result" = isRunning
    ? "loading"
    : result
      ? "result"
      : "empty";

  const responseJson = ids
    ? JSON.stringify(
        {
          id: ids.id,
          name: "my-live-stream",
          playbackId: ids.playbackId,
          streamKey: ids.streamKey,
          playbackUrl: ids.hlsUrl,
          rtmpIngestUrl: ids.rtmpUrl,
          record: true,
          profiles: DEFAULT_LADDER.map((r) => ({
            name: r.label,
            width: r.width,
            height: r.height,
            bitrate: r.bitrate,
            fps: r.fps,
          })),
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      )
    : "";

  return (
    <div className="flex flex-col gap-3">
      {/* View mode tabs — disabled until a result lands, keeps layout from jumping. */}
      <div
        className={`flex items-center gap-0 border-b border-hairline transition-opacity duration-300 ${
          state === "result" ? "opacity-100" : "pointer-events-none opacity-40"
        }`}
        aria-disabled={state !== "result"}
      >
        <button
          onClick={() => setViewMode("preview")}
          disabled={state !== "result"}
          className={`border-b-2 px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
            state === "result" && viewMode === "preview"
              ? "border-green-bright text-fg"
              : "border-transparent text-fg-faint hover:text-fg-muted"
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setViewMode("json")}
          disabled={state !== "result"}
          className={`border-b-2 px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
            state === "result" && viewMode === "json"
              ? "border-green-bright text-fg"
              : "border-transparent text-fg-faint hover:text-fg-muted"
          }`}
        >
          JSON
        </button>
      </div>

      {state === "loading" && <TranscodingLoading />}
      {state === "empty" && <TranscodingEmpty modelName={modelName} />}

      {state === "result" && viewMode === "json" && (
        <div className="relative rounded-lg border border-subtle bg-zebra">
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg-muted">
            {responseJson}
          </pre>
        </div>
      )}

      {state === "result" && viewMode === "preview" && ids && (
        <>
          <HlsPlayerMock
            activeRendition={activeRendition}
            onRenditionChange={setActiveRendition}
            posterUrl={posterUrl}
          />

          {/* Rendition ladder */}
          <div className="rounded-xl border border-hairline bg-dark-surface">
            <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-fg-label">
                Rendition ladder
              </span>
              <span className="text-[10px] text-fg-label">
                4 renditions · H.264
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-0 px-3 py-1 text-xs">
              {DEFAULT_LADDER.map((r) => {
                const active = r.label === activeRendition.label;
                return (
                  <div
                    key={r.label}
                    className={`col-span-4 grid grid-cols-subgrid items-center py-1.5 transition-colors ${
                      active ? "text-fg" : "text-fg-faint"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        active ? "bg-green-bright" : "bg-fg-faint"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-mono">{r.label}</span>
                    <span className="font-mono text-fg-muted">
                      {r.width}×{r.height}
                    </span>
                    <span className="font-mono text-fg-muted">{r.bitrate}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Copy URLs */}
          <div className="flex flex-col gap-2">
            <CopyChip label="HLS playback URL" value={ids.hlsUrl} />
            <CopyChip label="RTMP ingest URL" value={ids.rtmpUrl} />
            <CopyChip label="Playback ID" value={ids.playbackId} />
          </div>

          {inferenceTime !== undefined && (
            <p className="text-xs text-fg-faint">
              Provisioned in{" "}
              <span className="font-mono text-fg-faint">{inferenceTime}s</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
