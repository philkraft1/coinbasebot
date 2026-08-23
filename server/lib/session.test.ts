import assert from "node:assert/strict";
import { test } from "node:test";
import { readSession, sessionSecret } from "./session.ts";

test("sessionSecret refuses a generated file on serverless", () => {
  const prevVercel = process.env.VERCEL;
  const prevSecret = process.env.AUTH_SESSION_SECRET;
  delete process.env.AUTH_SESSION_SECRET;
  process.env.VERCEL = "1";
  try {
    assert.throws(() => sessionSecret("/tmp/should-not-write.secret"), /AUTH_SESSION_SECRET/);
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = prevSecret;
  }
});

test("sessionSecret reads AUTH_SESSION_SECRET on serverless", () => {
  const prevVercel = process.env.VERCEL;
  const prevSecret = process.env.AUTH_SESSION_SECRET;
  process.env.VERCEL = "1";
  process.env.AUTH_SESSION_SECRET = "hosted-secret-with-at-least-32-bytes";
  try {
    assert.equal(new TextDecoder().decode(sessionSecret()), "hosted-secret-with-at-least-32-bytes");
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = prevSecret;
  }
});

test("sessionSecret rejects weak configured secrets", () => {
  const prevSecret = process.env.AUTH_SESSION_SECRET;
  process.env.AUTH_SESSION_SECRET = "too-short";
  try {
    assert.throws(() => sessionSecret(), /at least 32 bytes/);
  } finally {
    if (prevSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = prevSecret;
  }
});

test("readSession does not load a production secret when there is no cookie", async () => {
  const prevVercel = process.env.VERCEL;
  const prevSecret = process.env.AUTH_SESSION_SECRET;
  process.env.VERCEL = "1";
  delete process.env.AUTH_SESSION_SECRET;
  try {
    assert.equal(await readSession(undefined), null);
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = prevSecret;
  }
});
