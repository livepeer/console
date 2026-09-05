import assert from "node:assert/strict";
import { test } from "node:test";

import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import { resolveMcpExternalUserId } from "./principal";

test("claimed external_user_id wins", async () => {
  assert.equal(
    await resolveMcpExternalUserId("auth0|abc", "eu_from_token"),
    "eu_from_token"
  );
});

test("Auth0 sub is hashed the same way as console sessions", async () => {
  const sub = "github|12345";
  assert.equal(
    await resolveMcpExternalUserId(sub),
    await externalUserIdFromSub(sub)
  );
});

test("already-namespaced ids are kept", async () => {
  assert.equal(await resolveMcpExternalUserId("eu_abc123"), "eu_abc123");
});
