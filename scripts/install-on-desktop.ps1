#Requires -Version 5.1
<#
  install-on-desktop.ps1
  Run this ON YOUR WINDOWS PC in PowerShell.

  Transfers the public GitHub repo into Desktop\coinbasebot, installs
  Payments MCP + Agentic Wallet skills, and MERGES payments-mcp into
  existing Cursor / Claude Desktop configs (does not wipe other servers).

  After the first clone, prefer the local file (not irm | iex):

    cd $env:USERPROFILE\Desktop\coinbasebot
    powershell -ExecutionPolicy Bypass -File .\scripts\install-on-desktop.ps1

  If Payments MCP already failed with a missing bundle.js:

    powershell -ExecutionPolicy Bypass -File .\scripts\repair-payments-mcp.ps1
#>

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/philkraft1/coinbasebot.git"
$DesktopTarget = Join-Path $env:USERPROFILE "Desktop\coinbasebot"
$HomeTarget = Join-Path $env:USERPROFILE "coinbasebot"
if ((Test-Path (Join-Path $HomeTarget ".git")) -and -not (Test-Path (Join-Path $DesktopTarget ".git"))) {
  $Target = $HomeTarget
} else {
  $Target = $DesktopTarget
}

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
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

Write-Step "Put the repo in $Target"
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

$repair = Join-Path $Target "scripts\repair-mcp.cmd"
if (-not (Test-Path -LiteralPath $repair)) {
  throw "Missing $repair after clone. git pull the latest main, then re-run."
}

Write-Host "Close Claude Desktop and Cursor before the MCP install." -ForegroundColor Yellow
Write-Step "Install Payments MCP, skills, and merge configs"
cmd.exe /c "`"$repair`""
if ($LASTEXITCODE -ne 0) {
  throw "repair-mcp.cmd failed with exit code $LASTEXITCODE"
}
