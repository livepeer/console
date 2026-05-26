"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Download } from "lucide-react";
import type { Model, PlaygroundOutputType } from "@/lib/dashboard/types";
import {
  estimateCallCost,
  generateMockRequestId,
  getModelIcon,
} from "@/lib/dashboard/utils";
import type { ModelCategory } from "@/lib/dashboard/types";
import CodeSnippets from "@/components/dashboard/playground/CodeSnippets";
import CopyButton from "@/components/dashboard/CopyButton";
import CostTag from "@/components/dashboard/CostTag";
import RequestIdChip from "@/components/dashboard/RequestIdChip";
import WaveSurferAudio from "@/components/dashboard/playground/WaveSurferAudio";
import WaveformStatic from "@/components/dashboard/playground/WaveformStatic";

interface PlaygroundOutputProps {
  outputType: PlaygroundOutputType;
  result: string | null;
  isRunning: boolean;
  inferenceTime?: number;
  category?: ModelCategory;
  modelName?: string;
  /** Model-specific response shape for the JSON tab. When provided, replaces
   *  the generic { status, output, metrics } envelope — gives developers a real
   *  response shape (detection boxes, depth stats, masks) to integrate against. */
  mockOutputJson?: unknown;
  /** When provided alongside `lastRunValues`, the result panel renders a
   *  "Use this in your code" section with snippets that match what was just run. */
  model?: Model;
  lastRunValues?: Record<string, unknown> | null;
}

// ─── Placeholders — sized per output type so the layout doesn't jump when a real result arrives ───

// Returns the Tailwind aspect-ratio class matching each output type. Keeps
// placeholder frames shaped like the real result they'll be replaced with.
function placeholderShape(outputType: PlaygroundOutputType): string {
  switch (outputType) {
    case "image":
      return "aspect-square";
    case "video":
      return "aspect-video"; // 16/9
    case "audio":
      return "min-h-[260px]";
    case "text":
      return "min-h-[320px]";
    case "json":
      return "min-h-[240px]";
  }
}

function PlaceholderFrame({
  outputType,
  children,
}: {
  outputType: PlaygroundOutputType;
  children: React.ReactNode;
}) {
  const shape = placeholderShape(outputType);
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-subtle bg-zebra p-6 text-center ${shape}`}
    >
      {children}
    </div>
  );
}

function ShimmerLoader({
  outputType,
  modelName,
}: {
  outputType: PlaygroundOutputType;
  modelName?: string;
}) {
  // Audio shares its bespoke frame across states — keep the waveform visible
  // while generating instead of swapping to a generic spinner card.
  if (outputType === "audio") {
    return <AudioPlaygroundOutput state="loading" modelName={modelName} />;
  }
  return (
    <PlaceholderFrame outputType={outputType}>
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-subtle border-t-green-bright" />
      <p className="mt-3 animate-pulse text-xs text-fg-faint">Running inference…</p>
    </PlaceholderFrame>
  );
}

// ─── Audio output ─────────────────────────────────────────────────────────────
// Empty / loading states reuse the WaveSurfer library via `WaveformStatic` so
// the bar geometry, spacing, and radius are identical to the rendered player.
// Only the colour changes between states — not the visual "shape" of audio.

function AudioPlaygroundOutput({
  state,
  modelName,
  url,
}: {
  state: "empty" | "loading" | "result";
  modelName?: string;
  /** Audio URL for the rendered state. WaveSurfer extracts real peaks from it;
   * when real orchestrator-returned URLs land, this prop is all that changes. */
  url?: string;
}) {
  const label =
    state === "loading"
      ? "Generating audio…"
      : modelName
        ? `Run ${modelName} to hear output`
        : "Fill in the form and click Run";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-dark-surface px-5 py-6">
      {state === "result" && url ? (
        <WaveSurferAudio url={url} />
      ) : (
        <>
          <WaveformStatic dimmed={state === "loading"} />
          {/* Bottom slot — fixed height so empty / loading / result frames match. */}
          <div className="flex h-8 items-center">
            <p
              className={`w-full text-center text-xs ${state === "loading" ? "animate-pulse text-fg-faint" : "text-fg-label"}`}
            >
              {label}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({
  outputType,
  category,
  modelName,
}: {
  outputType: PlaygroundOutputType;
  category?: ModelCategory;
  modelName?: string;
}) {
  const Icon = category ? getModelIcon(category) : null;
  const label = modelName ? `Run ${modelName} to see output here` : "Fill in the form and click Run";

  // Chat-like empty state for LLM outputs — matches Replicate/Chutes convention
  if (outputType === "text") {
    return (
      <div className="flex min-h-[320px] w-full flex-col justify-end gap-3 rounded-xl border border-hairline bg-zebra p-4">
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hover">
            {Icon && <Icon className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />}
          </div>
          <div className="flex min-h-[48px] flex-1 items-center rounded-lg bg-zebra px-3 py-2 text-xs text-fg-label">
            {label}
          </div>
        </div>
      </div>
    );
  }

  // Audio gets its own unified frame — wave is the placeholder, no mic icon stacked.
  if (outputType === "audio") {
    return <AudioPlaygroundOutput state="empty" modelName={modelName} />;
  }

  return (
    <PlaceholderFrame outputType={outputType}>
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-hover">
          <Icon className="h-6 w-6 text-fg-muted" strokeWidth={2} aria-hidden="true" />
        </div>
      )}
      <p className="mt-3 text-sm text-fg-faint">Ready to run</p>
      <p className="mt-1 px-6 text-xs text-fg-label">{label}</p>
    </PlaceholderFrame>
  );
}

function ImageOutput({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  // Container aspect ratio. A hidden probe Image fires onload as soon as the
  // browser knows the dimensions — well before the visible <img> fades in —
  // so the placeholder locks to the output's natural aspect from the start,
  // avoiding the "big square shrinks to landscape" layout hop.
  const [aspect, setAspect] = useState<string>("1 / 1");

  useEffect(() => {
    setLoaded(false);
    setAspect("1 / 1");
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) {
        setAspect(`${probe.naturalWidth} / ${probe.naturalHeight}`);
      }
    };
    probe.src = url;
    return () => {
      probe.onload = null;
    };
  }, [url]);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-hairline bg-zebra transition-[aspect-ratio] duration-500 ease-out"
      style={{ aspectRatio: aspect }}
    >
      {/* Full-frame pulse — soft opacity breath while the image bytes decode.
          Paired with the aspect-ratio transition above: container finds its
          shape, pulse covers the download wait, image fades in on top. */}
      <div
        className={`absolute inset-0 animate-pulse bg-hover transition-opacity duration-700 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      <img
        src={url}
        alt="Generated output"
        decoding="async"
        className={`relative h-full w-full object-contain transition-opacity duration-700 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function VideoOutput({ url }: { url: string }) {
  return (
    <video
      src={url}
      controls
      muted
      playsInline
      className="aspect-video w-full rounded-lg bg-black object-contain"
    />
  );
}

function StreamingTextOutput({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;
    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text]);

  const isStreaming = displayed.length < text.length;

  return (
    <div className="min-h-[320px] rounded-lg border border-subtle bg-zebra p-4 font-mono text-sm leading-relaxed text-fg-strong">
      <pre className="whitespace-pre-wrap">{displayed}</pre>
      {isStreaming && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-green-bright" />
      )}
    </div>
  );
}

function AudioOutput({ modelName, url }: { modelName?: string; url?: string }) {
  return <AudioPlaygroundOutput state="result" modelName={modelName} url={url} />;
}

function JsonOutput({ data }: { data: string }) {
  return (
    <div className="relative rounded-lg border border-subtle bg-zebra">
      <CopyButton
        value={data}
        label="Copy"
        ariaLabel="Copy JSON"
        size="xs"
        className="absolute right-2 top-2"
      />
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg-muted">
        {data}
      </pre>
    </div>
  );
}

export default function PlaygroundOutput({
  outputType,
  result,
  isRunning,
  inferenceTime,
  category,
  modelName,
  mockOutputJson,
  model,
  lastRunValues,
}: PlaygroundOutputProps) {
  const [viewMode, setViewMode] = useState<"preview" | "json">("preview");

  // Three display states. No wrapper animation — each output component handles its own
  // reveal (e.g. ImageOutput cross-fades shimmer → image in place), which avoids the
  // double-fade flicker you get when both a wrapper and inner content animate at once.
  const state: "loading" | "empty" | "result" = isRunning
    ? "loading"
    : result
      ? "result"
      : "empty";

  // One stable request ID per result. Regenerated when `result` changes so a
  // fresh Run gets a fresh ID; client-side only to avoid SSR/CSR mismatch.
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    if (state === "result" && result) {
      setRequestId(generateMockRequestId());
    }
  }, [state, result]);

  const costDisplay = useMemo(
    () => (model ? estimateCallCost(model, inferenceTime) : null),
    [model, inferenceTime],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* View mode tabs — always rendered so the layout doesn't shift when a result arrives.
          Disabled (muted + not clickable) until there's a result to switch between. */}
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

      {state === "loading" && <ShimmerLoader outputType={outputType} modelName={modelName} />}
      {state === "empty" && (
        <EmptyState outputType={outputType} category={category} modelName={modelName} />
      )}
      {state === "result" && viewMode === "json" && (
        <JsonOutput
          data={JSON.stringify(
            mockOutputJson ?? {
              status: "succeeded",
              output: result,
              metrics: {
                inference_time: inferenceTime ?? 0.5,
                gpus_matched: 3,
              },
            },
            null,
            2,
          )}
        />
      )}
      {state === "result" && viewMode === "preview" && result && (
        <>
          {outputType === "image" && <ImageOutput url={result} />}
          {outputType === "text" && <StreamingTextOutput text={result} />}
          {outputType === "audio" && <AudioOutput modelName={modelName} url={result} />}
          {outputType === "video" && <VideoOutput url={result} />}
          {outputType === "json" && <JsonOutput data={result} />}
        </>
      )}

      {/* Run metadata — cost + latency + request ID. Render whenever a result
          is shown; pieces are independent so each appears as data is available. */}
      {state === "result" && (costDisplay || inferenceTime || requestId) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-faint">
          {costDisplay && (
            <CostTag mode="cost" cost={costDisplay} />
          )}
          {inferenceTime && (
            <span className="font-mono tabular-nums text-fg-faint">
              {inferenceTime}s
            </span>
          )}
          {requestId && <RequestIdChip id={requestId} className="ml-auto" />}
        </div>
      )}

      {/* Action buttons */}
      {state === "result" && (outputType === "image" || outputType === "audio") && (
        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-xs text-fg-label transition-colors hover:bg-hover hover:text-fg-muted focus:outline-none">
            <Download className="h-3 w-3" />
            Download
          </button>
        </div>
      )}

      {/* Copy code for this run — bridges click-to-test to copy-paste production code */}
      {state === "result" && model && lastRunValues && Object.keys(lastRunValues).length > 0 && (
        <div className="mt-2">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-label">
            Use this in your code
          </p>
          <CodeSnippets model={model} runValues={lastRunValues} />
        </div>
      )}
    </div>
  );
}
