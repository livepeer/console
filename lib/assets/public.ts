import { createHmac } from "node:crypto";
import type { JsonValue, RunAsset, RunDetail } from "@/lib/runs/types";
import { extractRunOutputs } from "@/lib/runs/outputs";

export const ASSET_URL_TTL_SECONDS = 60 * 60;

function signingSecret(): string {
  const configured = process.env.ASSET_URL_SIGNING_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "local-asset-signing-secret";
  throw new Error("ASSET_URL_SIGNING_SECRET is required");
}

function publicOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.MCP_PUBLIC_ORIGIN?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("An application public origin is required");
}

export function assetSignature(id: string, principalId: string, exp: number): string {
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

export function replaceAssetUrls(
  value: JsonValue,
  assets: Pick<RunAsset, "id" | "url">[],
  principalId: string
): JsonValue {
  const urls = new Map(
    assets.map((asset) => [asset.url, publicAssetUrl(asset.id, principalId)])
  );
  const byId = new Map(
    assets.map((asset) => [asset.id, publicAssetUrl(asset.id, principalId)])
  );
  const visit = (item: JsonValue): JsonValue => {
    if (typeof item === "string") {
      const direct = urls.get(item);
      if (direct) return direct;
      try {
        const match = new URL(item).pathname.match(/^\/api\/assets\/([^/]+)$/);
        const id = match ? decodeURIComponent(match[1]!) : null;
        if (id && byId.has(id)) return byId.get(id)!;
      } catch {
        // Non-URL strings are ordinary captured values.
      }
      return item;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).map(([key, child]) => [key, visit(child)])
      );
    }
    return item;
  };
  return visit(value);
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

/** Remove provider media origins at the HTTP/MCP boundary while retaining them in storage. */
export function publicRunDetail(detail: RunDetail): RunDetail {
  const assets = detail.assets.map((asset) => publicAsset(asset, detail.principalId));
  const submitted = detail.submittedArguments;
  const submittedMedia = submitted
    ? extractRunOutputs(submitted).map((asset) => asset.url)
    : [];
  const resultMedia = detail.result
    ? extractRunOutputs(detail.result.value).map((asset) => asset.url)
    : [];
  return {
    ...detail,
    assets,
    submittedArguments: submitted
      ? (removeAssetUrls(
          replaceAssetUrls(submitted, detail.assets, detail.principalId),
          submittedMedia.filter(
            (url) =>
              !detail.assets.some(
                (asset) =>
                  asset.url === url ||
                  (() => {
                    try {
                      return new URL(url).pathname === `/api/assets/${encodeURIComponent(asset.id)}`;
                    } catch {
                      return false;
                    }
                  })()
              )
          )
        ) as Record<string, JsonValue>)
      : null,
    result: detail.result
      ? {
          ...detail.result,
          value: removeAssetUrls(
            replaceAssetUrls(detail.result.value, detail.assets, detail.principalId),
            resultMedia.filter(
              (url) => !detail.assets.some((asset) => asset.url === url)
            )
          ),
        }
      : null,
  };
}
