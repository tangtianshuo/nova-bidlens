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

describe('Nested Table Rendering', () => {
  const simpleNestedTable = {
    id: 'nested-1',
    rows: [
      {
        id: 'nr1',
        cells: [
          { id: 'nc1', content: 'Inner A' },
          { id: 'nc2', content: 'Inner B' },
        ],
        rowType: 'body' as const,
      },
      {
        id: 'nr2',
        cells: [
          { id: 'nc3', content: 'Inner C' },
          { id: 'nc4', content: 'Inner D' },
        ],
        rowType: 'body' as const,
      }
    ]
  };

  it('renders nested table inside a cell', () => {
    const { container } = render(
      <TableCellView content="" nestedTable={simpleNestedTable} />
    );
    expect(container.textContent).toContain('Inner A');
    expect(container.textContent).toContain('Inner B');
    expect(container.textContent).toContain('Inner C');
    expect(container.textContent).toContain('Inner D');
  });

  it('renders cell with both text and nested table', () => {
    const { container } = render(
      <TableCellView content="Cell text" nestedTable={simpleNestedTable} />
    );
    expect(container.textContent).toContain('Cell text');
    expect(container.textContent).toContain('Inner A');
  });

  it('renders nested table with diff highlighting', () => {
    const diff = {
      position: [0, 0] as [number, number],
      changeType: 'modified' as const,
      oldContent: '',
      newContent: '',
      similarity: 0.5,
      nestedTableDiff: {
        tableMatchType: 'content_changed' as const,
        structuralChanges: [],
        cellDiffs: [
          {
            position: [0, 1] as [number, number],
            changeType: 'modified' as const,
            oldContent: 'Inner B',
            newContent: 'Inner CHANGED',
            similarity: 0.6,
          }
        ],
        confidence: 0.75,
      }
    };
    const { container } = render(
      <TableCellView content="" diff={diff} nestedTable={simpleNestedTable} />
    );
    // Should show nested table change indicator
    expect(container.textContent).toContain('嵌套表格有变化');
  });

  it('renders nested table with header rows', () => {
    const tableWithHeader = {
      id: 'nested-h',
      rows: [
        {
          id: 'nr1',
          cells: [{ id: 'nc1', content: 'Header Cell' }],
          rowType: 'header' as const,
        },
        {
          id: 'nr2',
          cells: [{ id: 'nc2', content: 'Body Cell' }],
          rowType: 'body' as const,
        }
      ]
    };
    const { container } = render(
      <TableCellView content="" nestedTable={tableWithHeader} />
    );
    const headerCell = container.querySelector('strong');
    expect(headerCell?.textContent).toBe('Header Cell');
  });

  it('shows depth limit exceeded warning', () => {
    const deepTable = {
      id: 'deep',
      rows: [
        {
          id: 'dr1',
          cells: [{ id: 'dc1', content: 'Deep content' }],
          rowType: 'body' as const,
        }
      ],
      depthLimitExceeded: true,
    };
    const { container } = render(
      <TableCellView content="" nestedTable={deepTable} />
    );
    expect(container.textContent).toContain('嵌套深度超限');
  });

  it('handles nested table with placeholder cells', () => {
    const tableWithPlaceholders = {
      id: 'nested-ph',
      rows: [
        {
          id: 'nr1',
          cells: [
            { id: 'nc1', content: 'Merged', rowSpan: 2, colSpan: 2 },
            { id: 'nc2', content: 'A' },
          ],
          rowType: 'body' as const,
        },
        {
          id: 'nr2',
          cells: [
            { id: 'nc3', content: '', isPlaceholder: true },
            { id: 'nc4', content: '', isPlaceholder: true },
            { id: 'nc5', content: 'B' },
          ],
          rowType: 'body' as const,
        }
      ]
    };
    const { container } = render(
      <TableCellView content="" nestedTable={tableWithPlaceholders} />
    );
    // Should render A and B but not placeholder cells
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('B');
  });
});
