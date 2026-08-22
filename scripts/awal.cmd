@echo off
setlocal
cd /d "%~dp0\.."
echo Patching Windows wallet bugs and starting Electron...
call node scripts\fix-awal-windows.mjs
if errorlevel 1 exit /b 1
call node scripts\start-wallet.mjs
if errorlevel 1 (
  echo Wallet did not start. Check that Electron downloaded.
  exit /b 1
)
echo.
echo Running awal %*
call npx --yes awal %*
exit /b %ERRORLEVEL%
