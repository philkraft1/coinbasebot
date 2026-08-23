#!/usr/bin/env node
/**
 * Windows-safe awal: start electron.exe first, then run the CLI.
 * Do not use bare `npx awal` — that still spawn()s electron.cmd (EINVAL).
 *
 *   node scripts/run-awal.mjs auth login kraftcoding@gmail.com
 *   node scripts/run-awal.mjs auth verify 123456
 *   node scripts/run-awal.mjs show
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findNpmCli, run } from "./lib/electron-install.mjs";
import { classifyAwalArgs, recordEvent } from "./lib/wallet-events.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-awal.mjs auth login kraftcoding@gmail.com");
  process.exit(1);
}

async function logWalletEvent(status, error) {
  try {
    const event = classifyAwalArgs(args);
    event.status = status;
    event.error = error || null;
    await recordEvent(event);
  } catch (err) {
    console.warn("wallet event not recorded:", err.message);
  }
}

const starter = join(root, "scripts", "start-wallet.mjs");
try {
  await run(process.execPath, [starter], root);

  const localAwal = join(root, "node_modules", "awal", "dist", "index.js");
  if (existsSync(localAwal)) {
    await run(process.execPath, [localAwal, ...args], root);
  } else {
    const npmCli = findNpmCli();
    if (!npmCli) {
      throw new Error("npm-cli.js not found. From this repo run: npm install");
    }
    await run(process.execPath, [npmCli, "exec", "--yes", "--", "awal", ...args], root);
  }
  await logWalletEvent("succeeded");
} catch (error) {
  await logWalletEvent("failed", error.message);
  process.exit(1);
}
