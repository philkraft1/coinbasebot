#!/usr/bin/env node
/**
 * Patch local node_modules/awal so Windows uses electron.exe, not electron.cmd.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "node_modules", "awal", "dist", "utils", "serverManager.js");

if (!existsSync(target)) {
  console.log("awal is not installed locally yet. npm install, then re-run this patch.");
  process.exit(0);
}

const before = readFileSync(target, "utf8");
if (before.includes("electron/dist/electron.exe")) {
  console.log("awal serverManager already patched.");
  process.exit(0);
}

const oldPaths = `function getServerPaths() {
    const dataDir = paths.data;
    const bundleDir = path.join(dataDir, 'server');
    // Electron binary location depends on platform
    const electronBinName = process.platform === 'win32' ? 'electron.cmd' : 'electron';
    return {
        dataDir,
        bundleDir,
        versionFile: path.join(bundleDir, '.version'),
        electronBin: path.join(bundleDir, 'node_modules', '.bin', electronBinName),
        bundleElectron: path.join(bundleDir, 'bundle-electron.js'),
    };
}`;

const newPaths = `function getServerPaths() {
    const homeMcp = path.join(process.env.USERPROFILE || process.env.HOME || '', '.payments-mcp');
    const winElectron = path.join(homeMcp, 'node_modules', 'electron', 'dist', 'electron.exe');
    if (process.platform === 'win32' && existsSync(winElectron)) {
        return {
            dataDir: homeMcp,
            bundleDir: homeMcp,
            versionFile: path.join(homeMcp, '.version'),
            electronBin: winElectron,
            bundleElectron: path.join(homeMcp, 'bundle-electron.js'),
        };
    }
    const dataDir = paths.data;
    const bundleDir = path.join(dataDir, 'server');
    const electronBinName = process.platform === 'win32' ? 'electron.exe' : 'electron';
    const electronBin = process.platform === 'win32'
        ? path.join(bundleDir, 'node_modules', 'electron', 'dist', electronBinName)
        : path.join(bundleDir, 'node_modules', '.bin', electronBinName);
    return {
        dataDir,
        bundleDir,
        versionFile: path.join(bundleDir, '.version'),
        electronBin,
        bundleElectron: path.join(bundleDir, 'bundle-electron.js'),
    };
}`;

if (!before.includes(oldPaths)) {
  console.error("Unrecognized awal serverManager.js — cannot patch.");
  process.exit(1);
}

writeFileSync(target, before.replace(oldPaths, newPaths));
console.log("Patched", target);
