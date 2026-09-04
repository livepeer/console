const INTERNAL_ORIGIN = "http://console.internal";

export function safeIdentityReturnTo(value: string | null): string {
  if (!value?.startsWith("/")) return "/";
  try {
    const resolved = new URL(value, INTERNAL_ORIGIN);
    return resolved.origin === INTERNAL_ORIGIN
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export function identitySyncPath(returnTo: string): string {
  const safeReturnTo = safeIdentityReturnTo(returnTo);
  return `/api/identity/sync?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
