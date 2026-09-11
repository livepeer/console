export type CachedEndUserToken = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

const REFRESH_SKEW_MS = 30_000;

type Slot = {
  token: CachedEndUserToken | null;
  expiresAt: number;
  inflight: Promise<CachedEndUserToken> | null;
};

const slots = new Map<string, Slot>();

export function endUserTokenCacheKey(
  publicClientId: string,
  externalUserId: string,
  scope = "sign:job"
): string {
  return `${publicClientId}\n${externalUserId}\n${scope}`;
}

export function resetEndUserTokenCache(): void {
  slots.clear();
}

function slotFor(key: string): Slot {
  const existing = slots.get(key);
  if (existing) return existing;
  const created: Slot = { token: null, expiresAt: 0, inflight: null };
  slots.set(key, created);
  return created;
}

function readLiveEndUserAccessToken(
  key: string,
  now = Date.now()
): CachedEndUserToken | null {
  const slot = slots.get(key);
  if (slot?.token && slot.expiresAt - REFRESH_SKEW_MS > now) return slot.token;
  return null;
}

/** Process-local reuse + single-flight. Not a session cookie. */
export async function cachedEndUserAccessToken(
  key: string,
  mint: () => Promise<CachedEndUserToken>,
  now = Date.now(),
  options?: { force?: boolean }
): Promise<CachedEndUserToken> {
  const slot = slotFor(key);
  if (!options?.force) {
    const live = readLiveEndUserAccessToken(key, now);
    if (live) return live;
  }
  if (slot.inflight) return slot.inflight;
  const pending = mint()
    .then((token) => {
      const lifetimeMs = Math.max(0, token.expires_in) * 1000;
      slot.token = token;
      slot.expiresAt = now + lifetimeMs;
      slot.inflight = null;
      return token;
    })
    .catch((error: unknown) => {
      slot.inflight = null;
      if (slot.token && slot.expiresAt > now) return slot.token;
      throw error;
    });
  slot.inflight = pending;
  return pending;
}
