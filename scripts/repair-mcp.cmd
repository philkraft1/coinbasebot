@echo off
setlocal
cd /d "%~dp0\.."

echo Close Claude Desktop and Cursor first.
echo.
echo Node is already working if you can run npx. The official Coinbase
echo installer falsely says "Node.js is not available" when Node lives in
echo C:\Program Files\nodejs  (space in the path).
echo.
echo Using our installer instead...
echo.

call node "%~dp0install-payments-mcp.mjs"
if errorlevel 1 (
  echo.
  echo Our installer failed. Check node -v and your network.
  exit /b 1
)

if not exist "%USERPROFILE%\.payments-mcp\bundle.js" (
  echo bundle.js is still missing at %USERPROFILE%\.payments-mcp\bundle.js
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
echo   node scripts\run-awal.mjs auth login kraftcoding@gmail.com
echo   node scripts\run-awal.mjs auth verify YOUR_CODE
echo   node scripts\run-awal.mjs show
echo Set max per call $1 and max per session $5.
exit /b 0
