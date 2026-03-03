import test from "node:test";
import assert from "node:assert/strict";

import { createSessionToken, hashSessionToken } from "../../src/app/security.mjs";

test("createSessionToken returns a non-empty token", () => {
  const token = createSessionToken();
  assert.equal(typeof token, "string");
  assert.ok(token.length >= 40);
});

test("hashSessionToken is deterministic and not raw token", async () => {
  const token = "sample-token";
  const one = await hashSessionToken(token);
  const two = await hashSessionToken(token);
  assert.equal(one, two);
  assert.notEqual(one, token);
  assert.equal(one.length, 64);
});
