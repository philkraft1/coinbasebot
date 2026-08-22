#!/usr/bin/env node
/**
 * Start the Coinbase Agentic Wallet UI without awal's broken Windows spawn.
 * Spawns electron.exe (not electron.cmd) and waits for C:\\tmp\\payments-mcp-ui.lock
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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

function findWallet() {
  const dirs = [join(homedir(), ".payments-mcp")];
  if (process.env.LOCALAPPDATA) {
    dirs.push(join(process.env.LOCALAPPDATA, "awal", "Data", "server"));
  }
  const electronName = process.platform === "win32" ? "electron.exe" : "electron";
  for (const dir of dirs) {
    const electron = join(dir, "node_modules", "electron", "dist", electronName);
    const script = join(dir, "bundle-electron.js");
    if (existsSync(electron) && existsSync(script)) {
      return { electron, script, dir };
    }
  }
  return null;
}

if (walletAlreadyRunning()) {
  console.log("Wallet already running (", lockFile, ")");
  process.exit(0);
}

const wallet = findWallet();
if (!wallet) {
  console.error("Wallet install not found. Run: node scripts/install-payments-mcp.mjs");
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

const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500));
  if (walletAlreadyRunning()) {
    console.log("Wallet is up. Keep this window's wallet UI open, then run:");
    console.log("  npx awal auth login kraftcoding@gmail.com");
    process.exit(0);
  }
}

console.error("Wallet did not create", lockFile, "within 30s.");
console.error("If a window opened, wait a few seconds and retry npx awal.");
process.exit(1);
