/** Browser MPEG-TS mux (publish) and demux-to-MSE (subscribe) for LV2V trickle. */

import { DEFAULT_TRICKLE_MIME_TYPE } from "@pymthouse/builder-sdk/gateway";

export { DEFAULT_TRICKLE_MIME_TYPE };

type JmuxerInstance = {
  feed: (payload: { video: Uint8Array; duration?: number }) => void;
  destroy: () => void;
};

type MuxSegment = {
  initSegment?: Uint8Array;
  data: Uint8Array;
};

type Mp4Transmuxer = {
  on: (event: "data", handler: (segment: MuxSegment) => void) => void;
  push: (chunk: Uint8Array) => void;
  flush: () => void;
};

type MuxJsModule = {
  mp4: { Transmuxer: new () => Mp4Transmuxer };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const MSE_AVC_CODEC_CANDIDATES = [
  'video/mp4; codecs="avc1.42E01E"',
  'video/mp4; codecs="avc1.4d401e"',
  'video/mp4; codecs="avc1.64001E"',
] as const;

const PROGRESSIVE_FLUSH_INTERVAL_MS = 250;
const PROGRESSIVE_FLUSH_MIN_BYTES = 64 * 1024;
const LIVE_EDGE_LAG_SECONDS = 0.75;
const DEFAULT_LIVE_PLAYBACK_RATE = 1;
const MIN_LIVE_PLAYBACK_RATE = 0.25;
const MAX_LIVE_PLAYBACK_RATE = 1;
const LOW_BUFFER_LAG_SECONDS = 0.5;
const TARGET_BUFFER_LAG_SECONDS = 1.6;

function pickMseAvcMimeType(): string {
  if (typeof MediaSource === "undefined") {
    return MSE_AVC_CODEC_CANDIDATES[0];
  }
  for (const mime of MSE_AVC_CODEC_CANDIDATES) {
    if (MediaSource.isTypeSupported(mime)) {
      return mime;
    }
  }
  return MSE_AVC_CODEC_CANDIDATES[0];
}

/** Encode canvas frames to MPEG-TS trickle segments (PyAV / write_frames.py equivalent). */
export class MpegTsPublisher {
  private jmuxer: JmuxerInstance | null = null;
  /** jmuxer requires a video node in the browser even when only using onData. */
  private jmuxerSink: HTMLVideoElement | null = null;
  private encoder: VideoEncoder | null = null;
  private frameCount = 0;
  private timestampUs = 0;
  private segmentChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly onSegment: (chunk: Uint8Array) => void,
    private readonly fps: number,
  ) {}

  async start(
    width: number,
    height: number,
  ): Promise<void> {
    if (typeof VideoEncoder === "undefined") {
      throw new Error("WebCodecs VideoEncoder is not available in this browser");
    }

    const jmuxerModule = await import("jmuxer");
    const JMuxer = jmuxerModule.default as new (options: Record<string, unknown>) => JmuxerInstance;

    const sink = document.createElement("video");
    sink.muted = true;
    sink.playsInline = true;
    sink.setAttribute("aria-hidden", "true");
    sink.style.cssText =
      "position:fixed;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden";
    document.body.appendChild(sink);
    this.jmuxerSink = sink;

    this.jmuxer = new JMuxer({
      node: sink,
      mode: "video",
      flushingTime: 500,
      fps: this.fps,
      clearBuffer: true,
      onData: (data: ArrayBuffer) => {
        const bytes = new Uint8Array(data);
        // Do not await on the hot path — caller should bound network uploads separately.
        void this.onSegment(bytes);
      },
    });

    this.encoder = new VideoEncoder({
      output: (chunk) => {
        const buffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buffer);
        const duration = Math.round(1000 / this.fps);
        this.jmuxer?.feed({ video: buffer, duration });
      },
      error: (err) => {
        throw err;
      },
    });

    this.encoder.configure({
      codec: "avc1.42E01E",
      width,
      height,
      bitrate: 1_000_000,
      framerate: this.fps,
      latencyMode: "realtime",
      avc: { format: "annexb" },
    });
  }

  encode(canvas: HTMLCanvasElement): void {
    if (!this.encoder) {
      return;
    }
    const frame = new VideoFrame(canvas, { timestamp: this.timestampUs });
    this.timestampUs += Math.round(1_000_000 / this.fps);
    const keyFrame = this.frameCount % Math.max(1, Math.round(this.fps * 2)) === 0;
    this.encoder.encode(frame, { keyFrame });
    frame.close();
    this.frameCount += 1;
  }

  async stop(): Promise<void> {
    if (this.encoder) {
      await this.encoder.flush().catch(() => undefined);
      this.encoder.close();
      this.encoder = null;
    }
    this.jmuxer?.destroy();
    this.jmuxer = null;
    this.jmuxerSink?.remove();
    this.jmuxerSink = null;
    await this.segmentChain;
  }
}

/** Play MPEG-TS trickle segments on a video element via MSE + mux.js. */
export class MpegTsPlayer {
  private mseMimeType: string = MSE_AVC_CODEC_CANDIDATES[0];
  private video: HTMLVideoElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private transmuxer: Mp4Transmuxer | null = null;
  private appendedInit = false;
  private objectUrl: string | null = null;
  private appendQueue: Array<{ data: Uint8Array; seekToLive: boolean }> = [];
  private pendingSegments: Uint8Array[] = [];
  private appending = false;
  private pendingSeekToLive = false;
  private playbackStarted = false;
  private playbackRateTimer: number | null = null;
  private bytesSinceFlush = 0;
  private lastFlushMs = 0;
  private ready = false;
  private destroyed = false;
  private attached = false;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;
  private readonly readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  /** Resolves when MSE source buffer is ready to accept trickle segments. */
  waitUntilReady(timeoutMs = 12_000): Promise<void> {
    if (this.ready) {
      return Promise.resolve();
    }
    return Promise.race([
      this.readyPromise,
      sleep(timeoutMs).then(() => {
        throw new Error("Output video player did not become ready in time");
      }),
    ]);
  }

  attach(video: HTMLVideoElement | null): boolean {
    if (!video || this.destroyed || this.attached) {
      return false;
    }

    const mseMime = pickMseAvcMimeType();
    if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported(mseMime)) {
      this.failReady(new Error("MediaSource API is not available for MPEG-TS playback"));
      return false;
    }
    this.mseMimeType = mseMime;

    this.video = video;
    this.attached = true;
    this.mediaSource = new MediaSource();
    this.objectUrl = URL.createObjectURL(this.mediaSource);

    try {
      video.muted = true;
      video.playsInline = true;
      video.src = this.objectUrl;
      this.playbackRateTimer = window.setInterval(() => {
        this.updateLivePlaybackRate();
      }, 250);
    } catch (err) {
      this.attached = false;
      this.failReady(err instanceof Error ? err : new Error("Failed to bind output video"));
      return false;
    }

    const onSourceOpen = () => {
      void this.onSourceOpen();
    };

    if (this.mediaSource.readyState === "open") {
      onSourceOpen();
    } else {
      this.mediaSource.addEventListener("sourceopen", onSourceOpen, { once: true });
    }

    return true;
  }

  private failReady(err: Error): void {
    this.readyReject?.(err);
    this.readyResolve = null;
    this.readyReject = null;
  }

  private markReady(): void {
    if (this.ready) {
      return;
    }
    this.ready = true;
    this.readyResolve?.();
    this.readyResolve = null;
    this.readyReject = null;
    for (const segment of this.pendingSegments) {
      this.pushSegment(segment);
    }
    this.pendingSegments = [];
  }

  private async onSourceOpen(): Promise<void> {
    if (this.destroyed || !this.mediaSource) {
      return;
    }

    try {
      const muxjsModule = await import("mux.js");
      if (this.destroyed || !this.mediaSource) {
        return;
      }

      const muxjs = muxjsModule.default as MuxJsModule;
      this.transmuxer = new muxjs.mp4.Transmuxer();
      this.transmuxer.on("data", (segment) => {
        this.enqueueTransmuxedSegment(segment);
      });

      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mseMimeType);
      this.sourceBuffer.mode = "sequence";
      this.sourceBuffer.addEventListener("updateend", () => {
        this.appending = false;
        this.updateLivePlaybackRate();
        if (this.pendingSeekToLive) {
          this.pendingSeekToLive = false;
          this.seekVideoToLiveEdge();
        }
        void this.drainAppendQueue();
      });
      this.markReady();
      void this.drainAppendQueue();
    } catch (err) {
      this.failReady(err instanceof Error ? err : new Error("MPEG-TS demux setup failed"));
    }
  }

  pushSegment(tsBytes: Uint8Array): void {
    if (this.destroyed) {
      return;
    }
    if (!this.pushChunk(tsBytes)) {
      return;
    }
    this.flushSegment();
  }

  /** Feed bytes from an in-flight trickle segment. Call flushSegment() at EOF. */
  pushChunk(tsBytes: Uint8Array): boolean {
    if (this.destroyed) {
      return false;
    }
    if (!this.ready || !this.transmuxer) {
      this.pendingSegments.push(tsBytes);
      if (this.pendingSegments.length > 8) {
        this.pendingSegments.shift();
      }
      return false;
    }
    this.transmuxer.push(tsBytes);
    this.bytesSinceFlush += tsBytes.byteLength;
    this.flushSegmentIfNeeded();
    return true;
  }

  /** Flush mux.js once the current trickle segment response has closed. */
  flushSegment(): void {
    if (this.destroyed || !this.ready || !this.transmuxer) {
      return;
    }
    this.transmuxer.flush();
    this.bytesSinceFlush = 0;
    this.lastFlushMs = Date.now();
  }

  private enqueueTransmuxedSegment(segment: MuxSegment): void {
    let payload: Uint8Array;
    if (segment.initSegment) {
      if (!this.appendedInit) {
        payload = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength);
        payload.set(segment.initSegment, 0);
        payload.set(segment.data, segment.initSegment.byteLength);
        this.appendedInit = true;
      } else {
        payload = segment.data;
      }
    } else {
      payload = segment.data;
    }
    this.enqueueAppend(payload, this.shouldSeekToLiveEdge());
  }

  private flushSegmentIfNeeded(): void {
    const now = Date.now();
    if (
      this.bytesSinceFlush >= PROGRESSIVE_FLUSH_MIN_BYTES ||
      now - this.lastFlushMs >= PROGRESSIVE_FLUSH_INTERVAL_MS
    ) {
      this.flushSegment();
    }
  }

  private shouldSeekToLiveEdge(): boolean {
    const video = this.video;
    if (!video) {
      return false;
    }
    if (!this.playbackStarted || video.paused) {
      this.playbackStarted = true;
      return true;
    }
    if (video.buffered.length === 0) {
      return false;
    }

    const end = video.buffered.end(video.buffered.length - 1);
    if (end - video.currentTime > LIVE_EDGE_LAG_SECONDS) {
      return true;
    }
    return false;
  }

  private seekVideoToLiveEdge(): void {
    const video = this.video;
    if (!video || video.buffered.length === 0) {
      return;
    }
    try {
      const end = video.buffered.end(video.buffered.length - 1);
      if (end > 0.1) {
        video.currentTime = Math.max(0, end - LIVE_EDGE_LAG_SECONDS);
      }
      void video.play().catch(() => undefined);
    } catch {
      // ignore seek failures while buffer is updating
    }
  }

  private enqueueAppend(data: Uint8Array, seekToLive = false): void {
    this.appendQueue.push({ data, seekToLive });
    void this.drainAppendQueue();
  }

  private async drainAppendQueue(): Promise<void> {
    if (this.destroyed || this.appending || !this.sourceBuffer || this.appendQueue.length === 0) {
      return;
    }
    if (this.sourceBuffer.updating) {
      return;
    }

    const next = this.appendQueue.shift();
    if (!next) {
      return;
    }

    this.appending = true;
    try {
      const chunk = new Uint8Array(next.data);
      const buffer = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      );
      if (next.seekToLive) {
        this.pendingSeekToLive = true;
      }
      this.sourceBuffer.appendBuffer(buffer);
    } catch {
      this.appending = false;
    }
  }

  private updateLivePlaybackRate(): void {
    const video = this.video;
    if (!video || video.buffered.length === 0) {
      return;
    }

    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const bufferedLag = bufferedEnd - video.currentTime;

    let playbackRate = DEFAULT_LIVE_PLAYBACK_RATE;
    if (bufferedLag < LOW_BUFFER_LAG_SECONDS) {
      playbackRate = MIN_LIVE_PLAYBACK_RATE;
    } else if (bufferedLag < TARGET_BUFFER_LAG_SECONDS) {
      const lagScale =
        (bufferedLag - LOW_BUFFER_LAG_SECONDS) /
        (TARGET_BUFFER_LAG_SECONDS - LOW_BUFFER_LAG_SECONDS);
      playbackRate =
        MIN_LIVE_PLAYBACK_RATE +
        (MAX_LIVE_PLAYBACK_RATE - MIN_LIVE_PLAYBACK_RATE) * lagScale;
    }
    video.playbackRate = playbackRate;
  }

  destroy(): void {
    this.destroyed = true;
    this.attached = false;
    this.appendQueue = [];
    this.pendingSegments = [];
    this.transmuxer = null;
    this.appendedInit = false;
    this.playbackStarted = false;
    if (this.playbackRateTimer !== null) {
      window.clearInterval(this.playbackRateTimer);
      this.playbackRateTimer = null;
    }
    this.bytesSinceFlush = 0;
    this.lastFlushMs = 0;
    this.sourceBuffer = null;

    const mediaSource = this.mediaSource;
    this.mediaSource = null;
    if (mediaSource && mediaSource.readyState === "open") {
      try {
        mediaSource.endOfStream();
      } catch {
        // ignore
      }
    }

    const video = this.video;
    this.video = null;
    const objectUrl = this.objectUrl;
    this.objectUrl = null;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    if (video) {
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        // ignore
      }
    }

    this.ready = false;
    this.appending = false;
    const reject = this.readyReject;
    this.readyResolve = null;
    this.readyReject = null;
    reject?.(new Error("Output player destroyed"));
  }
}
