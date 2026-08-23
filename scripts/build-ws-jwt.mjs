#!/usr/bin/env node
import { buildWsJwt, loadDotEnv, readCdpCredentials } from "./lib/coinbase-ws-auth.mjs";

loadDotEnv();
const credentials = readCdpCredentials();
if (!credentials.ready) {
  console.error("Set COINBASE_API_KEY_NAME and COINBASE_API_PRIVATE_KEY.");
  process.exit(1);
}
process.stdout.write(`${buildWsJwt(credentials.apiKey, credentials.signingKey)}\n`);
