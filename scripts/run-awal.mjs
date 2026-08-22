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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-awal.mjs auth login kraftcoding@gmail.com");
  process.exit(1);
}

const starter = join(root, "scripts", "start-wallet.mjs");
await run(process.execPath, [starter], root);

const localAwal = join(root, "node_modules", "awal", "dist", "index.js");
if (existsSync(localAwal)) {
  await run(process.execPath, [localAwal, ...args], root);
  process.exit(0);
}

const npmCli = findNpmCli();
if (!npmCli) {
  throw new Error("npm-cli.js not found. From this repo run: npm install");
}
await run(process.execPath, [npmCli, "exec", "--yes", "--", "awal", ...args], root);
