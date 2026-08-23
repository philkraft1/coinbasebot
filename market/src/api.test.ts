import assert from "node:assert/strict";
import { test } from "node:test";
import { authApiErrorMessage } from "./api.ts";

test("authApiErrorMessage never exposes server error details", () => {
  assert.equal(authApiErrorMessage(400), "Check your username and password and try again.");
  assert.equal(authApiErrorMessage(401), "Username or password is incorrect.");
  assert.equal(authApiErrorMessage(409), "That username is unavailable.");
  assert.equal(authApiErrorMessage(429), "Too many attempts. Try again later.");
  assert.equal(authApiErrorMessage(503), "Accounts are temporarily unavailable.");
  assert.equal(authApiErrorMessage(500), "The account request failed. Try again.");
});
