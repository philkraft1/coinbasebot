import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionSecret } from "./session.ts";

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
  process.env.AUTH_SESSION_SECRET = "hosted-secret";
  try {
    assert.equal(new TextDecoder().decode(sessionSecret()), "hosted-secret");
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = prevSecret;
  }
});
