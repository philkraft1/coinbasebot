import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketCandles, mergeFiveMinuteBars, toFiveMinuteCandles } from "./parse.ts";

test("toFiveMinuteCandles merges 1-minute rows into one 5-minute bar", () => {
  const bars = toFiveMinuteCandles([
    { product_id: "BTC-USD", start: "300", open: "100", high: "101", low: "99", close: "100.5", volume: "1" },
    { product_id: "BTC-USD", start: "360", open: "100.5", high: "103", low: "100", close: "102", volume: "2" },
    { product_id: "BTC-USD", start: "600", open: "102", high: "104", low: "101", close: "103", volume: "3" },
  ]);
  assert.equal(bars.length, 2);
  assert.deepEqual(bars[0], { start: 300, open: 100, high: 103, low: 99, close: 102, volume: 3 });
  assert.equal(bars[1].start, 600);
});

test("bucketCandles supports 1m, 5m, 15m, and a custom 7-minute period", () => {
  const rows = [0, 60, 180, 300, 420, 840].map((start, i) => ({
    product_id: "BTC-USD",
    start: String(start),
    open: String(100 + i),
    high: String(101 + i),
    low: String(99 + i),
    close: String(100.5 + i),
    volume: "1",
  }));
  assert.equal(bucketCandles(rows, 60).length, 6);
  assert.equal(bucketCandles(rows, 300)[0].start, 0);
  assert.equal(bucketCandles(rows, 900).length, 1);
  const seven = bucketCandles(rows, 420);
  assert.equal(seven[0].start, 0);
  assert.equal(seven.at(-1)?.start, 840);
});

test("mergeFiveMinuteBars lets live bars replace history on the same start", () => {
  const merged = mergeFiveMinuteBars(
    [{ start: 300, open: 1, high: 2, low: 1, close: 1.5, volume: 10 }],
    [{ start: 300, open: 1, high: 3, low: 1, close: 2.5, volume: 4 }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].close, 2.5);
  assert.equal(merged[0].volume, 4);
});
