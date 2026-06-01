const STORAGE_KEY = "livepeer.dashboard.signingToken";

export type StoredSigningToken = {
  externalUserId: string;
  accessToken: string;
  expiresAtMs: number;
  scope: string;
};

export function getStoredSigningToken(
  externalUserId: string,
): StoredSigningToken | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredSigningToken;
    if (
      parsed.externalUserId !== externalUserId.trim() ||
      typeof parsed.accessToken !== "string" ||
      !parsed.accessToken.trim() ||
      typeof parsed.expiresAtMs !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAtMs <= Date.now() + 5_000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSigningToken(entry: StoredSigningToken): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredSigningToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
