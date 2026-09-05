import { afterEach, describe, expect, it, vi } from "vitest";
import { isCaptureDelivery } from "./delivery-mode";

afterEach(() => vi.unstubAllEnvs());
describe("preview delivery isolation", () => {
  it.each([undefined, "send", "typo"])(
    "rejects unsafe preview mode %s",
    (mode) => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("EMAIL_DELIVERY_MODE", mode);
      expect(() => isCaptureDelivery()).toThrow(
        "Preview delivery is not isolated"
      );
      expect(() => isCaptureDelivery("newsletter")).toThrow();
    }
  );
  it("keeps newsletter synchronization captured even with live transactional mail", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "send_transactional");
    expect(isCaptureDelivery()).toBe(false);
    expect(isCaptureDelivery("newsletter")).toBe(true);
  });
  it("does not change production delivery", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "capture");
    expect(isCaptureDelivery()).toBe(false);
    expect(isCaptureDelivery("newsletter")).toBe(false);
  });
});
