import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PREFS, normalizeChartPrefs } from "./prefs.ts";

test("normalizeChartPrefs keeps a valid interval and product", () => {
  const prefs = normalizeChartPrefs({
    interval: "1H",
    range: "YTD",
    customMinutes: 12,
    focusedProduct: "sol-usd",
    studies: { rsi: true },
  });
  assert.equal(prefs.interval, "1H");
  assert.equal(prefs.range, "YTD");
  assert.equal(prefs.customMinutes, 12);
  assert.equal(prefs.focusedProduct, "SOL-USD");
  assert.equal(prefs.studies.rsi, true);
  assert.equal(prefs.studies.sma20, true);
});

test("normalizeChartPrefs falls back on garbage input", () => {
  const prefs = normalizeChartPrefs({ interval: "tick", focusedProduct: "nope" });
  assert.equal(prefs.interval, DEFAULT_PREFS.interval);
  assert.equal(prefs.focusedProduct, DEFAULT_PREFS.focusedProduct);
});
