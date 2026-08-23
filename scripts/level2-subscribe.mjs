#!/usr/bin/env node
/**
 * Coinbase Advanced Trade WebSocket — level2 for ETH-USD and ETH-EUR.
 *
 * The docs example includes `"jwt": "exampleJWT"`. Do not send that string.
 * level2 is a public channel; JWT is optional and only useful if you generate
 * a real CDP token (expires in 2 minutes).
 *
 *   node scripts/level2-subscribe.mjs
 */
import {
  WS_API_URL,
  channelMessage,
  loadDotEnv,
  readCdpCredentials,
} from "./lib/coinbase-ws-auth.mjs";
import { createFeedTracker, formatGap } from "./lib/coinbase-ws-feed.mjs";

loadDotEnv();
const PRODUCT_IDS = ["ETH-USD", "ETH-EUR"];
const credentials = readCdpCredentials();
const ws = new WebSocket(WS_API_URL);
const books = new Map(PRODUCT_IDS.map((id) => [id, { bids: new Map(), asks: new Map() }]));
const tracker = createFeedTracker();
let lastResubscribe = 0;

function applyUpdates(productId, type, updates) {
  const book = books.get(productId);
  if (!book) return;
  if (type === "snapshot") {
    book.bids.clear();
    book.asks.clear();
  }
  for (const update of updates || []) {
    const side = update.side === "bid" ? book.bids : book.asks;
    const qty = Number(update.new_quantity);
    if (!Number.isFinite(qty) || qty === 0) side.delete(update.price_level);
    else side.set(update.price_level, qty);
  }
}

function printTop() {
  for (const [productId, book] of books) {
    const bids = [...book.bids.entries()].sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 5);
    const asks = [...book.asks.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).slice(0, 5);
    const bid = bids[0]?.[0] ?? "—";
    const ask = asks[0]?.[0] ?? "—";
    console.log(`${productId}  bid ${bid}  ask ${ask}`);
  }
  console.log("---");
}

function send(type, channel) {
  ws.send(JSON.stringify(channelMessage(type, channel, PRODUCT_IDS, credentials)));
}

function resubscribeLevel2() {
  const now = Date.now();
  if (now - lastResubscribe < 2000) return;
  lastResubscribe = now;
  console.log("level2 gap — resubscribing (book may be stale)");
  send("unsubscribe", "level2");
  tracker.reset("l2_data");
  for (const book of books.values()) {
    book.bids.clear();
    book.asks.clear();
  }
  send("subscribe", "level2");
}

ws.addEventListener("open", () => {
  console.log("Connected", WS_API_URL);
  console.log(credentials.ready ? "JWT: signed (fresh CDP token)" : "JWT: omitted (public channel)");
  send("subscribe", "level2");
  send("subscribe", "heartbeats");
});

ws.addEventListener("message", (event) => {
  let payload;
  try {
    payload = JSON.parse(String(event.data));
  } catch {
    return;
  }

  const observed = tracker.observe(payload);
  for (const gap of observed.gaps) console.warn(formatGap(gap));
  if (observed.resubscribeLevel2) resubscribeLevel2();

  if (payload.channel !== "l2_data" || !Array.isArray(payload.events)) return;
  for (const item of payload.events) {
    applyUpdates(item.product_id, item.type, item.updates);
  }
  printTop();
});

ws.addEventListener("error", (error) => {
  console.error("WebSocket error", error);
});

ws.addEventListener("close", (event) => {
  console.error(`Closed ${event.code} ${event.reason || ""}`);
  process.exit(event.code === 1000 ? 0 : 1);
});
