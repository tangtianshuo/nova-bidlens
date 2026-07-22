---
plan: 06-01
phase: 06-nzbtf-file-support
status: complete
completed: 2026-07-22
---

## Summary

Extended type system and UI to accept .nzbtf files alongside .docx and .pdf.

### What Changed

**Task 1: Type System**
- `packages/shared/src/risk-review.ts`: `RiskFileFormat` union now includes `'nzbtf'`
- `apps/desktop/src/main/services/risk-review-service.ts`: All 3 cast sites updated to include `'nzbtf'`

**Task 2: UI Components**
- `submission-file-list.tsx`: Format type, ALLOWED_FORMATS, accept attribute, hint text, error message
- `tender-baseline-slot.tsx`: ACCEPT_DEFAULT, hint text
- `compare-handlers.ts`: File dialog filter with nZBTF option

### Verification

- `pnpm --filter @bidlens/shared build` exits 0
- All `'docx' | 'pdf'` cast sites updated to `'docx' | 'pdf' | 'nzbtf'`
- UI text updated to mention .nzbtf support

### Key Files

- `packages/shared/src/risk-review.ts`
- `apps/desktop/src/main/services/risk-review-service.ts`
- `apps/desktop/src/renderer/features/projects/submission-file-list.tsx`
- `apps/desktop/src/renderer/features/projects/tender-baseline-slot.tsx`
- `apps/desktop/src/main/ipc/compare-handlers.ts`
