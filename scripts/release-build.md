# BidLens V0.2.2 Release Build Guide

This document describes the end-to-end release build process for BidLens desktop application.

## Prerequisites

- Node.js >= 20, pnpm >= 9
- Rust toolchain (stable, via rustup)
- PowerShell 5.1+ (Windows)

## Build Order

Execute steps sequentially. Each step must succeed before proceeding.

### Step 1: Build Shared Package

```bash
pnpm --filter @bidlens/shared build
```

Produces `packages/shared/dist/` with ESM modules and type declarations. The desktop app depends on these at compile time.

### Step 2: Build Rust Engine (Release)

```bash
cargo build --release --manifest-path bidlens-engine/Cargo.toml
```

Produces optimized binary at `bidlens-engine/target/release/bidlens-engine.exe` (Windows).

### Step 3: Stage Rust Binaries

Copy the release binary into the Electron app resources directory:

```powershell
# Windows
$root = Split-Path -Parent $PSScriptRoot
$src = "$root\bidlens-engine\target\release\bidlens-engine.exe"
$dest = "$root\apps\desktop\resources\engine"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item $src "$dest\bidlens-engine.exe" -Force
```

### Step 4: Generate SHA-256 Checksums

```powershell
$hash = (Get-FileHash "$dest\bidlens-engine.exe" -Algorithm SHA256).Hash.ToLower()
"$hash  bidlens-engine.exe" | Out-File -Encoding ascii "$dest\checksums.sha256"
```

### Step 5: Rebuild Native Modules

```bash
cd apps/desktop && npm rebuild
```

Ensures any native Node modules (e.g., better-sqlite3, sharp) are compiled against the target Electron version.

### Step 6: Build Electron App

```bash
pnpm --filter @bidlens/desktop build
```

This runs `tsc` (main + renderer types) and `vite build` to produce:
- `apps/desktop/dist/main/` -- compiled main process
- `apps/desktop/dist/renderer/` -- Vite-bundled renderer

Then package with electron-builder:

```bash
cd apps/desktop && npx electron-builder --win
```

Output goes to `apps/desktop/dist-electron/`.

### Step 7: Verify ASAR Unpack

After packaging, confirm the Rust binary is **outside** the ASAR archive:

```powershell
# Inside the unpacked output directory
ls dist-electron/win-unpacked/resources/engine/bidlens-engine.exe
ls dist-electron/win-unpacked/resources/engine/checksums.sha256
```

If these files are missing or are inside `app.asar.unpacked/` with wrong paths, the ASAR unpack config is incorrect.

## Rust Staging Reference

| Item        | Path                                              |
|-------------|---------------------------------------------------|
| Source      | `bidlens-engine/target/release/bidlens-engine.exe`|
| Destination | `apps/desktop/resources/engine/bidlens-engine.exe`|
| Checksums   | `apps/desktop/resources/engine/checksums.sha256`  |

## ASAR Unpack Configuration

The Rust engine binary must remain unpacked from the ASAR archive so the main process can spawn it as a child process. Add to `apps/desktop/electron-builder.yml`:

```yaml
asar: true
asarUnpack:
  - resources/engine/**
```

Without this, `child_process.spawn('bidlens-engine.exe')` will fail at runtime because ASAR virtual filesystem does not support execution of embedded binaries.

## Missing Resource Checks

Before packaging, verify these files exist. Fail the build if any are absent:

```powershell
$checks = @(
    "apps/desktop/resources/engine/bidlens-engine.exe",
    "apps/desktop/resources/engine/checksums.sha256"
)
foreach ($f in $checks) {
    if (-not (Test-Path $f)) {
        Write-Error "MISSING: $f"
        exit 1
    }
}
```

For native modules, confirm they were rebuilt:

```powershell
# Should print the Electron-linked Node version
node -e "console.log(process.versions.modules)"
```

## Platform-Specific Notes

### Windows (Authenticode Signing)

Sign the Electron executable and installer using `signtool`:

```powershell
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
$cert = "path\to\codesign.pfx"
$timestamp = "http://timestamp.digicert.com"

# Sign the unpacked exe (before installer creation)
& $signtool sign /f $cert /p $env:CERT_PASSWORD /tr $timestamp /td sha256 /fd sha256 `
    "dist-electron/win-unpacked/BidLens.exe"

# Sign the NSIS installer
& $signtool sign /f $cert /p $env:CERT_PASSWORD /tr $timestamp /td sha256 /fd sha256 `
    "dist-electron/Bidlens Setup 0.2.2.exe"
```

Use `/tr` with a trusted RFC 3161 timestamp server so the signature remains valid after certificate expiry. Recommended servers:
- `http://timestamp.digicert.com`
- `http://ts.ssl.com`
- `http://timestamp.sectigo.com`

### macOS

Not yet supported in this release cycle. Future builds will require Apple Developer ID and notarization via `electron-builder`'s `afterSign` hook.

### Linux

Build AppImage target:

```bash
cd apps/desktop && npx electron-builder --linux
```

Code signing is not required for Linux distribution.

## Quick Reference

```bash
# Full release build (from repo root)
pnpm --filter @bidlens/shared build
cargo build --release --manifest-path bidlens-engine/Cargo.toml
# Stage and checksum (see Steps 3-4)
pnpm --filter @bidlens/desktop build
cd apps/desktop && npx electron-builder --win
```
