import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FALLBACK_TOP_USD,
  coinbaseSpotUrl,
  fillTopUsdSpot,
  isPublicUsdSpot,
  rankTopUsdSpot,
} from "./topProducts.ts";

test("keeps USD spot and allowed USDC, drops ETH-USDC and disabled pairs", () => {
  assert.equal(isPublicUsdSpot({ product_id: "ETH-USD", quote_currency_id: "USD", product_type: "SPOT" }), true);
  assert.equal(isPublicUsdSpot({ product_id: "USDT-USDC", quote_currency_id: "USDC", product_type: "SPOT" }), true);
  assert.equal(isPublicUsdSpot({ product_id: "ETH-USDC", quote_currency_id: "USDC", product_type: "SPOT" }), false);
  assert.equal(isPublicUsdSpot({ product_id: "../WALLET-USD", quote_currency_id: "USD", product_type: "SPOT" }), false);
  assert.equal(
    isPublicUsdSpot({
      product_id: "BTC-USD",
      quote_currency_id: "USD",
      product_type: "SPOT",
      trading_disabled: true,
    }),
    false,
  );
});

test("coinbaseSpotUrl encodes external path input", () => {
  assert.equal(
    coinbaseSpotUrl("BTC-USD/../../fake"),
    "https://www.coinbase.com/advanced-trade/spot/BTC-USD%2F..%2F..%2Ffake",
  );
});

test("sorts by quote volume, caps at 10, and drops ETH-USDC", () => {
  const ranked = rankTopUsdSpot(
    [
      { product_id: "ETH-USDC", quote_currency_id: "USDC", approximate_quote_24h_volume: "999999" },
      { product_id: "SOL-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "200" },
      { product_id: "BTC-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "500" },
      { product_id: "ETH-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "400" },
      { product_id: "ADA-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "50" },
      { product_id: "XRP-USD", quote_currency_id: "USD", volume_24h: "10" },
      { product_id: "DOGE-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "80" },
      { product_id: "LINK-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "70" },
      { product_id: "LTC-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "60" },
      { product_id: "AVAX-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "40" },
      { product_id: "SHIB-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "30" },
      { product_id: "DOT-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "20" },
      { product_id: "UNI-USD", quote_currency_id: "USD", approximate_quote_24h_volume: "15" },
    ],
    10,
  );
  assert.deepEqual(ranked, [
    "BTC-USD",
    "ETH-USD",
    "SOL-USD",
    "DOGE-USD",
    "LINK-USD",
    "LTC-USD",
    "ADA-USD",
    "AVAX-USD",
    "SHIB-USD",
    "DOT-USD",
  ]);
  assert.equal(ranked.includes("ETH-USDC"), false);
  assert.equal(ranked.length, 10);
});

test("fillTopUsdSpot pads with the hardcoded majors", () => {
  assert.deepEqual(fillTopUsdSpot(["BTC-USD", "ETH-USD"], 10), [
    "BTC-USD",
    "ETH-USD",
    ...FALLBACK_TOP_USD.filter((id) => id !== "BTC-USD" && id !== "ETH-USD"),
  ]);
});
