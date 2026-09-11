import { describe, expect, it } from "vitest";

import { isProtocolReturnPath, safeIdentityReturnTo } from "./sync-return";

describe("signed-in return paths", () => {
  it("treats device, authorize, and MCP callback as protocol destinations", () => {
    expect(isProtocolReturnPath("/device?user_code=ABC")).toBe(true);
    expect(isProtocolReturnPath("/authorize")).toBe(true);
    expect(isProtocolReturnPath("/api/mcp/oauth/callback?state=opaque")).toBe(
      true
    );
    expect(isProtocolReturnPath("/home")).toBe(false);
  });

  it("rejects protocol-relative and external redirects", () => {
    expect(safeIdentityReturnTo("//evil.example")).toBe("/");
    expect(safeIdentityReturnTo("/\\evil.example/path")).toBe("/");
    expect(safeIdentityReturnTo("https://evil.example")).toBe("/");
    expect(safeIdentityReturnTo("/home?tab=usage")).toBe("/home?tab=usage");
  });
});
