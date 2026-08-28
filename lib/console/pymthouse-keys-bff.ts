import "server-only";

import { PmtHouseError } from "@pymthouse/builder-sdk";
import { ensureDashboardAppUser } from "@/lib/console/pymthouse-bff";
import type { DashboardApiKeyRow } from "@/lib/console/pymthouse-keys";
import {
  pymthouseAppsOrigin,
  readM2mAuthHeader,
  readPublicClientId,
  readPymthouseResponse,
} from "@/lib/console/pymthouse-http";

export type { DashboardApiKeyRow };

function userKeysUrl(publicClientId: string, externalUserId: string): string {
  return `${pymthouseAppsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/users/${encodeURIComponent(externalUserId)}/keys`;
}

export async function listDashboardApiKeys(
  externalUserId: string,
  email?: string
): Promise<DashboardApiKeyRow[]> {
  const publicClientId = readPublicClientId();
  await ensureDashboardAppUser(externalUserId, email);

  const response = await fetch(userKeysUrl(publicClientId, externalUserId), {
    method: "GET",
    headers: {
      Authorization: readM2mAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const body = await readPymthouseResponse<{ keys?: DashboardApiKeyRow[] }>(
    response,
    { errorCode: "api_keys_list_failed" }
  );
  return (body.keys ?? []).filter((row) => row.status === "active");
}

export async function createDashboardApiKey(input: {
  externalUserId: string;
  email?: string;
  label?: string;
}): Promise<{
  apiKey: string;
  sdkToken: string | null;
  row: DashboardApiKeyRow;
}> {
  const publicClientId = readPublicClientId();
  await ensureDashboardAppUser(input.externalUserId, input.email);

  const response = await fetch(
    userKeysUrl(publicClientId, input.externalUserId),
    {
      method: "POST",
      headers: {
        Authorization: readM2mAuthHeader(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.label ? { label: input.label } : {}),
      cache: "no-store",
    }
  );
  const body = await readPymthouseResponse<{
    apiKey: string;
    sdkToken?: string;
    id: string;
    prefix: string;
    suffix: string;
    label: string | null;
    createdAt: string;
  }>(response, { errorCode: "api_key_create_failed" });

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
