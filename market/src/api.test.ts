import assert from "node:assert/strict";
import { test } from "node:test";
import { authApiErrorMessage, fetchMe, isAuthUser } from "./api.ts";

test("authApiErrorMessage never exposes server error details", () => {
  assert.equal(authApiErrorMessage(400), "Check your username and password and try again.");
  assert.equal(authApiErrorMessage(401), "Username or password is incorrect.");
  assert.equal(authApiErrorMessage(409), "That username is unavailable.");
  assert.equal(authApiErrorMessage(429), "Too many attempts. Try again later.");
  assert.equal(authApiErrorMessage(503), "Accounts are temporarily unavailable.");
  assert.equal(authApiErrorMessage(500), "The account request failed. Try again.");
});

test("isAuthUser requires both non-empty identity fields", () => {
  assert.equal(isAuthUser({ id: "user-1", username: "ivory" }), true);
  assert.equal(isAuthUser({ id: "", username: "ivory" }), false);
  assert.equal(isAuthUser({ username: "ivory" }), false);
  assert.equal(isAuthUser(null), false);
});

test("fetchMe rejects SPA fallbacks and malformed success payloads", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("<!doctype html><title>Ivory</title>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    await assert.rejects(fetchMe(), /temporarily unavailable/);

    globalThis.fetch = async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await assert.rejects(fetchMe(), /account response was invalid/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
