import type { App } from "@/lib/dashboard/types";

const DEFAULT_GATEWAY_BASE = "https://gateway.livepeer.org/v1";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Gateway base URL for snippets and docs (never a bare capability id). */
export function getModelApiBaseUrl(model: App): string {
  const candidate = model.apiEndpoint?.trim();
  if (candidate && isHttpUrl(candidate)) {
    return candidate.replace(/\/$/, "");
  }
  return DEFAULT_GATEWAY_BASE;
}

/** POST target for the model's inference API. */
export function getModelApiPostUrl(model: App): string {
  const base = getModelApiBaseUrl(model);
  if (model.category === "Language") {
    return `${base}/chat/completions`;
  }
  const pipeline = encodeURIComponent(model.id);
  return `${base}/${pipeline}`;
}

/** Host header value for raw HTTP examples. */
export function getModelApiHost(model: App): string {
  return new URL(getModelApiBaseUrl(model)).host;
}
