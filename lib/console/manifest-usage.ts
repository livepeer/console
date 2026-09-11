import "server-only";
import { mintEndUserAccessToken } from "./pymthouse-bff";
import { issuerOriginFromConfig } from "./pymthouse-http";

export type ManifestUsage = {
  manifestId: string;
  networkFeeUsdMicros: string;
  feeWei: string | null;
};

/** The server forces account scope from the minted end-user token. */
export async function fetchManifestUsage(input: {
  externalUserId: string;
  email?: string;
  startDate: string;
  endDate: string;
}): Promise<ManifestUsage[]> {
  const token = await mintEndUserAccessToken(input.externalUserId, input.email);
  const url = new URL("/api/v1/user/usage", issuerOriginFromConfig());
  url.search = new URLSearchParams({
    groupBy: "manifest",
    startDate: input.startDate,
    endDate: input.endDate,
  }).toString();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("manifest_usage_unavailable");
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("byManifest" in body) ||
    !Array.isArray(body.byManifest)
  )
    throw new Error("invalid_manifest_usage");
  const seen = new Set<string>();
  return body.byManifest.map((row: unknown) => {
    if (!row || typeof row !== "object")
      throw new Error("invalid_manifest_usage");
    const value = row as Record<string, unknown>;
    const id = value.manifestId;
    const fee = value.networkFeeUsdMicros;
    const wei = value.feeWei;
    if (
      typeof id !== "string" ||
      !id ||
      id.length > 512 ||
      /\s/.test(id) ||
      seen.has(id) ||
      typeof fee !== "string" ||
      !/^\d{1,30}(?:\.\d{1,18})?$/.test(fee) ||
      (wei != null && (typeof wei !== "string" || !/^\d{1,128}$/.test(wei)))
    )
      throw new Error("invalid_manifest_usage");
    seen.add(id);
    return {
      manifestId: id,
      networkFeeUsdMicros: fee,
      feeWei: typeof wei === "string" ? wei : null,
    };
  });
}
