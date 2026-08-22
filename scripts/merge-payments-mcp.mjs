#!/usr/bin/env node
/**
 * Merge payments-mcp into Cursor and Claude Desktop configs.
 * Does not remove other MCP servers.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const home = homedir();
const bundle = join(home, ".payments-mcp", "bundle.js");

if (!existsSync(bundle)) {
  console.error("bundle.js not found at", bundle);
  process.exit(1);
}

const configs = [
  join(home, ".cursor", "mcp.json"),
  join(
    home,
    "AppData",
    "Local",
    "Packages",
    "Claude_pzs8sxrjxfjjc",
    "LocalCache",
    "Roaming",
    "Claude",
    "claude_desktop_config.json",
  ),
  join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
];

const entry = {
  command: "node",
  args: [bundle],
};

for (const configPath of configs) {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    console.log("Skipping (folder not found yet):", configPath);
    continue;
  }

  let json = { mcpServers: {} };
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf8").trim();
      if (raw) json = JSON.parse(raw);
    } catch {
      console.error("WARNING: could not parse, leaving alone:", configPath);
      continue;
    }
  }

  if (!json.mcpServers || typeof json.mcpServers !== "object") {
    json.mcpServers = {};
  }
  json.mcpServers["payments-mcp"] = entry;

  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log("Merged payments-mcp into", configPath);
}

console.log("Done. Next: npx awal auth login kraftcoding@gmail.com");
