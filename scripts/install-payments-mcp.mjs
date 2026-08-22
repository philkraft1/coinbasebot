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
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const BASE = "https://payments-mcp.coinbase.com";
const installDir = join(homedir(), ".payments-mcp");

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`> ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

function findNpmCli() {
  const here = dirname(process.execPath);
  const candidates = [
    join(here, "node_modules", "npm", "bin", "npm-cli.js"),
    join(here, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return null;
}

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

const npmCli = findNpmCli();
console.log("Installing Electron (npm install in", installDir, ")");
if (npmCli) {
  await run(process.execPath, [npmCli, "install", "--no-fund", "--no-audit"], installDir);
} else {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  await run(npmCmd, ["install", "--no-fund", "--no-audit"], installDir);
}

const electronInstaller = join(installDir, "node_modules", "electron", "install.js");
if (existsSync(electronInstaller)) {
  console.log("Running Electron downloader");
  try {
    await run(process.execPath, [electronInstaller], dirname(electronInstaller));
  } catch (error) {
    console.warn("Electron binary download failed. Payments MCP will not start without it.");
    console.warn(error.message);
  }
}

if (!existsSync(bundle)) {
  throw new Error("bundle.js missing after install.");
}

const fix = join(dirname(fileURLToPath(import.meta.url)), "fix-awal-windows.mjs");
if (existsSync(fix)) {
  await run(process.execPath, [fix], installDir);
}

console.log("OK:", bundle);
