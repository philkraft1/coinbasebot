@echo off
cd /d "%~dp0\.."
call "%~dp0repair-mcp.cmd"
if errorlevel 1 pause
pause
