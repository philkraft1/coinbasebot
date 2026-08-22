@echo off
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0repair-payments-mcp.ps1"
if errorlevel 1 pause
pause
