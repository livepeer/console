import { createHash, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { fetchPinnedAsset } from "@/lib/assets/transport";
import { isIP } from "node:net";
import { assetSignature, ASSET_URL_TTL_SECONDS } from "@/lib/assets/public";
import { getAssetSource } from "@/lib/mcp/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARDED_HEADERS = [
  "accept-ranges",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const;

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "private, no-store" },
  });
}

function isPrivateIp(address: string): boolean {
  let normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
    if (!normalized.includes(".")) {
      const words = normalized.split(":").map((word) => parseInt(word, 16));
      if (words.length !== 2 || words.some((word) => !Number.isFinite(word)))
        return true;
      normalized = [
        words[0]! >> 8,
        words[0]! & 255,
        words[1]! >> 8,
        words[1]! & 255,
      ].join(".");
    }
  }
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return (
    isIP(normalized) !== 6 ||
    !/^[23]/.test(normalized) ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("2001:0:") ||
    normalized.startsWith("2001::") ||
    normalized.startsWith("2002:") ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

function allowedHosts(): string[] {
  const configured = process.env.ASSET_PROXY_ALLOWED_HOSTS?.trim();
  if (configured)
    return configured
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
  if (process.env.NODE_ENV !== "production")
    return ["fal.media", "*.fal.media", "media.example.test"];
  throw new Error("ASSET_PROXY_ALLOWED_HOSTS is required");
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return allowedHosts().some((rule) =>
    rule.startsWith("*.")
      ? host.endsWith(rule.slice(1)) && host !== rule.slice(2)
      : host === rule
  );
}

async function assertPublicHttps(raw: string) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !isAllowedHost(url.hostname)
  )
    throw new Error("unsafe_asset_origin");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateIp(address))
  )
    throw new Error("unsafe_asset_origin");
  return { url, addresses };
}

function validSignature(
  id: string,
  principalId: string,
  exp: number,
  supplied: string
): boolean {
  const expected = Buffer.from(assetSignature(id, principalId, exp));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function proxy(request: Request, id: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) return notFound();
  const requestUrl = new URL(request.url);
  const expText = requestUrl.searchParams.get("exp") ?? "";
  const sig = requestUrl.searchParams.get("sig") ?? "";
  const exp = Number(expText);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    !/^\d{10,}$/.test(expText) ||
    !Number.isSafeInteger(exp) ||
    exp <= nowSeconds ||
    exp > nowSeconds + ASSET_URL_TTL_SECONDS
  )
    return notFound();

  const asset = await getAssetSource(id);
  if (
    !asset ||
    asset.unavailableAt ||
    !validSignature(id, asset.principalId, exp, sig) ||
    (asset.expiresAt && asset.expiresAt.getTime() <= Date.now())
  )
    return notFound();

  // Synthetic fixtures are bundled public images, never arbitrary proxy origins.
  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.CONSOLE_PREVIEW_FIXTURES === "1"
  ) {
    const suffix = createHash("sha256")
      .update(asset.principalId)
      .digest("hex")
      .slice(0, 12);
    const fixturePaths: Record<string, string> = {
      [`asset_preview_v2_${suffix}_portrait`]:
        "/images/console/explore/flux-schnell.webp",
      [`asset_preview_v2_${suffix}_variation`]:
        "/images/console/explore/img2img-sdxl.webp",
    };
    const location = fixturePaths[id];
    if (location)
      return new Response(null, {
        status: 307,
        headers: { location, "cache-control": "private, no-store" },
      });
  }

  try {
    let target = await assertPublicHttps(asset.url);
    let upstream: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      upstream = await fetchPinnedAsset(target.url, target.addresses, {
        method: request.method,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
        headers: {
          Accept: request.headers.get("accept") ?? "*/*",
          "Accept-Encoding": "identity",
          ...(request.headers.get("range")
            ? { Range: request.headers.get("range")! }
            : {}),
        },
      });
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get("location");
      await upstream.body?.cancel();
      if (!location || redirects === 3) throw new Error("asset_redirect");
      target = await assertPublicHttps(new URL(location, target.url).href);
    }
    if (!upstream) throw new Error("asset_unavailable");
    const providerSeconds = asset.expiresAt
      ? Math.max(0, Math.floor((asset.expiresAt.getTime() - Date.now()) / 1000))
      : Number.POSITIVE_INFINITY;
    const maxAge = Math.max(
      0,
      Math.min(60, exp - Math.floor(Date.now() / 1000), providerSeconds)
    );
    const headers = new Headers({
      "cache-control": upstream.ok
        ? `private, max-age=${maxAge}`
        : "private, no-store",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    });
    for (const name of FORWARDED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return new Response("Asset unavailable", {
      status: 502,
      headers: { "cache-control": "private, no-store" },
    });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return proxy(request, (await context.params).id);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return proxy(request, (await context.params).id);
}
