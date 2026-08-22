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

```powershell
cd $env:USERPROFILE\coinbasebot
git pull https://github.com/philkraft1/coinbasebot.git main
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\repair-payments-mcp.ps1
```

Run the **whole file** with `-File`. Do not use `irm | iex` and do not run a highlighted selection — that is what caused `Install-PaymentsMcpBundle` to be missing.

Or skip git and run the Coinbase installer directly:

```powershell
npx --yes @coinbase/payments-mcp install --force --client other --no-auto-config --verbose
dir $env:USERPROFILE\.payments-mcp\bundle.js
```

`bundle.js` is downloaded from Coinbase (plus Electron). A dropped Wi-Fi/VPN (`ERR_NETWORK_CHANGED`) makes the official installer delete the partial folder, which is why our first script reported it missing.

## After the installer finishes

```powershell
npx awal auth login kraftcoding@gmail.com
npx awal auth verify <6-digit-code-from-email>
npx awal show
```

In the wallet UI: **max per call $1**, **max per session $5**.

Fully quit Claude Desktop and Cursor. In Cursor, **File → Open Folder →** `C:\Users\phsok\Desktop\coinbasebot`.

Ask: **What's my wallet balance?** Swaps need Cursor or Claude Code in this folder, not Claude Desktop alone.

## What lands in that folder

The same tree as [github.com/philkraft1/coinbasebot](https://github.com/philkraft1/coinbasebot): skills, MCP launcher, Windows merge installer, and docs.

Do not send funds to the old `phsokr1` wallet. The funded Base address is `0xD10d7eA8B847110f3bbf71781ABefbac01517b82`.
