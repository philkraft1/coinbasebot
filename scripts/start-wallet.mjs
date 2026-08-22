#!/usr/bin/env node
/**
 * Start the Coinbase Agentic Wallet UI without awal's broken Windows spawn.
 * Spawns electron.exe (not electron.cmd) and waits for C:\\tmp\\payments-mcp-ui.lock
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeWalletGap,
  ensureElectron,
  findWallet,
  installDir,
} from "./lib/electron-install.mjs";

await import(new URL("./fix-awal-windows.mjs", import.meta.url));

const lockFile =
  process.platform === "win32"
    ? "C:\\tmp\\payments-mcp-ui.lock"
    : "/tmp/payments-mcp-ui.lock";

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function walletAlreadyRunning() {
  if (!existsSync(lockFile)) return false;
  const pid = Number.parseInt(readFileSync(lockFile, "utf8").trim(), 10);
  return Number.isFinite(pid) && isPidAlive(pid);
}

if (walletAlreadyRunning()) {
  console.log("Wallet already running (", lockFile, ")");
  process.exit(0);
}

if (existsSync(join(installDir, "bundle-electron.js"))) {
  try {
    await ensureElectron(installDir);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const wallet = findWallet();
if (!wallet) {
  console.error("Wallet install not found. Electron never finished downloading.");
  console.error(describeWalletGap());
  console.error("Run: node scripts/install-payments-mcp.mjs");
  process.exit(1);
}

console.log("Starting wallet from", wallet.dir);
const child = spawn(wallet.electron, [wallet.script], {
  detached: true,
  stdio: "ignore",
  shell: false,
  env: {
    ...process.env,
    STARTED_BY_CLI: "true",
    WALLET_STANDALONE: "true",
  },
});
child.unref();

const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500));
  if (walletAlreadyRunning()) {
    console.log("Wallet is up. Leave the wallet window open, then run:");
    console.log("  scripts\\awal.cmd auth login kraftcoding@gmail.com");
    process.exit(0);
  }
}

console.error("Wallet did not create", lockFile, "within 45s.");
console.error("If a window opened, wait a few seconds and run scripts\\awal.cmd auth login ...");
process.exit(1);
