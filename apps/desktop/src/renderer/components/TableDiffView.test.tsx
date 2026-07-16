import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableDiffView } from './TableDiffView';
import type { TableDiffResult } from '@bidlens/shared';

describe('TableDiffView', () => {
  const tableA = {
    id: 'table-a',
    rows: [
      ['Header 1', 'Header 2'],
      ['Value A1', 'Value A2'],
    ],
    pageStart: 1,
    pageEnd: 1,
  };

  const tableB = {
    id: 'table-b',
    rows: [
      ['Header 1', 'Header 2'],
      ['Modified A1', 'Value A2'],
    ],
    pageStart: 1,
    pageEnd: 1,
  };

  it('renders both tables', () => {
    const diffResult: TableDiffResult = {
      tableMatchType: 'content_changed',
      structuralChanges: [],
      cellDiffs: [
        {
          position: [1, 0],
          changeType: 'modified',
          oldContent: 'Value A1',
          newContent: 'Modified A1',
          similarity: 0.5,
        },
      ],
      confidence: 0.8,
    };

    render(<TableDiffView tableA={tableA} tableB={tableB} diffResult={diffResult} />);

    expect(screen.getAllByText('原始文档表格').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('新文档表格').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Value A1')).toBeTruthy();
    expect(screen.getByText('Modified A1')).toBeTruthy();
  });

  it('renders row numbers', () => {
    const diffResult: TableDiffResult = {
      tableMatchType: 'identical',
      structuralChanges: [],
      cellDiffs: [],
      confidence: 1.0,
    };

    render(<TableDiffView tableA={tableA} tableB={tableB} diffResult={diffResult} />);

    // Row numbers appear in both tables
    const row1Elements = screen.getAllByText('1');
    expect(row1Elements.length).toBeGreaterThanOrEqual(2);
    
    const row2Elements = screen.getAllByText('2');
    expect(row2Elements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows structural changes summary', () => {
    const diffResult: TableDiffResult = {
      tableMatchType: 'structure_changed',
      structuralChanges: [
        { type: 'rows_added', count: 2, position: 2 },
      ],
      cellDiffs: [],
      confidence: 0.5,
    };

    render(<TableDiffView tableA={tableA} tableB={tableB} diffResult={diffResult} />);

    expect(screen.getByText(/有新增行/)).toBeTruthy();
    expect(screen.getByText(/新增 2 行/)).toBeTruthy();
  });

  it('calls onCellClick when cell is clicked', () => {
    const onClick = vi.fn();
    const diffResult: TableDiffResult = {
      tableMatchType: 'content_changed',
      structuralChanges: [],
      cellDiffs: [
        {
          position: [1, 0],
          changeType: 'modified',
          oldContent: 'Value A1',
          newContent: 'Modified A1',
          similarity: 0.5,
        },
      ],
      confidence: 0.8,
    };

    const { container } = render(<TableDiffView tableA={tableA} tableB={tableB} diffResult={diffResult} onCellClick={onClick} />);

    // Find the modified cell in the second table (new document)
    const tables = container.querySelectorAll('table');
    const newTable = tables[1]; // Second table is the new document
    const rows = newTable.querySelectorAll('tbody tr');
    const secondRow = rows[1]; // Second row (index 1)
    const cells = secondRow.querySelectorAll('td');
    const modifiedCell = cells[1]; // Second cell (index 1, first is row number)
    
    fireEvent.click(modifiedCell);

    expect(onClick).toHaveBeenCalledWith([1, 0]);
  });

  it('renders empty table with no rows', () => {
    const emptyTable = { id: 'empty', rows: [], pageStart: null, pageEnd: null };
    const diffResult: TableDiffResult = {
      tableMatchType: 'identical',
      structuralChanges: [],
      cellDiffs: [],
      confidence: 1.0,
    };

    render(<TableDiffView tableA={emptyTable} tableB={emptyTable} diffResult={diffResult} />);

    expect(screen.getAllByText('原始文档表格').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('新文档表格').length).toBeGreaterThanOrEqual(1);
  });

  it('handles tables with different column counts', () => {
    const tableA3Cols = {
      id: 'table-a',
      rows: [['A', 'B', 'C']],
      pageStart: 1,
      pageEnd: 1,
    };
    const tableB2Cols = {
      id: 'table-b',
      rows: [['A', 'B']],
      pageStart: 1,
      pageEnd: 1,
    };
    const diffResult: TableDiffResult = {
      tableMatchType: 'structure_changed',
      structuralChanges: [
        { type: 'columns_deleted', count: 1, position: 2 },
      ],
      cellDiffs: [],
      confidence: 0.5,
    };

    render(<TableDiffView tableA={tableA3Cols} tableB={tableB2Cols} diffResult={diffResult} />);

    expect(screen.getByText(/有删除列/)).toBeTruthy();
  });
});
