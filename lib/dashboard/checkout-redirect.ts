/** Only follow https (or localhost http, for dev) Checkout URLs. */
export function redirectToCheckout(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid checkout URL");
  }
  const isLocalhost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && isLocalhost)
  ) {
    throw new Error("Unsafe checkout URL");
  }
  window.location.assign(parsed.toString());
}
