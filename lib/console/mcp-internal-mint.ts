import { createHmac, timingSafeEqual } from "node:crypto";

export const RS2_TEST_BILLING_APP_ID = "app_98575870d7ae33589a3f0660";

function parseMintAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function timingSafeEqualString(left: string, right: string): boolean {
  const a = createHmac("sha256", "mcp-mint-compare").update(left).digest();
  const b = createHmac("sha256", "mcp-mint-compare").update(right).digest();
  return timingSafeEqual(a, b);
}

export function mintRouteConfigured(): boolean {
  const secret = process.env.MCP_INTERNAL_MINT_SECRET?.trim();
  const allowlist = parseMintAllowlist(process.env.MCP_INTERNAL_MINT_ALLOWLIST);
  return Boolean(secret && allowlist.length > 0);
}

export function authorizeMcpMint(input: {
  authorization: string | null;
  origin: string | null;
  callerOrigin: string | null;
}):
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string } {
  const secret = process.env.MCP_INTERNAL_MINT_SECRET?.trim() ?? "";
  const presented = input.authorization?.startsWith("Bearer ")
    ? input.authorization.slice("Bearer ".length).trim()
    : "";
  if (!presented || !timingSafeEqualString(presented, secret)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  const caller = (input.origin || input.callerOrigin || "").trim();
  const allowlist = parseMintAllowlist(process.env.MCP_INTERNAL_MINT_ALLOWLIST);
  if (!caller || !allowlist.includes(caller)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}

export function billingAppMismatch(): { error: string; error_description: string } | null {
  if (process.env.VERCEL_ENV === "production") {
    return null;
  }
  const publicClientId = process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ?? "";
  if (publicClientId === RS2_TEST_BILLING_APP_ID) {
    return null;
  }
  return {
    error: "billing_app_mismatch",
    error_description: `Non-prod mint requires PYMTHOUSE_PUBLIC_CLIENT_ID=${RS2_TEST_BILLING_APP_ID}`,
  };
}

export async function mintMcpCompositeKey(input: {
  externalUserId: string;
  email?: string;
  label?: string;
}): Promise<{ apiKey: string }> {
  const { createDashboardApiKey } = await import("./pymthouse-keys-bff");
  const created = await createDashboardApiKey({
    externalUserId: input.externalUserId,
    email: input.email,
    label: input.label?.trim() || "mcp-oauth",
  });
  return { apiKey: created.apiKey };
}
