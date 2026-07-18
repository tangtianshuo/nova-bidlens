# BidLens Windows 构建脚本
# 用法: .\scripts\build-windows.ps1 [-Clean] [-SkipTests] [-Dir]

param(
    [switch]$Clean,
    [switch]$SkipTests,
    [switch]$Dir
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  BidLens Windows Build Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: 清理
if ($Clean) {
    Write-Host "[1/5] Cleaning build artifacts..." -ForegroundColor Yellow
    Remove-Item -Path "$rootDir\apps\desktop\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$rootDir\apps\desktop\dist-electron" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$rootDir\packages\shared\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Done!" -ForegroundColor Green
} else {
    Write-Host "[1/5] Skipping clean (use -Clean to enable)" -ForegroundColor Gray
}

# Step 2: 安装依赖
Write-Host ""
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
Set-Location $rootDir
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
Write-Host "  Done!" -ForegroundColor Green

# Step 3: 运行测试
Write-Host ""
if ($SkipTests) {
    Write-Host "[3/5] Skipping tests" -ForegroundColor Gray
} else {
    Write-Host "[3/5] Running tests..." -ForegroundColor Yellow
    pnpm test:ts
    if ($LASTEXITCODE -ne 0) { throw "Tests failed" }
    Write-Host "  Done!" -ForegroundColor Green
}

# Step 4: 构建
Write-Host ""
Write-Host "[4/5] Building application..." -ForegroundColor Yellow
Set-Location "$rootDir\apps\desktop"

Write-Host "  Building @bidlens/shared..." -ForegroundColor Gray
pnpm --filter @bidlens/shared build
if ($LASTEXITCODE -ne 0) { throw "Shared build failed" }

Write-Host "  Building @bidlens/desktop..." -ForegroundColor Gray
pnpm --filter @bidlens/desktop build
if ($LASTEXITCODE -ne 0) { throw "Desktop build failed" }

Write-Host "  Building Rust engine..." -ForegroundColor Gray
Set-Location $rootDir
cargo build --manifest-path bidlens-engine/Cargo.toml --release
if ($LASTEXITCODE -ne 0) { throw "Rust build failed" }

Write-Host "  Done!" -ForegroundColor Green

# Step 5: 打包
Write-Host ""
Write-Host "[5/5] Packaging for Windows..." -ForegroundColor Yellow
Set-Location "$rootDir\apps\desktop"

if ($Dir) {
    Write-Host "  Creating unpacked directory..." -ForegroundColor Gray
    npx electron-builder --win --dir
} else {
    Write-Host "  Creating NSIS installer..." -ForegroundColor Gray
    npx electron-builder --win
}

if ($LASTEXITCODE -ne 0) { throw "Electron builder failed" }
Write-Host "  Done!" -ForegroundColor Green

# 完成
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output: apps\desktop\dist-electron\" -ForegroundColor White

if (Test-Path "$rootDir\apps\desktop\dist-electron") {
    Get-ChildItem "$rootDir\apps\desktop\dist-electron" -File | ForEach-Object {
        Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor Gray
    }
}
