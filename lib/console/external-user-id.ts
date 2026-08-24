/**
 * Deterministic PymtHouse externalUserId from an Auth0 `sub`.
 * `sub` contains `|`, which the builder-sdk charset forbids ([A-Za-z0-9._:-]).
 */
const HASH_NAMESPACE = "livepeer-console:externalUserId:";

export async function externalUserIdFromSub(sub: string): Promise<string> {
  const normalized = sub.trim();
  if (!normalized) {
    throw new Error("Auth0 sub is required");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${HASH_NAMESPACE}${normalized}`)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `eu_${hex}`;
}
