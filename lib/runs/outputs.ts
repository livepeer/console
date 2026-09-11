import { isQueueControlUrl } from "@pymthouse/gateway-web";

export type CapturedOutput = {
  url: string;
  availableUntil?: string;
  expiresAt?: string;
  mediaKind: "image" | "video" | "audio" | "model" | "unknown";
};

/** Only documented media fields, never prompt URLs or arbitrary nested links. */
export function extractRunOutputs(result: unknown): CapturedOutput[] {
  const outputs = new Map<string, CapturedOutput>();
  const add = (value: unknown, mediaKind: CapturedOutput["mediaKind"]) => {
    const url =
      typeof value === "string"
        ? value
        : value && typeof value === "object"
          ? (value as Record<string, unknown>).url
          : null;
    if (typeof url !== "string" || isQueueControlUrl(url)) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password)
        return;
      // URLs with credentials are not durable public media references.
      if (
        [...parsed.searchParams.keys()].some((key) =>
          /token|signature|credential|api.?key|^sig$|^x-amz-|^x-goog-/i.test(
            key
          )
        )
      )
        return;
      const row =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : {};
      const timestamp = (raw: unknown): string | undefined =>
        typeof raw === "string" &&
        /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) &&
        Number.isFinite(Date.parse(raw))
          ? new Date(raw).toISOString()
          : undefined;
      const availableUntil = timestamp(
        row.availableUntil ?? row.available_until
      );
      const expiresAt = timestamp(row.expiresAt ?? row.expires_at);
      const previous = outputs.get(url);
      outputs.set(url, {
        ...previous,
        url,
        mediaKind: previous?.mediaKind ?? mediaKind,
        ...(availableUntil ? { availableUntil } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });
    } catch {
      /* Not a public asset URL. */
    }
  };
  const visit = (value: unknown, depth: number) => {
    if (depth > 4 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const row = value as Record<string, unknown>;
    for (const [key, kind] of [
      ["model", "model"],
      ["model_url", "model"],
      ["modelUrl", "model"],
      ["model_mesh", "model"],
      ["preview_image", "image"],
      ["previewImage", "image"],
      ["image", "image"],
      ["imageUrl", "image"],
      ["image_url", "image"],
      ["video", "video"],
      ["videoUrl", "video"],
      ["video_url", "video"],
      ["audio", "audio"],
      ["audioUrl", "audio"],
      ["audio_url", "audio"],
    ] as const)
      add(
        typeof row[key] === "string" ? { ...row, url: row[key] } : row[key],
        kind
      );
    if (row.url) add(row, "unknown");
    for (const [key, kind] of [
      ["textures", "image"],
      ["images", "image"],
      ["image_urls", "image"],
      ["videos", "video"],
      ["video_urls", "video"],
      ["audios", "audio"],
      ["audio_urls", "audio"],
    ] as const) {
      if (Array.isArray(row[key])) for (const item of row[key]) add(item, kind);
    }
    for (const key of ["data", "output", "result"]) visit(row[key], depth + 1);
  };
  visit(result, 0);
  return [...outputs.values()];
}
