#Requires -Version 5.1
# Repair Payments MCP on Windows. No helper functions — run the whole file:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\repair-payments-mcp.ps1
# Do not use irm | iex and do not run a selection of this file.

$ErrorActionPreference = "Stop"

Write-Host "IvoryCrown / repair Payments MCP"
Write-Host "Close Claude Desktop and Cursor first."
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node is not on PATH. Install Node.js 22 LTS, then re-run."
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 22) {
  throw "Node $nodeMajor is too old. Payments MCP needs Node 22+."
}

$homes = New-Object System.Collections.Generic.List[string]
try {
  $nodeHome = (node -p "require('os').homedir()").Trim()
  if ($nodeHome) { $homes.Add($nodeHome) }
} catch {
  Write-Host "Could not read Node homedir; using USERPROFILE."
}
if ($env:USERPROFILE) { $homes.Add($env:USERPROFILE) }
if ($env:HOME) { $homes.Add($env:HOME) }
if ($env:HOMEDRIVE -and $env:HOMEPATH) {
  $homes.Add($env:HOMEDRIVE + $env:HOMEPATH)
}

$Bundle = $null
foreach ($homeDir in $homes) {
  if (-not $homeDir) { continue }
  $candidate = Join-Path $homeDir ".payments-mcp\bundle.js"
  if (Test-Path -LiteralPath $candidate) {
    $Bundle = $candidate
    break
  }
}

if (-not $Bundle) {
  Write-Host "==> Force-install Payments MCP (Electron download, can take a few minutes)"
  npx --yes @coinbase/payments-mcp@latest install --force --client other --no-auto-config --verbose
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Coinbase installer exit code: $LASTEXITCODE — retrying once." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    npx --yes @coinbase/payments-mcp@latest install --force --client other --no-auto-config --verbose
  }

  foreach ($homeDir in $homes) {
    if (-not $homeDir) { continue }
    $candidate = Join-Path $homeDir ".payments-mcp\bundle.js"
    if (Test-Path -LiteralPath $candidate) {
      $Bundle = $candidate
      break
    }
  }
}

if (-not $Bundle) {
  Write-Host "Payments MCP still did not write bundle.js." -ForegroundColor Red
  Write-Host "Run this and send the output:"
  Write-Host "  npx --yes @coinbase/payments-mcp status --verbose"
  throw "bundle.js missing after force install. Fully quit Claude/Cursor, check the network, then re-run this file with -File (not irm | iex)."
}

Write-Host "Found bundle: $Bundle" -ForegroundColor Green

Write-Host ""
Write-Host "==> Install Agentic Wallet skills"
npx --yes skills add coinbase/agentic-wallet-skills --agent claude-code -y
npx --yes skills add coinbase/agentic-wallet-skills --agent cursor -y

$CursorMcp = Join-Path $env:USERPROFILE ".cursor\mcp.json"
$ClaudeStore = Join-Path $env:USERPROFILE "AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"
$ClaudeRoaming = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
$configPaths = @($CursorMcp, $ClaudeStore, $ClaudeRoaming)

Write-Host ""
Write-Host "==> Merge payments-mcp into Cursor and Claude configs (other servers stay)"
foreach ($configPath in $configPaths) {
  $dir = Split-Path $configPath -Parent
  if (-not (Test-Path -LiteralPath $dir)) {
    Write-Host "Skipping (folder not found yet): $configPath"
    continue
  }

  $json = @{ mcpServers = @{} }
  if (Test-Path -LiteralPath $configPath) {
    try {
      $raw = Get-Content -Raw -LiteralPath $configPath
      if ($raw.Trim().Length -gt 0) {
        $json = $raw | ConvertFrom-Json
      }
    } catch {
      Write-Host "WARNING: could not parse $configPath — leaving it alone." -ForegroundColor Yellow
      continue
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

Write-Host ""
Write-Host "Next:"
Write-Host "  npx awal auth login kraftcoding@gmail.com"
Write-Host "  npx awal auth verify <6-digit-code>"
Write-Host "  npx awal show"
Write-Host "Set max per call `$1 and max per session `$5."
Write-Host "Then reopen Claude Desktop and Cursor on this folder."
