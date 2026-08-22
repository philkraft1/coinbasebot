# Windows PowerShell 5.1 wrapper. Keep this file tiny — 5.1 chokes on
# List[string] and other modern syntax. The real work is repair-mcp.cmd.
$ErrorActionPreference = "Stop"
$cmd = Join-Path $PSScriptRoot "repair-mcp.cmd"
if (-not (Test-Path $cmd)) {
  throw "Missing $cmd. git pull the latest main first."
}
cmd.exe /c "`"$cmd`""
if ($LASTEXITCODE -ne 0) {
  throw "repair-mcp.cmd failed with exit code $LASTEXITCODE"
}
