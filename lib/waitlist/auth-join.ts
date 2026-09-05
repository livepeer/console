import type { WaitlistEnrollmentContext } from "@/lib/platform/contracts";
const attributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/** Public campaign context only. Ownership/consent/role claims are never accepted. */
export function waitlistEnrollmentContext(
  params: URLSearchParams
): WaitlistEnrollmentContext {
  const attribution: Record<string, string> = {};
  for (const key of attributionKeys) {
    const value = params.get(key)?.trim().slice(0, 200);
    if (value) attribution[key] = value;
  }
  attribution.landing_page = "/waitlist";
  const referrer = params.get("referrer");
  if (referrer && referrer.length <= 2048) {
    try {
      const url = new URL(referrer);
      if (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
        attribution.referrer = url.origin;
    } catch {
      /* Untrusted analytics metadata is optional. */
    }
  }
  const referralCode = params.get("ref")?.trim();
  return {
    source: "waitlist_auth",
    ...(referralCode && /^[-_A-Za-z0-9]{1,64}$/.test(referralCode)
      ? { referralCode }
      : {}),
    attribution,
  };
}

export function waitlistAuthLoginPath(params: URLSearchParams): string {
  const context = waitlistEnrollmentContext(params);
  const sync = new URLSearchParams({ from: "waitlist" });
  if (context.referralCode) sync.set("ref", context.referralCode);
  for (const [key, value] of Object.entries(context.attribution))
    sync.set(key, value);
  // Auth0 binds returnTo to its encrypted transaction cookie and state check.
  return `/auth/login?${new URLSearchParams({ returnTo: `/api/identity/sync?${sync}` })}`;
}

export function isProtocolReturnPath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return ["/device", "/authorize", "/api/mcp/oauth/callback"].includes(
    pathname
  );
}
