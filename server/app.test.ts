import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildApp } from "./app.ts";
import { createPgliteStore } from "./lib/store.ts";

async function startApp() {
  const dir = mkdtempSync(join(tmpdir(), "cb-auth-"));
  const store = await createPgliteStore(dir);
  const { app } = await buildApp({ store });
  return app;
}

function cookieHeader(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  return list.map((value) => String(value).split(";")[0]).join("; ");
}

test("signup, login, and saved studies round-trip on the credentials store", async () => {
  const app = await startApp();
  const signup = await app.inject({
    method: "POST",
    url: "/api/signup",
    payload: { username: "chart_user", password: "hunter2x" },
  });
  assert.equal(signup.statusCode, 201, signup.body);
  assert.equal(signup.json().user.username, "chart_user");
  const cookie = cookieHeader(signup);
  assert.match(cookie, /cb_session=/);

  const empty = await app.inject({ method: "GET", url: "/api/preferences", headers: { cookie } });
  assert.equal(empty.statusCode, 200);
  assert.equal(empty.json().prefs, null);

  const saved = await app.inject({
    method: "PUT",
    url: "/api/preferences",
    headers: { cookie },
    payload: { interval: "15m", range: "5D", studies: { rsi: true, sma20: false }, focusedProduct: "ETH-USD" },
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().prefs.interval, "15m");
  assert.equal(saved.json().prefs.studies.rsi, true);
  assert.equal(saved.json().prefs.studies.volSma, true);

  const loggedOut = await app.inject({ method: "POST", url: "/api/logout", headers: { cookie } });
  assert.equal(loggedOut.statusCode, 200);
  const denied = await app.inject({ method: "GET", url: "/api/me" });
  assert.equal(denied.statusCode, 401);

  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { username: "Chart_User", password: "hunter2x" },
  });
  assert.equal(login.statusCode, 200);
  const again = await app.inject({
    method: "GET",
    url: "/api/preferences",
    headers: { cookie: cookieHeader(login) },
  });
  assert.equal(again.json().prefs.interval, "15m");
  assert.equal(again.json().prefs.focusedProduct, "ETH-USD");
  assert.equal(again.json().prefs.studies.rsi, true);

  const taken = await app.inject({
    method: "POST",
    url: "/api/signup",
    payload: { username: "chart_user", password: "anotherpass" },
  });
  assert.equal(taken.statusCode, 409);
  assert.equal(taken.json().error, "That username is unavailable.");

  await app.close();
});

test("signup returns 503 when the auth store is unavailable", async () => {
  const { createUnavailableStore } = await import("./lib/store.ts");
  const { app } = await buildApp({ store: createUnavailableStore() });
  const res = await app.inject({
    method: "POST",
    url: "/api/signup",
    payload: { username: "chart_user", password: "hunter2x" },
  });
  assert.equal(res.statusCode, 503, res.body);
  assert.equal(res.json().error, "Accounts are temporarily unavailable.");
  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().store, "unavailable");
  await app.close();
});

test("session cookies are Secure when AUTH_COOKIE_SECURE=1", async () => {
  const prev = process.env.AUTH_COOKIE_SECURE;
  process.env.AUTH_COOKIE_SECURE = "1";
  try {
    const app = await startApp();
    const signup = await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { username: "secure_user", password: "hunter2x" },
    });
    assert.equal(signup.statusCode, 201, signup.body);
    const raw = signup.headers["set-cookie"];
    const setCookie = String(Array.isArray(raw) ? raw.join(";") : raw);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);

    const logout = await app.inject({
      method: "POST",
      url: "/api/logout",
      headers: { cookie: cookieHeader(signup) },
    });
    const cleared = String(
      Array.isArray(logout.headers["set-cookie"])
        ? logout.headers["set-cookie"].join(";")
        : logout.headers["set-cookie"],
    );
    assert.match(cleared, /Secure/i);
    assert.match(cleared, /HttpOnly/i);
    assert.match(cleared, /SameSite=Strict/i);
    assert.match(cleared, /Max-Age=0/i);
    await app.close();
  } finally {
    if (prev === undefined) delete process.env.AUTH_COOKIE_SECURE;
    else process.env.AUTH_COOKIE_SECURE = prev;
  }
});

test("mutating auth requests reject cross-origin browser calls", async () => {
  const app = await startApp();
  const blocked = await app.inject({
    method: "POST",
    url: "/api/signup",
    headers: { host: "127.0.0.1:43148", origin: "https://evil.example" },
    payload: { username: "origin_user", password: "hunter2x" },
  });
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.json().error, "Request origin is not allowed.");

  const allowed = await app.inject({
    method: "POST",
    url: "/api/signup",
    headers: { host: "127.0.0.1:43148", origin: "http://127.0.0.1:43148" },
    payload: { username: "origin_user", password: "hunter2x" },
  });
  assert.equal(allowed.statusCode, 201, allowed.body);
  await app.close();
});

test("oversized requests fail safely without reflecting parser details", async () => {
  const app = await startApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { username: "size_user", password: "x".repeat(70_000) },
  });
  assert.equal(response.statusCode, 413);
  assert.equal(response.json().error, "Request body is too large.");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  await app.close();
});

test("parallel duplicate signup returns a conflict instead of a database error", async () => {
  const app = await startApp();
  const request = {
    method: "POST" as const,
    url: "/api/signup",
    payload: { username: "race_user", password: "hunter2x" },
  };
  const responses = await Promise.all([app.inject(request), app.inject(request)]);
  assert.deepEqual(
    responses.map((response) => response.statusCode).sort(),
    [201, 409],
  );
  assert.equal(
    responses.find((response) => response.statusCode === 409)?.json().error,
    "That username is unavailable.",
  );
  await app.close();
});
