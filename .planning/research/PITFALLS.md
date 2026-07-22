# MinerU Integration Pitfalls

**Domain:** Python ML tool embedded in Electron desktop app
**Researched:** 2026-07-22
**Overall confidence:** MEDIUM

---

## Critical Pitfalls

### Pitfall 1: Dependency Footprint Explosion

**What goes wrong:** MinerU (`magic-pdf[full]`) pulls PyTorch + PaddlePaddle + PaddleOCR + transformers + ultralytics. Combined install is 5-10 GB on disk. BidLens Electron app is already ~200-400 MB; adding Python runtime + ML frameworks balloons installer to 3-6 GB.

**Why it happens:** MinerU depends on two separate deep learning frameworks (PyTorch for layout detection, PaddlePaddle for OCR). Neither is optional in `[full]` install. MinerU v1.3.0 added option to skip PaddlePaddle, but core functionality still needs PyTorch.

**Consequences:**
- Users in China on typical office networks face 30-60 min download on first install
- Distribution via USB/offline media becomes impractical
- Auto-update mechanism (electron-updater) must now handle multi-GB deltas

**Prevention:**
- Use `pip install magic-pdf` (without `[full]`) for lighter footprint if features suffice
- Consider MinerU v1.3.0+ which made PaddlePaddle optional
- Evaluate if only a subset of MinerU's pipeline is needed (layout detection only? OCR only?)

**Detection:** Run `pip install magic-pdf[full] --dry-run` to measure actual download size before committing.

---

### Pitfall 2: Model Download at Runtime (Violates Offline-First)

**What goes wrong:** MinerU downloads ML models from HuggingFace on first use. Models are 4-8 GB (PDF-Extract-Kit-1.0, DocLayoutYOLO, UniMERNet, PaddleOCR models). First PDF parse triggers multi-GB download, hangs for minutes, fails on slow/offline networks.

**Why it happens:** Models are not bundled with pip package. HuggingFace Hub downloads them lazily. BidLens is offline-first by design — this directly violates the product constraint.

**Consequences:**
- First-run experience is broken: user opens app, loads PDF, waits 10+ min for model download
- Offline users (common in Chinese government/enterprise offices) cannot use the feature at all
- HuggingFace is sometimes slow/blocked in China

**Prevention:**
- Bundle models with the app installer (adds 4-8 GB to distribution)
- Download models during app installation/setup wizard (one-time, with progress bar)
- Use `MINERU_MODEL_SOURCE=local` env var to point to bundled model directory
- Mirror models to domestic CDN (ModelScope, modelscope.cn) for Chinese users
- Consider ONNX-converted smaller models if MinerU supports them

**Detection:** Delete `~/.cache/huggingface/` and run a parse — if it hangs or fails, models aren't bundled.

---

### Pitfall 3: Python Runtime Packaging in Electron

**What goes wrong:** Electron bundles Node.js but not Python. Must either require users to install Python 3.10+ separately, or bundle an embedded Python (via PyInstaller, Nuitka, or python-embed).

**Why it happens:** MinerU is a Python library. There is no Node.js/Rust/WASM port. Every integration path requires a Python interpreter somewhere.

**Consequences:**
- **Option A (require system Python):** Users must install Python 3.10+, pip, then `pip install magic-pdf`. Installation guide becomes 10 steps. Support tickets explode.
- **Option B (bundle with PyInstaller):** Adds 150-500 MB. Hidden imports frequently missing (numpy, scipy, torch). Must build on each target OS (no cross-compilation). macOS code signing is painful. Windows Defender flags unsigned EXEs.
- **Option C (bundle python-embed):** Smaller (~50 MB for base Python), but pip doesn't work out of the box. Must manually manage site-packages.

**Prevention:**
- Start with Option C (python-embed + pre-installed site-packages) for smallest footprint
- Use `child_process.spawn()` from Electron main process — never from renderer
- Always use `-u` flag or `PYTHONUNBUFFERED=1` to prevent stdout deadlocks
- Build PyInstaller/embed bundles on CI for each target OS (Windows, macOS, Linux)
- Test with Windows Defender / macOS Gatekeeper early

**Detection:** Fresh Windows VM without Python installed — does the app work?

---

### Pitfall 4: Subprocess Communication Deadlocks

**What goes wrong:** Electron main process spawns Python subprocess, communicates via stdin/stdout with JSON messages. Python's print() buffers output when stdout is not a TTY. Node.js `child_process` waits for data that never arrives. App freezes.

**Why it happens:** Python buffers stdout by default when not connected to a terminal. Electron's `child_process.spawn()` creates pipes, not TTYs. Large JSON payloads (full document ASTs) can also overflow buffers.

**Consequences:**
- App hangs silently during PDF parsing
- No error message — just frozen UI
- Intermittent: works for small files, fails for large ones

**Prevention:**
- Always spawn Python with `-u` (unbuffered) flag
- Set `PYTHONUNBUFFERED=1` in spawn environment
- Use `print(..., flush=True)` in Python code
- For large payloads, use file-based IPC (write JSON to temp file, pass path over stdout) instead of piping multi-MB JSON through stdout
- Set `maxBuffer` option in `child_process.execSync` if using exec

**Detection:** Parse a 50-page PDF. If it hangs but 1-page works, it's a buffer issue.

---

### Pitfall 5: Startup Latency (Python Cold Start)

**What goes wrong:** Python process + PyTorch + model loading takes 5-15 seconds on first launch. User clicks "analyze" and waits with no feedback. Second invocation is faster (models cached in memory), but first-run is brutal.

**Why it happens:** PyTorch initialization + loading layout detection models into memory is inherently slow. Even CPU-only mode takes 3-8 seconds for cold start.

**Consequences:**
- First PDF parse feels broken — 10-20 second delay with no progress indication
- Users kill the app thinking it's frozen
- BidLens currently parses DOCX in <1 second — the UX regression is jarring

**Prevention:**
- Start Python subprocess at app launch (not on first parse) — "warm up" in background
- Show explicit loading state: "PDF 分析引擎初始化中..." with progress
- Keep Python process alive across parses (don't spawn/kill per file)
- Cache loaded models in process memory (MinerU does this by default within a session)
- Consider lazy initialization: only start Python if user imports a PDF (not DOCX-only projects)

**Detection:** Time from app launch to first PDF parse completing. Target: <10s with loading indicator.

---

## Moderate Pitfalls

### Pitfall 6: Windows + CUDA GPU Detection Failures

**What goes wrong:** MinerU on Windows frequently fails to detect NVIDIA GPUs, silently falling back to CPU. PyTorch CUDA version must match installed CUDA toolkit version exactly. Mismatched versions = CPU fallback with no error.

**Why it happens:** Windows CUDA ecosystem is fragmented. User may have CUDA 12.x driver but PyTorch built for CUDA 11.8. PaddlePaddle has its own CUDA version requirements separate from PyTorch.

**Consequences:**
- GPU users get CPU performance (10-50x slower) without knowing why
- Support team cannot reproduce — depends on user's GPU driver version

**Prevention:**
- Bundle CPU-only PyTorch for consistency (sacrifice speed for reliability)
- OR: detect GPU at startup, log `torch.cuda.is_available()` result, show GPU/CPU status in UI
- Document supported CUDA versions explicitly
- Consider ONNX Runtime as inference backend (better Windows GPU support)

**Detection:** Check logs for `torch.cuda.is_available()` return value on target machines.

---

### Pitfall 7: HuggingFace Access in China

**What goes wrong:** HuggingFace (huggingface.co) is slow or intermittently blocked in China. Model downloads fail or take 30+ minutes.

**Why it happens:** GFW (Great Firewall) throttles/blocks certain international CDNs. HuggingFace is on the list intermittently.

**Consequences:**
- First-run model download fails for majority of Chinese users
- Users assume the app is broken

**Prevention:**
- Mirror models to ModelScope (modelscope.cn) — Alibaba's HuggingFace equivalent for China
- Bundle models with installer to avoid runtime download entirely
- Set `HF_ENDPOINT=https://hf-mirror.com` as fallback (community mirror)
- Use MinerU's `MINERU_MODEL_SOURCE=local` to bypass HuggingFace entirely

**Detection:** Test model download from a machine in mainland China without VPN.

---

### Pitfall 8: macOS Code Signing + Notarization

**What goes wrong:** Bundled Python executable (PyInstaller output) is unsigned. macOS Gatekeeper blocks it. electron-builder notarization process doesn't cover child executables automatically.

**Why it happens:** Apple requires all executables to be signed and notarized. PyInstaller outputs a standalone binary that needs separate signing. electron-builder signs the Electron app but not arbitrary child processes.

**Consequences:**
- macOS users see "app is damaged" or "cannot be opened" dialog
- App Store rejection if targeting Mac App Store

**Prevention:**
- Sign the Python binary separately in build script: `codesign --deep --force --sign "Developer ID" python-worker`
- Include Python binary in `extraResources` and sign it during electron-builder `afterSign` hook
- Test on clean macOS machine without developer tools installed

**Detection:** Download app on fresh macOS, try to open — does Gatekeeper block?

---

### Pitfall 9: Document AST Schema Mismatch

**What goes wrong:** MinerU outputs Markdown/JSON with its own schema (headings, tables, images, formulas). BidLens expects `DocumentAst` with `BlockNode[]` (paragraph | section | list | table). Mapping is lossy and incomplete.

**Why it happens:** MinerU's output format is designed for LLM data extraction, not bid document risk review. Its table representation differs from BidLens's `TableNode`. Its section detection uses different heuristics than the existing DOCX parser.

**Consequences:**
- Evidence linking breaks — MinerU's page/position info doesn't map to existing AST node IDs
- Table diff engine may not work on MinerU-extracted tables
- Two different "views" of the same document confuse the review UI

**Prevention:**
- Write a MinerU-to-DocumentAst adapter layer (same pattern as existing `PdfParser` adapter in `packages/shared/src/parser/pdf/index.ts`)
- Map MinerU blocks to existing `BlockNode` types, generate compatible node IDs
- Run table-diff engine on MinerU output to verify compatibility early
- Consider using MinerU only for PDF text/table extraction, not for the full AST

**Detection:** Parse same PDF with current parser and MinerU, compare AST structure.

---

## Minor Pitfalls

### Pitfall 10: Process Cleanup on App Quit

**What goes wrong:** User closes Electron app while Python subprocess is mid-parse. Zombie Python process remains, holding GPU memory and file locks.

**Prevention:**
- Listen for `app.on('before-quit')` and `pythonProcess.kill('SIGTERM')`
- Use `pythonProcess.kill('SIGKILL')` as fallback after 5s timeout
- On Windows, use `taskkill /pid` since SIGTERM doesn't work on Windows processes

---

### Pitfall 11: Virtual Environment Path Fragility

**What goes wrong:** Hardcoded venv paths break when app is moved or installed to path with spaces/non-ASCII characters (common in Chinese Windows: `C:\Users\张三\AppData\...`).

**Prevention:**
- Use `app.getPath('userData')` for venv location (stable, no spaces guaranteed)
- Test with Chinese username paths explicitly
- Use `process.resourcesPath` for bundled Python

---

### Pitfall 12: Concurrent Parse Requests

**What goes wrong:** User imports 4 PDFs simultaneously. Single Python process handles them sequentially (GIL). Or: spawning 4 Python processes crashes on 8GB RAM machines.

**Prevention:**
- Queue parse requests in main process, process one at a time
- Show progress per document: "正在解析 2/4..."
- Monitor Python process memory, kill if >2GB

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Python runtime bundling | PyInstaller hidden imports, platform-specific builds | CI builds per-OS, test on clean VMs |
| Model distribution | HuggingFace blocked in China, 4-8GB download | Bundle with installer or use ModelScope mirror |
| Subprocess IPC | stdout deadlocks on large PDFs | `-u` flag + file-based IPC for payloads >1MB |
| First-run UX | 10-20s cold start with no feedback | Background warm-up at app launch + loading indicator |
| Windows GPU | CUDA version mismatch, silent CPU fallback | Bundle CPU-only PyTorch OR log GPU detection status |
| macOS signing | Unsigned Python binary blocked by Gatekeeper | Sign in afterSign hook, test on clean Mac |
| AST integration | MinerU output schema != DocumentAst | Adapter layer, early table-diff compatibility test |
| Memory | 4 PDFs * 2GB model memory = OOM | Queue + memory monitoring + kill threshold |

---

## Decision Matrix: Integration Approach

| Approach | Size Impact | Offline | Complexity | Recommended |
|---|---|---|---|---|
| Require system Python + pip install | 0 MB bundled | No (needs pip) | Low dev, high user cost | No |
| Bundle python-embed + pre-installed packages | +500MB-1GB | Yes | Medium | Maybe |
| Bundle PyInstaller binary | +500MB-1.5GB | Yes | High (signing, hidden imports) | Maybe |
| Run MinerU as separate service (Docker/standalone) | Separate install | Partial | Low coupling | No (violates local-only) |
| Use MinerU's CLI from subprocess | Same as above | Depends on bundling | Lowest code change | Yes for PoC |

---

## Sources

- MinerU GitHub: https://github.com/opendatalab/MinerU (Python 3.10+, PyTorch + PaddlePaddle)
- MinerU Installation Guide: https://github.com/opendatalab/MinerU/blob/master/docs/Installation.md
- MinerU v1.3.0 Release: https://github.com/opendatalab/MinerU/releases/tag/v1.3.0 (PaddlePaddle optional)
- PyPI magic-pdf: https://pypi.org/project/magic-pdf/
- HuggingFace models: https://huggingface.co/opendatalab/PDF-Extract-Kit
- python-shell npm: https://www.npmjs.com/package/python-shell (subprocess IPC patterns)
- PyInstaller docs: https://pyinstaller.org/ (hidden imports, platform builds)

**Confidence notes:**
- Dependency sizes (5-10 GB): MEDIUM — based on PyTorch (~2GB) + PaddlePaddle (~2GB) + models (~4-8GB), but exact sizes vary by version
- Model download behavior: MEDIUM — confirmed HuggingFace-based, but MinerU may have added ModelScope support since last check
- Windows CUDA issues: MEDIUM — widely reported but not verified against latest MinerU version
- HuggingFace blocking in China: HIGH — well-documented, ongoing issue
