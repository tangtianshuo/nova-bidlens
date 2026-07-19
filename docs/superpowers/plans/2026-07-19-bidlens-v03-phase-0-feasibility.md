# BidLens V0.3 Phase 0 Feasibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reproducible evidence that the pinned BGE-M3 ONNX artifact can be commercially distributed, runs fully offline on the target Windows CPU within the 2GB Embedding memory budget, preserves reference embeddings, and can be measured against the current Jaccard baseline on an auditable gold dataset.

**Architecture:** Phase 0 is tooling and evidence only; it must not add a model runtime to the production Electron or Rust processes. TypeScript utilities define the gold-data and scoring contract, Python utilities acquire and benchmark the pinned ONNX artifact in an isolated virtual environment, and a final gate script combines legal, model, dataset, parity, memory, and baseline evidence before any production Provider work begins.

**Tech Stack:** TypeScript 5.7, Vitest 2, Python 3.12, pytest 9, Hugging Face Hub, Transformers, ONNX Runtime CPU, NumPy, psutil, existing Rust JSON-RPC engine.

---

## Scope Decomposition

The approved V0.3 specification contains several dependency-ordered subsystems. This plan covers only Phase 0 because its output determines the exact model artifacts and dependencies used by later plans. After this gate passes, write and execute separate plans in this order:

1. Phase 1: shared contracts, model package lifecycle, and bidirectional engine protocol.
2. Phase 2: Rust `embedding-core`, Rust ONNX Provider, and encrypted cache integration.
3. Phase 3: stable chunks, hybrid one-to-one matching, and threshold calibration.
4. Phase 4: sparse global matching, split, merge, and move detection.
5. Phase 5: `ui-ux-pro-max` UI specification and trusted review workflow.
6. Phase 6: packaging, offline E2E, performance evidence, and documentation closure.

Do not write the Phase 1 plan until Task 8 records a passing Phase 0 gate or an explicit model reselection decision.

## File Map

Create these focused files:

```text
scripts/v03/model-feasibility/
  requirements.txt              # Pinned Python-only feasibility dependencies
  model-source.json             # Pinned upstream revision and artifact hashes
  legal-decision.json            # Explicit human redistribution decision
  model_source.py                # Download, hash, and manifest validation
  quantize_model.py              # Deterministic ONNX dynamic quantization entrypoint
  benchmark_model.py             # Reference parity, latency, and RSS benchmark
  evaluate_gold.ts               # Gold schema validation and metric calculation
  run_jaccard_baseline.ts        # Current-engine predictions over private gold ASTs
  phase0_gate.ts                 # Aggregates all evidence and enforces hard gates

tests/v03/
  fixtures/gold-sample.json      # Non-sensitive contract fixture
  evaluate-gold.test.ts          # Metrics and validation tests
  phase0-gate.test.ts            # Gate pass/fail tests
  test_model_source.py           # Python artifact validation tests

docs/v03/
  bge-m3-license-review.md       # Source facts and required legal determination
  phase0-feasibility-report.md   # Generated technical and quality evidence
```

Modify:

```text
.gitignore                       # Exclude model artifacts and private gold data
package.json                     # Add deterministic Phase 0 commands
```

Generated files under `.artifacts/v03/` and private data under `tests/v03/private-gold/` must never be committed.

### Task 1: Pin Model Provenance and Isolate Large Artifacts

**Files:**
- Create: `scripts/v03/model-feasibility/model-source.json`
- Create: `scripts/v03/model-feasibility/requirements.txt`
- Create: `scripts/v03/model-feasibility/legal-decision.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add artifact and private-data exclusions**

Append exactly these entries to `.gitignore`:

```gitignore
# V0.3 local model feasibility artifacts and private evaluation data
.artifacts/v03/
tests/v03/private-gold/
scripts/v03/model-feasibility/.venv/
scripts/v03/model-feasibility/__pycache__/
```

- [ ] **Step 2: Pin the observed official model revision and files**

Create `scripts/v03/model-feasibility/model-source.json`:

```json
{
  "schemaVersion": 1,
  "modelId": "BAAI/bge-m3",
  "revision": "5617a9f61b028005a4858fdac845db406aefb181",
  "modelCardLicense": "mit",
  "expectedDimension": 1024,
  "maxSequenceLength": 8192,
  "pooling": "cls",
  "artifacts": [
    {
      "path": "onnx/model.onnx_data",
      "sha256": "1eebfb28493f67bba03ce0ef64bfdc7fc5a3bd9d7493f818bb1d78cd798416b4",
      "size": 2266820608
    },
    {
      "path": "onnx/sentencepiece.bpe.model",
      "sha256": "cfc8146abe2a0488e9e2a0c56de7952f7c11ab059eca145a0a727afce0db2865",
      "size": 5069051
    },
    {
      "path": "onnx/tokenizer.json",
      "sha256": "6710678b12670bc442b99edc952c4d996ae309a7020c1fa0096dd245c2faf790",
      "size": 17082821
    }
  ]
}
```

The small `onnx/model.onnx` protobuf is also downloaded, but the upstream API did not expose an LFS SHA-256 for it. `model_source.py` must record its computed hash in the generated local manifest rather than pretending the value is known here.

- [ ] **Step 3: Pin the isolated feasibility dependencies**

Create `scripts/v03/model-feasibility/requirements.txt`:

```text
huggingface_hub==1.24.0
numpy==2.5.1
onnx==1.22.0
onnxruntime==1.27.0
psutil==7.2.2
pytest==9.1.1
tokenizers==0.22.2
transformers==5.14.1
```

These packages are feasibility tooling only. Do not add them to the Electron application or production installer.

- [ ] **Step 4: Create an explicit human legal decision record**

Create `scripts/v03/model-feasibility/legal-decision.json`:

```json
{
  "schemaVersion": 1,
  "modelId": "BAAI/bge-m3",
  "revision": "5617a9f61b028005a4858fdac845db406aefb181",
  "redistributionApproved": false,
  "reviewer": "unassigned",
  "reviewedAt": null,
  "evidenceDocument": "docs/v03/bge-m3-license-review.md"
}
```

`false` is intentional. Only an authorized human review may change it to `true`; the technical implementation must not infer redistribution permission from the model-card tag alone.

- [ ] **Step 5: Verify only intended files changed**

Run:

```powershell
git diff --check
git status --short
```

Expected: the four files above are the only Phase 0 Task 1 changes; unrelated pre-existing working-tree changes may still be listed and must not be staged.

- [ ] **Step 6: Commit Task 1**

```powershell
git add .gitignore scripts/v03/model-feasibility/model-source.json scripts/v03/model-feasibility/requirements.txt scripts/v03/model-feasibility/legal-decision.json
git commit -m "chore(ai): pin BGE-M3 feasibility inputs"
```

### Task 2: Document the Commercial Redistribution Gate

**Files:**
- Create: `docs/v03/bge-m3-license-review.md`

- [ ] **Step 1: Write the evidence record**

Create `docs/v03/bge-m3-license-review.md` with this complete structure and the currently verified facts:

```markdown
# BGE-M3 商业许可与分发审查

> 审查对象：`BAAI/bge-m3`
> 固定 revision：`5617a9f61b028005a4858fdac845db406aefb181`
> 技术核对日期：2026-07-19
> 技术结论：模型卡标记为 MIT，但固定 revision 未提供独立 LICENSE 文件；未经授权人员书面确认，不得将权重随商业模型包再分发。

## 已验证事实

- Hugging Face API 的 `cardData.license` 返回 `mit`。
- 官方仓库包含 `onnx/model.onnx` 和外部数据文件 `onnx/model.onnx_data`。
- `onnx/model.onnx_data` 大小为 2,266,820,608 bytes。
- 模型配置为 XLM-RoBERTa，hidden size 1024，最大位置长度 8194。
- Sentence Transformers 配置使用 CLS pooling 和归一化。
- 固定 revision 根目录未提供可直接读取的独立 `LICENSE` 文件。

## 必须由授权人员确认的问题

1. 模型卡的 MIT 标记是否覆盖固定 revision 的权重、ONNX 产物和 tokenizer。
2. BidLens 是否可修改、量化、重新打包并向商业客户离线分发这些产物。
3. 产品、安装器、关于页和模型包需要保留哪些版权及许可文本。
4. 上游更新后，是否需要重新执行许可审查。

## 决策写入规则

授权人员确认后，更新 `scripts/v03/model-feasibility/legal-decision.json`：

- `redistributionApproved`: 仅在书面批准后设为 `true`
- `reviewer`: 填写真实审查责任人或审批记录 ID
- `reviewedAt`: ISO 8601 时间

Phase 0 gate 在上述字段不完整时必须失败。
```

- [ ] **Step 2: Check the document for unsupported claims**

Run:

```powershell
rg -n "允许商用|允许分发|已经批准" docs/v03/bge-m3-license-review.md
```

Expected: no matches. The document records evidence and an unresolved authorization gate; it does not manufacture legal approval.

- [ ] **Step 3: Commit Task 2**

```powershell
git add docs/v03/bge-m3-license-review.md
git commit -m "docs(ai): record BGE-M3 redistribution gate"
```

### Task 3: Implement Gold Dataset Validation and Metrics

**Files:**
- Create: `tests/v03/fixtures/gold-sample.json`
- Create: `tests/v03/evaluate-gold.test.ts`
- Create: `scripts/v03/model-feasibility/evaluate_gold.ts`

- [ ] **Step 1: Create a non-sensitive contract fixture**

Create `tests/v03/fixtures/gold-sample.json`:

```json
{
  "schemaVersion": 1,
  "annotation": {
    "independentAnnotators": 2,
    "adjudication": "third-reviewer"
  },
  "pairs": [
    {
      "pairId": "sample-001",
      "docA": "fixtures/sample-001-a.ast.json",
      "docB": "fixtures/sample-001-b.ast.json",
      "relations": [
        { "nodeIdsA": ["a-1"], "nodeIdsB": ["b-2"], "matchType": "moved" },
        { "nodeIdsA": ["a-2"], "nodeIdsB": ["b-3", "b-4"], "matchType": "split" }
      ],
      "forbiddenRelations": [
        { "nodeIdsA": ["a-3"], "nodeIdsB": ["b-5"] }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing metric tests**

Create `tests/v03/evaluate-gold.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  evaluateRelations,
  validateGoldDataset,
  type PredictedRelation,
} from '../../scripts/v03/model-feasibility/evaluate_gold';
import sample from './fixtures/gold-sample.json';

describe('V0.3 gold evaluation', () => {
  it('accepts the canonical sample', () => {
    expect(validateGoldDataset(sample)).toEqual({ pairCount: 1, relationCount: 2 });
  });

  it('normalizes node order when scoring exact relations', () => {
    const predictions: PredictedRelation[] = [
      { pairId: 'sample-001', nodeIdsA: ['a-1'], nodeIdsB: ['b-2'], matchType: 'moved' },
      { pairId: 'sample-001', nodeIdsA: ['a-2'], nodeIdsB: ['b-4', 'b-3'], matchType: 'split' },
    ];
    expect(evaluateRelations(sample, predictions)).toMatchObject({
      truePositive: 2,
      falsePositive: 0,
      falseNegative: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    });
  });

  it('counts explicitly forbidden predictions as obvious errors', () => {
    const predictions: PredictedRelation[] = [
      { pairId: 'sample-001', nodeIdsA: ['a-3'], nodeIdsB: ['b-5'], matchType: 'modified' },
    ];
    expect(evaluateRelations(sample, predictions).obviousErrorRate).toBe(1);
  });

  it('rejects duplicate relation identities', () => {
    const duplicate = structuredClone(sample);
    duplicate.pairs[0].relations.push(duplicate.pairs[0].relations[0]);
    expect(() => validateGoldDataset(duplicate)).toThrow('duplicate gold relation');
  });
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/v03/evaluate-gold.test.ts
```

Expected: FAIL because `evaluate_gold.ts` does not exist.

- [ ] **Step 4: Implement the complete scoring utility**

Create `scripts/v03/model-feasibility/evaluate_gold.ts`:

```typescript
export interface Relation {
  nodeIdsA: string[];
  nodeIdsB: string[];
  matchType: string;
}

export interface PredictedRelation extends Relation {
  pairId: string;
}

interface GoldPair {
  pairId: string;
  docA: string;
  docB: string;
  relations: Relation[];
  forbiddenRelations: Array<Pick<Relation, 'nodeIdsA' | 'nodeIdsB'>>;
}

interface GoldDataset {
  schemaVersion: number;
  annotation: { independentAnnotators: number; adjudication: string };
  pairs: GoldPair[];
}

export interface EvaluationResult {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
  obviousErrorCount: number;
  obviousErrorRate: number;
}

function sorted(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function relationKey(pairId: string, relation: Relation): string {
  return JSON.stringify([
    pairId,
    sorted(relation.nodeIdsA),
    sorted(relation.nodeIdsB),
    relation.matchType,
  ]);
}

function edgeKey(pairId: string, relation: Pick<Relation, 'nodeIdsA' | 'nodeIdsB'>): string {
  return JSON.stringify([pairId, sorted(relation.nodeIdsA), sorted(relation.nodeIdsB)]);
}

export function validateGoldDataset(input: unknown): { pairCount: number; relationCount: number } {
  if (!input || typeof input !== 'object') throw new Error('gold dataset must be an object');
  const dataset = input as GoldDataset;
  if (dataset.schemaVersion !== 1 || !Array.isArray(dataset.pairs)) {
    throw new Error('unsupported gold dataset schema');
  }
  if (!dataset.annotation || dataset.annotation.independentAnnotators < 2 || !dataset.annotation.adjudication) {
    throw new Error('gold dataset requires independent annotation and adjudication');
  }
  const pairIds = new Set<string>();
  const relationIds = new Set<string>();
  let relationCount = 0;
  for (const pair of dataset.pairs) {
    if (!pair.pairId || pairIds.has(pair.pairId)) throw new Error('duplicate or empty pairId');
    pairIds.add(pair.pairId);
    if (!pair.docA || !pair.docB || !Array.isArray(pair.relations) || !Array.isArray(pair.forbiddenRelations)) {
      throw new Error(`invalid pair ${pair.pairId}`);
    }
    for (const relation of pair.relations) {
      if (!relation.nodeIdsA.length || !relation.nodeIdsB.length || !relation.matchType) {
        throw new Error(`invalid gold relation in ${pair.pairId}`);
      }
      const key = relationKey(pair.pairId, relation);
      if (relationIds.has(key)) throw new Error('duplicate gold relation');
      relationIds.add(key);
      relationCount += 1;
    }
  }
  return { pairCount: dataset.pairs.length, relationCount };
}

export function evaluateRelations(input: unknown, predictions: PredictedRelation[]): EvaluationResult {
  validateGoldDataset(input);
  const dataset = input as GoldDataset;
  const gold = new Set(dataset.pairs.flatMap((pair) => pair.relations.map((r) => relationKey(pair.pairId, r))));
  const forbidden = new Set(dataset.pairs.flatMap((pair) => pair.forbiddenRelations.map((r) => edgeKey(pair.pairId, r))));
  const predicted = new Set(predictions.map((r) => relationKey(r.pairId, r)));
  const truePositive = [...predicted].filter((key) => gold.has(key)).length;
  const falsePositive = predicted.size - truePositive;
  const falseNegative = gold.size - truePositive;
  const precision = predicted.size === 0 ? 0 : truePositive / predicted.size;
  const recall = gold.size === 0 ? 0 : truePositive / gold.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const obviousErrorCount = predictions.filter((r) => forbidden.has(edgeKey(r.pairId, r))).length;
  return {
    truePositive,
    falsePositive,
    falseNegative,
    precision,
    recall,
    f1,
    obviousErrorCount,
    obviousErrorRate: predicted.size === 0 ? 0 : obviousErrorCount / predicted.size,
  };
}

if (process.argv[1]?.endsWith('evaluate_gold.ts') && process.argv.length === 4) {
  const { createHash } = await import('node:crypto');
  const { mkdir, readFile, writeFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const datasetPath = resolve(process.argv[2]);
  const outputPath = resolve(process.argv[3]);
  const bytes = await readFile(datasetPath);
  const dataset = JSON.parse(bytes.toString('utf-8')) as GoldDataset;
  const counts = validateGoldDataset(dataset);
  const output = {
    ...counts,
    annotation: dataset.annotation,
    datasetHash: createHash('sha256').update(bytes).digest('hex'),
    generatedAt: new Date().toISOString(),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}
```

- [ ] **Step 5: Run the tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/v03/evaluate-gold.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add tests/v03/fixtures/gold-sample.json tests/v03/evaluate-gold.test.ts scripts/v03/model-feasibility/evaluate_gold.ts
git commit -m "test(ai): add semantic matching gold metrics"
```

### Task 4: Validate and Acquire the Pinned ONNX Artifact

**Files:**
- Create: `tests/v03/test_model_source.py`
- Create: `scripts/v03/model-feasibility/model_source.py`

- [ ] **Step 1: Write failing Python tests**

Create `tests/v03/test_model_source.py`:

```python
import hashlib
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parents[2] / "scripts" / "v03" / "model-feasibility"
sys.path.insert(0, str(SCRIPT_DIR))

from model_source import sha256_file, validate_source


def test_sha256_file(tmp_path: Path) -> None:
    artifact = tmp_path / "artifact.bin"
    artifact.write_bytes(b"bidlens")
    assert sha256_file(artifact) == hashlib.sha256(b"bidlens").hexdigest()


def test_validate_source_accepts_pinned_manifest() -> None:
    source = json.loads((SCRIPT_DIR / "model-source.json").read_text("utf-8"))
    validate_source(source)


def test_validate_source_rejects_moving_revision() -> None:
    source = json.loads((SCRIPT_DIR / "model-source.json").read_text("utf-8"))
    source["revision"] = "main"
    try:
        validate_source(source)
    except ValueError as error:
        assert "40-character revision" in str(error)
    else:
        raise AssertionError("moving revision was accepted")
```

- [ ] **Step 2: Create and populate the virtual environment**

Run:

```powershell
python -m venv scripts/v03/model-feasibility/.venv
scripts/v03/model-feasibility/.venv/Scripts/python -m pip install -r scripts/v03/model-feasibility/requirements.txt
```

Use the isolated environment only for feasibility tooling. The model artifact itself is independently verified by SHA-256; dependency wheel hashes are not part of the production model package. Preserve the exact Windows wheel set used for the report with:

```powershell
scripts/v03/model-feasibility/.venv/Scripts/python -m pip download --only-binary=:all: --dest .artifacts/v03/wheels -r scripts/v03/model-feasibility/requirements.txt
Get-ChildItem .artifacts/v03/wheels | ForEach-Object { scripts/v03/model-feasibility/.venv/Scripts/python -m pip hash $_.FullName }
```

- [ ] **Step 3: Run the Python tests and verify RED**

Run:

```powershell
scripts/v03/model-feasibility/.venv/Scripts/python -m pytest tests/v03/test_model_source.py -q
```

Expected: FAIL because `model_source.py` does not exist.

- [ ] **Step 4: Implement model source validation and download**

Create `scripts/v03/model-feasibility/model_source.py`:

```python
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from huggingface_hub import snapshot_download


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_source(source: dict) -> None:
    if source.get("schemaVersion") != 1:
        raise ValueError("unsupported model source schema")
    revision = source.get("revision", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("revision must be a 40-character revision SHA")
    if source.get("expectedDimension") != 1024 or source.get("pooling") != "cls":
        raise ValueError("unexpected BGE-M3 embedding contract")
    for artifact in source.get("artifacts", []):
        if not re.fullmatch(r"[0-9a-f]{64}", artifact.get("sha256", "")):
            raise ValueError(f"invalid SHA-256 for {artifact.get('path')}")


def acquire(source_path: Path, output_dir: Path) -> Path:
    source = json.loads(source_path.read_text("utf-8"))
    validate_source(source)
    snapshot = Path(snapshot_download(
        repo_id=source["modelId"],
        revision=source["revision"],
        local_dir=output_dir,
        allow_patterns=["onnx/*", "1_Pooling/config.json", "modules.json"],
    ))
    manifest = []
    expected = {item["path"]: item for item in source["artifacts"]}
    for path in sorted(p for p in snapshot.rglob("*") if p.is_file()):
        relative = path.relative_to(snapshot).as_posix()
        digest = sha256_file(path)
        size = path.stat().st_size
        if relative in expected:
            item = expected[relative]
            if digest != item["sha256"] or size != item["size"]:
                raise ValueError(f"artifact mismatch: {relative}")
        manifest.append({"path": relative, "sha256": digest, "size": size})
    manifest_path = snapshot / "bidlens-source-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), "utf-8")
    return manifest_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(acquire(args.source, args.output))
```

- [ ] **Step 5: Run unit tests and acquire the pinned artifact**

Run:

```powershell
scripts/v03/model-feasibility/.venv/Scripts/python -m pytest tests/v03/test_model_source.py -q
scripts/v03/model-feasibility/.venv/Scripts/python scripts/v03/model-feasibility/model_source.py --source scripts/v03/model-feasibility/model-source.json --output .artifacts/v03/bge-m3-source
```

Expected: 3 tests PASS; acquisition prints `.artifacts/v03/bge-m3-source/bidlens-source-manifest.json`; every pinned hash and size matches.

- [ ] **Step 6: Commit Task 4**

```powershell
git add scripts/v03/model-feasibility/requirements.txt scripts/v03/model-feasibility/model_source.py tests/v03/test_model_source.py
git commit -m "test(ai): verify pinned BGE-M3 artifacts"
```

### Task 5: Quantize and Benchmark ONNX Parity and Resources

**Files:**
- Create: `scripts/v03/model-feasibility/quantize_model.py`
- Create: `scripts/v03/model-feasibility/benchmark_model.py`
- Create: `tests/v03/test_model_benchmark.py`

- [ ] **Step 1: Write failing benchmark-helper tests**

Create `tests/v03/test_model_benchmark.py`:

```python
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parents[2] / "scripts" / "v03" / "model-feasibility"))
from benchmark_model import normalize


def test_normalize_returns_unit_rows() -> None:
    result = normalize(np.array([[3.0, 4.0]], dtype=np.float32))
    assert np.allclose(result, [[0.6, 0.8]])


def test_normalize_rejects_zero_rows() -> None:
    with pytest.raises(ValueError, match="invalid embedding norm"):
        normalize(np.zeros((1, 2), dtype=np.float32))
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run:

```powershell
scripts/v03/model-feasibility/.venv/Scripts/python -m pytest tests/v03/test_model_benchmark.py -q
```

Expected: FAIL because `benchmark_model.py` does not exist.

- [ ] **Step 3: Implement deterministic dynamic quantization**

Create `scripts/v03/model-feasibility/quantize_model.py`:

```python
from __future__ import annotations

import argparse
from pathlib import Path

from onnxruntime.quantization import QuantType, quantize_dynamic


def quantize(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    quantize_dynamic(
        model_input=str(source),
        model_output=str(destination),
        weight_type=QuantType.QInt8,
        per_channel=True,
        reduce_range=False,
        use_external_data_format=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    quantize(args.source, args.output)
```

- [ ] **Step 4: Implement the reference and ONNX benchmark**

Create `scripts/v03/model-feasibility/benchmark_model.py`:

```python
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
import psutil
from transformers import AutoTokenizer

SENTENCES = [
    "投标人应具有建筑工程施工总承包一级资质。",
    "申请人须具备建筑工程施工总承包壹级资格。",
    "投标保证金为人民币五十万元。",
    "本项目不要求提交投标保证金。",
]


def normalize(values: np.ndarray) -> np.ndarray:
    denominator = np.linalg.norm(values, axis=1, keepdims=True)
    if np.any(denominator == 0) or not np.isfinite(denominator).all():
        raise ValueError("invalid embedding norm")
    return values / denominator


def ort_embeddings(model_path: Path, encoded) -> np.ndarray:
    options = ort.SessionOptions()
    options.intra_op_num_threads = max(1, min(3, (os.cpu_count() or 4) - 1))
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])
    inputs = {item.name: encoded[item.name] for item in session.get_inputs()}
    output = session.run(None, inputs)[0]
    return normalize(output[:, 0, :])


def cosine_rows(left: np.ndarray, right: np.ndarray) -> list[float]:
    return np.sum(left * right, axis=1).astype(float).tolist()


def benchmark(tokenizer_dir: Path, model_path: Path, output: Path, reference_report: Path | None) -> None:
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_dir, local_files_only=True)
    encoded = tokenizer(SENTENCES, padding=True, truncation=True, max_length=512, return_tensors="np")
    process = psutil.Process()
    before = process.memory_info().rss
    started = time.perf_counter()
    candidate = ort_embeddings(model_path, encoded)
    duration_ms = (time.perf_counter() - started) * 1000
    after = process.memory_info().rss
    reference = candidate if reference_report is None else np.asarray(
        json.loads(reference_report.read_text("utf-8"))["embeddings"], dtype=np.float32
    )
    report = {
        "modelPath": str(model_path),
        "dimension": int(candidate.shape[1]),
        "rowNorms": np.linalg.norm(candidate, axis=1).astype(float).tolist(),
        "referenceCosines": cosine_rows(reference, candidate),
        "embeddings": candidate.astype(float).tolist(),
        "durationMs": duration_ms,
        "rssBeforeBytes": before,
        "rssAfterBytes": after,
        "rssDeltaBytes": max(0, after - before),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), "utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tokenizer-dir", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--reference-report", type=Path)
    args = parser.parse_args()
    benchmark(args.tokenizer_dir, args.model, args.output, args.reference_report)
```

- [ ] **Step 5: Run helper tests and quantize the pinned model**

Run:

```powershell
scripts/v03/model-feasibility/.venv/Scripts/python -m pytest tests/v03/test_model_benchmark.py -q
scripts/v03/model-feasibility/.venv/Scripts/python scripts/v03/model-feasibility/quantize_model.py --source .artifacts/v03/bge-m3-source/onnx/model.onnx --output .artifacts/v03/bge-m3-int8/model.onnx
```

Expected: an INT8 ONNX model and external-data file exist under `.artifacts/v03/bge-m3-int8/`; neither is tracked by Git.

- [ ] **Step 6: Benchmark FP32 and INT8 in fresh processes**

Run:

```powershell
scripts/v03/model-feasibility/.venv/Scripts/python scripts/v03/model-feasibility/benchmark_model.py --tokenizer-dir .artifacts/v03/bge-m3-source/onnx --model .artifacts/v03/bge-m3-source/onnx/model.onnx --output .artifacts/v03/results/bge-m3-fp32.json
scripts/v03/model-feasibility/.venv/Scripts/python scripts/v03/model-feasibility/benchmark_model.py --tokenizer-dir .artifacts/v03/bge-m3-source/onnx --model .artifacts/v03/bge-m3-int8/model.onnx --output .artifacts/v03/results/bge-m3-int8.json --reference-report .artifacts/v03/results/bge-m3-fp32.json
```

Expected for the artifact selected for production:

- `dimension` equals 1024.
- Every row norm is in `[0.999, 1.001]`.
- FP32 reference cosine is at least `0.999` for every probe sentence.
- INT8 reference cosine is at least `0.98` for every probe sentence.
- Fresh-process peak RSS, measured in the next step, remains below 2,147,483,648 bytes.

- [ ] **Step 7: Measure true child-process peak RSS**

Use PowerShell to launch each benchmark and poll `PeakWorkingSet64` until exit:

```powershell
$python = Resolve-Path 'scripts/v03/model-feasibility/.venv/Scripts/python.exe'
$args = @('scripts/v03/model-feasibility/benchmark_model.py','--tokenizer-dir','.artifacts/v03/bge-m3-source/onnx','--model','.artifacts/v03/bge-m3-int8/model.onnx','--output','.artifacts/v03/results/bge-m3-int8-rss.json','--reference-report','.artifacts/v03/results/bge-m3-fp32.json')
$process = Start-Process -FilePath $python -ArgumentList $args -WindowStyle Hidden -PassThru
$peak = 0L
while (-not $process.HasExited) { $process.Refresh(); $peak = [Math]::Max($peak, $process.PeakWorkingSet64); Start-Sleep -Milliseconds 100 }
@{ peakWorkingSetBytes = $peak; exitCode = $process.ExitCode } | ConvertTo-Json | Set-Content .artifacts/v03/results/bge-m3-int8-process.json
if ($process.ExitCode -ne 0 -or $peak -ge 2147483648) { exit 1 }
```

Expected: exit code 0 and peak working set below 2GB.

- [ ] **Step 8: Commit Task 5 tooling**

```powershell
git add scripts/v03/model-feasibility/requirements.txt scripts/v03/model-feasibility/quantize_model.py scripts/v03/model-feasibility/benchmark_model.py tests/v03/test_model_benchmark.py
git commit -m "test(ai): benchmark BGE-M3 ONNX feasibility"
```

### Task 6: Capture the Current Jaccard Baseline on Private Gold ASTs

**Files:**
- Create: `scripts/v03/model-feasibility/run_jaccard_baseline.ts`
- Create: `tests/v03/jaccard-baseline.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Define the private dataset layout**

Populate this ignored directory with authorized, de-identified data:

```text
tests/v03/private-gold/
  dataset.json
  pairs/pair-001/doc-a.ast.json
  pairs/pair-001/doc-b.ast.json
```

`dataset.json` uses the Task 3 schema and relative AST paths. Before proceeding, a human data checkpoint must confirm:

- at least 30 document pairs;
- at least 3,000 adjudicated relations;
- two independent annotators and a recorded adjudication process;
- no customer-sensitive source content is committed to Git.

- [ ] **Step 2: Write the pure mapping test first**

Create `tests/v03/jaccard-baseline.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { mapDiffItems } from '../../scripts/v03/model-feasibility/run_jaccard_baseline';

describe('Jaccard baseline mapping', () => {
  it('keeps only correspondence items and preserves complex node lists', () => {
    expect(mapDiffItems('pair-001', [
      { node_ids_a: ['a-1'], node_ids_b: ['b-1'], match_type: 'modified' },
      { node_ids_a: ['a-2'], node_ids_b: [], match_type: 'deleted' },
      { node_ids_a: ['a-3'], node_ids_b: ['b-3', 'b-4'], match_type: 'split' },
    ])).toEqual([
      { pairId: 'pair-001', nodeIdsA: ['a-1'], nodeIdsB: ['b-1'], matchType: 'modified' },
      { pairId: 'pair-001', nodeIdsA: ['a-3'], nodeIdsB: ['b-3', 'b-4'], matchType: 'split' },
    ]);
  });
});
```

- [ ] **Step 3: Run the mapping test and verify RED**

Run:

```powershell
pnpm exec vitest run tests/v03/jaccard-baseline.test.ts
```

Expected: FAIL because `mapDiffItems` is not exported.

- [ ] **Step 4: Implement the baseline runner**

Create `scripts/v03/model-feasibility/run_jaccard_baseline.ts` as a Node script that:

1. Loads and validates `tests/v03/private-gold/dataset.json` with `validateGoldDataset`.
2. Rejects fewer than 30 pairs or 3,000 relations.
3. Builds `bidlens-engine` with `cargo build --manifest-path bidlens-engine/Cargo.toml` before evaluation.
4. Starts one `bidlens-engine.exe` child process.
5. Sends the existing newline-delimited `compare` request for every AST pair with `similarity_threshold: 0.45`.
6. Maps every returned item with non-empty A and B node IDs to `PredictedRelation`.
7. Calls `evaluateRelations` and writes `.artifacts/v03/results/jaccard-baseline.json` with metrics, engine version, protocol version, dataset hash, threshold, timestamp, and machine information.
8. Sends `shutdown` and rejects malformed responses, engine stderr, or a non-zero exit code.

Use the request and process framing already proven in `bidlens-engine/tests/json_rpc.rs`; do not introduce a second protocol shape. Keep the baseline runner outside production modules.

Create the runner with this implementation shape:

```typescript
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cpus, platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { evaluateRelations, validateGoldDataset, type PredictedRelation } from './evaluate_gold';

interface Pair { pairId: string; docA: string; docB: string; }
interface Dataset { schemaVersion: number; pairs: Pair[]; }

async function sha256(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

async function request(lines: AsyncIterator<string>, stdin: NodeJS.WritableStream, method: string, params: unknown, id: string): Promise<any> {
  stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  while (true) {
    const next = await lines.next();
    if (next.done) throw new Error(`engine closed before response ${id}`);
    const message = JSON.parse(next.value) as { id?: string; error?: { message: string }; result?: unknown };
    if (message.id !== id) continue;
    if (message.error) throw new Error(message.error.message);
    return message.result;
  }
}

export function mapDiffItems(pairId: string, items: Array<{ node_ids_a: string[]; node_ids_b: string[]; match_type: string }>): PredictedRelation[] {
  return items
    .filter((item) => item.node_ids_a.length > 0 && item.node_ids_b.length > 0)
    .map((item) => ({ pairId, nodeIdsA: item.node_ids_a, nodeIdsB: item.node_ids_b, matchType: item.match_type }));
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, '../../..');
  const manifestPath = resolve(root, 'tests/v03/private-gold/dataset.json');
  const dataset = JSON.parse(await readFile(manifestPath, 'utf-8')) as Dataset;
  const summary = validateGoldDataset(dataset);
  if (summary.pairCount < 30 || summary.relationCount < 3000) {
    throw new Error(`gold dataset too small: ${summary.pairCount} pairs, ${summary.relationCount} relations`);
  }
  execFileSync('cargo', ['build', '--manifest-path', 'bidlens-engine/Cargo.toml'], { cwd: root, stdio: 'inherit' });
  const binary = resolve(root, 'bidlens-engine/target/debug', platform() === 'win32' ? 'bidlens-engine.exe' : 'bidlens-engine');
  const child = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: child.stdout });
  const lineIterator = lines[Symbol.asyncIterator]();
  const stderr: Buffer[] = [];
  child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
  const predictions: PredictedRelation[] = [];
  let id = 0;
  try {
    const info = await request(lineIterator, child.stdin, 'ping', {}, `baseline-${++id}`);
    for (const pair of dataset.pairs) {
      const docA = JSON.parse(await readFile(resolve(root, 'tests/v03/private-gold', pair.docA), 'utf-8'));
      const docB = JSON.parse(await readFile(resolve(root, 'tests/v03/private-gold', pair.docB), 'utf-8'));
      const result = await request(lineIterator, child.stdin, 'compare', { doc_a: docA, doc_b: docB, options: { similarity_threshold: 0.45 } }, `baseline-${++id}`);
      predictions.push(...mapDiffItems(pair.pairId, result.diff.items as Array<{ node_ids_a: string[]; node_ids_b: string[]; match_type: string }>));
    }
    const metrics = evaluateRelations(dataset, predictions);
    const output = { ...metrics, engine: info, threshold: 0.45, pairCount: summary.pairCount, relationCount: summary.relationCount, datasetHash: await sha256(manifestPath), cpus: cpus().length, generatedAt: new Date().toISOString() };
    const outputPath = resolve(root, '.artifacts/v03/results/jaccard-baseline.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    await request(lineIterator, child.stdin, 'shutdown', {}, `baseline-${++id}`);
  } finally {
    lines.close();
    if (!child.killed) child.kill();
    const diagnostic = Buffer.concat(stderr).toString('utf-8').trim();
    if (diagnostic) throw new Error(`engine stderr: ${diagnostic}`);
  }
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 5: Add deterministic commands**

Add these scripts to root `package.json`:

```json
{
  "scripts": {
    "test:v03:metrics": "vitest run tests/v03/evaluate-gold.test.ts tests/v03/jaccard-baseline.test.ts tests/v03/phase0-gate.test.ts",
    "test:v03:baseline": "tsx scripts/v03/model-feasibility/run_jaccard_baseline.ts",
    "test:v03:phase0": "pnpm test:v03:metrics && pnpm test:v03:baseline && tsx scripts/v03/model-feasibility/phase0_gate.ts"
  }
}
```

Merge these keys into the existing `scripts` object; do not replace existing commands.

- [ ] **Step 6: Run the mapping test and baseline**

Run:

```powershell
pnpm exec vitest run tests/v03/jaccard-baseline.test.ts
pnpm test:v03:baseline
```

Expected: `.artifacts/v03/results/jaccard-baseline.json` exists and contains finite Precision, Recall, F1, and obvious error rate values plus the dataset hash.

- [ ] **Step 7: Commit Task 6**

```powershell
git add package.json scripts/v03/model-feasibility/run_jaccard_baseline.ts tests/v03/jaccard-baseline.test.ts
git commit -m "test(ai): capture Jaccard gold baseline"
```

### Task 7: Implement the Phase 0 Gate

**Files:**
- Create: `tests/v03/phase0-gate.test.ts`
- Create: `scripts/v03/model-feasibility/phase0_gate.ts`

- [ ] **Step 1: Write failing gate tests**

Create `tests/v03/phase0-gate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { evaluatePhase0Gate, type Phase0Evidence } from '../../scripts/v03/model-feasibility/phase0_gate';

const passing: Phase0Evidence = {
  legal: { redistributionApproved: true, reviewer: 'LEGAL-123', reviewedAt: '2026-07-19T00:00:00Z' },
  dataset: { pairCount: 30, relationCount: 3000 },
  model: { dimension: 1024, minimumReferenceCosine: 0.981, peakWorkingSetBytes: 1_900_000_000 },
  baseline: { f1: 0.61, obviousErrorRate: 0.08, datasetHash: 'abc' },
};

describe('V0.3 Phase 0 gate', () => {
  it('passes complete evidence', () => {
    expect(evaluatePhase0Gate(passing)).toEqual({ status: 'pass', failures: [] });
  });

  it('blocks unapproved redistribution', () => {
    const evidence = structuredClone(passing);
    evidence.legal.redistributionApproved = false;
    expect(evaluatePhase0Gate(evidence).failures).toContain('model redistribution is not approved');
  });

  it('blocks memory at or above 2GB', () => {
    const evidence = structuredClone(passing);
    evidence.model.peakWorkingSetBytes = 2_147_483_648;
    expect(evaluatePhase0Gate(evidence).failures).toContain('model peak working set must be below 2GB');
  });

  it('blocks insufficient gold data', () => {
    const evidence = structuredClone(passing);
    evidence.dataset.relationCount = 2999;
    expect(evaluatePhase0Gate(evidence).failures).toContain('gold dataset requires at least 3000 relations');
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/v03/phase0-gate.test.ts
```

Expected: FAIL because `phase0_gate.ts` does not exist.

- [ ] **Step 3: Implement the gate evaluator**

Create `scripts/v03/model-feasibility/phase0_gate.ts`:

```typescript
export interface Phase0Evidence {
  legal: { redistributionApproved: boolean; reviewer: string; reviewedAt: string | null };
  dataset: { pairCount: number; relationCount: number };
  model: { dimension: number; minimumReferenceCosine: number; peakWorkingSetBytes: number };
  baseline: { f1: number; obviousErrorRate: number; datasetHash: string };
}

export function evaluatePhase0Gate(evidence: Phase0Evidence): { status: 'pass' | 'fail'; failures: string[] } {
  const failures: string[] = [];
  if (!evidence.legal.redistributionApproved || !evidence.legal.reviewer || !evidence.legal.reviewedAt) {
    failures.push('model redistribution is not approved');
  }
  if (evidence.dataset.pairCount < 30) failures.push('gold dataset requires at least 30 pairs');
  if (evidence.dataset.relationCount < 3000) failures.push('gold dataset requires at least 3000 relations');
  if (evidence.model.dimension !== 1024) failures.push('model output dimension must be 1024');
  if (evidence.model.minimumReferenceCosine < 0.98) failures.push('INT8 reference cosine must be at least 0.98');
  if (evidence.model.peakWorkingSetBytes >= 2_147_483_648) failures.push('model peak working set must be below 2GB');
  if (!Number.isFinite(evidence.baseline.f1) || !Number.isFinite(evidence.baseline.obviousErrorRate)) {
    failures.push('Jaccard baseline metrics must be finite');
  }
  if (!evidence.baseline.datasetHash) failures.push('Jaccard baseline requires a dataset hash');
  return { status: failures.length === 0 ? 'pass' : 'fail', failures };
}

if (process.argv[1]?.endsWith('phase0_gate.ts')) {
  const { readFileSync } = await import('node:fs');
  const root = new URL('../../../', import.meta.url);
  const readJson = (relative: string) => JSON.parse(readFileSync(new URL(relative, root), 'utf-8')) as any;
  const legal = readJson('scripts/v03/model-feasibility/legal-decision.json');
  const gold = readJson('.artifacts/v03/results/gold-summary.json');
  const model = readJson('.artifacts/v03/results/bge-m3-int8.json');
  const processReport = readJson('.artifacts/v03/results/bge-m3-int8-process.json');
  const baseline = readJson('.artifacts/v03/results/jaccard-baseline.json');
  const evidence: Phase0Evidence = {
    legal,
    dataset: { pairCount: gold.pairCount, relationCount: gold.relationCount },
    model: {
      dimension: model.dimension,
      minimumReferenceCosine: Math.min(...model.referenceCosines),
      peakWorkingSetBytes: processReport.peakWorkingSetBytes,
    },
    baseline: { f1: baseline.f1, obviousErrorRate: baseline.obviousErrorRate, datasetHash: baseline.datasetHash },
  };
  const result = evaluatePhase0Gate(evidence);
  console.log(JSON.stringify({ ...result, evidence }, null, 2));
  if (result.status === 'fail') process.exitCode = 1;
}
```

Keep file reading out of `evaluatePhase0Gate` so unit tests remain deterministic.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/v03/phase0-gate.test.ts tests/v03/evaluate-gold.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add tests/v03/phase0-gate.test.ts scripts/v03/model-feasibility/phase0_gate.ts package.json
git commit -m "test(ai): enforce V0.3 feasibility gates"
```

### Task 8: Execute the Human Checkpoints and Publish the Feasibility Decision

**Files:**
- Modify: `scripts/v03/model-feasibility/legal-decision.json`
- Create: `docs/v03/phase0-feasibility-report.md`

- [ ] **Step 1: Complete the legal checkpoint**

An authorized reviewer reads `docs/v03/bge-m3-license-review.md` and the upstream materials for the pinned revision. Only after written approval, set `redistributionApproved` to `true`, set `reviewer` to the exact approval record identity, and set `reviewedAt` to the approval time in ISO 8601 format. Do not use a generic name or a fabricated timestamp. If approval is denied or remains unavailable, keep `redistributionApproved: false`, record the reason in the report, and stop before Phase 1 planning.

- [ ] **Step 2: Complete the gold-data checkpoint**

Have the data owner verify the private dataset meets the Task 6 counts and provenance requirements. Generate a summary containing only counts, annotation metadata, and the dataset SHA-256; do not include document text:

```powershell
pnpm exec tsx scripts/v03/model-feasibility/evaluate_gold.ts tests/v03/private-gold/dataset.json .artifacts/v03/results/gold-summary.json
```

Expected: `gold-summary.json` reports at least 30 pairs, at least 3,000 relations, two or more independent annotators, a non-empty adjudication record, and a 64-character dataset hash.

- [ ] **Step 3: Run the full Phase 0 verification**

Run:

```powershell
pnpm test:v03:phase0
scripts/v03/model-feasibility/.venv/Scripts/python -m pytest tests/v03/test_model_source.py -q
cargo test --manifest-path bidlens-engine/Cargo.toml
pnpm test:ts
```

Expected before a passing decision:

- Phase 0 gate: `status: pass`, zero failures.
- Python model-source tests: 3 PASS.
- Rust suite: PASS.
- TypeScript shared and desktop suites: PASS.

- [ ] **Step 4: Write the evidence report**

Create `docs/v03/phase0-feasibility-report.md` with exact values copied from the generated JSON evidence. The report must contain these headings and fields:

```markdown
# BidLens V0.3 Phase 0 可行性报告

## 决策

- Gate decision and zero-based failure count
- 固定模型：BAAI/bge-m3
- 固定 revision：5617a9f61b028005a4858fdac845db406aefb181
- Selected production artifact and quantization mode

## 许可证据

- Redistribution decision
- Exact reviewer or approval record ID
- ISO 8601 review time

## 模型证据

- Embedding dimension
- Minimum reference cosine
- Peak working set in bytes and MiB
- Cold-start duration in milliseconds
- Model package size in bytes and MiB

## 数据集与当前基线

- Document-pair count
- Adjudicated-relation count
- Dataset SHA-256
- Jaccard Precision, Recall, and F1
- Jaccard obvious-error rate

## 未通过项

- On PASS, state that there are no failed gates.
- On FAIL, copy every gate failure and record the model-reselection or remediation decision.

## 后续决定

- PASS：允许编写 Phase 1 实施计划。
- FAIL：禁止接入生产运行时；回到模型选择决策。
```

Every field must contain measured evidence rather than an instruction to the reader.

- [ ] **Step 5: Verify the report and repository**

Run:

```powershell
rg -n "未填写|待定|TBD|TODO|placeholder" docs/v03/phase0-feasibility-report.md scripts/v03/model-feasibility/legal-decision.json
git diff --check
git status --short
```

Expected: no placeholder matches and no model/private-gold artifacts appear in `git status`.

- [ ] **Step 6: Commit the Phase 0 decision**

```powershell
git add scripts/v03/model-feasibility/legal-decision.json docs/v03/phase0-feasibility-report.md
git commit -m "docs(ai): publish V0.3 feasibility decision"
```

## Final Verification

Run every command from a clean shell:

```powershell
pnpm test:v03:phase0
scripts/v03/model-feasibility/.venv/Scripts/python -m pytest tests/v03/test_model_source.py -q
cargo test --manifest-path bidlens-engine/Cargo.toml
pnpm test:ts
git diff --check
git status --short
```

Required evidence:

- The Phase 0 gate reports PASS with zero failures.
- BGE-M3 INT8 parity is at least 0.98 against the pinned reference path.
- Peak child-process working set is below 2GB.
- Private gold data has at least 30 pairs and 3,000 adjudicated relations.
- The current Jaccard baseline is recorded against the same dataset hash.
- No model weights, virtual environments, generated benchmark outputs, or private gold documents are tracked.
- Existing Rust and TypeScript tests remain green.
- The feasibility report contains measured values and an auditable legal decision.

If any required evidence fails, Phase 0 is not complete and the Phase 1 plan must not be written.
