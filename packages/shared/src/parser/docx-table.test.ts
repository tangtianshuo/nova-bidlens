import { describe, expect, it } from 'vitest';
import { parseDocxTable, convertToTableNode } from './docx-table.js';

// 模拟HTML元素
function createHtmlElement(tagName: string, attributes: Record<string, string> = {}, children: any[] = [], textContent?: string): any {
  return {
    tagName,
    attributes,
    children,
    textContent
  };
}

describe('parseDocxTable', () => {
  it('should parse a simple table without merged cells', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 1'),
          createHtmlElement('td', {}, [], 'Cell 2'),
          createHtmlElement('td', {}, [], 'Cell 3')
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 4'),
          createHtmlElement('td', {}, [], 'Cell 5'),
          createHtmlElement('td', {}, [], 'Cell 6')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].cells).toHaveLength(3);
    expect(result.rows[1].cells).toHaveLength(3);
    expect(result.rows[0].cells[0].content).toBe('Cell 1');
    expect(result.rows[1].cells[2].content).toBe('Cell 6');
  });

  it('should identify header, body, and footer rows', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('thead', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('th', {}, [], 'Header 1'),
          createHtmlElement('th', {}, [], 'Header 2')
        ])
      ]),
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Body 1'),
          createHtmlElement('td', {}, [], 'Body 2')
        ])
      ]),
      createHtmlElement('tfoot', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Footer 1'),
          createHtmlElement('td', {}, [], 'Footer 2')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].rowType).toBe('header');
    expect(result.rows[1].rowType).toBe('body');
    expect(result.rows[2].rowType).toBe('footer');
  });

  it('should handle horizontal merged cells (colSpan)', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', { colspan: '2' }, [], 'Merged Cell'),
          createHtmlElement('td', {}, [], 'Cell 3')
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 4'),
          createHtmlElement('td', {}, [], 'Cell 5'),
          createHtmlElement('td', {}, [], 'Cell 6')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].colSpan).toBe(2);
    expect(result.rows[0].cells).toHaveLength(2); // 合并后只有2个单元格
  });

  it('should handle vertical merged cells (rowSpan)', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', { rowspan: '2' }, [], 'Vertical Merged'),
          createHtmlElement('td', {}, [], 'Cell 2'),
          createHtmlElement('td', {}, [], 'Cell 3')
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 4'),
          createHtmlElement('td', {}, [], 'Cell 5')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].rowSpan).toBe(2);
    expect(result.rows[0].cells).toHaveLength(3);
    expect(result.rows[1].cells).toHaveLength(2);
  });

  it('should extract table properties', () => {
    const table = createHtmlElement('table', { width: '500', style: 'border: 1px solid black; text-align: center;' }, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.properties?.width).toBe(500);
    expect(result.properties?.borders?.top).toBe('1px solid black');
    expect(result.properties?.alignment).toBe('center');
  });

  it('should extract cell properties', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', { width: '100', style: 'vertical-align: top; background-color: #ff0000;' }, [], 'Cell')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].properties?.width).toBe(100);
    expect(result.rows[0].cells[0].properties?.verticalAlign).toBe('top');
    expect(result.rows[0].cells[0].properties?.backgroundColor).toBe('#ff0000');
  });

  it('should generate unique IDs for table, rows, and cells', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 1'),
          createHtmlElement('td', {}, [], 'Cell 2')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.id).toBeDefined();
    expect(result.rows[0].id).toBeDefined();
    expect(result.rows[0].cells[0].id).toBeDefined();
    expect(result.rows[0].cells[0].id).not.toBe(result.rows[0].cells[1].id);
  });
});

describe('convertToTableNode', () => {
  it('should convert parsed table to TableNode format', () => {
    const parsedTable = {
      id: 'table1',
      rows: [
        {
          id: 'row1',
          cells: [
            { id: 'cell1', content: 'Cell 1' },
            { id: 'cell2', content: 'Cell 2' }
          ],
          rowType: 'header' as const
        },
        {
          id: 'row2',
          cells: [
            { id: 'cell3', content: 'Cell 3' },
            { id: 'cell4', content: 'Cell 4' }
          ],
          rowType: 'body' as const
        }
      ]
    };

    const result = convertToTableNode(parsedTable);
    expect(result.type).toBe('table');
    expect(result.id).toBe('table1');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['Cell 1', 'Cell 2']);
    expect(result.rows[1]).toEqual(['Cell 3', 'Cell 4']);
  });
});
