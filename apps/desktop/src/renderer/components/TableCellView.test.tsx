import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableCellView } from './TableCellView';

describe('TableCellView', () => {
  it('renders cell content', () => {
    render(<TableCellView content="Test content" />);
    expect(screen.getByText('Test content')).toBeTruthy();
  });

  it('renders header content with strong tag', () => {
    render(<TableCellView content="Header" isHeader />);
    const header = screen.getByText('Header');
    expect(header.tagName).toBe('STRONG');
  });

  it('renders dash for empty content', () => {
    render(<TableCellView content="" />);
    expect(screen.getByText('-')).toBeTruthy();
  });

  it('applies yellow background for modified cells', () => {
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'modified' as const,
      oldContent: 'old',
      newContent: 'new',
      similarity: 0.8,
    };
    const { container } = render(<TableCellView content="new" diff={diff} />);
    const cell = container.querySelector('td');
    expect(cell?.style.backgroundColor).toBe('rgb(255, 243, 205)'); // #fff3cd
  });

  it('applies green background for added cells', () => {
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'added' as const,
      oldContent: null,
      newContent: 'added content',
      similarity: 1.0,
    };
    const { container } = render(<TableCellView content="added content" diff={diff} />);
    const cell = container.querySelector('td');
    expect(cell?.style.backgroundColor).toBe('rgb(212, 237, 218)'); // #d4edda
  });

  it('applies red background for deleted cells', () => {
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'deleted' as const,
      oldContent: 'deleted content',
      newContent: null,
      similarity: 0.0,
    };
    const { container } = render(<TableCellView content="deleted content" diff={diff} />);
    const cell = container.querySelector('td');
    expect(cell?.style.backgroundColor).toBe('rgb(248, 215, 218)'); // #f8d7da
  });

  it('shows tooltip on hover for modified cells', async () => {
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'modified' as const,
      oldContent: 'old value',
      newContent: 'new value',
      similarity: 0.75,
    };
    const { container } = render(<TableCellView content="new value" diff={diff} />);
    
    const cell = container.querySelector('td');
    fireEvent.mouseEnter(cell!);
    
    expect(screen.getByText(/修改:/)).toBeTruthy();
    expect(screen.getByText(/old value/)).toBeTruthy();
    expect(screen.getByText(/75%/)).toBeTruthy();
  });

  it('calls onCellClick when clicked on changed cell', () => {
    const onClick = vi.fn();
    const diff = {
      position: [2, 3] as [number, number],
      changeType: 'modified' as const,
      oldContent: 'old',
      newContent: 'clickable',
      similarity: 0.8,
    };
    const { container } = render(<TableCellView content="clickable" diff={diff} onCellClick={onClick} />);
    
    const cell = container.querySelector('td');
    fireEvent.click(cell!);
    
    expect(onClick).toHaveBeenCalledWith([2, 3]);
  });

  it('does not call onCellClick for identical cells', () => {
    const onClick = vi.fn();
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'identical' as const,
      oldContent: 'same',
      newContent: 'same',
      similarity: 1.0,
    };
    const { container } = render(<TableCellView content="same" diff={diff} onCellClick={onClick} />);
    
    const cell = container.querySelector('td');
    fireEvent.click(cell!);
    
    expect(onClick).not.toHaveBeenCalled();
  });

  // 合并单元格相关测试
  it('renders merged cell with rowSpan and colSpan', () => {
    const { container } = render(<TableCellView content="Merged" rowSpan={2} colSpan={3} />);
    const cell = container.querySelector('td');
    expect(cell?.getAttribute('rowSpan')).toBe('2');
    expect(cell?.getAttribute('colSpan')).toBe('3');
  });

  it('shows merge indicator for merged cells', () => {
    const { container } = render(<TableCellView content="Merged" rowSpan={2} colSpan={3} />);
    expect(container.textContent).toContain('2行3列');
  });

  it('shows merge change indicator when spanChanged is true', () => {
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'span_changed' as const,
      oldContent: 'Merged',
      newContent: 'Merged',
      similarity: 1.0,
      spanChanged: true,
    };
    const { container } = render(<TableCellView content="Merged" diff={diff} />);
    expect(container.textContent).toContain('合并变化');
  });

  it('does not render placeholder cells', () => {
    const { container } = render(<TableCellView content="Placeholder" isPlaceholder />);
    expect(container.querySelector('td')).toBeNull();
  });

  it('applies blue background for span_changed cells', () => {
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'span_changed' as const,
      oldContent: 'old',
      newContent: 'new',
      similarity: 1.0,
      spanChanged: true,
    };
    const { container } = render(<TableCellView content="new" diff={diff} />);
    const cell = container.querySelector('td');
    expect(cell?.style.backgroundColor).toBe('rgb(204, 229, 255)'); // #cce5ff
  });

  it('applies special border for merged cells', () => {
    const { container } = render(<TableCellView content="Merged" rowSpan={2} colSpan={2} />);
    const cell = container.querySelector('td');
    expect(cell?.style.border).toContain('2px solid');
  });
});
