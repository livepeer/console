import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/console/pymthouse-bff", () => ({
  mintEndUserAccessToken: vi.fn(async () => ({ access_token: "test-token" })),
}));
vi.mock("@/lib/console/pymthouse-http", () => ({
  issuerOriginFromConfig: () => "https://pymthouse.test",
}));
import { fetchManifestUsage } from "@/lib/console/manifest-usage";
const input = {
  externalUserId: "eu",
  startDate: "2026-08-01",
  endDate: "2026-09-12",
};
afterEach(() => vi.unstubAllGlobals());
it("uses Bearer scope and documented manifest grouping without receipt cursors or subject overrides", async () => {
  const f = vi.fn(async () =>
    Response.json({
      byManifest: [
        {
          manifestId: "mid",
          networkFeeUsdMicros: "2982",
          feeWei: "1190385777842",
        },
      ],
    })
  );
  vi.stubGlobal("fetch", f);
  expect(await fetchManifestUsage(input)).toEqual([
    { manifestId: "mid", networkFeeUsdMicros: "2982", feeWei: "1190385777842" },
  ]);
  const [url, init] = (f.mock.calls as unknown as [URL, RequestInit][])[0];
  expect(url.pathname).toBe("/api/v1/user/usage");
  expect([...url.searchParams.keys()]).toEqual([
    "groupBy",
    "startDate",
    "endDate",
  ]);
  expect(url.searchParams.get("groupBy")).toBe("manifest");
  expect(init.headers).toEqual({
    Authorization: "Bearer test-token",
    Accept: "application/json",
  });
});
it.each([
  {},
  { byManifest: [{ manifestId: "mid", networkFeeUsdMicros: -1 }] },
  { byManifest: [{ manifestId: "mid", networkFeeUsdMicros: "NaN" }] },
  {
    byManifest: Array(2).fill({ manifestId: "mid", networkFeeUsdMicros: "1" }),
  },
])("rejects malformed or duplicate aggregate rows", async (body) => {
  vi.stubGlobal("fetch", async () => Response.json(body));
  await expect(fetchManifestUsage(input)).rejects.toThrow(
    "invalid_manifest_usage"
  );
});
