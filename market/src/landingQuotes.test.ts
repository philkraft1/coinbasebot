import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuote, formatChange, formatVolume } from "./landingQuotes.ts";

test("buildQuote prefers live ticker 24h fields and derives open from % change", () => {
  const quote = buildQuote(
    "BTC-USD",
    {
      product_id: "BTC-USD",
      price: "220",
      price_percent_chg_24_h: "10",
      high_24_h: "120",
      low_24_h: "90",
      volume_24_h: "5000",
    },
    [
      { start: 1, open: 100, high: 101, low: 99, close: 100, volume: 10 },
      { start: 2, open: 100, high: 105, low: 98, close: 104, volume: 30 },
    ],
  );
  assert.equal(quote.close, 220);
  assert.equal(Number((quote.open ?? 0).toFixed(2)), 200);
  assert.equal(quote.high, 120);
  assert.equal(quote.low, 90);
  assert.equal(quote.changePct, 10);
  assert.equal(quote.volume, 30);
  assert.equal(quote.volume24h, 5000);
  assert.equal(quote.avgVolume, 20);
});

test("buildQuote falls back to candle OHLC when the ticker is still empty", () => {
  const quote = buildQuote("ETH-USD", undefined, [
    { start: 1, open: 10, high: 12, low: 9, close: 11, volume: 4 },
    { start: 2, open: 11, high: 13, low: 10, close: 12, volume: 6 },
  ]);
  assert.equal(quote.open, 10);
  assert.equal(quote.high, 13);
  assert.equal(quote.low, 9);
  assert.equal(quote.close, 12);
  assert.equal(quote.volume, 6);
  assert.equal(quote.volume24h, null);
});

test("format helpers compact volume and signed percent", () => {
  assert.equal(formatVolume(2_500_000), "2.50M");
  assert.equal(formatVolume(1500), "1.50K");
  assert.equal(formatChange(1.2), "+1.20%");
  assert.equal(formatChange(-0.5), "-0.50%");
  assert.equal(formatChange(null), "—");
});
