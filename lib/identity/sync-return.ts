const INTERNAL_ORIGIN = "http://console.internal";

export function isProtocolReturnPath(path: string) {
  return ["/device", "/authorize", "/api/mcp/oauth/callback"].includes(
    path.split(/[?#]/, 1)[0]
  );
}

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
