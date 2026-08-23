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
  const prefs = normalizeChartPrefs({
    interval: "tick",
    focusedProduct: "nope",
    studies: { rsi: "yes", rsiPeriod: 1_000_000, bbStd: -5, constructor: true },
  });
  assert.equal(prefs.interval, DEFAULT_PREFS.interval);
  assert.equal(prefs.focusedProduct, DEFAULT_PREFS.focusedProduct);
  assert.equal(prefs.studies.rsi, DEFAULT_PREFS.studies.rsi);
  assert.equal(prefs.studies.rsiPeriod, 400);
  assert.equal(prefs.studies.bbStd, 0.1);
  assert.equal("constructor" in prefs.studies, false);
});
