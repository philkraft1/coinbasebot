import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
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

  allowElectronInstallScripts(dir);

  console.log("Downloading Electron (~100MB). Leave this window open.");
  await run(
    process.execPath,
    [
      npmCli,
      "install",
      "--no-fund",
      "--no-audit",
      "--allow-scripts=electron",
    ],
    dir,
  );

  if (!existsSync(binary)) {
    const installer = join(dir, "node_modules", "electron", "install.js");
    if (existsSync(installer)) {
      console.log("npm 12 skipped Electron postinstall; running install.js");
      try {
        await run(process.execPath, [installer], dirname(installer));
      } catch (error) {
        console.warn("electron/install.js failed:", error instanceof Error ? error.message : error);
      }
    }
  }

  if (!existsSync(binary)) {
    console.log("Official installer did not leave electron.exe. Downloading the GitHub zip.");
    await downloadElectronFromGithub(dir);
  }

  if (!existsSync(binary)) {
    throw new Error(
      `Electron still missing at ${binary}.\n${describeWalletGap()}\nCheck the network and re-run.`,
    );
  }
  console.log("OK:", binary);
  return binary;
}

function allowElectronInstallScripts(dir) {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const electronPkg = join(dir, "node_modules", "electron", "package.json");
  const version = existsSync(electronPkg)
    ? JSON.parse(readFileSync(electronPkg, "utf8")).version
    : null;
  pkg.allowScripts = {
    ...(pkg.allowScripts && typeof pkg.allowScripts === "object" ? pkg.allowScripts : {}),
    electron: true,
    ...(version ? { [`electron@${version}`]: true } : {}),
  };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

async function downloadElectronFromGithub(dir) {
  const electronPkg = join(dir, "node_modules", "electron", "package.json");
  if (!existsSync(electronPkg)) {
    throw new Error("electron package is not installed; npm install did not finish.");
  }
  const { version } = JSON.parse(readFileSync(electronPkg, "utf8"));
  const platform = process.platform === "win32" ? "win32" : process.platform;
  const arch = process.arch;
  const zipName = `electron-v${version}-${platform}-${arch}.zip`;
  const url = `https://github.com/electron/electron/releases/download/v${version}/${zipName}`;
  const zipPath = join(tmpdir(), zipName);
  const dist = join(dir, "node_modules", "electron", "dist");
  mkdirSync(dist, { recursive: true });

  console.log("GET", url);
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1_000_000) {
        throw new Error(`Download too small (${bytes.length} bytes). Likely a blocked GitHub redirect.`);
      }
      writeFileSync(zipPath, bytes);
      console.log(`Saved ${bytes.length} bytes to ${zipPath}`);
      await extractZipArchive(zipPath, dist);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      console.warn(`Download attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
    }
  }
  if (lastError) throw lastError;

  const pathTxt = join(dir, "node_modules", "electron", "path.txt");
  writeFileSync(pathTxt, process.platform === "win32" ? "electron.exe" : "electron");
}

function extractZipArchive(zipPath, dest) {
  mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") {
    return run("tar", ["-xf", zipPath, "-C", dest], dest).catch(() =>
      run(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
        ],
        dest,
      ),
    );
  }
  return run("unzip", ["-o", zipPath, "-d", dest], dest);
}
