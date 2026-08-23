import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutCandleChart } from "./chart.ts";

test("layoutCandleChart maps bars to finite SVG coordinates", () => {
  const layout = layoutCandleChart(
    [
      { start: 300, open: 100, high: 110, low: 90, close: 105, volume: 2 },
      { start: 600, open: 105, high: 108, low: 95, close: 96, volume: 1 },
    ],
    1000,
    400,
  );
  assert.equal(layout.bars.length, 2);
  assert.equal(layout.bars[0].up, true);
  assert.equal(layout.bars[1].up, false);
  for (const bar of layout.bars) {
    for (const value of [bar.x, bar.wickX, bar.bodyY, bar.bodyH, bar.highY, bar.lowY, bar.volY, bar.volH]) {
      assert.equal(Number.isFinite(value), true);
    }
    assert.ok(bar.highY <= bar.bodyY);
    assert.ok(bar.lowY >= bar.bodyY);
  }
});

test("layoutCandleChart is empty-safe", () => {
  const layout = layoutCandleChart([], 1000, 400);
  assert.deepEqual(layout.bars, []);
  assert.equal(Number.isFinite(layout.min), true);
});

test("layoutCandleChart stays finite with overlays and an RSI pane", () => {
  const bars = [
    { start: 300, open: 100, high: 110, low: 90, close: 105, volume: 2 },
    { start: 600, open: 105, high: 108, low: 95, close: 96, volume: 1 },
  ];
  const layout = layoutCandleChart(bars, 1000, 480, 300, {
    overlays: [{ id: "sma", className: "sma20", values: [null, 100] }],
    volSma: [null, 1.5],
    rsi: [null, 55],
    macd: null,
  });
  assert.ok(layout.overlays[0].points.includes(","));
  assert.ok(layout.rsi);
  for (const bar of layout.bars) {
    assert.equal(Number.isFinite(bar.x), true);
  }
});
