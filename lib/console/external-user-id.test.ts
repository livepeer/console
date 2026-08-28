import assert from "node:assert/strict";
import { test } from "node:test";
import { externalUserIdFromSub } from "./external-user-id";

test("hashes Auth0 sub into the pymthouse charset", async () => {
  const id = await externalUserIdFromSub("github|12345");
  assert.match(id, /^eu_[0-9a-f]{64}$/);
});

test("is deterministic and case-sensitive on sub", async () => {
  const a = await externalUserIdFromSub("auth0|abc");
  const b = await externalUserIdFromSub("auth0|abc");
  const c = await externalUserIdFromSub("auth0|Abc");
  assert.equal(a, b);
  assert.notEqual(a, c);
});
