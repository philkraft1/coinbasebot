#!/usr/bin/env node
/**
 * Build a Coinbase Advanced Trade WebSocket JWT (ES256, 2 minute expiry).
 * Needs CDP API key name + EC private key. Never use the docs placeholder exampleJWT.
 *
 *   COINBASE_API_KEY_NAME="organizations/.../apiKeys/..." \
 *   COINBASE_API_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\\n...\\n-----END EC PRIVATE KEY-----\\n" \
 *   node scripts/build-ws-jwt.mjs
 */
import { createPrivateKey, randomBytes, sign } from "node:crypto";

const keyName = process.env.COINBASE_API_KEY_NAME || process.env.COINBASE_KEY_NAME;
const keySecret = (process.env.COINBASE_API_PRIVATE_KEY || process.env.COINBASE_KEY_SECRET || "")
  .replace(/\\n/g, "\n");

if (!keyName || !keySecret.includes("BEGIN")) {
  console.error("Set COINBASE_API_KEY_NAME and COINBASE_API_PRIVATE_KEY.");
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", typ: "JWT", kid: keyName, nonce: randomBytes(16).toString("hex") };
const payload = { sub: keyName, iss: "cdp", nbf: now, exp: now + 120 };
const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const key = createPrivateKey(keySecret);
const der = sign("SHA256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
process.stdout.write(`${signingInput}.${b64url(der)}\n`);
