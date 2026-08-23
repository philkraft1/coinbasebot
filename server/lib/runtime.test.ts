import assert from "node:assert/strict";
import { test } from "node:test";
import { cookieSecure, isServerlessRuntime, productionAuthError } from "./runtime.ts";

test("serverless and cookie flags follow Vercel / AUTH_COOKIE_SECURE", () => {
  assert.equal(isServerlessRuntime({}), false);
  assert.equal(isServerlessRuntime({ VERCEL: "1" }), true);
  assert.equal(cookieSecure({}), false);
  assert.equal(cookieSecure({ AUTH_COOKIE_SECURE: "1" }), true);
  assert.equal(cookieSecure({ VERCEL: "1" }), true);
});

test("production auth requires a dedicated URL and session secret", () => {
  assert.equal(productionAuthError({}), null);
  assert.match(productionAuthError({ VERCEL: "1" }) || "", /AUTH_DATABASE_URL/);
  assert.match(
    productionAuthError({ VERCEL: "1", AUTH_DATABASE_URL: "postgres://auth_app@db/auth" }) || "",
    /AUTH_SESSION_SECRET/,
  );
  assert.equal(
    productionAuthError({
      VERCEL: "1",
      AUTH_DATABASE_URL: "postgres://auth_app@db/auth",
      AUTH_SESSION_SECRET: "unit-test-secret",
    }),
    null,
  );
});
