# Transfer this project to `Desktop\coinbasebot`

Use whichever folder already has the clone:

- `C:\Users\phsok\Desktop\coinbasebot`
- `C:\Users\phsok\coinbasebot` (this is where the last repair script ran)

This cloud agent cannot write to your Windows Desktop. Run the installer **on your PC** in **PowerShell**. That copies the public repo into that folder, installs Payments MCP and the trading skills, and **merges** `payments-mcp` into your existing Claude Desktop and Cursor configs without wiping other MCP servers.

## One command (empty or existing folder)

```powershell
cd $env:USERPROFILE\Desktop\coinbasebot
Set-ExecutionPolicy -Scope Process Bypass
irm https://raw.githubusercontent.com/philkraft1/coinbasebot/main/scripts/install-on-desktop.ps1 | iex
```

Needs [Git for Windows](https://git-scm.com/download/win) and [Node.js 22+](https://nodejs.org).

## If you already cloned and got `bundle.js` missing

Fully quit **Claude Desktop** and **Cursor**, then in PowerShell:

Use **Command Prompt** (not PowerShell syntax). From `C:\Users\phsok\coinbasebot`:

```bat
cd %USERPROFILE%\coinbasebot
git pull https://github.com/philkraft1/coinbasebot.git main
scripts\repair-mcp.cmd
```

The official `npx @coinbase/payments-mcp` installer is broken on Windows when Node is in `C:\Program Files\nodejs`. It reports **Node.js is not available** even though `npx` just ran. Use our installer instead:

```bat
cd %USERPROFILE%\coinbasebot
git pull https://github.com/philkraft1/coinbasebot.git main
node scripts\install-payments-mcp.mjs
node scripts\merge-payments-mcp.mjs
dir %USERPROFILE%\.payments-mcp\bundle.js
```

Or skip git and run the Coinbase installer directly:

```powershell
npx --yes @coinbase/payments-mcp install --force --client other --no-auto-config --verbose
dir $env:USERPROFILE\.payments-mcp\bundle.js
```

`bundle.js` is downloaded from Coinbase (plus Electron). A dropped Wi-Fi/VPN (`ERR_NETWORK_CHANGED`) makes the official installer delete the partial folder, which is why our first script reported it missing.

## After the installer finishes

Do **not** run bare `npx awal` on Windows. Coinbase's CLI still hits `spawn EINVAL`, missing `C:\tmp`, and Unix `ps`. Use:

```bat
cd %USERPROFILE%\coinbasebot
git pull https://github.com/philkraft1/coinbasebot.git main
node scripts\start-wallet.mjs
scripts\awal.cmd auth login kraftcoding@gmail.com
scripts\awal.cmd auth verify YOUR_CODE
```

In the wallet UI: **max per call $1**, **max per session $5**.

Fully quit Claude Desktop and Cursor. In Cursor, **File → Open Folder →** `C:\Users\phsok\Desktop\coinbasebot`.

Ask: **What's my wallet balance?** Swaps need Cursor or Claude Code in this folder, not Claude Desktop alone.

## What lands in that folder

The same tree as [github.com/philkraft1/coinbasebot](https://github.com/philkraft1/coinbasebot): skills, MCP launcher, Windows merge installer, and docs.

Do not send funds to the old `phsokr1` wallet. The funded Base address is `0xD10d7eA8B847110f3bbf71781ABefbac01517b82`.
