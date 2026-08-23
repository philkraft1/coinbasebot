import assert from "node:assert/strict";
import { test } from "node:test";
import { demoBars, landingExamples } from "./landingExamples.ts";

test("demoBars is deterministic and builds valid OHLC", () => {
  const a = demoBars(11, 100, 2, 8);
  const b = demoBars(11, 100, 2, 8);
  assert.equal(a.length, 8);
  assert.deepEqual(a, b);
  for (const bar of a) {
    assert.equal(bar.high >= Math.max(bar.open, bar.close), true);
    assert.equal(bar.low <= Math.min(bar.open, bar.close), true);
    assert.equal(bar.volume > 0, true);
  }
});

test("landingExamples returns a two-column showcase of four USD pairs", () => {
  const rows = landingExamples();
  assert.deepEqual(
    rows.map((row) => row.productId),
    ["BTC-USD", "ETH-USD", "SOL-USD", "LINK-USD"],
  );
  assert.equal(rows.every((row) => row.bars.length === 36), true);
  assert.equal(Number.isFinite(rows[0].last), true);
});
