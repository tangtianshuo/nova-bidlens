import { diffChars } from 'diff';
import type { DiffItem, TextDiffToken } from '@bidlens/shared/types-only';

const MAX_CHARACTER_DIFF_LENGTH = 20_000;

const SUMMARY_LABELS: Record<string, string> = {
  'semantic match': '语义匹配',
  'content changed': '正文内容修改',
  'text changed': '正文文字修改',
};

export function formatDiffSummary(item: DiffItem): string {
  const summary = item.summary?.trim();
  if (summary) return SUMMARY_LABELS[summary.toLowerCase()] ?? summary;
  if (item.sourceA && item.sourceB) return '正文内容修改';
  if (item.sourceA) return '正文内容删除';
  if (item.sourceB) return '正文内容新增';
  return '结构差异';
}

export function resolveTextDiffTokens(item: DiffItem): TextDiffToken[] {
  if (item.diffDetail?.length) return item.diffDetail;

  const sourceA = item.sourceA ?? '';
  const sourceB = item.sourceB ?? '';

  if (!sourceA && !sourceB) return [];
  if (!sourceA) return [{ kind: 'added', text: sourceB }];
  if (!sourceB) return [{ kind: 'removed', text: sourceA }];
  if (sourceA === sourceB) return [{ kind: 'same', text: sourceA }];

  if (sourceA.length + sourceB.length > MAX_CHARACTER_DIFF_LENGTH) {
    return createBoundedDiff(sourceA, sourceB);
  }

  return diffChars(sourceA, sourceB).map((change) => ({
    kind: change.added ? 'added' : change.removed ? 'removed' : 'same',
    text: change.value,
  }));
}

function createBoundedDiff(sourceA: string, sourceB: string): TextDiffToken[] {
  let prefixLength = 0;
  const maxPrefix = Math.min(sourceA.length, sourceB.length);
  while (prefixLength < maxPrefix && sourceA[prefixLength] === sourceB[prefixLength]) {
    prefixLength++;
  }

  let suffixLength = 0;
  const maxSuffix = Math.min(sourceA.length - prefixLength, sourceB.length - prefixLength);
  while (
    suffixLength < maxSuffix &&
    sourceA[sourceA.length - 1 - suffixLength] === sourceB[sourceB.length - 1 - suffixLength]
  ) {
    suffixLength++;
  }

  const tokens: TextDiffToken[] = [];
  if (prefixLength > 0) tokens.push({ kind: 'same', text: sourceA.slice(0, prefixLength) });

  const removed = sourceA.slice(prefixLength, sourceA.length - suffixLength);
  const added = sourceB.slice(prefixLength, sourceB.length - suffixLength);
  if (removed) tokens.push({ kind: 'removed', text: removed });
  if (added) tokens.push({ kind: 'added', text: added });

  if (suffixLength > 0) tokens.push({ kind: 'same', text: sourceA.slice(sourceA.length - suffixLength) });
  return tokens;
}
