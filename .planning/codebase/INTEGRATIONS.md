# External Integrations

**Analysis Date:** 2026-07-22

## APIs & External Services

**No external APIs detected.** BidLens is a fully offline desktop application. All document parsing, analysis, and risk detection happen locally via the Rust engine and TypeScript libraries.

## Data Storage

**Databases:**
- SQLite (via `better-sqlite3`)
  - Location: `app.getPath('userData')/bidlens.db` (Electron user data directory)
  - WAL mode enabled for concurrent read/write
  - Schema version tracking with migration checksums
  - Tables: `tasks`, `document_snapshots`, `diff_snapshots`, `review_annotations`, `settings`, `migration_history`
  - Manager: `apps/desktop/src/main/db/database.ts`
  - Schema: `apps/desktop/src/main/db/schema.ts`
  - Migrations: `apps/desktop/src/main/db/migrations.ts`

**File Storage:**
- Local filesystem only
- Document files read from user-selected paths (via Electron `dialog.showOpenDialog`)
- Exported reports saved to user-selected paths (via Electron `dialog.showSaveDialog`)
- Database and key files stored in Electron `userData` directory

**Caching:**
- None (no explicit caching layer)

## Authentication & Identity

**Auth Provider:**
- None — offline desktop app, no user authentication

**Encryption:**
- Electron `safeStorage` (DPAPI on Windows, Keychain on macOS) for master key protection
- AES-256 encryption for sensitive database fields (document paths, annotations, snapshots)
- Key file: `.bidlens-key.enc` in userData directory
- Implementation: `apps/desktop/src/main/services/key-manager.ts`

## Monitoring & Observability

**Error Tracking:**
- Console logging only (`console.log`, `console.error`, `console.warn`)
- Renderer console messages forwarded to main process via `webContents.on('console-message')`

**Logs:**
- Main process: stdout/stderr via Electron's built-in logging
- Engine process: stderr captured by `EngineManager`
- No external logging service

## CI/CD & Deployment

**Hosting:**
- Desktop distribution (no server hosting)

**CI Pipeline:**
- Not detected (no `.github/workflows/`, `.gitlab-ci.yml`, or similar)

**Build Scripts:**
- `scripts/build-windows.ps1` — Windows build automation
- `scripts/release-build.md` — Release build documentation
- `scripts/v03/` — V0.3 model feasibility scripts

**Distribution:**
- Windows: NSIS installer via electron-builder
- macOS: DMG via electron-builder (x64 + arm64)
- Linux: AppImage via electron-builder

## Environment Configuration

**Required env vars:**
- None detected — application is fully self-contained

**Configuration:**
- App settings stored in SQLite `settings` table (key-value JSON store)
- Default settings: 20 task history limit, 1GB storage limit

## IPC Communication (Internal)

**Electron IPC:**
- Preload script bridges main↔renderer via `contextBridge.exposeInMainWorld('bidlens', api)`
- Contract defined in `packages/shared/src/ipc.ts`
- IPC channels: `risk:*`, `compare:*`, `file:*`, `review:*`, `history:*`, `export:*`, `settings:*`, `window:*`, `engine:*`

**Rust Engine Communication:**
- JSON-RPC 2.0 over stdio (stdin/stdout pipes)
- Engine spawned as child process by `EngineManager`
- Methods: `ping`, `compare`, `compare.cancel`, `shutdown`, `risk.analyzeWithAst`, `risk.cancelProject`
- Notifications: `compare.progress`, `risk.progress`
- Implementation: `apps/desktop/src/main/services/engine-manager.ts`

## Document Parsing

**Supported Formats:**
- DOCX — via `docx4js` 3.3.0 (shared package)
- PDF — via `pdf-parse` 2.4.5 (shared package)
- XML — via `fast-xml-parser` 4.5.1 (desktop package)
- ZIP — via `jszip` 3.10.1 (for DOCX extraction)

## Native Modules

**better-sqlite3:**
- Requires native compilation via `@electron/rebuild`
- Rebuild command: `pnpm native:electron` (dev) / `npm rebuild better-sqlite3` (test)
- Unpacked from asar in production builds (`asarUnpack` in electron-builder config)
- Native runtime copied during packaging via `scripts/copy-native-runtime.cjs`

## Platform APIs

**Electron APIs Used:**
- `app` — Application lifecycle
- `BrowserWindow` — Window management (frameless, custom title bar)
- `ipcMain` / `ipcRenderer` — IPC communication
- `contextBridge` — Secure preload bridge
- `dialog` — File/folder selection, save dialogs
- `shell` — Open files/folders in system explorer
- `Menu` — Disabled native menu (`Menu.setApplicationMenu(null)`)
- `safeStorage` — OS-level encryption for key storage

**Node.js APIs:**
- `child_process.spawn` — Engine process management
- `fs` / `fs/promises` — File operations
- `path` — Path manipulation
- `crypto` — Random key generation
- `os` — System information

---

*Integration audit: 2026-07-22*
