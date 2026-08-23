#!/usr/bin/env node
/**
 * Coinbase Advanced Trade WebSocket client (official JS sample, cleaned up).
 *
 * Docs sample used jsonwebtoken + placeholder keys and unsubscribed BTC-USD
 * after 5 seconds while appending every frame to Output1.txt.
 *
 * This version:
 *   - uses Node 22 WebSocket (no `ws` package)
 *   - signs with ES256 only when real CDP credentials are in the environment
 *   - never sends exampleJWT or YOUR PRIVATE KEY
 *   - stays subscribed (no demo unsubscribe)
 *
 *   node scripts/coinbase-ws.mjs
 *   node scripts/coinbase-ws.mjs --channel ticker --products BTC-USD
 *   node scripts/coinbase-ws.mjs --log feed.jsonl
 */
import { appendFileSync } from "node:fs";
import {
  CHANNEL_NAMES,
  WS_API_URL,
  channelMessage,
  loadDotEnv,
  readCdpCredentials,
} from "./lib/coinbase-ws-auth.mjs";

loadDotEnv();

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const channelName = arg("--channel", CHANNEL_NAMES.level2);
const products = arg("--products", "ETH-USD,ETH-EUR")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const logFile = arg("--log", "");

if (!CHANNEL_NAMES[channelName] && !Object.values(CHANNEL_NAMES).includes(channelName)) {
  console.error("Unknown channel. Use:", Object.values(CHANNEL_NAMES).join(", "));
  process.exit(1);
}

const credentials = readCdpCredentials();
const subscribe = channelMessage("subscribe", channelName, products, credentials);
const heartbeat = channelMessage("subscribe", "heartbeats", products, credentials);

function subscribeToProducts(ws) {
  ws.send(JSON.stringify(subscribe));
  ws.send(JSON.stringify(heartbeat));
}

function unsubscribeToProducts(ws) {
  const message = channelMessage("unsubscribe", channelName, products, credentials);
  ws.send(JSON.stringify(message));
}

const ws = new WebSocket(WS_API_URL);

ws.addEventListener("open", () => {
  console.log("Connected", WS_API_URL);
  console.log(credentials.ready ? "JWT: signed (CDP key)" : "JWT: omitted (public channel)");
  console.log("Subscribe:", JSON.stringify({ ...subscribe, jwt: subscribe.jwt ? "[redacted]" : undefined }, null, 2));
  subscribeToProducts(ws);
});

ws.addEventListener("message", (event) => {
  const data = String(event.data);
  if (logFile) appendFileSync(logFile, `${data}\n`);
  try {
    const parsed = JSON.parse(data);
    const preview = JSON.stringify(parsed);
    console.log(preview.length > 240 ? `${preview.slice(0, 240)}…` : preview);
  } catch {
    console.log(data);
  }
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
    unsubscribeToProducts(ws);
    ws.close();
  } catch {
    process.exit(0);
  }
});
