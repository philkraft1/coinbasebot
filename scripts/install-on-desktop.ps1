#Requires -Version 5.1
<#
  install-on-desktop.ps1
  Run this ON YOUR WINDOWS PC in PowerShell.

  Transfers the public GitHub repo into Desktop\coinbasebot, installs
  Payments MCP + Agentic Wallet skills, and MERGES payments-mcp into
  existing Cursor / Claude Desktop configs (does not wipe other servers).

  Usage:
    cd $env:USERPROFILE\Desktop\coinbasebot
    Set-ExecutionPolicy -Scope Process Bypass
    irm https://raw.githubusercontent.com/philkraft1/coinbasebot/main/scripts/install-on-desktop.ps1 | iex

  Or after you already have the scripts:
    powershell -ExecutionPolicy Bypass -File .\scripts\install-on-desktop.ps1
#>

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/philkraft1/coinbasebot.git"
$Target = Join-Path $env:USERPROFILE "Desktop\coinbasebot"
$CursorMcp = Join-Path $env:USERPROFILE ".cursor\mcp.json"
$ClaudeStore = Join-Path $env:USERPROFILE "AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"
$ClaudeRoaming = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
$Bundle = Join-Path $env:USERPROFILE ".payments-mcp\bundle.js"

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Merge-PaymentsMcp([string]$configPath) {
  $dir = Split-Path $configPath -Parent
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $json = @{ mcpServers = @{} }
  if (Test-Path $configPath) {
    try {
      $raw = Get-Content -Raw -Path $configPath
      if ($raw.Trim().Length -gt 0) {
        $json = $raw | ConvertFrom-Json
      }
    } catch {
      Write-Host "WARNING: could not parse $configPath — leaving it alone." -ForegroundColor Yellow
      return
    }
  }

  if (-not $json.mcpServers) {
    $json | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) -Force
  }

  $entry = [pscustomobject]@{
    command = "node"
    args    = @($Bundle)
  }
  $json.mcpServers | Add-Member -NotePropertyName payments-mcp -NotePropertyValue $entry -Force

  $out = $json | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($configPath, $out + "`n")
  Write-Host "Merged payments-mcp into $configPath"
}

Write-Host "IvoryCrown / coinbasebot desktop installer"
Write-Host "Target: $Target"
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is not on PATH. Install Git for Windows, then re-run."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node is not on PATH. Install Node.js 22 LTS from https://nodejs.org then re-run."
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 22) {
  throw "Node $nodeMajor is too old. Payments MCP needs Node 22+."
}

Write-Step "Put the repo in Desktop\coinbasebot"
New-Item -ItemType Directory -Force -Path $Target | Out-Null
Set-Location $Target

$hasGit = Test-Path (Join-Path $Target ".git")
$entries = @(Get-ChildItem -Force | Where-Object { $_.Name -notin @(".", "..") })

if ($hasGit) {
  Write-Host "Existing git repo — fetching latest from GitHub."
  git remote remove github 2>$null
  git remote add github $RepoUrl
  git fetch github
  git checkout -B main "github/main"
} elseif ($entries.Count -eq 0) {
  git clone $RepoUrl .
} else {
  Write-Host "Folder is not empty and is not a git repo. Cloning into a temp dir, then copying."
  $tmp = Join-Path $env:TEMP ("coinbasebot-" + [guid]::NewGuid().ToString("N"))
  git clone $RepoUrl $tmp
  Get-ChildItem -Force -LiteralPath $tmp | Copy-Item -Destination $Target -Recurse -Force
  Remove-Item -Recurse -Force $tmp
}

Write-Step "Install Payments MCP (Claude Code client)"
npx --yes @coinbase/payments-mcp@latest --client claude-code --auto-config
if (-not (Test-Path $Bundle)) {
  throw "Payments MCP bundle missing at $Bundle after install."
}

Write-Step "Install Agentic Wallet skills (Claude Code / Cursor)"
npx --yes skills add coinbase/agentic-wallet-skills --agent claude-code -y
npx --yes skills add coinbase/agentic-wallet-skills --agent cursor -y

Write-Step "Merge payments-mcp into Cursor (keep your other servers)"
Merge-PaymentsMcp $CursorMcp

Write-Step "Merge payments-mcp into Claude Desktop (keep your other servers)"
if (Test-Path (Split-Path $ClaudeStore -Parent)) {
  Merge-PaymentsMcp $ClaudeStore
} else {
  Write-Host "Claude Store config folder not found yet — skipping $ClaudeStore"
}
if (Test-Path (Split-Path $ClaudeRoaming -Parent)) {
  Merge-PaymentsMcp $ClaudeRoaming
} else {
  Write-Host "Classic %APPDATA%\Claude folder not found — skipping"
}

Write-Step "Next steps (you, on this PC)"
Write-Host @"
1. Sign in as kraftcoding (not phsokr1):
     npx awal auth login kraftcoding@gmail.com
     npx awal auth verify <6-digit-code>

2. Confirm the wallet, then set spend limits in the UI:
     npx awal show
   Expected Base EVM: 0xD10d7eA8B847110f3bbf71781ABefbac01517b82
   Set max per call `$1 and max per session `$5.

3. Fully quit and reopen Claude Desktop and Cursor.
   Open this folder as the workspace:
     $Target

4. Claude Desktop can check balances. Swaps need Claude Code or Cursor
   in this folder (the agentic-wallet skills).

Do not paste Linux paths. Do not send funds to the old phsokr1 wallet.
"@
