import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "./rate-limit.ts";

test("rate limiter allows up to max hits then blocks until the window resets", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
  const t = 1_000_000;
  assert.equal(limiter.check("a", t), true);
  assert.equal(limiter.check("a", t + 10), true);
  assert.equal(limiter.check("a", t + 20), false);
  assert.equal(limiter.check("b", t + 20), true);
  assert.equal(limiter.check("a", t + 1001), true);
});
