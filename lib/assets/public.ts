import { createHmac } from "node:crypto";
import type { JsonValue, RunAsset, RunDetail } from "@/lib/runs/types";

export const ASSET_URL_TTL_SECONDS = 60 * 60;

function signingSecret(): string {
  const configured = process.env.ASSET_URL_SIGNING_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production")
    return "local-asset-signing-secret";
  throw new Error("ASSET_URL_SIGNING_SECRET is required");
}

export function publicOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.MCP_PUBLIC_ORIGIN?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("An application public origin is required");
}

export function assetSignature(
  id: string,
  principalId: string,
  exp: number
): string {
  return createHmac("sha256", signingSecret())
    .update(`${id}\n${principalId}\n${exp}`)
    .digest("base64url");
}

export function publicAssetUrl(
  id: string,
  principalId: string,
  now = Date.now()
): string {
  const exp = Math.floor(now / 1000) + ASSET_URL_TTL_SECONDS;
  const url = new URL(`/api/assets/${encodeURIComponent(id)}`, publicOrigin());
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("sig", assetSignature(id, principalId, exp));
  return url.toString();
}

export function publicAsset(asset: RunAsset, principalId: string): RunAsset {
  return { ...asset, url: publicAssetUrl(asset.id, principalId) };
}

/** Recognize an asset reference only on the configured application origin. */
export function ownedAssetReference(
  value: string,
  assets: Pick<RunAsset, "id" | "url">[]
): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== publicOrigin() || url.username || url.password)
      return null;
    const match = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
    const id = match ? decodeURIComponent(match[1]!) : null;
    return id && assets.some((asset) => asset.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function replaceAssetUrls(
  value: JsonValue,
  assets: Pick<RunAsset, "id" | "url">[],
  principalId: string
): JsonValue {
  return sanitizePublicMedia(value, assets, principalId);
}

/** Media detection deliberately includes URLs rejected by durable capture. */
export function sanitizePublicMedia(
  value: JsonValue,
  assets: Pick<RunAsset, "id" | "url">[],
  principalId: string
): JsonValue {
  const byUrl = new Map(assets.map((asset) => [asset.url, asset.id]));
  const mediaKey = (key: string) =>
    /(?:image|video|audio|mask|media|thumbnail|reference|attachment|file|model|mesh|texture)/i.test(
      key
    ) ||
    /(?:^|_)(?:urls?|uris?)$/i.test(key) ||
    /[a-z](?:Urls?|Uris?)$/.test(key);
  const visit = (item: JsonValue, media = false): JsonValue | undefined => {
    if (typeof item === "string") {
      const id = byUrl.get(item) ?? ownedAssetReference(item, assets);
      if (id) return publicAssetUrl(id, principalId);
      // Only entire URL values in media fields are removed, not prose or prompts.
      if (media && /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(item)) return undefined;
      return item;
    }
    if (Array.isArray(item))
      return item
        .map((child) => visit(child, media))
        .filter((child): child is JsonValue => child !== undefined);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item).flatMap(([key, child]) => {
          const result = visit(
            child,
            /prompt|caption|description|^(?:text|texts)$/i.test(key)
              ? false
              : mediaKey(key) || media
          );
          return result === undefined ? [] : [[key, result]];
        })
      );
    return item;
  };
  return visit(value) ?? null;
}

export function removeAssetUrls(value: JsonValue, urls: string[]): JsonValue {
  const blocked = new Set(urls);
  const visit = (item: JsonValue): JsonValue | undefined => {
    if (typeof item === "string") return blocked.has(item) ? undefined : item;
    if (Array.isArray(item)) {
      return item
        .map(visit)
        .filter((child): child is JsonValue => child !== undefined);
    }
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item)
          .map(([key, child]) => [key, visit(child)] as const)
          .filter(
            (entry): entry is readonly [string, JsonValue] =>
              entry[1] !== undefined
          )
      );
    }
    return item;
  };
  return visit(value) ?? null;
}

/** Keep durable records while exposing only owner-bound first-party media. */
export function publicRunDetail(detail: RunDetail): RunDetail {
  return {
    ...detail,
    assets: detail.assets.map((asset) =>
      publicAsset(asset, detail.principalId)
    ),
    submittedArguments: detail.submittedArguments
      ? (sanitizePublicMedia(
          detail.submittedArguments,
          detail.assets,
          detail.principalId
        ) as Record<string, JsonValue>)
      : null,
    result: detail.result
      ? {
          ...detail.result,
          value: sanitizePublicMedia(
            detail.result.value,
            detail.assets,
            detail.principalId
          ),
        }
      : null,
  };
}
