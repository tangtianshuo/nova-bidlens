@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   BidLens Dev Launcher
echo ========================================
echo.

cd /d D:\Projects\Nova\nova-bidlens

if "%1"=="demo" (
    echo Starting Demo server...
    echo URL: http://localhost:8000
    echo Press Ctrl+C to stop
    echo.
    python demo/server.py
    goto :eof
)

if "%1"=="test" (
    echo Running tests...
    echo.
    echo [1/3] TypeScript tests...
    call pnpm test:ts
    if errorlevel 1 (
        echo TypeScript tests failed
        pause
        exit /b 1
    )

    echo.
    echo [2/3] Rust tests...
    cargo test --manifest-path bidlens-engine/Cargo.toml
    if errorlevel 1 (
        echo Rust tests failed
        pause
        exit /b 1
    )

    echo.
    echo [3/3] Integration tests...
    call pnpm test:integration
    if errorlevel 1 (
        echo Integration tests failed
        pause
        exit /b 1
    )

    echo.
    echo All tests passed!
    pause
    goto :eof
)

if "%1"=="build" (
    echo Building project...
    call pnpm build
    if errorlevel 1 (
        echo Build failed
        pause
        exit /b 1
    )
    echo.
    echo Build complete!
    pause
    goto :eof
)

echo Starting Electron dev environment...
echo.

if not exist node_modules (
    echo Installing dependencies...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    call pnpm install
    if errorlevel 1 (
        echo Install failed
        pause
        exit /b 1
    )
)

echo [1/2] Building Rust engine...
cargo build --manifest-path bidlens-engine/Cargo.toml
if errorlevel 1 (
    echo Rust build failed
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Electron dev server...
echo.
echo ========================================
echo   BidLens dev server started
echo   Press Ctrl+C to stop
echo ========================================
echo.

call pnpm dev
