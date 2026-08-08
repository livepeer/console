import { PmtHouseError } from "@pymthouse/builder-sdk";

export type DashboardApiKeyRow = {
  id: string;
  label: string | null;
  prefix: string;
  suffix: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
};

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

function userKeysUrl(publicClientId: string, externalUserId: string): string {
  return `${appsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/users/${encodeURIComponent(externalUserId)}/keys`;
}

async function readJsonBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new PmtHouseError(`Empty response from PymtHouse (${response.status})`, {
      status: 502,
      code: "invalid_json",
    });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PmtHouseError(
      `PymtHouse returned non-JSON (${response.status})`,
      { status: 502, code: "invalid_json" },
    );
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await readJsonBody<{ error?: string; error_description?: string }>(
      response,
    );
    return body.error_description ?? body.error ?? `Request failed (${response.status})`;
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return error.message;
    }
    return `Request failed (${response.status})`;
  }
}

export async function listDashboardApiKeys(
  externalUserId: string,
  email?: string,
): Promise<DashboardApiKeyRow[]> {
  const publicClientId = readPublicClientId();
  // Upsert before list — pymthouse returns 404 "User not found" until the
  // app user row exists (same as create).
  await ensureAppUserProvisioned(publicClientId, externalUserId, email);

  const response = await fetch(userKeysUrl(publicClientId, externalUserId), {
    method: "GET",
    headers: {
      Authorization: readM2mAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PmtHouseError(await readErrorMessage(response), {
      status: response.status,
      code: "api_keys_list_failed",
    });
  }

  const body = await readJsonBody<{ keys?: DashboardApiKeyRow[] }>(response);
  return (body.keys ?? []).filter((row) => row.status === "active");
}

export async function ensureAppUserProvisioned(
  publicClientId: string,
  externalUserId: string,
  email?: string,
) {
  const response = await fetch(`${appsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/users`, {
    method: "POST",
    headers: {
      Authorization: readM2mAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      externalUserId,
      ...(email?.trim() ? { email: email.trim() } : {}),
      status: "active",
    }),
    cache: "no-store",
  });
  // Drain body so the connection can be reused cleanly.
  await response.text().catch(() => undefined);
  if (!response.ok && response.status !== 409) {
    throw new PmtHouseError(`App user provision failed (${response.status})`, {
      status: response.status,
      code: "app_user_provision_failed",
    });
  }
}

export async function createDashboardApiKey(input: {
  externalUserId: string;
  email?: string;
  label?: string;
}): Promise<{ apiKey: string; sdkToken: string | null; row: DashboardApiKeyRow }> {
  const publicClientId = readPublicClientId();
  await ensureAppUserProvisioned(
    publicClientId,
    input.externalUserId,
    input.email,
  );

  const response = await fetch(userKeysUrl(publicClientId, input.externalUserId), {
    method: "POST",
    headers: {
      Authorization: readM2mAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.label ? { label: input.label } : {}),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PmtHouseError(await readErrorMessage(response), {
      status: response.status,
      code: "api_key_create_failed",
    });
  }

  const body = await readJsonBody<{
    apiKey: string;
    sdkToken?: string;
    id: string;
    prefix: string;
    suffix: string;
    label: string | null;
    createdAt: string;
  }>(response);

  // Issuer builds the python-gateway --token (includes signer routing).
  const sdkToken =
    typeof body.sdkToken === "string" && body.sdkToken.trim()
      ? body.sdkToken.trim()
      : null;

  return {
    apiKey: body.apiKey,
    sdkToken,
    row: {
      id: body.id,
      label: body.label,
      prefix: body.prefix,
      suffix: body.suffix,
      status: "active",
      createdAt: body.createdAt,
      revokedAt: null,
    },
  };
}

export async function revokeDashboardApiKey(input: {
  externalUserId: string;
  keyId: string;
}): Promise<void> {
  const publicClientId = readPublicClientId();
  const url = new URL(userKeysUrl(publicClientId, input.externalUserId));
  url.searchParams.set("keyId", input.keyId);

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: readM2mAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  await response.text().catch(() => undefined);
  if (!response.ok) {
    throw new PmtHouseError(`API key revoke failed (${response.status})`, {
      status: response.status,
      code: "api_key_revoke_failed",
    });
  }
}
