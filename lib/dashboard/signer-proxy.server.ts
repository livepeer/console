import "server-only";

import { resolveDashboardSignerUpstreamUrl } from "@/lib/dashboard/gateway-config.server";

const ALLOWED_SIGNER_PROXY_SUFFIXES = new Set([
  "sign-orchestrator-info",
  "generate-live-payment",
  "discover-orchestrators",
]);

export function isAllowedSignerProxyPath(pathSegments: string[]): boolean {
  if (pathSegments.length !== 1) {
    return false;
  }
  return ALLOWED_SIGNER_PROXY_SUFFIXES.has(pathSegments[0]);
}

export async function forwardSignerProxyRequest(
  request: Request,
  pathSegments: string[],
): Promise<Response> {
  const upstreamBase = resolveDashboardSignerUpstreamUrl();
  if (!upstreamBase) {
    return Response.json(
      {
        error: "server_misconfigured",
        error_description:
          "PYMTHOUSE_SIGNER_URL or PYMTHOUSE_ISSUER_URL is required for signer proxy",
      },
      { status: 503 },
    );
  }

  if (!isAllowedSignerProxyPath(pathSegments)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const suffix = pathSegments[0];
  const target = `${upstreamBase.replace(/\/+$/, "")}/${suffix}`;
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Accept", request.headers.get("accept") ?? "application/json");

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, {
    method,
    headers,
    body,
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("Content-Type", upstreamContentType);
  }
  const livepeerOrch = upstream.headers.get("Livepeer-Orchestrator-URL");
  if (livepeerOrch) {
    responseHeaders.set("Livepeer-Orchestrator-URL", livepeerOrch);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
