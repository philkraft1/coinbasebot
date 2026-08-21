#!/usr/bin/env node
/**
 * Launches the Coinbase Payments MCP server from ~/.payments-mcp.
 * Cursor starts this process over stdio via .cursor/mcp.json.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const bundle = join(homedir(), ".payments-mcp", "bundle.js");

if (!existsSync(bundle)) {
  console.error(
    [
      "Coinbase Payments MCP is not installed on this machine.",
      "",
      "Install it, then restart Cursor:",
      "  npx @coinbase/payments-mcp",
      "",
      "Docs: https://docs.cdp.coinbase.com/agentic-wallet/mcp/quickstart",
    ].join("\n"),
  );
  process.exit(1);
}

const child = spawn(process.execPath, [bundle], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  console.error("Failed to start Payments MCP:", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
