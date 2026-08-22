@echo off
setlocal
cd /d "%~dp0\.."

echo Close Claude Desktop and Cursor first.
echo Installing Payments MCP. This downloads Electron and can take a few minutes.
echo.

call npx --yes @coinbase/payments-mcp@latest install --force --client other --no-auto-config --verbose
if errorlevel 1 (
  echo First install failed. Retrying once...
  timeout /t 5 /nobreak >nul
  call npx --yes @coinbase/payments-mcp@latest install --force --client other --no-auto-config --verbose
)

if not exist "%USERPROFILE%\.payments-mcp\bundle.js" (
  echo.
  echo bundle.js is still missing at %USERPROFILE%\.payments-mcp\bundle.js
  echo Run: npx --yes @coinbase/payments-mcp status --verbose
  exit /b 1
)

echo.
echo Found bundle.js
echo Installing Agentic Wallet skills...
call npx --yes skills add coinbase/agentic-wallet-skills --agent claude-code -y
call npx --yes skills add coinbase/agentic-wallet-skills --agent cursor -y

echo.
echo Merging MCP configs...
call node "%~dp0merge-payments-mcp.mjs"
if errorlevel 1 exit /b 1

echo.
echo Next:
echo   npx awal auth login kraftcoding@gmail.com
echo   npx awal auth verify YOUR_CODE
echo   npx awal show
echo Set max per call $1 and max per session $5.
exit /b 0
