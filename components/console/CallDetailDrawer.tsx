"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { Maximize2, MoreVertical, Play, VolumeX } from "lucide-react";
import { modalityTag } from "@/components/console/CallsTable";
import { formatCallMetric } from "@/lib/console/utils";
import type {
  AccountActivityRow,
  AccountActivityStatus,
} from "@/lib/console/types";

const STATUS_LABEL: Record<AccountActivityStatus, string> = {
  active: "Streaming",
  success: "Succeeded",
  failed: "Failed",
  timeout: "Timed out",
};

type MediaKind = "image" | "video" | "audio" | "text" | "json";

type MediaSpec = {
  kind: MediaKind;
  title: string;
  label: string;
  format: string;
  metricLabel: string;
  metricValue: string;
  source: string;
  imageUrl?: string;
  text?: string;
  json?: unknown;
};

const AUDIO_BARS = Array.from({ length: 64 }, (_, i) => {
  const envelope = Math.sin((i / 64) * Math.PI);
  const detail = Math.sin(i * 1.3) * 0.32 + Math.sin(i * 0.45) * 0.22;
  return Math.max(12, Math.round((0.18 + envelope * 0.72 + detail * 0.2) * 96));
});

function previewSeed(row: AccountActivityRow): string {
  return encodeURIComponent(
    `${row.id}-${row.pipeline}`.replace(/[^a-z0-9_-]+/gi, "-")
  );
}

function previewImageUrl(row: AccountActivityRow, size = "1200/900"): string {
  return `https://picsum.photos/seed/${previewSeed(row)}/${size}`;
}

function samplePayload(row: AccountActivityRow): {
  request: unknown;
  response: unknown;
} {
  const failed = row.status === "failed" || row.status === "timeout";
  const error =
    row.status === "timeout"
      ? {
          error: "deadline_exceeded",
          message: "No orchestrator responded in time.",
        }
      : {
          error: "inference_failed",
          message: "The pipeline returned a non-2xx status.",
        };

  switch (row.pipeline) {
    case "text-to-image":
    case "image-to-image":
      return {
        request: {
          prompt: "a neon-lit city street at night, cinematic",
          steps: 4,
          seed: 41207,
        },
        response: failed
          ? error
          : {
              image_url: previewImageUrl(row, "1024/1024"),
              width: 1024,
              height: 1024,
            },
      };
    case "image-to-video":
    case "text-to-video":
    case "video-to-video":
    case "live-video-to-video":
      return {
        request: {
          prompt: "wide cinematic production frame, soft natural motion",
          duration_s: 6,
        },
        response: failed
          ? error
          : {
              video_url: "https://gateway.livepeer/out/render.mp4",
              width: 1920,
              height: 1080,
              duration_s: 6,
            },
      };
    case "transcoding":
    case "live-transcoding":
      return {
        request: {
          source_url: "https://gateway.livepeer/in/feed.mp4",
          profiles: ["1080p", "720p", "480p"],
        },
        response: failed
          ? error
          : {
              playback_url: "https://gateway.livepeer/out/master.m3u8",
              width: 1920,
              height: 1080,
            },
      };
    case "language":
    case "text-generation":
      return {
        request: {
          messages: [
            {
              role: "user",
              content: "Summarize the Livepeer whitepaper in 3 bullets.",
            },
          ],
          max_tokens: 512,
        },
        response: failed
          ? error
          : {
              text: "- Decentralized GPU network\n- Pay-per-use inference\n- Open, permissionless apps",
              tokens: 187,
            },
      };
    case "audio-to-text":
      return {
        request: {
          audio_url: "https://gateway.livepeer/in/clip.wav",
          language: "en",
        },
        response: failed
          ? error
          : {
              text: "Welcome back to the show. Today we're talking real-time AI video.",
              duration_s: 12.4,
            },
      };
    case "text-to-speech":
    case "text-to-audio":
      return {
        request: { text: "Hello from the Livepeer network.", voice: "am_onyx" },
        response: failed
          ? error
          : {
              audio_url: "https://gateway.livepeer/out/tts-8821.wav",
              duration_s: 2.1,
            },
      };
    case "video-understanding":
      return {
        request: {
          video_url: "https://gateway.livepeer/in/feed.mp4",
          task: "detect",
        },
        response: failed
          ? error
          : {
              detections: [
                { label: "person", confidence: 0.98 },
                { label: "bicycle", confidence: 0.83 },
              ],
            },
      };
    default:
      return {
        request: { input: "...", pipeline: row.pipeline },
        response: failed ? error : { output: "...", pipeline: row.pipeline },
      };
  }
}

function readText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const text = (value as { text?: unknown }).text;
  return typeof text === "string" ? text : undefined;
}

function readTokenCount(value: unknown): string {
  if (!value || typeof value !== "object") return "Text";
  const tokens = (value as { tokens?: unknown }).tokens;
  return typeof tokens === "number" ? `${tokens} tokens` : "Text";
}

function mediaSpecForRow(row: AccountActivityRow): MediaSpec {
  const payload = samplePayload(row);
  const pipeline = row.pipeline.toLowerCase();
  const failed = row.status === "failed" || row.status === "timeout";
  const source = row.signerLabel || "Livepeer";

  if (failed) {
    return {
      kind: "json",
      title: `${row.model} request`,
      label: "Error",
      format: "JSON",
      metricLabel: "Result",
      metricValue: STATUS_LABEL[row.status],
      source,
      json: payload.response,
    };
  }

  if (pipeline.includes("video") || pipeline.includes("transcoding")) {
    return {
      kind: "video",
      title:
        row.kind === "live" ? `${row.model} session` : `${row.model} video`,
      label: "Video",
      format: pipeline.includes("transcoding") ? "HLS" : "MP4",
      metricLabel: "Dimensions",
      metricValue: "1920 x 1080",
      source,
      imageUrl: previewImageUrl(row, "1280/720"),
    };
  }

  if (pipeline.includes("image")) {
    return {
      kind: "image",
      title: `${row.model} image`,
      label: "Image",
      format: "PNG",
      metricLabel: "Dimensions",
      metricValue: "1024 x 1024",
      source,
      imageUrl: previewImageUrl(row, "1024/1024"),
    };
  }

  if (pipeline.includes("audio") || pipeline.includes("speech")) {
    return {
      kind: "audio",
      title: `${row.model} audio`,
      label: "Audio",
      format: "WAV",
      metricLabel: "Duration",
      metricValue:
        row.pipeline === "audio-to-text" ? "12.4s source" : "2.1s output",
      source,
    };
  }

  if (
    pipeline === "language" ||
    pipeline === "llm" ||
    pipeline.includes("text")
  ) {
    const text = readText(payload.response) ?? JSON.stringify(payload.response);
    return {
      kind: "text",
      title: `${row.model} response`,
      label: "Text",
      format: "TXT",
      metricLabel: "Length",
      metricValue: readTokenCount(payload.response),
      source,
      text,
    };
  }

  return {
    kind: "json",
    title: `${row.model} response`,
    label: "Data",
    format: "JSON",
    metricLabel: "Result",
    metricValue: STATUS_LABEL[row.status],
    source,
    json: payload.response,
  };
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] items-start gap-4 border-b border-hairline py-3 text-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-fg">{children}</dd>
    </div>
  );
}

function CapabilityChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-[5px] bg-foreground/5 px-2 py-0.5 text-sm text-fg">
      <span className="truncate">{children}</span>
    </span>
  );
}

function ImagePreview({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
        Preview unavailable
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full object-contain object-top lg:object-center"
    />
  );
}

function VideoPreview({ poster }: { poster?: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {poster && (
        <img
          src={poster}
          alt=""
          decoding="async"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm"
        />
      )}
      <div className="absolute inset-0 bg-background/80" />
      <div className="absolute inset-x-5 bottom-5 text-white/80">
        <div className="flex items-center gap-3 text-sm">
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          <span>0:00</span>
          <div className="ml-auto flex items-center gap-5 text-white/45">
            <VolumeX className="h-4 w-4" aria-hidden="true" />
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-[8%] rounded-full bg-white/65" />
        </div>
      </div>
    </div>
  );
}

function AudioPreview() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-5 rounded-[6px] bg-black/20 px-8 py-7">
      <div className="flex h-28 items-center gap-1.5">
        {AUDIO_BARS.map((height, i) => (
          <span
            key={i}
            className="w-1 flex-1 rounded-full bg-white/45"
            style={{ height }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="flex items-center gap-3 text-sm text-white/70">
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        <span>0:00</span>
        <div className="h-1 flex-1 rounded-full bg-white/15" />
      </div>
    </div>
  );
}

function TextPreview({ text }: { text: string }) {
  return (
    <pre className="max-h-full w-full max-w-3xl overflow-auto whitespace-pre-wrap rounded-[6px] bg-black/20 p-6 text-left text-sm leading-6 text-white/75">
      {text}
    </pre>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-full w-full max-w-3xl overflow-auto whitespace-pre-wrap rounded-[6px] bg-black/20 p-6 text-left font-mono text-xs leading-6 text-white/70">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function MediaStage({ media }: { media: MediaSpec }) {
  return (
    <div className="relative flex aspect-video w-full min-h-0 min-w-0 items-start justify-center overflow-auto bg-background lg:aspect-auto lg:h-full lg:items-center">
      {media.kind === "image" && media.imageUrl && (
        <ImagePreview src={media.imageUrl} title={media.title} />
      )}
      {media.kind === "video" && <VideoPreview poster={media.imageUrl} />}
      {media.kind === "audio" && <AudioPreview />}
      {media.kind === "text" && <TextPreview text={media.text ?? ""} />}
      {media.kind === "json" && <JsonPreview value={media.json} />}
    </div>
  );
}

function canScrollWithin(target: EventTarget, deltaY: number): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const scrollTarget = target.closest<HTMLElement>("[data-detail-scroll]");
  if (!scrollTarget) return false;
  if (scrollTarget.scrollHeight <= scrollTarget.clientHeight) return false;

  if (deltaY > 0) {
    return (
      scrollTarget.scrollTop + scrollTarget.clientHeight <
      scrollTarget.scrollHeight - 1
    );
  }

  return scrollTarget.scrollTop > 0;
}

function HistoryEntryRail({
  rows,
  activeId,
  onSelect,
}: {
  rows: AccountActivityRow[];
  activeId: string;
  onSelect?: (row: AccountActivityRow) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId, rows.length]);

  if (!onSelect || rows.length <= 1) return null;

  return (
    <aside
      className="hidden h-full w-10 shrink-0 overflow-y-auto py-1 lg:block"
      aria-label="History entries"
    >
      <div className="flex min-h-full flex-col items-end gap-px">
        {rows.map((entry, index) => {
          const active = entry.id === activeId;
          return (
            <button
              key={entry.id}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(entry)}
              aria-label={`Open history entry ${index + 1}`}
              aria-current={active ? "true" : undefined}
              title={`${entry.model} ${entry.costDisplay}`}
              className="group grid h-3 w-9 shrink-0 place-items-center justify-items-end rounded-[3px] focus:outline-none"
            >
              <span
                className={`h-0.5 rounded-full transition-all ${
                  active
                    ? "w-7 bg-white"
                    : "w-5 bg-white/40 group-hover:w-6 group-hover:bg-white/70"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default function CallDetailDrawer({
  row,
  rows = [],
  open,
  onClose,
  onSelectRow,
}: {
  row: AccountActivityRow | null;
  rows?: AccountActivityRow[];
  open: boolean;
  onClose: () => void;
  onSelectRow?: (row: AccountActivityRow) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const wheelDeltaRef = useRef(0);
  const lastWheelNavigationRef = useRef(0);
  const media = row ? mediaSpecForRow(row) : null;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      previousActiveRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    } else if (previousActiveRef.current) {
      previousActiveRef.current.focus?.({ preventScroll: true });
      previousActiveRef.current = null;
    }
  }, [open]);

  const selectAdjacentRow = useCallback(
    (offset: number) => {
      if (!row || !onSelectRow || rows.length <= 1) return;
      const currentIndex = rows.findIndex((entry) => entry.id === row.id);
      if (currentIndex === -1) return;

      const nextIndex = Math.max(
        0,
        Math.min(rows.length - 1, currentIndex + offset)
      );
      if (nextIndex === currentIndex) return;

      const nextRow = rows[nextIndex];
      if (nextRow) onSelectRow(nextRow);
    },
    [onSelectRow, row, rows]
  );

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (
      !onSelectRow ||
      rows.length <= 1 ||
      window.matchMedia("(max-width: 1023px)").matches ||
      canScrollWithin(event.target, event.deltaY)
    ) {
      return;
    }

    event.preventDefault();
    wheelDeltaRef.current += event.deltaY;
    if (Math.abs(wheelDeltaRef.current) < 28) return;

    const now = performance.now();
    if (now - lastWheelNavigationRef.current < 90) return;

    lastWheelNavigationRef.current = now;
    selectAdjacentRow(wheelDeltaRef.current > 0 ? 1 : -1);
    wheelDeltaRef.current = 0;
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black p-3 pt-14 transition-opacity duration-200 sm:p-6 sm:pt-16 ${
        open ? "visible opacity-100" : "invisible opacity-0"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close detail"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute left-1/2 top-3 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:top-4"
      >
        <span aria-hidden="true">&larr;</span>
        Return to dashboard
      </button>

      {row && media && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${row.model} detail`}
          tabIndex={-1}
          onWheel={handleWheel}
          className={`relative z-10 flex max-h-[calc(100dvh-68px)] w-[min(1240px,calc(100vw-32px))] items-stretch gap-3 overflow-y-auto outline-none transition-[opacity,transform] duration-200 ease-out sm:max-h-[calc(100dvh-96px)] lg:h-[calc(100dvh-96px)] lg:max-h-[760px] lg:overflow-visible ${
            open ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
          }`}
        >
          <div className="grid h-auto min-w-0 flex-1 grid-rows-[auto_auto] overflow-hidden rounded-sm bg-background shadow-2xl shadow-black/55 lg:h-full lg:grid-cols-[minmax(0,1fr)_350px] lg:grid-rows-none">
            <MediaStage media={media} />

            <aside className="flex min-h-0 flex-col border-t border-hairline bg-background lg:border-l lg:border-t-0">
              <dl className="min-h-0 overflow-y-auto px-5 py-5" data-detail-scroll>
                <DetailRow label="Capability">
                  <CapabilityChip>{row.model}</CapabilityChip>
                </DetailRow>
                <DetailRow label="Modality">
                  <CapabilityChip>{modalityTag(row.pipeline)}</CapabilityChip>
                </DetailRow>
                <DetailRow label="Format">{media.format}</DetailRow>
                <DetailRow label={media.metricLabel}>
                  {media.metricValue}
                </DetailRow>
                <DetailRow label="Source">{media.source}</DetailRow>
                <DetailRow label="Status">{STATUS_LABEL[row.status]}</DetailRow>
                <DetailRow label={row.kind === "live" ? "Duration" : "Latency"}>
                  {formatCallMetric(row)}
                </DetailRow>
                <DetailRow label="Cost">{row.costDisplay}</DetailRow>
                <DetailRow label="Time">
                  {formatTimestamp(row.timestamp)}
                </DetailRow>
              </dl>
            </aside>
          </div>
          <HistoryEntryRail
            rows={rows}
            activeId={row.id}
            onSelect={onSelectRow}
          />
        </div>
      )}
    </div>,
    document.body
  );
}
