import { timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
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
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return (
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
    return configured.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (process.env.NODE_ENV !== "production") return ["fal.media", "*.fal.media", "media.example.test"];
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

async function assertPublicHttps(raw: string): Promise<URL> {
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
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address)))
    throw new Error("unsafe_asset_origin");
  return url;
}

function validSignature(id: string, principalId: string, exp: number, supplied: string): boolean {
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
    !validSignature(id, asset.principalId, exp, sig) ||
    (asset.expiresAt && asset.expiresAt.getTime() <= Date.now())
  )
    return notFound();

  try {
    let target = await assertPublicHttps(asset.url);
    let upstream: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      upstream = await fetch(target, {
        method: request.method,
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
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
      target = await assertPublicHttps(new URL(location, target).href);
    }
    if (!upstream) throw new Error("asset_unavailable");
    const providerSeconds = asset.expiresAt
      ? Math.max(0, Math.floor((asset.expiresAt.getTime() - Date.now()) / 1000))
      : Number.POSITIVE_INFINITY;
    const maxAge = Math.max(0, Math.min(exp - nowSeconds, providerSeconds));
    const headers = new Headers({
      "cache-control": `private, max-age=${maxAge}`,
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
