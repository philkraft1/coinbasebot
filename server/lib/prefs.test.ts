import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PREFS, prefsAreUnset, sanitizePrefs } from "./prefs.ts";

test("sanitizePrefs drops unknown keys and fills defaults", () => {
  const clean = sanitizePrefs({
    interval: "15m",
    extra: "nope",
    customMinutes: 9,
    studies: { sma50: true, evil: 1, bbPeriod: 1 },
    focusedProduct: "eth-usd",
  });
  assert.equal(clean.interval, "15m");
  assert.equal(clean.customMinutes, 9);
  assert.equal(clean.studies.sma50, true);
  assert.equal(clean.studies.sma20, true);
  assert.equal(clean.studies.bbPeriod, 2);
  assert.equal(clean.focusedProduct, "ETH-USD");
  assert.equal("extra" in clean, false);
  assert.equal("evil" in clean.studies, false);
});

test("sanitizePrefs rejects bad interval, range, and product ids", () => {
  const clean = sanitizePrefs({
    interval: "2h",
    range: "forever",
    customMinutes: 99999,
    focusedProduct: "drop table",
  });
  assert.equal(clean.interval, DEFAULT_PREFS.interval);
  assert.equal(clean.range, DEFAULT_PREFS.range);
  assert.equal(clean.customMinutes, 1440);
  assert.equal(clean.focusedProduct, DEFAULT_PREFS.focusedProduct);
});

test("prefsAreUnset treats empty objects as missing", () => {
  assert.equal(prefsAreUnset(null), true);
  assert.equal(prefsAreUnset({}), true);
  assert.equal(prefsAreUnset({ interval: "1m" }), false);
});
