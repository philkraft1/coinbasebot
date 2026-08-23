#!/usr/bin/env node
/**
 * Coinbase Advanced Trade WebSocket — level2 for ETH-USD and ETH-EUR.
 *
 * The docs example includes `"jwt": "exampleJWT"`. Do not send that string.
 * level2 is a public channel; JWT is optional and only useful if you generate
 * a real CDP token (expires in 2 minutes).
 *
 *   node scripts/level2-subscribe.mjs
 *   JWT=$(node scripts/build-ws-jwt.mjs) node scripts/level2-subscribe.mjs
 */
const WS_URL = "wss://advanced-trade-ws.coinbase.com";
const PRODUCT_IDS = ["ETH-USD", "ETH-EUR"];

function subscribeMessage(channel, jwt) {
  const message = {
    type: "subscribe",
    product_ids: PRODUCT_IDS,
    channel,
  };
  if (jwt && jwt !== "exampleJWT") message.jwt = jwt;
  return message;
}

const jwt = process.env.JWT || process.env.COINBASE_WS_JWT || "";
const ws = new WebSocket(WS_URL);
const books = new Map(PRODUCT_IDS.map((id) => [id, { bids: new Map(), asks: new Map() }]));

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

ws.addEventListener("open", () => {
  console.log("Connected", WS_URL);
  console.log("Subscribe:", JSON.stringify(subscribeMessage("level2", jwt), null, 2));
  ws.send(JSON.stringify(subscribeMessage("level2", jwt)));
  ws.send(JSON.stringify(subscribeMessage("heartbeats", jwt)));
});

ws.addEventListener("message", (event) => {
  let payload;
  try {
    payload = JSON.parse(String(event.data));
  } catch {
    return;
  }
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
