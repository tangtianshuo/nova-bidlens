/**
 * P4-18: Tests for format detail display.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FormatDetail } from './format-detail';
import type { FormatDiffResult } from '@bidlens/shared/types-only';

vi.mock('../../components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('../../components/ui/separator', () => ({
  Separator: () => <hr />,
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('FormatDetail', () => {
  beforeEach(cleanup);

  it('shows no-changes message when hasChanges is false', () => {
    const diff: FormatDiffResult = {
      hasChanges: false,
      textFormatChanges: [],
      paragraphFormatChanges: [],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('无格式差异')).toBeTruthy();
  });

  it('renders text format changes', () => {
    const diff: FormatDiffResult = {
      hasChanges: true,
      textFormatChanges: [
        { property: 'bold', changeType: 'modified', oldValue: false, newValue: true },
        { property: 'fontSize', changeType: 'modified', oldValue: 12, newValue: 14 },
      ],
      paragraphFormatChanges: [],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('文字格式')).toBeTruthy();
    expect(screen.getByText('粗体')).toBeTruthy();
    expect(screen.getByText('字号')).toBeTruthy();
  });

  it('renders paragraph format changes', () => {
    const diff: FormatDiffResult = {
      hasChanges: true,
      textFormatChanges: [],
      paragraphFormatChanges: [
        { property: 'alignment', changeType: 'modified', oldValue: 'left', newValue: 'center' },
      ],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('段落格式')).toBeTruthy();
    expect(screen.getByText('对齐')).toBeTruthy();
  });

  it('renders old and new values for modified changes', () => {
    const diff: FormatDiffResult = {
      hasChanges: true,
      textFormatChanges: [
        { property: 'fontSize', changeType: 'modified', oldValue: 12, newValue: 14 },
      ],
      paragraphFormatChanges: [],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('12pt')).toBeTruthy();
    expect(screen.getByText('14pt')).toBeTruthy();
  });

  it('renders boolean values as 是/否', () => {
    const diff: FormatDiffResult = {
      hasChanges: true,
      textFormatChanges: [
        { property: 'bold', changeType: 'modified', oldValue: false, newValue: true },
      ],
      paragraphFormatChanges: [],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('否')).toBeTruthy();
    expect(screen.getByText('是')).toBeTruthy();
  });

  it('renders added changes', () => {
    const diff: FormatDiffResult = {
      hasChanges: true,
      textFormatChanges: [
        { property: 'highlight', changeType: 'added', oldValue: null, newValue: '#ffff00' },
      ],
      paragraphFormatChanges: [],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('高亮')).toBeTruthy();
    expect(screen.getByText('#ffff00')).toBeTruthy();
  });

  it('renders removed changes with line-through', () => {
    const diff: FormatDiffResult = {
      hasChanges: true,
      textFormatChanges: [
        { property: 'strikethrough', changeType: 'removed', oldValue: true, newValue: undefined },
      ],
      paragraphFormatChanges: [],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('删除线')).toBeTruthy();
  });

  it('shows change count badges', () => {
    const diff: FormatDiffResult = {
      hasChanges: true,
      textFormatChanges: [
        { property: 'bold', changeType: 'modified', oldValue: false, newValue: true },
        { property: 'italic', changeType: 'modified', oldValue: false, newValue: true },
      ],
      paragraphFormatChanges: [
        { property: 'alignment', changeType: 'modified', oldValue: 'left', newValue: 'center' },
      ],
    };
    render(<FormatDetail formatDiff={diff} />);
    expect(screen.getByText('2')).toBeTruthy(); // text format count
    expect(screen.getByText('1')).toBeTruthy(); // paragraph format count
  });
});
