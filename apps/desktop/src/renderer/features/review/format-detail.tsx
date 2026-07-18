/**
 * P4-11: Localized format change display with groups, units, and swatches.
 * Shows text and paragraph format changes with old→new values.
 */

import type { FormatDiffResult, TextFormatChange, ParagraphFormatChange } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';

interface FormatDetailProps {
  formatDiff: FormatDiffResult;
  className?: string;
}

// Format property display names (zh-CN)
const PROPERTY_LABELS: Record<string, string> = {
  bold: '粗体',
  italic: '斜体',
  underline: '下划线',
  strikethrough: '删除线',
  fontSize: '字号',
  fontFamily: '字体',
  color: '颜色',
  backgroundColor: '背景色',
  alignment: '对齐',
  indent: '缩进',
  lineSpacing: '行距',
  spaceBefore: '段前间距',
  spaceAfter: '段后间距',
  firstLineIndent: '首行缩进',
  subscript: '下标',
  superscript: '上标',
  highlight: '高亮',
  caps: '大写',
  smallCaps: '小型大写',
};

// Units for numeric properties
const PROPERTY_UNITS: Record<string, string> = {
  fontSize: 'pt',
  indent: 'pt',
  lineSpacing: '',
  spaceBefore: 'pt',
  spaceAfter: 'pt',
  firstLineIndent: 'pt',
};

function isColorProperty(property: string): boolean {
  return property === 'color' || property === 'backgroundColor' || property === 'highlight';
}

function formatValue(property: string, value: unknown): string {
  if (value === null || value === undefined) return '(无)';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    const unit = PROPERTY_UNITS[property] ?? '';
    return `${value}${unit}`;
  }
  return String(value);
}

function ColorSwatch({ color }: { color: string }) {
  if (!color || color === 'auto' || color === 'transparent') return null;
  return (
    <span
      className="inline-block w-3 h-3 rounded-sm border border-[var(--color-border)] ml-1"
      style={{ backgroundColor: color }}
      aria-label={`颜色: ${color}`}
    />
  );
}

function ChangeRow({ change }: { change: TextFormatChange | ParagraphFormatChange }) {
  const label = PROPERTY_LABELS[change.property] ?? change.property;
  const isColor = isColorProperty(change.property);

  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        {change.changeType === 'modified' && (
          <>
            <span className="text-[var(--color-deleted)] line-through flex items-center">
              {formatValue(change.property, change.oldValue)}
              {isColor && <ColorSwatch color={String(change.oldValue ?? '')} />}
            </span>
            <span className="text-[var(--color-text-muted)]">→</span>
            <span className="text-[var(--color-added)] flex items-center">
              {formatValue(change.property, change.newValue)}
              {isColor && <ColorSwatch color={String(change.newValue ?? '')} />}
            </span>
          </>
        )}
        {change.changeType === 'added' && (
          <span className="text-[var(--color-added)] flex items-center">
            {formatValue(change.property, change.newValue)}
            {isColor && <ColorSwatch color={String(change.newValue ?? '')} />}
          </span>
        )}
        {change.changeType === 'removed' && (
          <span className="text-[var(--color-deleted)] line-through flex items-center">
            {formatValue(change.property, change.oldValue)}
            {isColor && <ColorSwatch color={String(change.oldValue ?? '')} />}
          </span>
        )}
      </div>
    </div>
  );
}

export function FormatDetail({ formatDiff, className }: FormatDetailProps) {
  const textChanges = formatDiff.textFormatChanges;
  const paraChanges = formatDiff.paragraphFormatChanges;

  if (!formatDiff.hasChanges) {
    return (
      <div className={cn('p-4 text-sm text-[var(--color-text-muted)]', className)}>
        无格式差异
      </div>
    );
  }

  return (
    <div className={cn('p-4 space-y-4', className)}>
      {/* Text format changes */}
      {textChanges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs font-medium text-[var(--color-text)]">文字格式</h4>
            <Badge variant="accent" className="text-xs h-4 px-1">
              {textChanges.length}
            </Badge>
          </div>
          <div className="space-y-0.5">
            {textChanges.map((change, i) => (
              <ChangeRow key={i} change={change} />
            ))}
          </div>
        </div>
      )}

      {textChanges.length > 0 && paraChanges.length > 0 && (
        <Separator />
      )}

      {/* Paragraph format changes */}
      {paraChanges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs font-medium text-[var(--color-text)]">段落格式</h4>
            <Badge variant="accent" className="text-xs h-4 px-1">
              {paraChanges.length}
            </Badge>
          </div>
          <div className="space-y-0.5">
            {paraChanges.map((change, i) => (
              <ChangeRow key={i} change={change} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
