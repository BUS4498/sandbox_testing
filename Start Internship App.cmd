@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install Node.js, then double-click this launcher again.
  pause
  exit /b 1
)

node.exe scripts\launch-local-app.js
if errorlevel 1 pause
