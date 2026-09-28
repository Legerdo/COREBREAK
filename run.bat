@echo off
setlocal
cd /d "%~dp0"

title COREBREAK

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found. Install Node.js 20.19 or later in the 20.x line, or 22.12 or later.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found. Reinstall Node.js with npm included and try again.
    pause
    exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); const ok = (major === 20 && minor >= 19) || (major >= 22 && (major > 22 || minor >= 12)); if (!ok) { console.error('Use Node.js 20.19 or later in the 20.x line, or 22.12 or later.'); process.exit(1); }"
if errorlevel 1 (
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    echo [INFO] Installing project dependencies...
    call npm install --no-save --no-package-lock
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting COREBREAK. Close this window or press Ctrl+C to stop the server.
call npm run dev -- --open
if errorlevel 1 (
    echo.
    echo [ERROR] COREBREAK did not start successfully.
    pause
    exit /b 1
)

endlocal
