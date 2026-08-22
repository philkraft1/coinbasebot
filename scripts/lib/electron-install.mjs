import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const installDir = join(homedir(), ".payments-mcp");

export function run(command, args, cwd) {
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

export function findNpmCli() {
  const here = dirname(process.execPath);
  const candidates = [
    join(here, "node_modules", "npm", "bin", "npm-cli.js"),
    join(here, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  if (process.env.ProgramFiles) {
    candidates.push(
      join(process.env.ProgramFiles, "nodejs", "node_modules", "npm", "bin", "npm-cli.js"),
    );
  }
  if (process.env.APPDATA) {
    candidates.push(join(process.env.APPDATA, "npm", "node_modules", "npm", "bin", "npm-cli.js"));
  }
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return null;
}

export function electronBinary(dir = installDir) {
  const name = process.platform === "win32" ? "electron.exe" : "electron";
  return join(dir, "node_modules", "electron", "dist", name);
}

export function walletRoots() {
  const dirs = [installDir];
  if (process.env.LOCALAPPDATA) {
    dirs.push(join(process.env.LOCALAPPDATA, "awal", "Data", "server"));
  }
  return dirs;
}

export function findWallet() {
  for (const dir of walletRoots()) {
    const electron = electronBinary(dir);
    const script = join(dir, "bundle-electron.js");
    if (existsSync(electron) && existsSync(script)) {
      return { electron, script, dir };
    }
  }
  return null;
}

export function describeWalletGap() {
  const lines = [];
  for (const dir of walletRoots()) {
    const script = join(dir, "bundle-electron.js");
    const electron = electronBinary(dir);
    const electronDir = join(dir, "node_modules", "electron");
    const distDir = join(electronDir, "dist");
    lines.push(`dir: ${dir}`);
    lines.push(`  bundle-electron.js: ${existsSync(script) ? "yes" : "NO"}`);
    lines.push(`  node_modules/electron: ${existsSync(electronDir) ? "yes" : "NO"}`);
    if (existsSync(distDir)) {
      lines.push(`  dist/: ${readdirSync(distDir).join(", ") || "(empty)"}`);
    } else {
      lines.push("  dist/: NO");
    }
    lines.push(`  electron binary: ${existsSync(electron) ? electron : "NO"}`);
  }
  return lines.join("\n");
}

export async function ensureElectron(dir = installDir) {
  const script = join(dir, "bundle-electron.js");
  if (!existsSync(script)) {
    throw new Error(`${script} is missing. Run: node scripts/install-payments-mcp.mjs`);
  }

  const binary = electronBinary(dir);
  if (existsSync(binary)) {
    console.log("Electron already present:", binary);
    return binary;
  }

  const npmCli = findNpmCli();
  if (!npmCli) {
    throw new Error(
      `Cannot find npm-cli.js next to Node (${process.execPath}). Do not use npm.cmd (Node 22 EINVAL).`,
    );
  }

  console.log("Downloading Electron (~100MB). Leave this window open.");
  await run(
    process.execPath,
    [npmCli, "install", "--no-fund", "--no-audit"],
    dir,
  );

  const installer = join(dir, "node_modules", "electron", "install.js");
  if (existsSync(installer) && !existsSync(binary)) {
    await run(process.execPath, [installer], dirname(installer));
  }

  if (!existsSync(binary)) {
    throw new Error(
      `Electron still missing at ${binary}.\n${describeWalletGap()}\nCheck the network and re-run.`,
    );
  }
  console.log("OK:", binary);
  return binary;
}
