@echo off
setlocal EnableExtensions
set "DEST=%USERPROFILE%\Desktop\coinbasebot"
set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

echo.
echo Copying coinbasebot to your Desktop
echo   from: %SRC%
echo   to:   %DEST%
echo.

if not exist "%USERPROFILE%\Desktop" (
  echo Desktop folder not found: %USERPROFILE%\Desktop
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"

robocopy "%SRC%" "%DEST%" /E /XD node_modules .git coinbasebot artifacts /NFL /NDL /NJH /NJS /nc /ns /np
if errorlevel 8 (
  echo Copy failed.
  exit /b 1
)

cd /d "%DEST%"
if exist "package.json" (
  echo Running npm install in the Desktop folder...
  call npm install
)

echo.
echo Desktop folder is ready:
echo   %DEST%
echo.
echo Next, in Command Prompt:
echo   cd /d "%DEST%"
echo   node scripts\run-awal.mjs auth login kraftcoding@gmail.com
echo.
echo Do not run bare npx awal  ^(that is the spawn EINVAL error^).
explorer "%DEST%"
exit /b 0
