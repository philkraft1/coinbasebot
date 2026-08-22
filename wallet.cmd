@echo off
cd /d "%~dp0"
call node scripts\run-awal.mjs %*
exit /b %ERRORLEVEL%
