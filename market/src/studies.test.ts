import assert from "node:assert/strict";
import { test } from "node:test";
import { ema, macd, rsi, sma } from "./studies.ts";

test("SMA of [1,2,3,4,5] period 3 is 2,3,4", () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test("RSI is 100 after a straight run-up", () => {
  const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const values = rsi(closes, 14);
  assert.equal(values[14], 100);
});

test("MACD line is fast EMA minus slow EMA", () => {
  const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
  const series = macd(closes, 12, 26, 9);
  const last = closes.length - 1;
  const fast = ema(closes, 12)[last];
  const slow = ema(closes, 26)[last];
  assert.ok(fast != null && slow != null && series.macd[last] != null);
  assert.ok(Math.abs((series.macd[last] as number) - ((fast as number) - (slow as number))) < 1e-9);
  assert.equal(Number.isFinite(series.hist[last] as number), true);
});
