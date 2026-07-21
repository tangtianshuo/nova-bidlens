# V0.3.0 Domain Semantics Field Dictionary

> Date: 2026-07-21
> Status: Draft — pending review freeze
> Authority: PRD v0.3 (`docs/product/PRD-v0.3-similarity-risk-review.md`)
> Current types: `packages/shared/src/risk-review.ts`, `packages/shared/src/ipc.ts`

## 1. Gap Summary

| Area | Current | PRD | Action |
|------|---------|-----|--------|
| Project status | `validating\|parsing\|filtering\|embedding\|retrieving\|detecting\|aggregating\|ready\|partial\|interrupted\|failed` | `draft\|running\|ready\|partial\|interrupted\|failed\|cancelled` | Replace |
| Analysis phase | missing | `validating\|parsing\|extracting-nodes\|extracting-entities\|filtering-tender-content\|recalling-candidates\|detecting\|aggregating\|persisting\|completed` | Add |
| Submission state | `status: AnalysisProjectStatus` (reused) | Per-submission processing state | Add |
| ReviewNode | missing | §7: stable ID, node type, section path, page range, normalized text, content hash, entities, facts, labels | Add |
| Entity type | missing | §7/§8.3: strong (id/code) vs weak (name) entities | Add |
| KeyFact type | missing | §7/§8.4: amount, ratio, date, period, identifier, qualification, negation, commitment | Add |
| Business labels | missing | §7.1: 12 labels from `bidder-identity` to `generic` | Add |
| DetectorCandidate | missing | §9: candidate pair with score breakdown | Add |
| DetectorHit | missing | §9: detector output with evidence | Add |
| ScoreBreakdown | missing | §9: contribution components | Add |
| FindingReviewStatus | `pending\|confirmed\|ignored\|important` | §11: `pending\|confirmed\|ignored`, `important` is boolean | Fix |
| FilePairAssessment | missing | §10.2: directional coverage, symmetric similarity | Add |
| ProjectRiskAssessment | `RiskAssessment` (partial) | §10.3: non-linear, includes incomplete propagation | Extend |
| ReviewDecision | missing | §11: independent from algorithm risk | Add |
| AnalysisCheckpoint | missing | §13.3: phase, input hash, processing version | Add |
| AuditEvent | missing | §15.3: event type, timestamp, payload | Add |
| ExportedReport | missing | §15.1: format, scope, result hash | Add |
| TenderBaseline | missing in types | §6/§8.5: 0..1 per project | Add |
| Evidence location | `blockIndex` only | §7: file, AST node ID, ReviewNode ID, page, section path, table/row/cell | Extend |
| matchBasis | `lexical\|semantic\|structural\|entity` | Also needs `fact` | Extend |

## 2. Canonical Type Definitions

### 2.1 Project Status (PRD §13.1)

```typescript
type ProjectStatus = 'draft' | 'running' | 'ready' | 'partial' | 'interrupted' | 'failed' | 'cancelled';
```

Current `AnalysisProjectStatus` conflates project status with analysis phase. Split into two types.

### 2.2 Analysis Phase (PRD §13.2)

```typescript
type AnalysisPhase =
  | 'validating'
  | 'parsing'
  | 'extracting-nodes'
  | 'extracting-entities'
  | 'filtering-tender-content'
  | 'recalling-candidates'
  | 'detecting'
  | 'aggregating'
  | 'persisting'
  | 'completed';
```

Not stored — derived from checkpoint progress. Used for UI stage display.

### 2.3 Submission Processing State (PRD §13.4)

```typescript
type SubmissionState = 'pending' | 'validated' | 'parsing' | 'parsed' | 'extracting' | 'extracted' | 'failed' | 'removed';
```

Per-submission, not per-project. Tracks where each file is in the pipeline.

### 2.4 ReviewNode (PRD §7)

```typescript
type ReviewNodeType = 'heading' | 'paragraph' | 'list-item' | 'table-row' | 'table-cell';

interface ReviewNode {
  id: string;                    // stable, deterministic from AST + version
  sourceAstNodeId: string;       // links back to DocumentAst block
  submissionId: string;
  nodeType: ReviewNodeType;
  sectionPath: string[];         // e.g. ["技术方案", "施工组织", "进度计划"]
  orderIndex: number;            // document-order position
  pageRange: [number, number] | null;
  originalText: string;
  normalizedText: string;
  contentHash: string;           // hash of normalized text
  labels: BusinessLabel[];       // PRD §7.1
  entities: Entity[];
  keyFacts: KeyFact[];
  isKeyNode: boolean;            // PRD §7.2 criteria
  tableLocation: TableLocation | null;
}
```

### 2.5 Business Labels (PRD §7.1)

```typescript
type BusinessLabel =
  | 'bidder-identity'
  | 'authorization'
  | 'qualification'
  | 'personnel'
  | 'performance'
  | 'technical-solution'
  | 'schedule'
  | 'quality'
  | 'equipment'
  | 'commercial'
  | 'commitment'
  | 'generic';
```

A node can have multiple labels. Labels influence recall priority and explanation, not filtering.

### 2.6 Entity (PRD §8.3)

```typescript
type EntityStrength = 'strong' | 'weak';
type StrongEntityType = 'id-card' | 'phone' | 'email' | 'credit-code';
type WeakEntityType = 'person-name' | 'company-name';

interface Entity {
  id: string;
  submissionId: string;
  nodeId: string;
  strength: EntityStrength;
  entityType: StrongEntityType | WeakEntityType;
  normalizedValue: string;       // canonical form
  originalValue: string;
  confidence: number;
}
```

Strong entities use exact normalized matching. Weak entities (person names) require surrounding context.

### 2.7 KeyFact (PRD §8.4)

```typescript
type KeyFactType = 'amount' | 'ratio' | 'date' | 'period' | 'identifier' | 'qualification' | 'negation' | 'commitment';

interface KeyFact {
  id: string;
  submissionId: string;
  nodeId: string;
  factType: KeyFactType;
  normalizedValue: string;
  originalValue: string;
  unit: string | null;
  confidence: number;
}
```

Same-fact combinations increase evidence strength. Different facts produce "fact conflict" evidence, not deletion.

### 2.8 TableLocation

```typescript
interface TableLocation {
  tableIndex: number;
  rowIndex: number;
  cellIndex: number | null;
  headerContext: string[];        // column headers for this cell
}
```

### 2.9 DetectorCandidate and ScoreBreakdown (PRD §9)

```typescript
interface ScoreBreakdown {
  exactMatchScore: number;
  lexicalScore: number;
  structuralScore: number;
  entityScore: number;
  factScore: number;
  tenderDiscount: number;        // PRD §8.5
  templateDiscount: number;
  factConflictPenalty: number;
  finalScore: number;
  ruleVersion: string;
}

interface DetectorCandidate {
  id: string;
  detectorType: DetectorType;
  sourceSubmissionId: string;
  sourceNodeId: string;
  targetSubmissionId: string;
  targetNodeId: string;
  scoreBreakdown: ScoreBreakdown;
}
```

### 2.10 Evidence (PRD §4.1, extends current RiskEvidence)

```typescript
type MatchBasis = 'lexical' | 'semantic' | 'structural' | 'entity' | 'fact';

interface Evidence {
  id: string;
  detectorType: DetectorType;
  matchBasis: MatchBasis;
  similarityScore: number;

  // Source side (always present)
  sourceSubmissionId: string;
  sourceNodeId: string;
  sourceOriginalText: string;
  sourceNormalizedText: string;
  sourceSectionPath: string[];
  sourcePageRange: [number, number] | null;
  sourceTableLocation: TableLocation | null;

  // Target side (always present — PRD requires ≥2 submissions per Finding)
  targetSubmissionId: string;
  targetNodeId: string;
  targetOriginalText: string;
  targetNormalizedText: string;
  targetSectionPath: string[];
  targetPageRange: [number, number] | null;
  targetTableLocation: TableLocation | null;

  // Context
  contextBefore: string;
  contextAfter: string;

  // Tender filtering (PRD §8.5)
  tenderFiltered: boolean;
  tenderFilterReason: string | null;

  // Provenance
  ruleVersion: string;
}
```

### 2.11 RiskFinding (PRD §10.1)

```typescript
interface RiskFinding {
  id: string;                    // deterministic from input/provenance/rule versions
  detectorType: DetectorType;
  riskLevel: RiskLevel;
  involvedSubmissionIds: string[];
  evidence: Evidence[];
  symmetricSimilarity: number;
  directionalCoverage: { fromId: string; toId: string; coverage: number }[];
  confidenceScore: number;
  scoreBreakdown: ScoreBreakdown;
  ruleVersion: string;

  // Review (independent from algorithm)
  reviewStatus: FindingReviewStatus;  // pending | confirmed | ignored
  important: boolean;                  // independent boolean, NOT a status
  reviewNote: string;
  reviewedAt: string | null;
}
```

### 2.12 ReviewDecision (PRD §11)

```typescript
type FindingReviewStatus = 'pending' | 'confirmed' | 'ignored';

interface ReviewDecision {
  id: string;
  projectId: string;
  findingId: string;
  status: FindingReviewStatus;
  important: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2.13 FilePairAssessment (PRD §10.2)

```typescript
interface FilePairAssessment {
  id: string;
  projectId: string;
  submissionAId: string;
  submissionBId: string;
  directionalCoverageAB: number;
  directionalCoverageBA: number;
  symmetricSimilarity: number;
  riskLevel: RiskLevel;
  topFindingIds: string[];
  findingCount: { high: number; medium: number; low: number };
  ruleVersion: string;
  analysisStatus: RiskAnalysisStatus;
}
```

### 2.14 ProjectRiskAssessment (PRD §10.3)

```typescript
interface ProjectRiskAssessment {
  id: string;
  projectId: string;
  level: RiskLevel | 'incomplete';
  rawRuleScore: number;
  topContributingFindingIds: string[];
  preset: RiskPreset;
  ruleVersion: string;
  analysisStatus: RiskAnalysisStatus;
  // PRD §10.3: not count-only
  highValueFindingCount: number;
  involvedSubmissionCount: number;
  strongEntityHitCount: number;
  tenderDiscountApplied: boolean;
  incompleteReason: string | null;  // which detector failed
}
```

### 2.15 AnalysisCheckpoint (PRD §13.3)

```typescript
interface AnalysisCheckpoint {
  id: string;
  projectId: string;
  phase: AnalysisPhase;
  inputHash: string;
  processingVersion: string;
  completedDetectors: DetectorType[];
  intermediateResultRef: string | null;  // encrypted blob reference
  warnings: string[];
  errors: string[];
  createdAt: string;
}
```

### 2.16 AuditEvent (PRD §15.3)

```typescript
type AuditEventType =
  | 'project-created'
  | 'file-added' | 'file-removed' | 'file-replaced'
  | 'no-baseline-confirmed'
  | 'analysis-started' | 'analysis-cancelled' | 'analysis-recovered'
  | 'partial-accepted'
  | 'review-changed' | 'note-changed'
  | 'report-exported'
  | 'project-deleted'
  | 'cache-cleaned';

interface AuditEvent {
  id: string;
  projectId: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

### 2.17 ExportedReport (PRD §15.1)

```typescript
type ReportFormat = 'pdf' | 'html' | 'markdown';
type ReportScope = 'all' | 'confirmed' | 'important' | 'filtered';

interface ExportedReport {
  id: string;
  projectId: string;
  format: ReportFormat;
  scope: ReportScope;
  resultHash: string;            // immutable result version
  filePath: string;              // encrypted path
  createdAt: string;
}
```

### 2.18 TenderBaseline (PRD §8.5)

```typescript
interface TenderBaseline {
  id: string;
  projectId: string;
  submissionId: string;          // references a RiskSubmission
  status: 'parsed' | 'failed' | 'absent';
  parseWarnings: string[];
}
```

### 2.19 DetectorRun (PRD §13.3)

```typescript
interface DetectorRun {
  id: string;
  projectId: string;
  detectorType: DetectorType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  candidateCount: number;
  hitCount: number;
  elapsedMs: number;
  errorMessage: string | null;
  ruleVersion: string;
}
```

## 3. IPC Contract Changes (V3-003 scope)

Current `BidLensApi` risk surface:

```typescript
listProjects(): Promise<AnalysisProjectSummary[]>;
getProject(projectId: string): Promise<AnalysisProjectDetail>;
createRiskProject(request: CreateRiskProjectRequest): Promise<CreateRiskProjectResponse>;
cancelRiskProject(projectId: string): Promise<{ projectId: string; cancelled: boolean }>;
onRiskProgress(handler: (progress: RiskProgress) => void): () => void;
saveRiskFindingReview(request: { projectId: string; findingId: string; status?: string; important?: boolean; note?: string }): Promise<RiskFinding>;
```

Missing per PRD:
- `resumeRiskProject(projectId)` — resume interrupted
- `retryRiskSubmission(projectId, submissionId)` — replace/remove failed file
- `acceptPartial(projectId)` — accept partial results
- `deleteProject(projectId)` — with reference counting
- `getAuditEvents(projectId)` — audit trail
- `exportRiskReport(request)` — report generation
- `getCheckpoints(projectId)` — checkpoint list
- `openExportedFile(path)` / `openExportFolder(path)` — reuse existing
- `onDetectorProgress(handler)` — per-detector status
- Structured error types (not just strings)

## 4. Rust Field Mapping (V3-004 scope)

All camelCase TypeScript fields map to snake_case Rust fields. Enum variants use PascalCase in both languages. The JSON fixture test must verify:

- `RiskLevel::High` serializes as `"high"` in both TS and Rust
- `DetectorType::Text` serializes as `"text"`
- `MatchBasis::Fact` serializes as `"fact"`
- `ProjectStatus::Ready` serializes as `"ready"`

## 5. Decisions Pending Review

| # | Decision | PRD reference | Status |
|---|----------|---------------|--------|
| D1 | `important` is boolean, not review status | §11 | Accepted — PRD explicit |
| D2 | `AnalysisPhase` derived from checkpoint, not stored | §13.3 | Accepted — simplifies persistence |
| D3 | Evidence always has both source and target sides | §10.1 | Accepted — PRD requires ≥2 submissions |
| D4 | `matchBasis` includes `fact` | §8.4 | Accepted — key-fact detector needs it |
| D5 | ReviewNode ID deterministic from AST + version | §7 | Accepted — enables stable checkpointing |
| D6 | Business labels are arrays, not single value | §7.1 | Accepted — PRD says "can have multiple" |
