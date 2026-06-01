"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play, Square, Video } from "lucide-react";
import { BrowserGatewayClient } from "@pymthouse/builder-sdk/gateway/client";
import { useUserSession } from "@/components/dashboard/UserSessionContext";
import type { Model } from "@/lib/dashboard/types";
import StatusDot from "@/components/dashboard/StatusDot";
import {
  DEFAULT_TRICKLE_MIME_TYPE,
  MpegTsPlayer,
  MpegTsPublisher,
} from "@/lib/dashboard/playground/trickle-mpegts";
import {
  AsyncSemaphore,
  InputFrameCapture,
} from "@/lib/dashboard/playground/stream-capture";

type StreamStatus = "idle" | "connecting" | "live" | "error";

type ConnectPhase =
  | "signing"
  | "discovery"
  | "session"
  | "starting_loops";

const TEST_PATTERN_FPS = 15;
const TEST_WIDTH = 320;
const TEST_HEIGHT = 180;
const PUBLISH_UPLOAD_CONCURRENCY = 1;
const FRAMES_PUBLISHED_UI_INTERVAL_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Yield until React has committed the latest state (refs populated). */
function afterReactCommit(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function phaseLabel(phase: ConnectPhase | null): string {
  switch (phase) {
    case "signing":
      return "Minting signing credentials…";
    case "discovery":
      return "Discovering orchestrators and negotiating job…";
    case "session":
      return "Opening gateway session…";
    case "starting_loops":
      return "Starting frame relay…";
    default:
      return "Connecting…";
  }
}

export default function LiveStreamPlayground({ model }: { model: Model }) {
  const {
    signing: signerState,
    ensureSigningAccessToken: ensureAccessToken,
    refreshSigningToken: refresh,
  } = useUserSession();
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [connectPhase, setConnectPhase] = useState<ConnectPhase | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);
  const [framesPublished, setFramesPublished] = useState(0);
  const [outputSegmentSeq, setOutputSegmentSeq] = useState<number | null>(null);

  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const publishCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<InstanceType<typeof BrowserGatewayClient> | null>(null);
  const mpegTsPublisherRef = useRef<MpegTsPublisher | null>(null);
  const mpegTsPlayerRef = useRef<MpegTsPlayer | null>(null);
  const inputCaptureRef = useRef<InputFrameCapture | null>(null);
  const publishUploadRef = useRef(new AsyncSemaphore(PUBLISH_UPLOAD_CONCURRENCY));
  const publishSeqRef = useRef(-1);
  const framesPublishedCountRef = useRef(0);
  const lastPublishUiMsRef = useRef(0);
  const lastOutputSegmentSeqRef = useRef<number | null>(null);
  const lastOutputSegmentBytesRef = useRef(0);
  const publishActiveRef = useRef(false);
  const subscribeActiveRef = useRef(false);
  const segmentContentTypeRef = useRef(DEFAULT_TRICKLE_MIME_TYPE);
  const streamGenerationRef = useRef(0);
  const pendingOutputAttachRef = useRef(false);
  const resetStreamResourcesRef = useRef<() => Promise<void>>(async () => undefined);
  const [outputSurfaceKey, setOutputSurfaceKey] = useState(0);

  const stopLoops = useCallback(() => {
    publishActiveRef.current = false;
    subscribeActiveRef.current = false;
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (sourceVideoRef.current) {
      sourceVideoRef.current.srcObject = null;
    }
  }, []);

  /** Tear down gateway + encode/play pipeline; optionally keep the camera open. */
  const resetGatewaySession = useCallback(
    async (preserveCamera: boolean) => {
      streamGenerationRef.current += 1;
      pendingOutputAttachRef.current = false;
      stopLoops();
      if (!preserveCamera) {
        stopCamera();
      }
      await mpegTsPublisherRef.current?.stop().catch(() => undefined);
      mpegTsPublisherRef.current = null;
      mpegTsPlayerRef.current?.destroy();
      mpegTsPlayerRef.current = null;
      await clientRef.current?.stop().catch(() => undefined);
      clientRef.current = null;
      setSessionLabel(null);
      framesPublishedCountRef.current = 0;
      lastPublishUiMsRef.current = 0;
      lastOutputSegmentSeqRef.current = null;
      lastOutputSegmentBytesRef.current = 0;
      publishSeqRef.current = -1;
      setOutputSegmentSeq(null);
      setFramesPublished(0);
      setConnectPhase(null);
    },
    [stopCamera, stopLoops],
  );

  const resetStreamResources = useCallback(async () => {
    inputCaptureRef.current?.stop();
    await resetGatewaySession(false);
  }, [resetGatewaySession]);

  resetStreamResourcesRef.current = resetStreamResources;

  const tryAttachOutputPlayer = useCallback(() => {
    if (!pendingOutputAttachRef.current) {
      return false;
    }
    const video = outputVideoRef.current;
    const player = mpegTsPlayerRef.current;
    if (!video || !player) {
      return false;
    }
    pendingOutputAttachRef.current = false;
    return player.attach(video);
  }, []);

  const bindOutputVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      outputVideoRef.current = node;
      if (node) {
        tryAttachOutputPlayer();
      }
    },
    [tryAttachOutputPlayer],
  );

  const publishFrame = useCallback(() => {
    const client = clientRef.current;
    const publisher = mpegTsPublisherRef.current;
    const publishCanvas = publishCanvasRef.current;
    const inputCanvas = inputCanvasRef.current;
    if (!client || !publisher || !publishCanvas || !inputCanvas) {
      return;
    }

    const ctx = publishCanvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return;
    }

    ctx.drawImage(inputCanvas, 0, 0, publishCanvas.width, publishCanvas.height);
    publisher.encode(publishCanvas);

    framesPublishedCountRef.current += 1;
    const now = performance.now();
    if (now - lastPublishUiMsRef.current >= FRAMES_PUBLISHED_UI_INTERVAL_MS) {
      lastPublishUiMsRef.current = now;
      setFramesPublished(framesPublishedCountRef.current);
    }
  }, []);

  const startInputCapture = useCallback(() => {
    const canvas = inputCanvasRef.current;
    if (!canvas) {
      return;
    }
    inputCaptureRef.current?.stop();
    const capture = new InputFrameCapture();
    inputCaptureRef.current = capture;
    capture.start({
      canvas,
      sourceVideo: sourceVideoRef.current,
      getMediaStream: () => streamRef.current,
      fps: TEST_PATTERN_FPS,
      onSample: () => {
        if (publishActiveRef.current) {
          publishFrame();
        }
      },
    });
  }, [publishFrame]);

  const stopAll = useCallback(async () => {
    await resetStreamResources();
    setErrorMsg(null);
    setStatus("idle");
    startInputCapture();
  }, [resetStreamResources, startInputCapture]);

  const failStream = useCallback(
    async (err: unknown) => {
      await resetGatewaySession(true);
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to start stream");
      startInputCapture();
    },
    [resetGatewaySession, startInputCapture],
  );

  useEffect(() => {
    startInputCapture();
    return () => {
      inputCaptureRef.current?.stop();
      void resetStreamResourcesRef.current();
    };
  }, [startInputCapture]);

  useLayoutEffect(() => {
    if (status === "live") {
      tryAttachOutputPlayer();
    }
  }, [status, outputSurfaceKey, tryAttachOutputPlayer]);

  const gatewayModelId = model.gatewayModelId ?? model.id;

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices) {
      setErrorMsg("Camera API not available");
      setStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: TEST_WIDTH }, height: { ideal: TEST_HEIGHT } },
        audio: false,
      });
      streamRef.current = stream;
      if (sourceVideoRef.current) {
        sourceVideoRef.current.srcObject = stream;
        await sourceVideoRef.current.play().catch(() => undefined);
      }
      startInputCapture();
      if (status === "error") {
        setStatus("idle");
        setErrorMsg(null);
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Camera denied");
    }
  }, [startInputCapture, status]);

  const subscribeLoop = useCallback(async () => {
    const client = clientRef.current;
    const player = mpegTsPlayerRef.current;
    if (!client || !player || !subscribeActiveRef.current) {
      return;
    }

    try {
      const segment = await client.subscribeOutputSegmentStream((chunk: Uint8Array) => {
        player.pushChunk(chunk);
      });
      if (!segment || !subscribeActiveRef.current) {
        await sleep(200);
        if (subscribeActiveRef.current) {
          void subscribeLoop();
        }
        return;
      }

      const lastSeq = lastOutputSegmentSeqRef.current;
      const lastBytes = lastOutputSegmentBytesRef.current;
      const segmentBytes = segment.byteCount;
      const isOlderSegment = segment.segmentSeq < (lastSeq ?? -1);
      const isExactDuplicate = segment.segmentSeq === lastSeq && segmentBytes <= lastBytes;

      if (isOlderSegment || isExactDuplicate) {
        await sleep(80);
        if (subscribeActiveRef.current) {
          void subscribeLoop();
        }
        return;
      }
      lastOutputSegmentSeqRef.current = segment.segmentSeq;
      lastOutputSegmentBytesRef.current = segmentBytes;
      setOutputSegmentSeq(segment.segmentSeq);
      player.flushSegment();
      if (subscribeActiveRef.current) {
        void subscribeLoop();
      }
    } catch {
      if (subscribeActiveRef.current) {
        await sleep(500);
        if (subscribeActiveRef.current) {
          void subscribeLoop();
        }
      }
    }
  }, []);

  const startStream = useCallback(async () => {
    setStatus("connecting");
    setErrorMsg(null);
    framesPublishedCountRef.current = 0;
    lastPublishUiMsRef.current = 0;
    lastOutputSegmentSeqRef.current = null;
    lastOutputSegmentBytesRef.current = 0;
    publishSeqRef.current = -1;
    setOutputSegmentSeq(null);
    setFramesPublished(0);
    stopLoops();
    await resetGatewaySession(true);

    const generation = streamGenerationRef.current;

    try {
      setConnectPhase("signing");
      const bearer = await ensureAccessToken();
      if (streamGenerationRef.current !== generation) {
        return;
      }

      setConnectPhase("discovery");
      const origin = window.location.origin;
      const client = new BrowserGatewayClient({ baseUrl: origin });
      client.setSignerToken(bearer);

      setConnectPhase("session");
      const session = await client.startSession({ modelId: gatewayModelId });
      if (streamGenerationRef.current !== generation) {
        await client.stop().catch(() => undefined);
        return;
      }

      clientRef.current = client;
      setSessionLabel(`${session.sessionId.slice(0, 8)}…`);
      segmentContentTypeRef.current = session.mimeType ?? DEFAULT_TRICKLE_MIME_TYPE;
      publishSeqRef.current = Math.max(-1, (session.publishSeq ?? 0) - 1);

      const uploadGate = publishUploadRef.current;
      const publisher = new MpegTsPublisher((chunk) => {
        if (streamGenerationRef.current !== generation) {
          return;
        }
        const nextPublishSeq = publishSeqRef.current + 1;
        publishSeqRef.current = nextPublishSeq;
        void uploadGate
          .run(() =>
            client.publishSegment(chunk, {
              seq: nextPublishSeq,
              contentType: segmentContentTypeRef.current,
            }),
          )
          .catch(() => undefined);
      }, TEST_PATTERN_FPS);
      await publisher.start(TEST_WIDTH, TEST_HEIGHT);
      if (streamGenerationRef.current !== generation) {
        await publisher.stop().catch(() => undefined);
        await client.stop().catch(() => undefined);
        return;
      }
      mpegTsPublisherRef.current = publisher;

      const player = new MpegTsPlayer();
      mpegTsPlayerRef.current = player;
      pendingOutputAttachRef.current = true;

      setConnectPhase("starting_loops");
      setOutputSurfaceKey((key) => key + 1);
      setStatus("live");

      await afterReactCommit();
      if (streamGenerationRef.current !== generation) {
        return;
      }
      tryAttachOutputPlayer();
      await player.waitUntilReady(12_000);
      if (streamGenerationRef.current !== generation) {
        return;
      }

      setConnectPhase(null);
      publishActiveRef.current = true;
      subscribeActiveRef.current = true;
      startInputCapture();
      void subscribeLoop();
    } catch (err) {
      if (streamGenerationRef.current === generation) {
        await failStream(err);
      }
    }
  }, [
    ensureAccessToken,
    failStream,
    gatewayModelId,
    resetGatewaySession,
    startInputCapture,
    stopLoops,
    subscribeLoop,
    tryAttachOutputPlayer,
  ]);

  const signingReady = signerState.status === "ready";
  const signingLoading = signerState.status === "loading";
  const canStart = signingReady && status !== "connecting";

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-muted">
        Stream to an orchestrator through the dashboard gateway relay. Frames are muxed to
        MPEG-TS (<span className="font-mono">video/mp2t</span>) like{" "}
        <span className="font-mono">write_frames.py</span>. A short-lived signing token is
        minted automatically for your account.
      </p>

      <div className="rounded-lg border border-subtle bg-zebra px-3 py-2.5 text-sm">
        {signingLoading && <p className="text-fg-muted">Preparing signing token…</p>}
        {signingReady && status !== "connecting" && status !== "live" && (
          <p className="flex flex-wrap items-center gap-2 text-fg-muted">
            <StatusDot tone="green" />
            <span>
              Signing token ready
              <span className="font-mono text-[11px] text-fg-faint">
                {" "}
                · refreshes before expiry
              </span>
            </span>
          </p>
        )}
        {status === "connecting" && (
          <p className="text-fg-muted">{phaseLabel(connectPhase)}</p>
        )}
        {signerState.status === "missing_user" && (
          <p className="text-fg-muted">Sign in to mint a signing token for streaming.</p>
        )}
        {signerState.status === "error" && status !== "live" && (
          <p className="text-red">
            {signerState.message}{" "}
            <button
              type="button"
              className="underline decoration-dotted underline-offset-2"
              onClick={() => void refresh()}
            >
              Retry
            </button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-fg-faint">Input</h3>
            {status === "live" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-subtle px-2 py-0.5 text-[11px] font-medium text-warm">
                <StatusDot tone="warm" />
                Streaming
                {framesPublished > 0 && (
                  <span className="font-mono text-fg-faint">· {framesPublished} encoded</span>
                )}
              </span>
            )}
          </div>
          <div className="relative aspect-video overflow-hidden rounded-lg border border-hairline bg-black">
            <canvas
              ref={inputCanvasRef}
              width={TEST_WIDTH}
              height={TEST_HEIGHT}
              className="h-full w-full object-contain"
            />
            <video
              ref={sourceVideoRef}
              autoPlay
              playsInline
              muted
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              aria-hidden
            />
            <canvas ref={publishCanvasRef} width={TEST_WIDTH} height={TEST_HEIGHT} className="hidden" />
          </div>
          <p className="mt-2 text-[11px] text-fg-faint">
            Test pattern frames cycle automatically. Optional camera overrides the pattern
            when streaming.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={status === "connecting"}
              className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              <Video className="h-3.5 w-3.5" />
              Camera
            </button>
            {status === "live" ? (
              <button
                type="button"
                onClick={() => void stopAll()}
                className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startStream()}
                disabled={!canStart}
                className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {status === "connecting" ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-strong border-t-white" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Start stream
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-fg-faint">Output</h3>
            <div className="flex flex-wrap items-center gap-2">
              {sessionLabel && (
                <span className="font-mono text-[11px] text-fg-faint">session {sessionLabel}</span>
              )}
              {outputSegmentSeq !== null && (
                <span className="font-mono text-[11px] text-fg-faint">
                  out seg {outputSegmentSeq}
                </span>
              )}
            </div>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-lg border border-hairline bg-black">
            <video
              key={outputSurfaceKey}
              ref={bindOutputVideo}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-contain"
            />
            {status !== "live" && (
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-fg-label">
                {status === "error" && errorMsg
                  ? errorMsg
                  : status === "connecting"
                    ? phaseLabel(connectPhase)
                    : "Orchestrator output (MPEG-TS demuxed) appears here when the stream is live."}
              </div>
            )}
          </div>
        </div>
      </div>

      {status === "error" && errorMsg && (
        <p className="text-sm text-red" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
