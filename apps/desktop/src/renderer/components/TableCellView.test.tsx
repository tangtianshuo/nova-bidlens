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
});
