import assert from "node:assert/strict";
import { test } from "node:test";
import { planCandleSource, rangeStartUtc } from "./timeframes.ts";

test("YTD range starts at Jan 1 00:00 UTC of the current year", () => {
  const now = Date.UTC(2026, 7, 23, 12, 0, 0);
  assert.equal(rangeStartUtc("YTD", now), Math.floor(Date.UTC(2026, 0, 1) / 1000));
  assert.equal(rangeStartUtc("1D", now), Math.floor(now / 1000) - 86400);
});

test("planCandleSource keeps 5m for a 1-day range and steps 1m+1Y to daily", () => {
  const day = planCandleSource(300, 86400);
  assert.equal(day.granularity, "FIVE_MINUTE");
  assert.equal(day.hint, null);
  const year = planCandleSource(60, 365 * 86400);
  assert.equal(year.granularity, "ONE_DAY");
  assert.match(year.hint || "", /daily/);
});
