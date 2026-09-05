const attributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Presentation-only allowlist. The server independently validates every field. */
export function buildWaitlistJoinHref(
  params: URLSearchParams,
  referrer?: string
): string {
  const safe = new URLSearchParams({ landing_page: "/waitlist" });
  const referral = params.get("ref")?.trim();
  if (referral && /^[A-Za-z0-9_-]{1,64}$/.test(referral))
    safe.set("ref", referral);
  for (const key of attributionKeys) {
    const value = params.get(key)?.trim().slice(0, 200);
    if (value) safe.set(key, value);
  }
  if (referrer) {
    try {
      const url = new URL(referrer);
      if (url.protocol === "https:" || url.protocol === "http:")
        safe.set("referrer", url.origin);
    } catch {
      /* No valid public origin to attribute. */
    }
  }
  return `/api/waitlist/join?${safe}`;
}
