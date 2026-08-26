@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install Node.js, then double-click this launcher again.
  pause
  exit /b 1
)

node.exe scripts\launch-local-app.js --no-open
if errorlevel 1 (
  pause
  exit /b 1
)

if "%PORT%"=="" (
  set "APP_PORT=4318"
) else (
  set "APP_PORT=%PORT%"
)

echo Opening http://127.0.0.1:%APP_PORT%/
start "" "http://127.0.0.1:%APP_PORT%/"
if errorlevel 1 (
  echo The app is running, but Windows could not open the browser automatically.
  echo Copy this address into your browser: http://127.0.0.1:%APP_PORT%/
  pause
  exit /b 1
)
