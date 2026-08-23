import { createPrivateKey, randomBytes, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const WS_API_URL = "wss://advanced-trade-ws.coinbase.com";

/** Catalog names plus the `tickers` alias used in older docs samples. */
export const CHANNEL_NAMES = {
  heartbeats: "heartbeats",
  candles: "candles",
  status: "status",
  ticker: "ticker",
  tickers: "ticker",
  ticker_batch: "ticker_batch",
  level2: "level2",
  market_trades: "market_trades",
  user: "user",
  futures_balance_summary: "futures_balance_summary",
};

export const PRIVATE_CHANNELS = new Set(["user", "futures_balance_summary"]);

/** Docs: these subscribe frames are `{ type, channel }` only. */
export const CHANNELS_WITHOUT_PRODUCTS = new Set([
  "heartbeats",
  "futures_balance_summary",
]);

/** Public books reject most `-USDC` pairs. */
export const USDC_ALLOWED_PUBLIC = new Set(["USDT-USDC", "EURC-USDC"]);

export function knownChannelValues() {
  return [...new Set(Object.values(CHANNEL_NAMES))];
}

export function resolveChannelName(name) {
  if (CHANNEL_NAMES[name]) return CHANNEL_NAMES[name];
  if (Object.values(CHANNEL_NAMES).includes(name)) return name;
  throw new Error(`Unknown channel "${name}". Use: ${knownChannelValues().join(", ")}`);
}

export function isPrivateChannel(channelName) {
  return PRIVATE_CHANNELS.has(resolveChannelName(channelName));
}

export function loadDotEnv(file = ".env") {
  const path = resolve(file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function readCdpCredentials() {
  const apiKey = (
    process.env.COINBASE_API_KEY_NAME ||
    process.env.COINBASE_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
  const signingKey = (
    process.env.COINBASE_API_PRIVATE_KEY ||
    process.env.COINBASE_KEY_SECRET ||
    process.env.SIGNING_KEY ||
    ""
  )
    .trim()
    .replace(/\\n/g, "\n");

  const placeholder =
    !apiKey ||
    apiKey.includes("{org_id}") ||
    apiKey.includes("{key_id}") ||
    !signingKey.includes("BEGIN") ||
    signingKey.includes("YOUR PRIVATE KEY");

  return { apiKey, signingKey, ready: !placeholder };
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function buildWsJwt(apiKey, signingKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "ES256",
    kid: apiKey,
    nonce: randomBytes(16).toString("hex"),
  };
  const payload = {
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    sub: apiKey,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(signingKey);
  const der = sign("SHA256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(der)}`;
}

export function signWithJWT(message, credentials = readCdpCredentials()) {
  if (!credentials.ready) {
    throw new Error(
      "Missing Coinbase CDP API key. Set COINBASE_API_KEY_NAME and COINBASE_API_PRIVATE_KEY (not the docs placeholders).",
    );
  }
  const jwt = buildWsJwt(credentials.apiKey, credentials.signingKey);
  return { ...message, jwt };
}

export function assertPublicProductIds(products) {
  const bad = (products || []).filter((id) => {
    const upper = String(id).toUpperCase();
    return upper.endsWith("-USDC") && !USDC_ALLOWED_PUBLIC.has(upper);
  });
  if (bad.length) {
    throw new Error(
      `Public channels reject ${bad.join(", ")}. Only USDT-USDC and EURC-USDC are allowed among -USDC pairs.`,
    );
  }
}

/**
 * Build a subscribe/unsubscribe frame.
 * Always mints a fresh JWT when CDP credentials are present (2 minute expiry).
 * Never reuse a previously signed object.
 */
export function channelMessage(type, channelName, products = [], credentials = readCdpCredentials()) {
  const channel = resolveChannelName(channelName);
  const message = { type, channel };

  if (!CHANNELS_WITHOUT_PRODUCTS.has(channel)) {
    const ids = Array.isArray(products) ? products.map((id) => String(id).trim()).filter(Boolean) : [];
    if (channel === "user") {
      if (ids.length > 0) message.product_ids = ids;
    } else {
      assertPublicProductIds(ids);
      message.product_ids = ids;
    }
  }

  if (PRIVATE_CHANNELS.has(channel) && !credentials.ready) {
    throw new Error(
      `Channel "${channel}" requires a real CDP JWT. Set COINBASE_API_KEY_NAME and COINBASE_API_PRIVATE_KEY.`,
    );
  }
  if (credentials.ready) return signWithJWT(message, credentials);
  return message;
}

export function redactJwt(message) {
  if (!message || !message.jwt) return message;
  return { ...message, jwt: "[redacted]" };
}
