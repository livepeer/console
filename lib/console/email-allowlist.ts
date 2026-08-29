export function parseEmailAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/** Empty env = gate off (local). Non-empty = fail-closed allowlist. */
export function emailAllowlistConfigured(): boolean {
  return parseEmailAllowlist(process.env.CONSOLE_EMAIL_ALLOWLIST).length > 0;
}

export function isEmailAllowlisted(email: string | null | undefined): boolean {
  if (!emailAllowlistConfigured()) return true;
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return parseEmailAllowlist(process.env.CONSOLE_EMAIL_ALLOWLIST).includes(
    normalized
  );
}

export function isAllowlistExemptPath(pathname: string): boolean {
  const exempt = [
    "/login",
    "/signup",
    "/waitlist",
    "/device",
    "/auth",
    "/api",
    "/explore",
    "/apps",
    "/network",
    "/orgs",
  ];
  return exempt.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAllowlistGatedPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/home" ||
    pathname.startsWith("/usage") ||
    pathname.startsWith("/keys") ||
    pathname.startsWith("/calls") ||
    pathname.startsWith("/settings")
  );
}
