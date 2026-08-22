#!/usr/bin/env node
/**
 * Patch Coinbase awal / Payments MCP so they work on Windows.
 *
 * Upstream awal@2.12.1 still has the bugs from
 * https://github.com/x402-foundation/x402/issues/1372
 *   1. spawn(electron.cmd) without shell → EINVAL on Node 22
 *   2. IPC handler runs `ps -p` and rejects every request when that fails
 *   3. Lock/IPC paths hardcoded to /tmp → C:\tmp, which does not exist
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const IPC_NEEDLE =
  'try{let f=i9(`ps -p ${a.pid} -o command=`,{encoding:"utf8",stdio:"pipe"});if(!(f.includes("payments-mcp-server")||f.includes("payments-mcp-cli")||f.includes("awal-cli")||f.includes("bundle-electron"))){j.security.warning({message:"Rejecting request from non-payments-mcp process",pid:process.pid,senderPid:a.pid,channel:a.channel}),Ce.unlinkSync(r);return}}catch{j.bridge.warning({message:"Could not validate process, rejecting",pid:process.pid,senderPid:a.pid,channel:a.channel}),Ce.unlinkSync(r);return}';

const IPC_PATCH =
  'if(process.platform!=="win32"){try{let f=i9(`ps -p ${a.pid} -o command=`,{encoding:"utf8",stdio:"pipe"});if(!(f.includes("payments-mcp-server")||f.includes("payments-mcp-cli")||f.includes("awal-cli")||f.includes("bundle-electron"))){j.security.warning({message:"Rejecting request from non-payments-mcp process",pid:process.pid,senderPid:a.pid,channel:a.channel}),Ce.unlinkSync(r);return}}catch{j.bridge.warning({message:"Could not validate process, rejecting",pid:process.pid,senderPid:a.pid,channel:a.channel}),Ce.unlinkSync(r);return}}';

function ensureWindowsTmp() {
  if (process.platform !== "win32") return;
  const dirs = [
    "C:\\tmp",
    "C:\\tmp\\payments-mcp-ui-bridge",
    "C:\\tmp\\payments-mcp-ui-bridge\\requests",
    "C:\\tmp\\payments-mcp-ui-bridge\\responses",
  ];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
  console.log("OK: C:\\tmp IPC directories");
}

function patchBundleElectron(file) {
  if (!existsSync(file)) return false;
  const source = readFileSync(file, "utf8");
  if (source.includes('if(process.platform!=="win32"){try{let f=i9(`ps -p ${a.pid}')) {
    console.log("Already patched:", file);
    return true;
  }
  if (!source.includes(IPC_NEEDLE)) {
    console.warn("Unrecognized bundle (IPC needle missing):", file);
    return false;
  }
  writeFileSync(file, source.replace(IPC_NEEDLE, IPC_PATCH));
  console.log("Patched IPC check:", file);
  return true;
}

function writeSafeLauncher(dir) {
  const launcher = join(dir, "bundle.js");
  const electronJs = join(dir, "bundle-electron.js");
  if (!existsSync(electronJs)) return;
  writeFileSync(
    launcher,
    `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const script = join(root, "bundle-electron.js");
const electron = process.platform === "win32"
  ? join(root, "node_modules", "electron", "dist", "electron.exe")
  : join(root, "node_modules", "electron", "dist", "electron");

if (!existsSync(electron)) {
  console.error("Electron binary missing:", electron);
  process.exit(1);
}

const child = spawn(electron, [script], {
  stdio: "inherit",
  env: { ...process.env },
  shell: false,
});
child.on("error", (error) => {
  console.error("Failed to start Electron:", error);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code || 0));
`,
  );
  console.log("Wrote Windows-safe launcher:", launcher);
}

function candidateDirs() {
  const dirs = [join(homedir(), ".payments-mcp")];
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    dirs.push(join(localAppData, "awal", "Data", "server"));
  }
  return dirs;
}

ensureWindowsTmp();
let patched = 0;
for (const dir of candidateDirs()) {
  if (patchBundleElectron(join(dir, "bundle-electron.js"))) patched += 1;
  writeSafeLauncher(dir);
}
if (patched === 0) {
  console.log("No wallet bundle found yet. Run: node scripts/install-payments-mcp.mjs");
}
