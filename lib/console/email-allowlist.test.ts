import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowlistExemptPath,
  isAllowlistGatedPath,
  isEmailAllowlisted,
  parseEmailAllowlist,
} from "./email-allowlist";

test("parseEmailAllowlist splits csv", () => {
  assert.deepEqual(parseEmailAllowlist("a@x.com, B@Y.com"), [
    "a@x.com",
    "b@y.com",
  ]);
});

test("empty allowlist admits everyone", () => {
  const prev = process.env.CONSOLE_EMAIL_ALLOWLIST;
  delete process.env.CONSOLE_EMAIL_ALLOWLIST;
  try {
    assert.equal(isEmailAllowlisted("anyone@example.com"), true);
  } finally {
    if (prev === undefined) delete process.env.CONSOLE_EMAIL_ALLOWLIST;
    else process.env.CONSOLE_EMAIL_ALLOWLIST = prev;
  }
});

test("configured allowlist is fail-closed", () => {
  const prev = process.env.CONSOLE_EMAIL_ALLOWLIST;
  process.env.CONSOLE_EMAIL_ALLOWLIST = "ok@livepeer.org";
  try {
    assert.equal(isEmailAllowlisted("ok@livepeer.org"), true);
    assert.equal(isEmailAllowlisted("nope@livepeer.org"), false);
    assert.equal(isEmailAllowlisted(undefined), false);
  } finally {
    if (prev === undefined) delete process.env.CONSOLE_EMAIL_ALLOWLIST;
    else process.env.CONSOLE_EMAIL_ALLOWLIST = prev;
  }
});

test("device, login, and MCP OAuth paths are exempt; home is gated", () => {
  assert.equal(isAllowlistExemptPath("/device"), true);
  assert.equal(isAllowlistExemptPath("/login"), true);
  assert.equal(isAllowlistExemptPath("/api/mcp"), true);
  assert.equal(isAllowlistExemptPath("/authorize"), true);
  assert.equal(isAllowlistExemptPath("/token"), true);
  assert.equal(isAllowlistExemptPath("/register"), true);
  assert.equal(isAllowlistExemptPath("/.well-known/oauth-authorization-server/mcp"), true);
  assert.equal(isAllowlistGatedPath("/"), true);
  assert.equal(isAllowlistGatedPath("/home"), true);
  assert.equal(isAllowlistGatedPath("/explore"), false);
});
