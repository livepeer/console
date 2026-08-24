import type { App } from "@/lib/console/types";

export function buildOpenAIChatPayload(
  model: App,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const prompt =
    typeof values.prompt === "string" && values.prompt.trim()
      ? values.prompt.trim()
      : typeof values.messages !== "undefined"
        ? values.messages
        : "Hello, how are you?";

  const messages = Array.isArray(prompt)
    ? prompt
    : [{ role: "user", content: String(prompt) }];

  const payload: Record<string, unknown> = {
    model: model.id,
    messages,
  };

  if (values.temperature !== undefined && values.temperature !== "") {
    payload.temperature = Number(values.temperature);
  }
  if (values.max_tokens !== undefined && values.max_tokens !== "") {
    payload.max_tokens = Number(values.max_tokens);
  }
  if (values.stream === true) {
    payload.stream = true;
  }

  return payload;
}

/** Build the JSON body for a live-runner playground call. */
export function buildLiveRunnerPayload(
  model: App,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const runnerPath = model.playgroundConfig?.runnerPath?.trim();
  if (!runnerPath) {
    return buildOpenAIChatPayload(model, values);
  }

  // Hello-world and other form-backed runners: send field values as JSON.
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    payload[key] = value;
  }
  if (runnerPath === "hello" && typeof payload.name !== "string") {
    payload.name = "world";
  }
  return payload;
}

export function extractRunnerResultText(data: unknown): string {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return JSON.stringify(data, null, 2);
  }
  const record = data as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  return extractAssistantText(data);
}

export function extractAssistantText(data: unknown): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return typeof data === "string" ? data : JSON.stringify(data, null, 2);
  }
  const record = data as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return JSON.stringify(data, null, 2);
  }
  const first = choices[0];
  if (!first || typeof first !== "object") {
    return JSON.stringify(data, null, 2);
  }
  const message = (first as Record<string, unknown>).message;
  if (message && typeof message === "object" && !Array.isArray(message)) {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === "string") return content;
  }
  const text = (first as Record<string, unknown>).text;
  if (typeof text === "string") return text;
  return JSON.stringify(data, null, 2);
}

export function parseSseAssistantText(chunk: string, prior: string): string {
  const lines = chunk.split("\n");
  let output = prior;
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      const choices = parsed.choices;
      if (!Array.isArray(choices) || choices.length === 0) continue;
      const delta = (choices[0] as Record<string, unknown>).delta;
      if (delta && typeof delta === "object" && !Array.isArray(delta)) {
        const content = (delta as Record<string, unknown>).content;
        if (typeof content === "string") output += content;
      }
    } catch {
      // ignore malformed SSE lines
    }
  }
  return output;
}

export function runnerGatewayPostUrl(
  gatewayBaseUrl: string,
  runnerAppId: string,
  path = "chat/completions",
): string {
  const base = gatewayBaseUrl.replace(/\/+$/, "");
  const tail = path.replace(/^\/+/, "");
  const params = new URLSearchParams({ app: runnerAppId });
  return `${base}/${tail}?${params.toString()}`;
}
