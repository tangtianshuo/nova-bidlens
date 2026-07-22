# LangExtract Feasibility Research

**Researched:** 2026-07-22
**Domain:** LLM-based structured information extraction
**Confidence:** HIGH (direct source verification)

---

## What It Does

[google/langextract](https://github.com/google/langextract) (37.6k stars, Apache 2.0) is a Python library by Google for extracting structured information from unstructured text using LLMs. Its core differentiator is **source grounding** — every extraction maps back to exact character positions in the source text, enabling traceable highlighting and verification.

**Core workflow:**
1. Define extraction schema via few-shot examples (text + expected extractions)
2. Feed input text → LLM processes in chunks with parallel workers
3. Output: structured extractions with `char_interval` (start_pos, end_pos) back to source
4. Optional: interactive HTML visualization of extractions in context

**Key capabilities:**
- Schema-driven extraction via few-shot examples (no fine-tuning needed)
- Source grounding with character-level span alignment (exact + fuzzy matching)
- Long document handling via chunking, parallel processing, multiple passes
- Batch processing (Vertex AI Batch API for cost savings)
- Interactive visualization (self-contained HTML)

**What it extracts:**
- Named entities (people, orgs, locations, dates, amounts)
- Relationships between entities
- Structured attributes on each extraction
- Anything you can demonstrate with examples — domain-adaptable

---

## Dependencies & Footprint

### Python Library (Official)

| Property | Value |
|----------|-------|
| Language | Python >= 3.10 |
| Version | 1.6.0 (as of 2026-07-22) |
| License | Apache 2.0 |
| Install | `pip install langextract` |

**Core dependencies (17 packages):**
```
absl-py, aiohttp, async_timeout, exceptiongroup, google-genai>=1.39.0,
google-cloud-storage>=2.14.0, ml-collections, more-itertools, numpy>=1.20.0,
pandas>=1.3.0, pydantic>=1.8.0, python-dotenv, PyYAML, regex, requests,
tqdm, typing-extensions
```

**Optional:** `openai>=1.50.0` (for OpenAI models)

**Assessment:** Heavy. google-genai + google-cloud-storage + numpy + pandas is a significant footprint for a desktop app. Full install is likely 200-400MB+.

### TypeScript Port (Unofficial)

| Property | Value |
|----------|-------|
| Package | `langextract` on npm (1.2.0) |
| Author | kmbro (community port, NOT Google) |
| Stars | 62 (vs 37.6k for Python) |
| Deps | axios, js-yaml, uuid (lightweight) |
| Status | Active but low adoption |

**Assessment:** Lightweight deps, but unofficial and low community validation. No guarantee of feature parity with Python version.

---

## Offline Feasibility

### Requirement: BidLens is offline-first. No network calls during analysis.

**langextract itself:** Pure extraction logic, but **requires an LLM backend**.

| Backend | Offline? | Notes |
|---------|----------|-------|
| Gemini (default) | NO | Requires API key, cloud calls |
| OpenAI | NO | Requires API key, cloud calls |
| Ollama | YES | Local inference, no API key needed |

**Ollama path (only viable offline option):**
1. Install Ollama on user machine
2. Pull a local model (e.g., `gemma2:2b` ~1.7GB, or larger models)
3. langextract connects to `http://localhost:11434`

**Reality check for Electron desktop app:**
- Requires: Python runtime + langextract + Ollama + local model
- Total footprint: ~500MB minimum (Python + deps + small model), 2-4GB for decent quality
- User must install and run Ollama separately (or we bundle it)
- First-run experience: download model, wait for setup
- Inference speed on CPU: slow (minutes per document with small models)

**Verdict: Technically possible, practically heavy.** The offline requirement forces the Ollama path, which brings significant dependency burden.

---

## Integration Points

### Where it fits in BidLens pipeline

```
DOCX/PDF → Parse to DocumentAst → [Current: text/table/entity/key-fact detectors]
                                        ↓
                                   [langextract could add:]
                                   - LLM-based entity extraction with source grounding
                                   - Key-fact extraction (dates, amounts, certifications)
                                   - Relationship extraction between entities
```

### Potential integration patterns:

**Pattern A: Python CLI preprocessor (like MinerU)**
- Build Python CLI that takes DocumentAst text, runs langextract, outputs JSON
- Electron spawns subprocess, reads JSON result
- Pros: Clean separation, no Python-in-Node mess
- Cons: Another Python dependency alongside MinerU, slow subprocess round-trips

**Pattern B: TypeScript port**
- Use `langextract` npm package (community port)
- Run against Ollama (local) or Gemini/OpenAI (cloud)
- Pros: Native to Electron, no Python dependency
- Cons: Unofficial port, 62 stars, no guarantee of parity or maintenance

**Pattern C: Cloud API only**
- Use langextract against Gemini/OpenAI API
- Pros: Best extraction quality, no local model burden
- Cons: Violates offline-first constraint, requires internet + API key

---

## Chinese Language Support

### CJK Handling in Code

The tokenizer has **explicit CJK support** via `UnicodeTokenizer`:
- `_CJK_PATTERN` matches Han, Hiragana, Katakana, Hangul
- CJK characters are tokenized individually (not merged into words) — correct for Chinese
- `_END_OF_SENTENCE_PATTERN` includes Chinese sentence endings: `。！？`
- `UnicodeTokenizer` uses grapheme clusters (`\X` pattern) for proper Unicode handling

### Known Issues (from GitHub)

| Issue | Status | Impact |
|-------|--------|--------|
| #51: CJK-friendly substring fallback alignment | Merged | Improves char_interval accuracy for CJK |
| #106: Chinese Support question | Open | Community asking about Chinese quality |
| #107: CJK Radicals and malformed JSON | Open | Edge case with some CJK characters |
| #108: char_interval accuracy for Chinese | Open | Inaccurate position mapping for Chinese text |

**Assessment:** CJK support exists but has known accuracy issues with character interval mapping. The tokenizer handles Chinese correctly (character-level tokenization), but the source grounding (resolver.py fuzzy matching) has reported issues with Chinese text alignment. This is a **MEDIUM risk** — the core tokenization works, but the value proposition (precise source grounding) may be degraded for Chinese text.

---

## Comparison to Current Approach

### What BidLens currently has (V0.2.2 baseline + V0.3.0 plan)

| Detector | Method | Source Grounding |
|----------|--------|-----------------|
| Text similarity | Diff engine (semantic diff, table-diff) | Yes — AST node references |
| Table similarity | Table-diff engine (Rust) | Yes — cell-level |
| Entity detection | Planned: regex/NER (Rust) | Planned: AST node refs |
| Key-fact detection | Planned: pattern matching (Rust) | Planned: AST node refs |

### What langextract would add

| Capability | langextract | BidLens Current |
|------------|-------------|-----------------|
| Entity extraction | LLM-based, few-shot, flexible | Regex/NER, rule-based |
| Key-fact extraction | LLM-based, schema-driven | Pattern matching |
| Source grounding | Char-level spans (exact + fuzzy) | AST node references |
| Relationship extraction | Yes (via examples) | Not planned |
| Adaptability | Change examples, no retraining | Change rules, recompile |
| Speed | Slow (LLM inference) | Fast (Rust) |
| Determinism | Non-deterministic (LLM) | Deterministic |

### What langextract does NOT add

- **Cross-document similarity detection** — langextract extracts from individual documents; it does NOT compare documents to find similarities. BidLens's core value (finding suspicious similarities across 2-8 submissions) is NOT what langextract does.
- **Text diff / paraphrase detection** — langextract extracts entities/facts; it doesn't detect if two documents have suspiciously similar phrasing.
- **Table comparison** — langextract works on text; table structure comparison is outside its scope.

**Key insight:** langextract is an **extraction** tool, not a **comparison** tool. BidLens's core problem is **cross-document similarity detection**, which is fundamentally different from single-document information extraction.

---

## Recommendation

### NO-GO for V0.3.x. Defer to V0.4+ evaluation.

**Rationale:**

1. **Wrong tool for the problem.** langextract extracts structured info from individual documents. BidLens needs to COMPARE documents for suspicious similarities. These are different problems. langextract could enhance entity/key-fact DETECTION within a single document, but the core value — cross-document similarity — requires comparison logic that langextract doesn't provide.

2. **Offline-first kills the value proposition.** langextract's strength is LLM-powered extraction. Offline means Ollama + local model, which means:
   - 500MB-4GB dependency footprint
   - User must install Ollama separately
   - CPU inference is slow (minutes per document)
   - Small local models produce worse extraction quality than regex/NER for structured bid documents

3. **Python dependency is too heavy.** BidLens already has MinerU (Python) for PDF parsing. Adding langextract (another Python dependency with 17+ packages including numpy/pandas) compounds the distribution problem. The TypeScript port exists but is unofficial (62 stars) — not reliable enough for a production tool.

4. **Chinese source grounding has known issues.** The char_interval accuracy for Chinese text is reported as inaccurate (GitHub issue #108). Since BidLens works entirely with Chinese bid documents, this directly undermines the core feature (precise source grounding).

5. **Existing detectors are better suited.** For structured bid documents, regex/NER-based entity detection and pattern matching for key-facts are faster, deterministic, and don't require LLM inference. The Rust engine already has the infrastructure for this.

### When langextract WOULD make sense

- If BidLens adds a **cloud-connected mode** (not offline-first) for users who want LLM-powered extraction
- If the TypeScript port matures to production quality (1k+ stars, feature parity)
- If a local model ecosystem emerges that makes Ollama inference fast enough for desktop UX
- If the use case shifts from "compare documents" to "extract and analyze single documents"

---

## Common Pitfalls

### Pitfall 1: Confusing extraction with comparison
**What goes wrong:** Assuming langextract can detect cross-document similarities
**Why:** langextract operates on single documents; similarity detection requires pairwise/multi-document comparison
**How to avoid:** Use langextract for entity/fact extraction within documents; use BidLens's diff engine for cross-document comparison

### Pitfall 2: Underestimating the Python dependency burden
**What goes wrong:** Assuming "pip install langextract" is simple for end users
**Why:** 17+ dependencies including numpy, pandas, google-genai, google-cloud-storage — total footprint 200-400MB
**How to avoid:** If pursuing integration, treat it like MinerU (preprocessor CLI pattern), not inline extraction

### Pitfall 3: Trusting CJK source grounding accuracy
**What goes wrong:** Assuming char_interval is accurate for Chinese text
**Why:** Open GitHub issues (#108) report inaccurate position mapping for Chinese
**How to avoid:** Test with real Chinese bid documents before committing; consider fallback to AST-node-based grounding

### Pitfall 4: Relying on the TypeScript port
**What goes wrong:** Using `npm install langextract` assuming parity with Python version
**Why:** Community port (62 stars), not maintained by Google, no guarantee of feature parity or bug fixes
**How to avoid:** Use Python version if at all; treat TypeScript port as experimental

### Pitfall 5: Local model quality expectations
**What goes wrong:** Expecting Ollama + small model to match cloud API extraction quality
**Why:** Small local models (2B-7B params) produce noisier, less reliable extractions than cloud models
**How to avoid:** Test with gemma2:2b on real bid documents; quality may not justify the dependency cost

---

## Sources

### Primary (HIGH confidence)
- GitHub API: `google/langextract` repo metadata — 37.6k stars, Python, Apache 2.0, created 2025-07-08
- README fetched via GitHub API — full feature list, API reference, Ollama support confirmed
- `pyproject.toml` — Python >=3.10, 17 core dependencies listed
- `langextract/core/tokenizer.py` — CJK pattern handling confirmed (`_CJK_PATTERN`)
- `langextract/resolver.py` — source grounding with fuzzy alignment confirmed

### Secondary (MEDIUM confidence)
- GitHub issues #51, #106, #107, #108 — CJK support status, known accuracy issues
- npm `langextract` package (1.2.0, kmbro) — TypeScript port, 62 stars, lightweight deps

### Tertiary (LOW confidence)
- Web search results — limited useful data due to tool constraints

---

## Metadata

**Confidence breakdown:**
- Capabilities & architecture: HIGH — verified from source code and README
- Dependencies & footprint: HIGH — verified from pyproject.toml
- Offline feasibility: HIGH — Ollama support confirmed in code and docs
- Chinese language support: MEDIUM — CJK tokenizer confirmed, but accuracy issues documented
- Integration feasibility: HIGH — architecture analysis based on verified code
- TypeScript port quality: LOW — limited data, 62 stars is the only signal

**Research date:** 2026-07-22
**Valid until:** 2026-08-22 (fast-moving library, 1.6.0 released recently)
