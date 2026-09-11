import { afterEach, expect, it } from "vitest";
import {
  cachedEndUserAccessToken,
  endUserTokenCacheKey,
  resetEndUserTokenCache,
  type CachedEndUserToken,
} from "@/lib/console/end-user-token-cache";

function token(access_token: string, expires_in = 300): CachedEndUserToken {
  return {
    access_token,
    refresh_token: "refresh",
    token_type: "Bearer",
    expires_in,
    scope: "sign:job",
  };
}

afterEach(() => {
  resetEndUserTokenCache();
});

it("reuses a live token and single-flights concurrent mints", async () => {
  let mints = 0;
  let release!: (value: CachedEndUserToken) => void;
  const first = new Promise<CachedEndUserToken>((resolve) => {
    release = resolve;
  });
  const mint = () => {
    mints += 1;
    return mints === 1 ? first : Promise.resolve(token("late"));
  };
  const key = endUserTokenCacheKey("app", "eu");
  const a = cachedEndUserAccessToken(key, mint);
  const b = cachedEndUserAccessToken(key, mint);
  release(token("minted"));
  expect(await a).toMatchObject({ access_token: "minted" });
  expect(await b).toMatchObject({ access_token: "minted" });
  expect(mints).toBe(1);
  expect(
    (await cachedEndUserAccessToken(key, mint, Date.now() + 60_000))
      .access_token
  ).toBe("minted");
  expect(mints).toBe(1);
});

it("force mint replaces a live token", async () => {
  const key = endUserTokenCacheKey("app", "eu");
  let mints = 0;
  const mint = async () => token(`t${++mints}`);
  expect(
    (await cachedEndUserAccessToken(key, mint, 1_000_000)).access_token
  ).toBe("t1");
  expect(
    (await cachedEndUserAccessToken(key, mint, 1_000_000, { force: true }))
      .access_token
  ).toBe("t2");
  expect(mints).toBe(2);
});

it("remints after expiry skew and keeps a still-valid token if refresh fails", async () => {
  const key = endUserTokenCacheKey("app", "eu");
  let mints = 0;
  const mint = async () => {
    mints += 1;
    if (mints >= 2) throw new Error("mint_failed");
    return token(`t${mints}`, 40);
  };
  const now = 1_000_000;
  expect((await cachedEndUserAccessToken(key, mint, now)).access_token).toBe(
    "t1"
  );
  expect(
    (await cachedEndUserAccessToken(key, mint, now + 15_000)).access_token
  ).toBe("t1");
  expect(mints).toBe(2);
  await expect(
    cachedEndUserAccessToken(key, mint, now + 41_000)
  ).rejects.toThrow("mint_failed");
});
