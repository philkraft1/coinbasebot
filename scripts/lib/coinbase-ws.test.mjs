import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  CHANNELS_WITHOUT_PRODUCTS,
  channelMessage,
  knownChannelValues,
  resolveChannelName,
} from "./coinbase-ws-auth.mjs";
import { createFeedTracker } from "./coinbase-ws-feed.mjs";

test("catalog includes futures_balance_summary and resolves aliases", () => {
  assert.ok(knownChannelValues().includes("futures_balance_summary"));
  assert.equal(resolveChannelName("tickers"), "ticker");
  assert.equal(resolveChannelName("user"), "user");
});

test("heartbeats and futures subscribe omit product_ids", () => {
  const heartbeats = channelMessage("subscribe", "heartbeats", ["ETH-USD"]);
  assert.deepEqual(heartbeats, { type: "subscribe", channel: "heartbeats" });
  assert.equal("product_ids" in heartbeats, false);

  const creds = { ready: false };
  assert.throws(() => channelMessage("subscribe", "futures_balance_summary", [], creds));
  assert.ok(CHANNELS_WITHOUT_PRODUCTS.has("futures_balance_summary"));
});

test("user may omit product_ids; public channels reject most -USDC pairs", () => {
  assert.throws(() => channelMessage("subscribe", "user", [], { ready: false }));

  assert.throws(() => channelMessage("subscribe", "ticker", ["ETH-USDC"]));
  const ok = channelMessage("subscribe", "ticker", ["USDT-USDC", "ETH-USD"]);
  assert.deepEqual(ok.product_ids, ["USDT-USDC", "ETH-USD"]);
});

test("fresh JWT on every subscribe when credentials are present", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const signingKey = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const credentials = { apiKey: "organizations/test/apiKeys/test", signingKey, ready: true };
  const first = channelMessage("subscribe", "ticker", ["ETH-USD"], credentials);
  const second = channelMessage("subscribe", "ticker", ["ETH-USD"], credentials);
  assert.ok(first.jwt && second.jwt);
  assert.notEqual(first.jwt, second.jwt);

  const userAll = channelMessage("subscribe", "user", [], credentials);
  assert.equal("product_ids" in userAll, false);
  const userSome = channelMessage("subscribe", "user", ["ETH-USD"], credentials);
  assert.deepEqual(userSome.product_ids, ["ETH-USD"]);

  const futures = channelMessage("subscribe", "futures_balance_summary", ["ETH-USD"], credentials);
  assert.equal(futures.channel, "futures_balance_summary");
  assert.equal("product_ids" in futures, false);
});

test("sequence and heartbeat gaps; level2 gap asks for resubscribe", () => {
  const tracker = createFeedTracker();
  const first = tracker.observe({ channel: "subscriptions", sequence_num: 0 });
  assert.equal(first.resubscribeLevel2, false);
  const contiguous = tracker.observe({ channel: "status", sequence_num: 1 });
  assert.equal(contiguous.gaps.length, 0);
  const gap = tracker.observe({ channel: "l2_data", sequence_num: 7 });
  assert.equal(gap.resubscribeLevel2, true);
  assert.equal(gap.gaps[0].expected, 2);
  assert.equal(gap.gaps[0].received, 7);

  tracker.observe({
    channel: "heartbeats",
    sequence_num: 0,
    events: [{ heartbeat_counter: 10 }],
  });
  const hb = tracker.observe({
    channel: "heartbeats",
    sequence_num: 1,
    events: [{ heartbeat_counter: "12" }],
  });
  assert.equal(hb.gaps.some((item) => item.kind === "heartbeat" && item.expected === 11), true);
});
