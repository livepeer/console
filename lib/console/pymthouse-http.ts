import "server-only";

import { PmtHouseError } from "@pymthouse/builder-sdk";

export type PymthouseM2mConfig = {
  issuerUrl: string;
  m2mClientId: string;
  m2mClientSecret: string;
  allowInsecureHttp: boolean;
};

export function readPymthouseM2mConfig(): PymthouseM2mConfig | null {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  const m2mClientId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const m2mClientSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  if (!issuerUrl || !m2mClientId || !m2mClientSecret) {
    return null;
  }
  return {
    issuerUrl,
    m2mClientId,
    m2mClientSecret,
    allowInsecureHttp: process.env.PYMTHOUSE_ALLOW_INSECURE_HTTP === "1",
  };
}

export function requirePymthouseM2mConfig(): PymthouseM2mConfig {
  const config = readPymthouseM2mConfig();
  if (!config) {
    throw new PmtHouseError(
      "Pymthouse is not configured. Set PYMTHOUSE_ISSUER_URL, PYMTHOUSE_M2M_CLIENT_ID, and PYMTHOUSE_M2M_CLIENT_SECRET.",
      { status: 503, code: "pymthouse_required" }
    );
  }
  return config;
}

export function readPublicClientId(): string {
  const id =
    process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ||
    process.env.DASHBOARD_DEVICE_PUBLIC_CLIENT_ID?.trim();
  if (!id) {
    throw new PmtHouseError(
      "PYMTHOUSE_PUBLIC_CLIENT_ID (or DASHBOARD_DEVICE_PUBLIC_CLIENT_ID) is required",
      { status: 503, code: "pymthouse_required" }
    );
  }
  return id;
}

export function readM2mAuthHeader(): string {
  const config = requirePymthouseM2mConfig();
  return `Basic ${Buffer.from(`${config.m2mClientId}:${config.m2mClientSecret}`).toString("base64")}`;
}

export function pymthouseAppsOrigin(issuerUrl?: string): string {
  const url = issuerUrl?.trim() || requirePymthouseM2mConfig().issuerUrl;
  return url.replace(/\/api\/v1\/oidc\/?$/i, "");
}

export function issuerOriginFromConfig(): string {
  return new URL(requirePymthouseM2mConfig().issuerUrl).origin;
}

export async function readPymthouseResponse<T>(
  response: Response,
  options?: { errorCode?: string }
): Promise<T> {
  const text = await response.text();
  let body: (T & { error?: string; error_description?: string }) | null = null;
  try {
    body = text
      ? (JSON.parse(text) as T & { error?: string; error_description?: string })
      : null;
  } catch {
    throw new PmtHouseError(
      `PymtHouse returned non-JSON (${response.status})`,
      {
        status: 502,
        code: "invalid_json",
      }
    );
  }
  if (!response.ok) {
    throw new PmtHouseError(
      body?.error_description ??
        body?.error ??
        `Request failed (${response.status})`,
      {
        status: response.status,
        code: options?.errorCode ?? "pymthouse_http_error",
        details: body ?? undefined,
      }
    );
  }
  if (!body) {
    throw new PmtHouseError("PymtHouse returned an empty response", {
      status: 502,
      code: "invalid_response",
    });
  }
  return body;
}
