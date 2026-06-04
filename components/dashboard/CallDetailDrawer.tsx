"use client";

import Drawer from "@/components/design-system/Drawer";
import EnvTag from "@/components/dashboard/EnvTag";
import {
  formatCallMetric,
  formatRunRelativeTime,
} from "@/lib/dashboard/utils";
import type {
  AccountActivityRow,
  AccountActivityStatus,
} from "@/lib/dashboard/types";

/**
 * CallDetailDrawer — the per-call inspector. A right-side slide-over opened from
 * any call row (`/calls?request={id}`): status, the key metrics, a timing
 * trace, and the request/response payloads (batch) or a session summary (live).
 * Payloads are mock, derived from the pipeline, until the metering API lands.
 */

const STATUS_LABEL: Record<AccountActivityStatus, string> = {
  active: "Streaming",
  success: "Succeeded",
  failed: "Failed",
  timeout: "Timed out",
};
const STATUS_DOT: Record<AccountActivityStatus, string> = {
  active: "bg-warm",
  success: "bg-green-bright",
  failed: "bg-red-400",
  timeout: "bg-warm",
};

// Mock request/response shaped by the pipeline, so the inspector reads like a
// real call without a backend.
function samplePayload(row: AccountActivityRow): {
  request: unknown;
  response: unknown;
} {
  const failed = row.status === "failed" || row.status === "timeout";
  const error =
    row.status === "timeout"
      ? { error: "deadline_exceeded", message: "No orchestrator responded in time." }
      : { error: "inference_failed", message: "The pipeline returned a non-2xx status." };

  switch (row.pipeline) {
    case "text-to-image":
      return {
        request: { prompt: "a neon-lit city street at night, cinematic", steps: 4, seed: 41207 },
        response: failed ? error : { image_url: "https://gateway.livepeer/out/41207.png", width: 1024, height: 1024 },
      };
    case "language":
      return {
        request: { messages: [{ role: "user", content: "Summarize the Livepeer whitepaper in 3 bullets." }], max_tokens: 512 },
        response: failed ? error : { text: "• Decentralized GPU network…\n• Pay-per-use inference…\n• Open, permissionless apps.", tokens: 187 },
      };
    case "audio-to-text":
      return {
        request: { audio_url: "https://gateway.livepeer/in/clip.wav", language: "en" },
        response: failed ? error : { text: "Welcome back to the show — today we're talking real-time AI video.", duration_s: 12.4 },
      };
    case "text-to-speech":
      return {
        request: { text: "Hello from the Livepeer network.", voice: "am_onyx" },
        response: failed ? error : { audio_url: "https://gateway.livepeer/out/tts-8821.wav", duration_s: 2.1 },
      };
    case "video-understanding":
      return {
        request: { video_url: "https://gateway.livepeer/in/feed.mp4", task: "detect" },
        response: failed ? error : { detections: [{ label: "person", confidence: 0.98 }, { label: "bicycle", confidence: 0.83 }] },
      };
    default:
      return {
        request: { input: "…", pipeline: row.pipeline },
        response: failed ? error : { output: "…", pipeline: row.pipeline },
      };
  }
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-hairline bg-dark px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-fg-strong">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-fg-faint">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-[12px] tabular-nums text-fg-strong">
        {value}
      </dd>
    </div>
  );
}

export default function CallDetailDrawer({
  row,
  open,
  onClose,
}: {
  row: AccountActivityRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const live = row?.kind === "live";

  return (
    <Drawer
      side="right"
      open={open}
      onClose={onClose}
      title={row?.model ?? "Call"}
      ariaLabel="Call detail"
    >
      {row && (
        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Status + facets */}
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-strong">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${STATUS_DOT[row.status]}`}
                aria-hidden="true"
              />
              {STATUS_LABEL[row.status]}
            </span>
            <span className="text-fg-disabled">·</span>
            <span
              className={`rounded-[3px] border px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-[0.03em] ${
                live
                  ? "border-blue-bright/25 bg-blue-bright/10 text-blue-bright"
                  : "border-hairline text-fg-faint"
              }`}
            >
              {live ? "Live" : "Batch"}
            </span>
            <EnvTag environmentId={row.environmentId} />
            <span className="ml-auto font-mono text-[11px] text-fg-faint">
              {formatRunRelativeTime(row.timestamp)}
            </span>
          </div>

          {/* Key metrics */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Meta label="Request ID" value={row.id} />
            <Meta label="Pipeline" value={row.pipeline} />
            <Meta
              label={live ? "Duration" : "Latency"}
              value={formatCallMetric(row)}
            />
            <Meta label="Cost" value={row.costDisplay} />
            <Meta
              label="Caller"
              value={`${row.tokenName} · ${row.signerLabel}`}
            />
            <Meta label="When" value={formatRunRelativeTime(row.timestamp)} />
          </dl>

          {live ? (
            <Section title="Session">
              <Json
                value={{
                  transport: row.pipeline === "live-transcoding" ? "HLS" : "trickle",
                  channels: ["video", "events", "data"],
                  status: row.status === "active" ? "streaming" : "ended",
                  duration: formatCallMetric(row),
                }}
              />
            </Section>
          ) : (
            <>
              <Section title="Request">
                <Json value={samplePayload(row).request} />
              </Section>
              <Section title="Response">
                <Json value={samplePayload(row).response} />
              </Section>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
