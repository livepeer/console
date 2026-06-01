/** rAF-driven input preview + snapshot source (keeps camera off the React render path). */

export type InputFrameCaptureOptions = {
  canvas: HTMLCanvasElement;
  sourceVideo: HTMLVideoElement | null;
  getMediaStream: () => MediaStream | null;
  fps: number;
  /** Called after each painted preview frame (e.g. to drive publish sampling). */
  onSample?: () => void;
};

export class InputFrameCapture {
  private running = false;
  private rafId = 0;
  private lastSampleMs = 0;
  private testFrameIndex = 0;
  private options: InputFrameCaptureOptions | null = null;

  start(options: InputFrameCaptureOptions): void {
    this.stop();
    this.options = options;
    this.running = true;
    this.lastSampleMs = 0;
    this.testFrameIndex = 0;
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.options = null;
  }

  private tick(): void {
    if (!this.running || !this.options) {
      return;
    }

    const { canvas, sourceVideo, getMediaStream, fps, onSample } = this.options;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (ctx) {
      const stream = getMediaStream();
      if (stream && sourceVideo && sourceVideo.readyState >= 2) {
        ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
      } else {
        const color = (this.testFrameIndex * 5) % 255;
        ctx.fillStyle = `rgb(${color}, 0, ${255 - color})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.testFrameIndex += 1;
      }
    }

    const intervalMs = 1000 / fps;
    const now = performance.now();
    if (onSample && now - this.lastSampleMs >= intervalMs) {
      this.lastSampleMs = now;
      onSample();
    }

    this.rafId = requestAnimationFrame(() => this.tick());
  }
}

/** Limits concurrent async work (e.g. trickle PUTs) so encoding is not blocked. */
export class AsyncSemaphore {
  private inFlight = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.inFlight >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.inFlight += 1;
    try {
      return await task();
    } finally {
      this.inFlight -= 1;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}
