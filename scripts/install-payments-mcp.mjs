#!/usr/bin/env node
/**
 * Install ~/.payments-mcp without Coinbase's Windows preflight.
 *
 * Official `npx @coinbase/payments-mcp` on Windows runs:
 *   spawn(process.execPath, ["--version"], { shell: true })
 * If Node lives in "C:\\Program Files\\nodejs\\node.exe", cmd.exe splits
 * on the space and the installer reports "Node.js is not available".
 *
 * This script uses the same zip Coinbase serves, but never enables shell.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { ensureElectron, installDir, run } from "./lib/electron-install.mjs";

const BASE = "https://payments-mcp.coinbase.com";

function unzipBuffer(buffer, dest) {
  mkdirSync(dest, { recursive: true });
  let offset = 0;
  let files = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;
    const data = buffer.subarray(dataStart, dataStart + compSize);
    const outPath = join(dest, name);
    if (name.endsWith("/")) {
      mkdirSync(outPath, { recursive: true });
    } else {
      mkdirSync(dirname(outPath), { recursive: true });
      let output = data;
      if (method === 8) output = inflateRawSync(data);
      else if (method !== 0) throw new Error(`Unsupported zip method ${method} for ${name}`);
      writeFileSync(outPath, output);
      files += 1;
    }
    offset = dataStart + compSize;
  }
  if (files === 0) throw new Error("Zip contained no files.");
  console.log(`Extracted ${files} files`);
}

console.log("Node:", process.version, process.execPath);
if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Node 22+ is required.");
  process.exit(1);
}

const versionRes = await fetch(`${BASE}/api/version`);
if (!versionRes.ok) {
  throw new Error(`Version API failed: ${versionRes.status}`);
}
const { version } = await versionRes.json();
if (!version) throw new Error("Version API returned no version");
console.log("Remote Payments MCP:", version);

const zipUrl = `${BASE}/install/payments-mcp-v${version}.zip`;
const zipPath = join(tmpdir(), `payments-mcp-v${version}.zip`);
console.log("Downloading", zipUrl);
const zipRes = await fetch(zipUrl);
if (!zipRes.ok) throw new Error(`Download failed: ${zipRes.status} ${zipUrl}`);
writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));

console.log("Extracting to", installDir);
unzipBuffer(readFileSync(zipPath), installDir);

const bundle = join(installDir, "bundle.js");
if (!existsSync(bundle)) {
  throw new Error(`Extract finished but ${bundle} is missing.`);
}

await ensureElectron(installDir);

if (!existsSync(bundle)) {
  throw new Error("bundle.js missing after install.");
}

const fix = join(dirname(fileURLToPath(import.meta.url)), "fix-awal-windows.mjs");
if (existsSync(fix)) {
  await run(process.execPath, [fix], installDir);
}

console.log("OK:", bundle);
