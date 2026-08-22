@echo off
REM Double-click this after the repo is in Desktop\coinbasebot
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-on-desktop.ps1"
if errorlevel 1 pause
pause
