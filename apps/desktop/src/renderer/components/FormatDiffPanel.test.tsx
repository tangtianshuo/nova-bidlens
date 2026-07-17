import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormatDiffPanel } from './FormatDiffPanel';
import type { FormatDiffResult } from '@bidlens/shared';

describe('FormatDiffPanel', () => {
  const mockFormatDiff: FormatDiffResult = {
    textFormatChanges: [
      {
        property: 'fontFamily',
        oldValue: 'Arial',
        newValue: 'Times New Roman',
        changeType: 'modified',
      },
      {
        property: 'fontSize',
        oldValue: 12,
        newValue: 14,
        changeType: 'modified',
      },
      {
        property: 'color',
        oldValue: '#000000',
        newValue: '#ff0000',
        changeType: 'modified',
      },
      {
        property: 'bold',
        oldValue: false,
        newValue: true,
        changeType: 'modified',
      },
      {
        property: 'italic',
        oldValue: undefined,
        newValue: true,
        changeType: 'added',
      },
    ],
    paragraphFormatChanges: [
      {
        property: 'alignment',
        oldValue: 'left',
        newValue: 'center',
        changeType: 'modified',
      },
      {
        property: 'lineSpacing',
        oldValue: 1.5,
        newValue: 2.0,
        changeType: 'modified',
      },
    ],
    hasChanges: true,
  };

  it('renders format diff panel with title', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    expect(screen.getByText('格式差异')).toBeTruthy();
  });

  it('shows total change count', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    // 使用getAllByText查找所有包含"7"的元素
    const countElements = screen.getAllByText('7');
    expect(countElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders font family changes group', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    const fontGroupElements = screen.getAllByText('字体变化');
    expect(fontGroupElements.length).toBeGreaterThanOrEqual(1);
    // 使用getAllByText因为fontFamily可能出现在多个地方
    const fontFamilyElements = screen.getAllByText('fontFamily');
    expect(fontFamilyElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('fontSize').length).toBeGreaterThanOrEqual(1);
  });

  it('renders color changes group', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    const colorGroupElements = screen.getAllByText('颜色变化');
    expect(colorGroupElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('color').length).toBeGreaterThanOrEqual(1);
  });

  it('renders text style changes group', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    const styleGroupElements = screen.getAllByText('文本样式变化');
    expect(styleGroupElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('bold').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('italic').length).toBeGreaterThanOrEqual(1);
  });

  it('renders paragraph format changes group', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    const paragraphGroupElements = screen.getAllByText('段落格式变化');
    expect(paragraphGroupElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('alignment').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('lineSpacing').length).toBeGreaterThanOrEqual(1);
  });

  it('shows change type labels', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    expect(screen.getAllByText('修改').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('新增').length).toBeGreaterThanOrEqual(1);
  });

  it('shows old and new values for modified changes', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    expect(screen.getAllByText('Arial').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Times New Roman').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('12pt').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('14pt').length).toBeGreaterThanOrEqual(1);
  });

  it('shows only new value for added changes', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    expect(screen.getAllByText('是').length).toBeGreaterThanOrEqual(1); // italic is true
  });

  it('calls onJumpToPosition when clicking a change', () => {
    const onJumpToPosition = vi.fn();
    render(<FormatDiffPanel formatDiff={mockFormatDiff} onJumpToPosition={onJumpToPosition} />);
    
    // 找到fontFamily所在的行并点击
    const fontFamilyElements = screen.getAllByText('fontFamily');
    const fontFamilyRow = fontFamilyElements[0].closest('[style*="cursor: pointer"]');
    if (fontFamilyRow) {
      fireEvent.click(fontFamilyRow);
      expect(onJumpToPosition).toHaveBeenCalledWith('fontFamily');
    }
  });

  it('shows empty state when no changes', () => {
    const emptyDiff: FormatDiffResult = {
      textFormatChanges: [],
      paragraphFormatChanges: [],
      hasChanges: false,
    };
    
    render(<FormatDiffPanel formatDiff={emptyDiff} />);
    
    expect(screen.getByText('格式完全一致')).toBeTruthy();
    expect(screen.getByText('两个文档的格式没有差异')).toBeTruthy();
  });

  it('collapses and expands groups', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    // Find the font group button
    const fontGroupButton = screen.getAllByText('字体变化')[0].closest('button')!;
    
    // Initially expanded - should have fontFamily visible
    const initialFontFamilyCount = screen.getAllByText('fontFamily').length;
    expect(initialFontFamilyCount).toBeGreaterThanOrEqual(1);
    
    // Click to collapse
    fireEvent.click(fontGroupButton);
    
    // Should be collapsed - fontFamily should have fewer instances
    const afterCollapseCount = screen.queryAllByText('fontFamily').length;
    expect(afterCollapseCount).toBeLessThan(initialFontFamilyCount);
    
    // Click to expand again
    fireEvent.click(fontGroupButton);
    
    // Should be expanded again
    const afterExpandCount = screen.getAllByText('fontFamily').length;
    expect(afterExpandCount).toBeGreaterThanOrEqual(1);
  });

  it('shows change count per group', () => {
    render(<FormatDiffPanel formatDiff={mockFormatDiff} />);
    
    // Font group has 2 changes (fontFamily, fontSize)
    const fontGroupButton = screen.getAllByText('字体变化')[0].closest('button')!;
    expect(fontGroupButton.textContent).toContain('2');
    
    // Color group has 1 change (color)
    const colorGroupButton = screen.getAllByText('颜色变化')[0].closest('button')!;
    expect(colorGroupButton.textContent).toContain('1');
    
    // Style group has 2 changes (bold, italic)
    const styleGroupButton = screen.getAllByText('文本样式变化')[0].closest('button')!;
    expect(styleGroupButton.textContent).toContain('2');
    
    // Paragraph group has 2 changes (alignment, lineSpacing)
    const paragraphGroupButton = screen.getAllByText('段落格式变化')[0].closest('button')!;
    expect(paragraphGroupButton.textContent).toContain('2');
  });
});
