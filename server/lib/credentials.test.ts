import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, normalizePassword, normalizeUsername, verifyPassword } from "./credentials.ts";

test("normalizeUsername accepts 3-32 word characters and rejects email-like names", () => {
  assert.equal(normalizeUsername("Ada_1"), "Ada_1");
  assert.equal(normalizeUsername("  bob  "), "bob");
  assert.equal(normalizeUsername("ab"), null);
  assert.equal(normalizeUsername("not-valid"), null);
  assert.equal(normalizeUsername("user@host"), null);
});

test("normalizePassword requires 8-128 characters", () => {
  assert.equal(normalizePassword("short"), null);
  assert.equal(normalizePassword("longenough"), "longenough");
});

test("argon2id hash verifies the original password only", async () => {
  const hash = await hashPassword("correct horse");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, "correct horse"), true);
  assert.equal(await verifyPassword(hash, "wrong password"), false);
});
