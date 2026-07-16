# BidLens 快速启动脚本
# 用于开发和功能测试

param(
    [switch]$Demo,
    [switch]$Build,
    [switch]$Test
)

$ErrorActionPreference = "Stop"
$ProjectRoot = "D:\Projects\Nova\nova-bidlens"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BidLens 快速启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
Set-Location $ProjectRoot

# 检查是否在正确的目录
if (-not (Test-Path "package.json")) {
    Write-Host "错误：未找到 package.json，请确认项目目录" -ForegroundColor Red
    exit 1
}

# 测试模式
if ($Test) {
    Write-Host "运行测试..." -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "[1/3] 运行 TypeScript 测试..." -ForegroundColor Green
    pnpm test:ts
    if ($LASTEXITCODE -ne 0) {
        Write-Host "TypeScript 测试失败" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "[2/3] 运行 Rust 测试..." -ForegroundColor Green
    cargo test --manifest-path bidlens-engine/Cargo.toml
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Rust 测试失败" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "[3/3] 运行集成测试..." -ForegroundColor Green
    pnpm test:integration
    if ($LASTEXITCODE -ne 0) {
        Write-Host "集成测试失败" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "所有测试通过！" -ForegroundColor Green
    exit 0
}

# 构建模式
if ($Build) {
    Write-Host "构建项目..." -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "[1/3] 构建 TypeScript..." -ForegroundColor Green
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "TypeScript 构建失败" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "构建完成！" -ForegroundColor Green
    exit 0
}

# Demo 模式
if ($Demo) {
    Write-Host "启动 Demo 服务器..." -ForegroundColor Yellow
    Write-Host ""
    
    # 检查 Python 是否可用
    try {
        python --version | Out-Null
    } catch {
        Write-Host "错误：未找到 Python，请安装 Python" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "启动 HTTP 服务器..." -ForegroundColor Green
    Write-Host "访问地址: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
    Write-Host ""
    
    # 启动 Python HTTP 服务器
    python demo/server.py
    exit 0
}

# 默认模式：启动 Electron 开发环境
Write-Host "启动 Electron 开发环境..." -ForegroundColor Yellow
Write-Host ""

# 检查依赖是否安装
if (-not (Test-Path "node_modules")) {
    Write-Host "安装依赖..." -ForegroundColor Green
    $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "依赖安装失败" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[1/2] 编译 Rust 引擎..." -ForegroundColor Green
cargo build --manifest-path bidlens-engine/Cargo.toml
if ($LASTEXITCODE -ne 0) {
    Write-Host "Rust 编译失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/2] 启动 Electron 开发服务器..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BidLens 开发服务器已启动" -ForegroundColor Cyan
Write-Host "  按 Ctrl+C 停止" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 启动 Electron 开发服务器
pnpm dev
