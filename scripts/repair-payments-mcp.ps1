#Requires -Version 5.1
<#
  Repair / finish Payments MCP on Windows.

  The Coinbase installer downloads Electron + bundle.js into
  %USERPROFILE%\.payments-mcp. It often exits without that file when:
    - Claude Desktop is open and the installer cancels by default
    - a network drop (ERR_NETWORK_CHANGED) fails the Electron download
      and the installer deletes the partial folder
    - it thinks an older install is "up to date" even with no bundle.js

  Run in PowerShell AFTER closing Claude Desktop and Cursor:

    powershell -ExecutionPolicy Bypass -File .\scripts\repair-payments-mcp.ps1
#>

$ErrorActionPreference = "Stop"

$CursorMcp = Join-Path $env:USERPROFILE ".cursor\mcp.json"
$ClaudeStore = Join-Path $env:USERPROFILE "AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"
$ClaudeRoaming = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Get-NodeHome {
  try {
    $homeDir = (node -p "require('os').homedir()").Trim()
    if ($homeDir) { return $homeDir }
  } catch {
    # fall through
  }
  return $env:USERPROFILE
}

function Find-PaymentsMcpBundle {
  $homes = @(
    (Get-NodeHome),
    $env:USERPROFILE,
    $env:HOME
  )
  if ($env:HOMEDRIVE -and $env:HOMEPATH) {
    $homes += ($env:HOMEDRIVE + $env:HOMEPATH)
  }

  foreach ($homeDir in ($homes | Where-Object { $_ } | Select-Object -Unique)) {
    $candidate = Join-Path $homeDir ".payments-mcp\bundle.js"
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }
  return $null
}

function Merge-PaymentsMcp([string]$configPath, [string]$bundlePath) {
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
    args    = @($bundlePath)
  }
  $json.mcpServers | Add-Member -NotePropertyName payments-mcp -NotePropertyValue $entry -Force

  $out = $json | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($configPath, $out + "`n")
  Write-Host "Merged payments-mcp into $configPath"
}

function Install-PaymentsMcpBundle {
  Write-Step "Install Payments MCP (force download, no prompts)"
  Write-Host "Close Claude Desktop and Cursor first if they are open."
  Write-Host "This download is large (Electron). A dropped Wi-Fi/VPN will fail it."

  $installArgs = @(
    "--yes",
    "@coinbase/payments-mcp@latest",
    "install",
    "--force",
    "--client", "other",
    "--no-auto-config",
    "--verbose"
  )

  $attempt = 1
  $bundle = $null
  while ($attempt -le 2) {
    Write-Host "Attempt $attempt / 2..."
    & npx @installArgs
    $code = $LASTEXITCODE
    if ($code -ne 0) {
      Write-Host "Coinbase installer exit code: $code" -ForegroundColor Yellow
    }
    $bundle = Find-PaymentsMcpBundle
    if ($bundle) { break }
    if ($attempt -lt 2) {
      Write-Host "bundle.js still missing — waiting 5s and retrying." -ForegroundColor Yellow
      Start-Sleep -Seconds 5
    }
    $attempt++
  }

  return $bundle
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node is not on PATH. Install Node.js 22 LTS, then re-run."
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 22) {
  throw "Node $nodeMajor is too old. Payments MCP needs Node 22+."
}

$Bundle = Find-PaymentsMcpBundle
if (-not $Bundle) {
  $Bundle = Install-PaymentsMcpBundle
}

if (-not $Bundle) {
  Write-Host ""
  Write-Host "Payments MCP still did not write bundle.js." -ForegroundColor Red
  Write-Host "Paste this into PowerShell and send the output if it fails again:"
  Write-Host ""
  Write-Host '  npx --yes @coinbase/payments-mcp status --verbose'
  Write-Host '  node -p "require(\"os\").homedir()"'
  Write-Host '  Get-ChildItem -Force (Join-Path $env:USERPROFILE ".payments-mcp")'
  Write-Host ""
  throw "Payments MCP bundle missing after force install. Common causes: Claude still open (installer cancels), or the Electron download dropped."
}

Write-Host "Found bundle: $Bundle" -ForegroundColor Green

Write-Step "Install Agentic Wallet skills (Claude Code / Cursor)"
npx --yes skills add coinbase/agentic-wallet-skills --agent claude-code -y
npx --yes skills add coinbase/agentic-wallet-skills --agent cursor -y

Write-Step "Merge payments-mcp into Cursor (keep your other servers)"
Merge-PaymentsMcp $CursorMcp $Bundle

Write-Step "Merge payments-mcp into Claude Desktop (keep your other servers)"
if (Test-Path (Split-Path $ClaudeStore -Parent)) {
  Merge-PaymentsMcp $ClaudeStore $Bundle
} else {
  Write-Host "Claude Store config folder not found yet — skipping $ClaudeStore"
}
if (Test-Path (Split-Path $ClaudeRoaming -Parent)) {
  Merge-PaymentsMcp $ClaudeRoaming $Bundle
} else {
  Write-Host "Classic %APPDATA%\Claude folder not found — skipping"
}

Write-Step "Next steps"
Write-Host @"
1. Sign in as kraftcoding (not phsokr1):
     npx awal auth login kraftcoding@gmail.com
     npx awal auth verify <6-digit-code>

2. Confirm the wallet, then set spend limits in the UI:
     npx awal show
   Expected Base EVM: 0xD10d7eA8B847110f3bbf71781ABefbac01517b82
   Set max per call `$1 and max per session `$5.

3. Fully quit and reopen Claude Desktop and Cursor.
   Open C:\Users\phsok\Desktop\coinbasebot as the workspace.
"@
