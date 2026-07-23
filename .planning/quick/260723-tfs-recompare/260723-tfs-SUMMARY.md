# Quick Task 260723-tfs: 项目列表增加重新对比功能

## Changes

### Shared types (`packages/shared/src/ipc.ts`)
- Added `reanalyzeProject(projectId: string)` to `BidLensApi` interface

### Shared types (`packages/shared/src/risk-review.ts`)
- Added `'analysis-reanalyzed'` to `AuditEventType` union

### Backend service (`apps/desktop/src/main/services/risk-review-service.ts`)
- Added `reanalyzeProject()` method: reconstructs request from audit event, clears old findings/detector-runs/file-pair-assessments/checkpoints, resets project + submission status, re-runs analysis pipeline

### Backend IPC (`apps/desktop/src/main/ipc/risk-review-handlers.ts`)
- Registered `risk:reanalyzeProject` handler

### Database repos (`apps/desktop/src/main/db/repositories.ts`)
- Added `deleteByProject()` to FindingRepository, DetectorRunRepository, ProjectRiskAssessmentRepository, CheckpointRepository

### Preload bridge (`apps/desktop/src/preload/index.ts`)
- Added `reanalyzeProject` IPC bridge

### Frontend table (`apps/desktop/src/renderer/features/projects/project-table.tsx`)
- Added `onReanalyze` prop to `ProjectTableProps` and `ProjectRowProps`
- Added "重新对比" menu item (RefreshCw icon) below "查看详情", visible for `ready/partial/failed` status

### Frontend page (`apps/desktop/src/renderer/features/projects/project-list-page.tsx`)
- Added `handleReanalyze` with `window.confirm()` warning dialog
- On confirm: calls `reanalyzeProject`, navigates to `project-processing` view
- Imported `useRiskReviewStore` and `useAppStore` for view transition

### Tests (`apps/desktop/src/renderer/features/projects/project-table.test.tsx`)
- Added `onReanalyze: vi.fn()` to defaultProps
