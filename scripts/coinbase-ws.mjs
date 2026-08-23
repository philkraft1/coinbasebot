#!/usr/bin/env node
/**
 * Coinbase Advanced Trade WebSocket client.
 *
 * Public channels work unsigned. `user` and `futures_balance_summary` need a
 * real CDP JWT from .env — never send "exampleJWT" or "XYZ".
 *
 *   node scripts/coinbase-ws.mjs
 *   node scripts/coinbase-ws.mjs --channel ticker --products BTC-USD
 *   node scripts/coinbase-ws.mjs --channels ticker,level2,market_trades
 *   node scripts/coinbase-ws.mjs --channel user
 *   node scripts/coinbase-ws.mjs --log feed.jsonl
 */
import { appendFileSync } from "node:fs";
import {
  WS_API_URL,
  channelMessage,
  knownChannelValues,
  loadDotEnv,
  readCdpCredentials,
  redactJwt,
  resolveChannelName,
} from "./lib/coinbase-ws-auth.mjs";
import { createFeedTracker, formatGap } from "./lib/coinbase-ws-feed.mjs";

loadDotEnv();

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

function parseChannels() {
  const names = [];
  const single = arg("--channel", "");
  const multi = arg("--channels", "");
  if (single) names.push(single);
  if (multi) names.push(...multi.split(","));
  if (!names.length) names.push("level2");
  const resolved = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    try {
      resolved.push(resolveChannelName(name));
    } catch (error) {
      console.error(error.message);
      console.error("Known channels:", knownChannelValues().join(", "));
      process.exit(1);
    }
  }
  return [...new Set(resolved)];
}

const channels = parseChannels();
const products = arg("--products", "ETH-USD,ETH-EUR")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const logFile = arg("--log", "");
const credentials = readCdpCredentials();
const tracker = createFeedTracker();

const books = new Map();
const tickers = new Map();
const trades = [];
const candles = new Map();
const productStatus = new Map();
const userOrders = [];
let userSnapshotComplete = false;
let userSawFirstBatch = false;
let futuresSummary = null;
let lastHeartbeat = null;
let lastLevel2Resubscribe = 0;

function emptyBook() {
  return { bids: new Map(), asks: new Map() };
}

function bookFor(productId) {
  if (!books.has(productId)) books.set(productId, emptyBook());
  return books.get(productId);
}

function sendChannel(ws, type, channel) {
  const message = channelMessage(type, channel, products, credentials);
  ws.send(JSON.stringify(message));
  return message;
}

function subscribeAll(ws) {
  sendChannel(ws, "subscribe", "heartbeats");
  for (const channel of channels) {
    if (channel === "heartbeats") continue;
    sendChannel(ws, "subscribe", channel);
  }
}

function unsubscribeAll(ws) {
  for (const channel of channels) {
    if (channel === "heartbeats") continue;
    sendChannel(ws, "unsubscribe", channel);
  }
  sendChannel(ws, "unsubscribe", "heartbeats");
}

function resubscribeLevel2(ws) {
  const now = Date.now();
  if (now - lastLevel2Resubscribe < 2000) return;
  lastLevel2Resubscribe = now;
  console.log("[level2] sequence gap — book may be stale; resubscribing");
  sendChannel(ws, "unsubscribe", "level2");
  tracker.reset("l2_data");
  for (const book of books.values()) {
    book.bids.clear();
    book.asks.clear();
  }
  sendChannel(ws, "subscribe", "level2");
}

function applyLevel2(payload) {
  if (payload.channel !== "l2_data" || !Array.isArray(payload.events)) return false;
  for (const item of payload.events) {
    const book = bookFor(item.product_id);
    if (item.type === "snapshot") {
      book.bids.clear();
      book.asks.clear();
    }
    for (const update of item.updates || []) {
      const side = update.side === "bid" ? book.bids : book.asks;
      const qty = Number(update.new_quantity);
      if (!Number.isFinite(qty) || qty === 0) side.delete(update.price_level);
      else side.set(update.price_level, qty);
    }
  }
  return true;
}

function topOfBook(productId) {
  const book = books.get(productId);
  if (!book) return { bid: "—", ask: "—" };
  const bid = [...book.bids.keys()].sort((a, b) => Number(b) - Number(a))[0] ?? "—";
  const ask = [...book.asks.keys()].sort((a, b) => Number(a) - Number(b))[0] ?? "—";
  return { bid, ask };
}

function printLevel2() {
  for (const productId of books.keys()) {
    const { bid, ask } = topOfBook(productId);
    console.log(`[level2] ${productId}  bid ${bid}  ask ${ask}`);
  }
}

function applyTicker(payload) {
  if (payload.channel !== "ticker" && payload.channel !== "ticker_batch") return false;
  for (const event of payload.events || []) {
    for (const ticker of event.tickers || []) {
      tickers.set(ticker.product_id, ticker);
      const chg = ticker.price_percent_chg_24_h ? `  24h ${ticker.price_percent_chg_24_h}%` : "";
      console.log(
        `[ticker] ${ticker.product_id}  ${ticker.price}  bid ${ticker.best_bid ?? "—"}  ask ${ticker.best_ask ?? "—"}${chg}`,
      );
    }
  }
  return true;
}

function applyTrades(payload) {
  if (payload.channel !== "market_trades") return false;
  for (const event of payload.events || []) {
    for (const trade of event.trades || []) {
      trades.push(trade);
      if (trades.length > 40) trades.shift();
      console.log(
        `[trades] ${trade.product_id}  ${trade.side}  ${trade.size} @ ${trade.price}  ${trade.time ?? ""}`,
      );
    }
  }
  return true;
}

function applyCandles(payload) {
  if (payload.channel !== "candles") return false;
  for (const event of payload.events || []) {
    for (const candle of event.candles || []) {
      candles.set(candle.product_id, candle);
      console.log(
        `[candles] ${candle.product_id}  o ${candle.open}  h ${candle.high}  l ${candle.low}  c ${candle.close}  v ${candle.volume}`,
      );
    }
  }
  return true;
}

function applyStatus(payload) {
  if (payload.channel !== "status") return false;
  for (const event of payload.events || []) {
    for (const product of event.products || []) {
      const id = product.product_id || product.id;
      if (!id) continue;
      productStatus.set(id, product);
      const disabled = product.trading_disabled ? " trading_disabled" : "";
      console.log(`[status] ${id}  ${product.status ?? "unknown"}${disabled}`);
    }
  }
  return true;
}

function applyUser(payload) {
  if (payload.channel !== "user") return false;
  let batch = 0;
  for (const event of payload.events || []) {
    const orders = event.orders || [];
    batch += orders.length;
    if (event.type === "snapshot") {
      userOrders.length = 0;
      userOrders.push(...orders);
    } else {
      for (const order of orders) {
        const index = userOrders.findIndex((item) => item.order_id === order.order_id);
        if (index >= 0) userOrders[index] = order;
        else userOrders.push(order);
      }
    }
  }
  if (!userSawFirstBatch) {
    userSawFirstBatch = true;
    if (batch < 50) userSnapshotComplete = true;
  } else if (batch < 50) {
    userSnapshotComplete = true;
  }
  const flag = userSnapshotComplete ? "snapshot complete" : "snapshot pending (≥50 in a batch)";
  console.log(`[user] ${userOrders.length} open orders (${flag}; last batch ${batch})`);
  for (const order of userOrders.slice(0, 8)) {
    console.log(
      `        ${order.product_id ?? "?"}  ${order.side ?? "?"}  ${order.order_type ?? ""}  ${order.status ?? ""}  ${order.leaves_quantity ?? order.filled_size ?? ""}`,
    );
  }
  return true;
}

function applyFutures(payload) {
  if (payload.channel !== "futures_balance_summary") return false;
  futuresSummary = payload.events?.[0] ?? payload;
  console.log("[futures] balance summary");
  console.log(JSON.stringify(futuresSummary, null, 2));
  return true;
}

function applySubscriptions(payload) {
  if (payload.channel !== "subscriptions" && payload.type !== "subscriptions") return false;
  console.log("[subscriptions]", JSON.stringify(payload.events ?? payload));
  return true;
}

const ws = new WebSocket(WS_API_URL);

ws.addEventListener("open", () => {
  console.log("Connected", WS_API_URL);
  console.log(credentials.ready ? "JWT: fresh ES256 token per subscribe/unsubscribe" : "JWT: omitted (public channels)");
  console.log("Channels:", ["heartbeats", ...channels.filter((name) => name !== "heartbeats")].join(", "));
  if (products.length) console.log("Products:", products.join(", "));
  const preview = channelMessage("subscribe", channels[0], products, { ready: false });
  console.log("Subscribe shape:", JSON.stringify(redactJwt(preview), null, 2));
  subscribeAll(ws);
});

ws.addEventListener("message", (event) => {
  const data = String(event.data);
  if (logFile) appendFileSync(logFile, `${data}\n`);

  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    console.log(data);
    return;
  }

  if (payload.type === "error" || payload.message === "error") {
    console.error("[error]", payload.message || payload.reason || JSON.stringify(payload));
    return;
  }

  const observed = tracker.observe(payload);
  for (const gap of observed.gaps) {
    console.warn(`[gap] ${formatGap(gap)}`);
  }
  if (observed.heartbeat) {
    lastHeartbeat = observed.heartbeat;
    console.log(`[heartbeats] counter=${lastHeartbeat.counter}  ${lastHeartbeat.currentTime}`);
  }
  if (observed.resubscribeLevel2 && channels.includes("level2")) resubscribeLevel2(ws);

  if (applyTicker(payload)) return;
  if (applyTrades(payload)) return;
  if (applyCandles(payload)) return;
  if (applyStatus(payload)) return;
  if (applyLevel2(payload)) {
    printLevel2();
    return;
  }
  if (applyUser(payload)) return;
  if (applyFutures(payload)) return;
  if (applySubscriptions(payload)) return;
  if (payload.channel === "heartbeats") return;
  console.log(`[${payload.channel ?? payload.type ?? "frame"}]`, JSON.stringify(payload).slice(0, 400));
});

ws.addEventListener("error", (error) => {
  console.error("WebSocket error", error);
});

ws.addEventListener("close", (event) => {
  console.error(`Closed ${event.code} ${event.reason || ""}`);
  process.exit(event.code === 1000 ? 0 : 1);
});

process.on("SIGINT", () => {
  try {
    unsubscribeAll(ws);
    ws.close();
  } catch {
    process.exit(0);
  }
});
