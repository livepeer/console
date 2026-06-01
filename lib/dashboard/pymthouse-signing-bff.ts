import { PmtHouseError } from "@pymthouse/builder-sdk";
import { ensureAppUserProvisioned } from "@/lib/dashboard/pymthouse-keys-bff";

function readPublicClientId(): string {
  const id =
    process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ||
    process.env.DASHBOARD_DEVICE_PUBLIC_CLIENT_ID?.trim();
  if (!id) {
    throw new PmtHouseError(
      "PYMTHOUSE_PUBLIC_CLIENT_ID (or DASHBOARD_DEVICE_PUBLIC_CLIENT_ID) is required",
      { status: 503, code: "pymthouse_required" },
    );
  }
  return id;
}

function readM2mAuthHeader(): string {
  const m2mId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const m2mSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  if (!m2mId || !m2mSecret) {
    throw new PmtHouseError(
      "PYMTHOUSE_M2M_CLIENT_ID and PYMTHOUSE_M2M_CLIENT_SECRET are required",
      { status: 503, code: "pymthouse_required" },
    );
  }
  return `Basic ${Buffer.from(`${m2mId}:${m2mSecret}`).toString("base64")}`;
}

function appsOrigin(): string {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  if (!issuerUrl) {
    throw new PmtHouseError("PYMTHOUSE_ISSUER_URL is required", {
      status: 503,
      code: "pymthouse_required",
    });
  }
  return issuerUrl.replace(/\/api\/v1\/oidc\/?$/i, "");
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; error_description?: string };
    return body.error_description ?? body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export type MintedSigningToken = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export async function mintDashboardUserSigningToken(input: {
  externalUserId: string;
  scope?: string;
}): Promise<MintedSigningToken> {
  const externalUserId = input.externalUserId.trim();
  if (!externalUserId) {
    throw new PmtHouseError("externalUserId is required", {
      status: 400,
      code: "invalid_request",
    });
  }

  const publicClientId = readPublicClientId();
  await ensureAppUserProvisioned(publicClientId, externalUserId);

  const scope = input.scope?.trim() || "sign:job";
  const url = `${appsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/users/${encodeURIComponent(externalUserId)}/token`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: readM2mAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scope }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PmtHouseError(await readErrorMessage(response), {
      status: response.status,
      code: "signing_token_mint_failed",
    });
  }

  const body = (await response.json()) as Record<string, unknown>;
  const accessToken =
    typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!accessToken) {
    throw new PmtHouseError("Token response missing access_token", {
      status: 502,
      code: "invalid_token_response",
    });
  }

  const expiresIn =
    typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
      ? body.expires_in
      : 900;

  const scopeOut =
    typeof body.scope === "string" && body.scope.trim() ? body.scope.trim() : scope;

  return {
    access_token: accessToken,
    expires_in: expiresIn,
    scope: scopeOut,
    token_type:
      typeof body.token_type === "string" && body.token_type.trim()
        ? body.token_type.trim()
        : "Bearer",
  };
}
