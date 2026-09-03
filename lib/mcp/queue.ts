/**
 * Fal queue receipts: detect, refuse to treat control URLs as media, and poll
 * status_url when the runner returned IN_QUEUE instead of a completed body.
 *
 * Vercel isolates cannot hold job state across MCP calls, so run_capability
 * must settle the queue in the same request.
 */

const QUEUE_STATES = new Set(["IN_QUEUE", "IN_PROGRESS", "QUEUED"]);
const TERMINAL_FAIL_STATES = new Set([
  "FAILED",
  "ERROR",
  "CANCELLED",
  "CANCELED",
]);
const QUEUE_URL_KEYS = new Set([
  "status_url",
  "response_url",
  "cancel_url",
  "logs_url",
]);

export type QueueHandle = {
  requestId: string | null;
  status: string | null;
  statusUrl: string | null;
  responseUrl: string | null;
};

export type QueueProgress = {
  status: string;
  elapsedMs: number;
  requestId: string | null;
  statusUrl: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringProp(rec: Record<string, unknown>, key: string): string | null {
  const value = rec[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isQueueControlUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "queue.fal.run" || host.endsWith(".queue.fal.run"))
      return true;
    return /\/requests\/[^/]+\/(status|cancel)\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isQueueControlKey(key: string): boolean {
  return QUEUE_URL_KEYS.has(key);
}

function handleFrom(rec: Record<string, unknown>): QueueHandle {
  return {
    requestId: stringProp(rec, "request_id"),
    status: stringProp(rec, "status"),
    statusUrl: stringProp(rec, "status_url"),
    responseUrl: stringProp(rec, "response_url"),
  };
}

function looksQueued(handle: QueueHandle): boolean {
  if (handle.status && QUEUE_STATES.has(handle.status)) return true;
  if (handle.status && TERMINAL_FAIL_STATES.has(handle.status)) return true;
  return Boolean(handle.statusUrl || handle.responseUrl);
}

export function extractQueueHandle(data: unknown): QueueHandle | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const top = handleFrom(rec);
  const nested = asRecord(rec.output);
  const merged: QueueHandle = {
    requestId: top.requestId ?? (nested ? handleFrom(nested).requestId : null),
    status: top.status ?? (nested ? handleFrom(nested).status : null),
    statusUrl: top.statusUrl ?? (nested ? handleFrom(nested).statusUrl : null),
    responseUrl:
      top.responseUrl ?? (nested ? handleFrom(nested).responseUrl : null),
  };
  return looksQueued(merged) ? merged : null;
}

function deriveResponseUrl(handle: QueueHandle): string | null {
  if (handle.responseUrl) return handle.responseUrl;
  if (!handle.statusUrl) return null;
  try {
    const parsed = new URL(handle.statusUrl);
    parsed.pathname = parsed.pathname.replace(/\/status\/?$/i, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getJson(
  url: string,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error(`queue poll unauthorized (${res.status})`), {
      status: res.status,
    });
  }
  if (!res.ok) {
    throw new Error(
      `queue poll HTTP ${res.status} from ${url}: ${text.slice(0, 300)}`
    );
  }
  const parsed: unknown = text ? JSON.parse(text) : null;
  const rec = asRecord(parsed);
  if (!rec) throw new Error("queue poll response was not a JSON object");
  return rec;
}

function attachResult(
  original: Record<string, unknown>,
  result: Record<string, unknown>
): Record<string, unknown> {
  if (
    "output" in original ||
    "endpoint_id" in original ||
    "schema_sha256" in original
  ) {
    return { ...original, output: result };
  }
  return result;
}

/**
 * Poll a fal queue receipt until COMPLETED (or timeout / 401).
 * Returns the original body when there is nothing to poll.
 */
export async function awaitQueuedResult(
  data: Record<string, unknown>,
  options: {
    timeoutMs: number;
    pollIntervalMs?: number;
    onProgress?: (info: QueueProgress) => void | Promise<void>;
  }
): Promise<Record<string, unknown>> {
  const handle = extractQueueHandle(data);
  if (!handle?.statusUrl && !handle?.responseUrl) return data;

  const started = Date.now();
  const deadline = started + Math.max(0, options.timeoutMs);
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;

  const report = async (status: string) => {
    if (!options.onProgress) return;
    await options.onProgress({
      status,
      elapsedMs: Date.now() - started,
      requestId: handle.requestId,
      statusUrl: handle.statusUrl,
    });
  };

  let lastStatus = handle.status ?? "IN_QUEUE";
  await report(lastStatus);

  try {
    if (handle.statusUrl) {
      while (remainingMs(deadline) > 0) {
        const statusBody = await getJson(
          handle.statusUrl,
          Math.min(30_000, remainingMs(deadline) || 1)
        );
        lastStatus = stringProp(statusBody, "status") ?? lastStatus;
        await report(lastStatus);
        if (lastStatus === "COMPLETED") {
          if (statusBody.error) {
            throw new Error(
              `queued job completed with an error (request_id=${handle.requestId ?? "unknown"})`
            );
          }
          break;
        }
        if (TERMINAL_FAIL_STATES.has(lastStatus)) {
          throw new Error(
            `queued job ${lastStatus.toLowerCase()} (request_id=${handle.requestId ?? "unknown"})`
          );
        }
        const wait = Math.min(pollIntervalMs, remainingMs(deadline));
        if (wait <= 0) break;
        await sleep(wait);
      }
      if (lastStatus !== "COMPLETED") return data;
    }

    const resultUrl = deriveResponseUrl(handle);
    if (!resultUrl || remainingMs(deadline) <= 0) return data;
    const result = await getJson(
      resultUrl,
      Math.min(30_000, remainingMs(deadline) || 1)
    );
    return attachResult(data, result);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) return data;
    if (err instanceof Error && err.message.startsWith("queued job")) throw err;
    return data;
  }
}
