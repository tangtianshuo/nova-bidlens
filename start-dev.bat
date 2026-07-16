@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   BidLens 快速启动脚本
echo ========================================
echo.

cd /d D:\Projects\Nova\nova-bidlens

if "%1"=="demo" (
    echo 启动 Demo 服务器...
    echo 访问地址: http://localhost:8000
    echo 按 Ctrl+C 停止服务器
    echo.
    python demo/server.py
    goto :eof
)

if "%1"=="test" (
    echo 运行测试...
    echo.
    echo [1/3] 运行 TypeScript 测试...
    call pnpm test:ts
    if errorlevel 1 (
        echo TypeScript 测试失败
        pause
        exit /b 1
    )

    echo.
    echo [2/3] 运行 Rust 测试...
    cargo test --manifest-path bidlens-engine/Cargo.toml
    if errorlevel 1 (
        echo Rust 测试失败
        pause
        exit /b 1
    )

    echo.
    echo [3/3] 运行集成测试...
    call pnpm test:integration
    if errorlevel 1 (
        echo 集成测试失败
        pause
        exit /b 1
    )

    echo.
    echo 所有测试通过！
    pause
    goto :eof
)

if "%1"=="build" (
    echo 构建项目...
    call pnpm build
    if errorlevel 1 (
        echo 构建失败
        pause
        exit /b 1
    )
    echo.
    echo 构建完成！
    pause
    goto :eof
)

echo 启动 Electron 开发环境...
echo.

if not exist node_modules (
    echo 安装依赖...
    call pnpm install
    if errorlevel 1 (
        echo 依赖安装失败
        pause
        exit /b 1
    )
)

echo [1/2] 编译 Rust 引擎...
cargo build --manifest-path bidlens-engine/Cargo.toml
if errorlevel 1 (
    echo Rust 编译失败
    pause
    exit /b 1
)

echo.
echo [2/2] 启动 Electron 开发服务器...
echo.
echo ========================================
echo   BidLens 开发服务器已启动
echo   按 Ctrl+C 停止
echo ========================================
echo.

call pnpm dev
