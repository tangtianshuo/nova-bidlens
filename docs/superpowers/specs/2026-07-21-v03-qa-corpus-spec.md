# V0.3.0 QA Corpus Specification and Evidence Assertions

> Date: 2026-07-21
> Status: acceptance test plan
> Product authority: `docs/product/PRD-v0.3-similarity-risk-review.md` sections 16.1-16.3
> Test root: `tests/v03/corpus/`

## 1. Purpose

Define the sanitized real-file QA corpus and expected evidence assertions for V0.3.0 release acceptance. Every scenario in this spec must pass before V0.3.0 can ship (PRD section 16).

## 2. Scenario Matrix

### 2.1 Dimension Definitions

| Dimension | Values | Count |
|---|---|---|
| Format | `docx`, `pdf-text`, `mixed` | 3 |
| Baseline | `with-baseline`, `no-baseline` | 2 |
| File count | `2-files`, `8-files` | 2 |
| Failure mode | `none`, `corrupt`, `unsupported`, `partial-failure` | 4 |

### 2.2 Core Scenarios (must-pass)

| ID | Format | Baseline | Files | Failure | Priority |
|---|---|---|---|---|---|
| CORPUS-01 | docx | with-baseline | 2 | none | P0 |
| CORPUS-02 | docx | no-baseline | 2 | none | P0 |
| CORPUS-03 | pdf-text | with-baseline | 2 | none | P0 |
| CORPUS-04 | pdf-text | no-baseline | 2 | none | P0 |
| CORPUS-05 | mixed | with-baseline | 2 | none | P0 |
| CORPUS-06 | mixed | no-baseline | 2 | none | P0 |
| CORPUS-07 | docx | with-baseline | 8 | none | P0 |
| CORPUS-08 | docx | no-baseline | 8 | none | P0 |
| CORPUS-09 | pdf-text | with-baseline | 8 | none | P1 |
| CORPUS-10 | mixed | with-baseline | 8 | none | P1 |

### 2.3 Failure Scenarios (must-pass)

| ID | Format | Baseline | Files | Failure | Expected behavior |
|---|---|---|---|---|---|
| CORPUS-F1 | docx | n/a | 2 | corrupt (truncated) | Validation blocks import before analysis |
| CORPUS-F2 | pdf-text | n/a | 2 | corrupt (zero-byte) | Validation blocks import before analysis |
| CORPUS-F3 | docx | n/a | 2 | unsupported (.xlsx) | Validation rejects with clear format error |
| CORPUS-F4 | mixed | n/a | 8 | 1 file parse failure | Project pauses; user can replace or remove |
| CORPUS-F5 | mixed | n/a | 8 | baseline parse failure | User can confirm no-baseline mode or abort |

### 2.4 Workflow Scenarios (must-pass)

| ID | Description | Priority |
|---|---|---|
| CORPUS-W1 | Cancel mid-analysis, resume from checkpoint | P0 |
| CORPUS-W2 | Interrupted recovery after simulated crash | P0 |
| CORPUS-W3 | Accept partial result after detector failure | P0 |
| CORPUS-W4 | Reopen completed project from history (no re-analysis) | P0 |
| CORPUS-W5 | Relocate missing original file, verify hash check | P1 |
| CORPUS-W6 | Export report (PDF, HTML, Markdown) from completed project | P0 |
| CORPUS-W7 | 8-file project: delete project, verify all artifacts cleaned | P1 |

## 3. Sanitized File Requirements

### 3.1 PII and Real-Company Scrubbing

All corpus files must contain zero real PII and zero real company names. Required substitutions:

| Real pattern | Replacement |
|---|---|
| Company name | `甲公司`, `乙公司`, `丙公司`, ... `辛公司` (8 max) |
| Person name | `张三`, `李四`, `王五`, ... |
| ID card number | Random valid checksum in `11010119900101XXXX` range |
| Phone number | `1380000XXXX` range |
| Email | `bidder-0N@example.com` |
| Credit code | `91110000MA0XXXXXXX` range |
| Bank account | `622200000000000N` |
| Address | `某某省某某市某某路N号` |
| Project name | `某某项目-测试招标` |
| Amount | Use round numbers in 100,000 - 99,999,999 range |

### 3.2 File Naming Convention

```
{scenario-id}_{submission-index}_{sanitized-name}.{ext}
```

Examples:
- `CORPUS-01_01_甲公司-技术标.docx`
- `CORPUS-01_02_乙公司-技术标.docx`
- `CORPUS-01_baseline_招标文件.docx`
- `CORPUS-07_01_甲公司-技术标.docx` through `CORPUS-07_08_辛公司-技术标.docx`

### 3.3 Content Requirements per Scenario

Each corpus file pair/group must include controlled test content:

| Content type | Required occurrences | Purpose |
|---|---|---|
| Exact-duplicate paragraph | >= 2 files, >= 3 sentences each | Text detector ground truth |
| Paraphrased paragraph (same meaning, different words) | >= 2 files, >= 2 sentences | Semantic recall baseline (V0.3.1, not gated) |
| Unique paragraph (only in 1 file) | >= 3 sentences per file | False-positive control |
| Table with identical rows | >= 1 table, >= 3 rows matching across files | Table detector ground truth |
| Table with conflicting values | >= 1 row where amounts/dates differ | Key-fact conflict detection |
| Repeated strong entity (ID card, phone) | >= 2 files share same entity | Entity detector ground truth |
| Repeated weak entity (person name) | >= 2 files share same name but different context | Weak entity noise control |
| Tender-baseline paragraph (appears in baseline and all submissions) | >= 2 paragraphs | Tender filtering ground truth |
| Key fact: amount | >= 2 files with same amount in same section | Key-fact same detection |
| Key fact: conflicting amounts | >= 2 files with different amounts in same section | Key-fact conflict detection |

### 3.4 Minimum Document Size

| Metric | Minimum |
|---|---|
| Pages per submission | 10 |
| Paragraphs per submission | 30 |
| Tables per submission | 2 |
| Total corpus files | 62 (10 core scenarios + 5 failure + 7 workflow scenarios, file sets shared where possible) |

## 4. Expected Evidence Assertions (PRD section 16.2)

Each assertion below maps to a PRD requirement. Test code must verify these against the actual `AnalysisProjectDetail` returned after analysis completes.

### 4.1 Exact Text Never Misses

```typescript
// PRD: "完全一致文本不得漏检"
// Setup: Inject 3 known exact-duplicate paragraphs across 3 files.
// Assert:
for (const knownDuplicate of KNOWN_EXACT_DUPLICATES) {
  const matchingFindings = findings.filter(f =>
    f.detectorType === 'text' &&
    f.evidence.some(e => e.sourceNormalizedText === knownDuplicate.normalizedText)
  );
  expect(matchingFindings.length).toBeGreaterThanOrEqual(1);
}
```

### 4.2 Strong Entity Normalization Exact

```typescript
// PRD: "强实体规范化精确匹配不得误配"
// Setup: Two files share ID card "110101199001011234"; a third file has "110101199001011235".
// Assert:
const entityFindings = findings.filter(f => f.detectorType === 'entity');
const sharedIdCardFinding = entityFindings.find(f =>
  f.evidence.some(e => e.matchBasis === 'entity') &&
  f.involvedSubmissionIds.length === 2 &&
  f.evidence.every(e => e.sourceNormalizedText === '110101199001011234')
);
expect(sharedIdCardFinding).toBeDefined();
// The third file with different ID must NOT appear in this finding:
expect(sharedIdCardFinding!.involvedSubmissionIds).not.toContain(DIFFERENT_ID_SUBMISSION);
```

### 4.3 Evidence Locates Table/Row/Cells

```typescript
// PRD: "表格 Evidence 定位到表、行和单元格"
// Setup: A table with 3 identical rows across 2 files.
// Assert:
const tableEvidence = findings
  .filter(f => f.detectorType === 'table')
  .flatMap(f => f.evidence);
for (const ev of tableEvidence) {
  expect(ev.sourceTableLocation).not.toBeNull();
  expect(ev.sourceTableLocation!.tableIndex).toBeGreaterThanOrEqual(0);
  expect(ev.sourceTableLocation!.rowIndex).toBeGreaterThanOrEqual(0);
  expect(ev.targetTableLocation).not.toBeNull();
  expect(ev.targetTableLocation!.tableIndex).toBeGreaterThanOrEqual(0);
  expect(ev.targetTableLocation!.rowIndex).toBeGreaterThanOrEqual(0);
}
```

### 4.4 Same and Conflicting Facts Distinguished

```typescript
// PRD: "关键事实区分相同和冲突"
// Setup: Two files with same amount "500000" in "投标总价" section;
//        two files with different amounts "500000" vs "600000" in same section.
// Assert:
const keyFactFindings = findings.filter(f => f.detectorType === 'key-fact');
const sameFact = keyFactFindings.find(f =>
  f.scoreBreakdown.factConflictPenalty === 0 &&
  f.evidence.some(e => e.matchBasis === 'fact')
);
const conflictFact = keyFactFindings.find(f =>
  f.scoreBreakdown.factConflictPenalty > 0
);
expect(sameFact).toBeDefined();
expect(conflictFact).toBeDefined();
expect(sameFact!.id).not.toBe(conflictFact!.id);
```

### 4.5 Tender Content Does Not Accumulate High Risk

```typescript
// PRD: "招标公共内容不直接累计高风险"
// Setup: Baseline file contains 3 paragraphs that appear verbatim in all submissions.
// Assert:
const tenderEvidence = findings.flatMap(f => f.evidence).filter(e => e.tenderFiltered);
expect(tenderEvidence.length).toBeGreaterThanOrEqual(3);
// Findings that consist entirely of tender-filtered evidence must not be high risk:
for (const finding of findings) {
  const allTenderFiltered = finding.evidence.every(e => e.tenderFiltered);
  if (allTenderFiltered) {
    expect(finding.riskLevel).not.toBe('high');
  }
}
// Project risk assessment should reflect tender discount:
expect(detail.assessment?.tenderDiscountApplied).toBe(true);
```

### 4.6 Cross-Detector Hits Do Not Double-Count

```typescript
// PRD: "跨检测器命中不重复计数"
// Setup: A paragraph that is both exact-text-match AND entity-overlap.
// Assert: The same pair of submissions should not produce two separate findings
// for the same content overlap.
const submissionPairFindings = findings.filter(f =>
  f.involvedSubmissionIds.includes(SUB_A) &&
  f.involvedSubmissionIds.includes(SUB_B)
);
// Each finding must cover a distinct content overlap (no two findings with
// identical evidence node pairs):
const evidencePairs = submissionPairFindings.map(f =>
  f.evidence.map(e => [e.sourceNodeId, e.targetNodeId].sort().join(':')).sort().join('|')
);
const uniquePairs = new Set(evidencePairs);
expect(evidencePairs.length).toBe(uniquePairs.size);
```

### 4.7 All Findings Have >= 2 Submissions of Evidence

```typescript
// PRD: "所有 Finding 至少有两份不同文件的 Evidence"
// Assert:
for (const finding of findings) {
  const distinctSubmissions = new Set([
    ...finding.evidence.map(e => e.sourceSubmissionId),
    ...finding.evidence.map(e => e.targetSubmissionId),
  ]);
  expect(distinctSubmissions.size).toBeGreaterThanOrEqual(2);
  expect(finding.involvedSubmissionIds.length).toBeGreaterThanOrEqual(2);
}
```

### 4.8 Same Input + Version = Same Result (Determinism)

```typescript
// PRD: "相同输入和版本产生相同结果"
// Setup: Run CORPUS-01 twice with identical files and ruleVersion.
// Assert:
const run1 = await runAnalysis(corpus01Files);
const run2 = await runAnalysis(corpus01Files);
expect(run1.findings.length).toBe(run2.findings.length);
expect(run1.assessment?.level).toBe(run2.assessment?.level);
// Compare finding-level determinism (order-insensitive):
const run1Signatures = run1.findings.map(f => ({
  type: f.detectorType,
  level: f.riskLevel,
  subs: [...f.involvedSubmissionIds].sort().join(','),
  score: f.scoreBreakdown.finalScore,
})).sort((a, b) => a.subs.localeCompare(b.subs));
const run2Signatures = run2.findings.map(f => ({
  type: f.detectorType,
  level: f.riskLevel,
  subs: [...f.involvedSubmissionIds].sort().join(','),
  score: f.scoreBreakdown.finalScore,
})).sort((a, b) => a.subs.localeCompare(b.subs));
expect(run1Signatures).toEqual(run2Signatures);
```

### 4.9 Complete Traceability

```typescript
// PRD: "每条 Finding 可追溯到文件、章节、页码、AST/ReviewNode、原文、检测依据、规则版本和人工意见"
// Assert:
for (const finding of findings) {
  // Finding-level traceability
  expect(finding.ruleVersion).toBeTruthy();
  expect(finding.detectorType).toBeDefined();

  // Evidence-level traceability
  for (const ev of finding.evidence) {
    expect(ev.sourceSubmissionId).toBeTruthy();
    expect(ev.sourceSectionPath.length).toBeGreaterThan(0);
    expect(ev.sourcePageRange).not.toBeNull();      // page location
    expect(ev.sourceOriginalText.length).toBeGreaterThan(0); // original text
    expect(ev.matchBasis).toBeDefined();             // detection basis
    expect(ev.ruleVersion).toBeTruthy();             // rule version
    expect(ev.sourceNodeId).toBeTruthy();            // AST/ReviewNode link
    expect(ev.targetSubmissionId).toBeTruthy();
    expect(ev.targetSectionPath.length).toBeGreaterThan(0);
    expect(ev.targetPageRange).not.toBeNull();
    expect(ev.targetOriginalText.length).toBeGreaterThan(0);
    expect(ev.targetNodeId).toBeTruthy();
  }
}

// Review decision traceability (after user action):
// After saving a review, the finding must carry reviewStatus, reviewedAt:
const reviewedFinding = await saveReview({
  projectId, findingId: findings[0].id, status: 'confirmed', note: 'test note',
});
expect(reviewedFinding.reviewStatus).toBe('confirmed');
expect(reviewedFinding.reviewedAt).toBeTruthy();
expect(reviewedFinding.reviewNote).toBe('test note');
```

## 5. Expected Risk Level Ranges per Scenario

| Scenario group | Expected findings count | Expected project risk | Notes |
|---|---|---|---|
| CORPUS-01/03/05 (with-baseline, 2 files) | 3-15 | low to medium | Baseline filters common content |
| CORPUS-02/04/06 (no-baseline, 2 files) | 5-20 | medium to high | No tender filtering |
| CORPUS-07/09 (with-baseline, 8 files) | 20-100 | medium to high | N*(N-1)/2 = 28 pairs |
| CORPUS-08 (no-baseline, 8 files) | 30-150 | high | Maximum noise |
| CORPUS-F1/F2/F3 | 0 | n/a | Blocked before analysis |
| CORPUS-F4 | 0 (incomplete) | 'incomplete' | Partial failure |
| CORPUS-F5 | 0 (incomplete) | 'incomplete' | Baseline failure |

## 6. Evidence Type Coverage Matrix

Every core scenario (CORPUS-01 through CORPUS-10) must produce evidence of all four detector types:

| Detector type | Minimum findings per scenario | Minimum evidence per finding |
|---|---|---|
| `text` | >= 2 | >= 1 (each with source + target) |
| `table` | >= 1 | >= 1 (with table location) |
| `entity` | >= 1 | >= 1 (with normalized value) |
| `key-fact` | >= 1 | >= 1 (with fact type and unit) |

## 7. Performance Assertions (PRD section 16.3)

| Metric | Threshold | Scenario |
|---|---|---|
| 8-file analysis completes | < 5 minutes | CORPUS-07 on target hardware |
| No OOM | Peak RSS < 4 GB | CORPUS-07 (4000 simulated pages) |
| Finding list scroll | < 100ms per frame | CORPUS-08 (1000+ findings) |
| Report export | < 30 seconds | CORPUS-W6 |

Target hardware: Windows 10/11, 4-core CPU, 16 GB RAM, no discrete GPU.

## 8. Security Assertions (PRD section 16.3)

| Assertion | Method |
|---|---|
| No implicit external requests | Run with network disconnected; assert no DNS/HTTP failures |
| Sensitive data encrypted | Read SQLite DB directly; assert paths, AST, evidence text are AES-256-GCM ciphertext |
| Logs leak no PII | Scan app logs for corpus file paths, original text, entity values |
| No test fixtures in production build | Verify `tests/v03/corpus/` not included in packaged app |

## 9. File Inventory

### 9.1 Minimum Corpus Files to Create

| Category | Files | Notes |
|---|---|---|
| DOCX submissions (2-file sets) | 12 | 6 pairs x 2 files |
| PDF submissions (2-file sets) | 8 | 4 pairs x 2 files |
| DOCX submissions (8-file set) | 8 | 1 scenario x 8 files |
| PDF submissions (8-file set) | 8 | 1 scenario x 8 files |
| Mixed 8-file set | 8 | 4 DOCX + 4 PDF |
| Baseline files | 4 | 1 per format (DOCX, PDF) x 2 (shared across scenarios) |
| Failure samples | 5 | 2 corrupt DOCX, 1 corrupt PDF, 1 .xlsx, 1 zero-byte |
| **Total** | **53** | |

### 9.2 Directory Structure

```
tests/v03/corpus/
├── README.md                          # Corpus overview and sanitization audit log
├── baseline/
│   ├── tender-baseline-docx.docx      # Shared DOCX baseline
│   └── tender-baseline-pdf.pdf        # Shared PDF baseline
├── CORPUS-01/
│   ├── CORPUS-01_01_甲公司-技术标.docx
│   ├── CORPUS-01_02_乙公司-技术标.docx
│   └── assertions.json                # Expected findings, levels, evidence types
├── CORPUS-02/
│   ├── CORPUS-02_01_甲公司-技术标.docx
│   ├── CORPUS-02_02_乙公司-技术标.docx
│   └── assertions.json
├── ...
├── CORPUS-07/
│   ├── CORPUS-07_01_甲公司-技术标.docx
│   ├── ...
│   ├── CORPUS-07_08_辛公司-技术标.docx
│   └── assertions.json
├── CORPUS-08/
│   └── ...                            # Same structure, no baseline
├── CORPUS-F1/
│   ├── CORPUS-F1_01_truncated.docx
│   ├── CORPUS-F1_02_normal.docx
│   └── assertions.json                # Expected: validation error, 0 findings
├── CORPUS-F2/
│   ├── CORPUS-F2_01_zero-byte.pdf
│   ├── CORPUS-F2_02_normal.pdf
│   └── assertions.json
├── CORPUS-F3/
│   ├── CORPUS-F3_01_spreadsheet.xlsx
│   ├── CORPUS-F3_02_normal.docx
│   └── assertions.json
├── CORPUS-F4/
│   ├── CORPUS-F4_01_normal.docx
│   ├── CORPUS-F4_02_corrupt-parse.docx  # Valid structure, causes parser error
│   ├── ...
│   └── assertions.json
└── CORPUS-F5/
    ├── CORPUS-F5_baseline_corrupt.docx  # Causes baseline parse failure
    ├── CORPUS-F5_01_normal.docx
    ├── ...
    └── assertions.json
```

### 9.3 assertions.json Schema

```json
{
  "scenarioId": "CORPUS-01",
  "description": "DOCX, with baseline, 2 files, no failure",
  "inputs": {
    "format": "docx",
    "hasBaseline": true,
    "submissionCount": 2,
    "failureMode": "none"
  },
  "expected": {
    "status": "ready",
    "findingCountRange": [3, 15],
    "projectRiskRange": ["low", "medium"],
    "detectorTypes": ["text", "table", "entity", "key-fact"],
    "evidenceAssertions": {
      "exactTextNotMissed": true,
      "strongEntityExact": true,
      "tableLocationPresent": true,
      "factConflictDistinguished": true,
      "tenderFiltered": true,
      "noDoubleCounting": true,
      "allFindingsMultiSubmission": true,
      "deterministic": true,
      "fullyTraceable": true
    }
  },
  "knownDuplicates": [
    {
      "normalizedText": "本项目严格按照招标文件要求执行...",
      "fileIndices": [1, 2],
      "sectionPath": ["技术方案", "质量保证"]
    }
  ],
  "knownEntities": [
    {
      "type": "id-card",
      "normalizedValue": "110101199001011234",
      "fileIndices": [1, 2]
    }
  ],
  "knownTableMatches": [
    {
      "tableIndex": 0,
      "rowIndices": [0, 1, 2],
      "fileIndices": [1, 2]
    }
  ],
  "knownFacts": [
    {
      "type": "amount",
      "normalizedValue": "500000",
      "sectionPath": ["商务部分", "投标总价"],
      "fileIndices": [1, 2],
      "conflict": false
    },
    {
      "type": "amount",
      "normalizedValue": "600000",
      "sectionPath": ["商务部分", "投标总价"],
      "fileIndices": [1],
      "conflictWith": {
        "fileIndex": 2,
        "value": "550000"
      }
    }
  ]
}
```

## 10. Test Runner Contract

### 10.1 Test File Location

```
tests/v03/qa-corpus.test.ts       # Runs all CORPUS-* scenarios
tests/v03/qa-failure.test.ts      # Runs all CORPUS-F* scenarios
tests/v03/qa-workflow.test.ts     # Runs all CORPUS-W* scenarios
tests/v03/qa-assertions.test.ts   # Runs PRD section 16.2 assertions across scenarios
```

### 10.2 Test Harness Requirements

- Tests must load `assertions.json` per scenario and drive analysis via the `risk:*` IPC surface (or direct service call in integration tests).
- Tests must NOT depend on external network, model downloads, or non-deterministic resources.
- Tests must clean up all generated artifacts after each run.
- Determinism test (4.8) must run twice in the same test process to avoid environment drift.

### 10.3 Integration with Existing Tests

The existing `tests/v03/` gold evaluation and phase-0 gate tests remain untouched. The QA corpus tests are additive and parallel:

| Existing test | QA corpus complement |
|---|---|
| `evaluate-gold.test.ts` | QA corpus runs against real pipeline, not just gold predictions |
| `jaccard-baseline.test.ts` | QA corpus validates end-to-end, not just mapping |
| `phase0-gate.test.ts` | QA corpus runs after phase-0 passes |

## 11. Acceptance Checklist

Before V0.3.0 release, every item below must be checked:

- [ ] All CORPUS-01 through CORPUS-10 pass assertions (section 4.1-4.9)
- [ ] All CORPUS-F1 through CORPUS-F5 produce correct error states
- [ ] All CORPUS-W1 through CORPUS-W7 complete workflow steps
- [ ] No corpus file contains real PII (sanitization audit log in corpus README)
- [ ] Determinism verified: CORPUS-01 run twice produces identical findings
- [ ] Performance thresholds met on target hardware
- [ ] Security assertions pass (no network, encrypted storage, no log leaks)
- [ ] Production build excludes corpus directory
