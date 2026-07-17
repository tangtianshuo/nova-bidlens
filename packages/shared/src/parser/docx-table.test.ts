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
    // 合并单元格本身就是一个单元格，不需要额外的占位符
    expect(result.rows[0].cells).toHaveLength(2);
    expect(result.rows[1].cells).toHaveLength(3);
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
    // 第二行应该有占位符（因为第一行的rowSpan=2）
    expect(result.rows[1].cells).toHaveLength(3);
    expect(result.rows[1].cells[0].isPlaceholder).toBe(true);
    expect(result.rows[1].cells[1].content).toBe('Cell 4');
    expect(result.rows[1].cells[2].content).toBe('Cell 5');
  });

  it('should handle complex merged cells (rowSpan and colSpan)', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', { rowspan: '2', colspan: '2' }, [], 'Complex Merged'),
          createHtmlElement('td', {}, [], 'Cell 13')
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 23')
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 31'),
          createHtmlElement('td', {}, [], 'Cell 32'),
          createHtmlElement('td', {}, [], 'Cell 33')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].rowSpan).toBe(2);
    expect(result.rows[0].cells[0].colSpan).toBe(2);
    // 第一行：合并单元格(占2列) + 普通单元格 = 2个单元格
    expect(result.rows[0].cells).toHaveLength(2);
    // 第二行：2个占位符(因为rowSpan=2, colSpan=2) + 普通单元格 = 3个单元格
    expect(result.rows[1].cells).toHaveLength(3);
    expect(result.rows[1].cells[0].isPlaceholder).toBe(true);
    expect(result.rows[1].cells[1].isPlaceholder).toBe(true);
    expect(result.rows[1].cells[2].content).toBe('Cell 23');
    // 第三行：3个普通单元格
    expect(result.rows[2].cells).toHaveLength(3);
    expect(result.rows[2].cells[0].content).toBe('Cell 31');
    expect(result.rows[2].cells[1].content).toBe('Cell 32');
    expect(result.rows[2].cells[2].content).toBe('Cell 33');
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

  it('should correctly process merged cells with placeholders', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', { rowspan: '2', colspan: '2' }, [], 'Merged'),
          createHtmlElement('td', {}, [], 'A')
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'B')
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'C'),
          createHtmlElement('td', {}, [], 'D'),
          createHtmlElement('td', {}, [], 'E')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    
    // 验证第一行
    expect(result.rows[0].cells[0].content).toBe('Merged');
    expect(result.rows[0].cells[0].rowSpan).toBe(2);
    expect(result.rows[0].cells[0].colSpan).toBe(2);
    expect(result.rows[0].cells[1].content).toBe('A');
    
    // 验证第二行（应有占位符）
    expect(result.rows[1].cells[0].isPlaceholder).toBe(true);
    expect(result.rows[1].cells[1].isPlaceholder).toBe(true);
    expect(result.rows[1].cells[2].content).toBe('B');
    
    // 验证第三行（普通行）
    expect(result.rows[2].cells[0].content).toBe('C');
    expect(result.rows[2].cells[1].content).toBe('D');
    expect(result.rows[2].cells[2].content).toBe('E');
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

  it('should skip placeholder cells when converting', () => {
    const parsedTable = {
      id: 'table1',
      rows: [
        {
          id: 'row1',
          cells: [
            { id: 'cell1', content: 'Merged', rowSpan: 2, colSpan: 2 },
            { id: 'cell2', content: 'A' },
          ],
          rowType: 'body' as const
        },
        {
          id: 'row2',
          cells: [
            { id: 'cell3', content: '', isPlaceholder: true },
            { id: 'cell4', content: '', isPlaceholder: true },
            { id: 'cell5', content: 'B' },
          ],
          rowType: 'body' as const
        }
      ]
    };

    const result = convertToTableNode(parsedTable);
    expect(result.rows[0]).toEqual(['Merged', 'A']);
    expect(result.rows[1]).toEqual(['B']);
  });
});

describe('Nested Table Support', () => {
  it('should parse a single-level nested table inside a cell', () => {
    const innerTable = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Inner A1'),
          createHtmlElement('td', {}, [], 'Inner A2'),
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Inner B1'),
          createHtmlElement('td', {}, [], 'Inner B2'),
        ])
      ])
    ]);
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 1'),
          createHtmlElement('td', {}, [innerTable]),
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Cell 3'),
          createHtmlElement('td', {}, [], 'Cell 4'),
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows).toHaveLength(2);
    // First row, second cell should have a nested table
    const cellWithNested = result.rows[0].cells[1];
    expect(cellWithNested.nestedTable).toBeDefined();
    expect(cellWithNested.nestedTable!.rows).toHaveLength(2);
    expect(cellWithNested.nestedTable!.rows[0].cells[0].content).toBe('Inner A1');
    expect(cellWithNested.nestedTable!.rows[1].cells[1].content).toBe('Inner B2');
    // Cell's own content should not include nested table text
    expect(cellWithNested.content).toBe('');
  });

  it('should parse a cell with both text and a nested table', () => {
    const innerTable = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Inner 1'),
        ])
      ])
    ]);
    const cellWithBoth = createHtmlElement('td', {}, [
      createHtmlElement('span', {}, [], 'Some text'),
      innerTable
    ]);
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          cellWithBoth,
          createHtmlElement('td', {}, [], 'Other cell'),
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    const cell = result.rows[0].cells[0];
    expect(cell.content).toBe('Some text');
    expect(cell.nestedTable).toBeDefined();
    expect(cell.nestedTable!.rows[0].cells[0].content).toBe('Inner 1');
  });

  it('should parse multi-level nested tables', () => {
    // Level 3 innermost table
    const innermostTable = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Deep value'),
        ])
      ])
    ]);
    // Level 2 table containing level 3
    const level2Table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [innermostTable]),
        ])
      ])
    ]);
    // Level 1 (outermost) table containing level 2
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [level2Table]),
          createHtmlElement('td', {}, [], 'Regular'),
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    // Level 1 -> cell has nested table
    const level1Cell = result.rows[0].cells[0];
    expect(level1Cell.nestedTable).toBeDefined();
    expect(level1Cell.nestedTable!.depth).toBe(1);
    
    // Level 2 -> cell has nested table
    const level2Cell = level1Cell.nestedTable!.rows[0].cells[0];
    expect(level2Cell.nestedTable).toBeDefined();
    expect(level2Cell.nestedTable!.depth).toBe(2);
    
    // Level 3 -> innermost
    const level3Cell = level2Cell.nestedTable!.rows[0].cells[0];
    expect(level3Cell.nestedTable).toBeUndefined();
    expect(level3Cell.content).toBe('Deep value');
  });

  it('should respect max depth limit (default 3)', () => {
    // Create 4 levels deep
    const level4 = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Level 4'),
        ])
      ])
    ]);
    const level3 = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [level4]),
        ])
      ])
    ]);
    const level2 = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [level3]),
        ])
      ])
    ]);
    const level1 = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [level2]),
        ])
      ])
    ]);

    const result = parseDocxTable(level1);
    // Level 1 (depth 0) -> has nested
    expect(result.rows[0].cells[0].nestedTable).toBeDefined();
    // Level 2 (depth 1) -> has nested
    expect(result.rows[0].cells[0].nestedTable!.rows[0].cells[0].nestedTable).toBeDefined();
    // Level 3 (depth 2) -> has nested, but it's at depth limit
    const l3 = result.rows[0].cells[0].nestedTable!.rows[0].cells[0].nestedTable!;
    expect(l3.depthLimitExceeded).toBe(false);
    // Level 3 cell content should include "Level 4" text since it's parsed as flat
    expect(l3.rows[0].cells[0].nestedTable).toBeDefined();
    // Level 4 (depth 3) should be at depth limit
    const l4 = l3.rows[0].cells[0].nestedTable!;
    expect(l4.depthLimitExceeded).toBe(true);
  });

  it('should handle nested table with merged cells', () => {
    const innerTable = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', { colspan: '2' }, [], 'Merged Inner'),
          createHtmlElement('td', {}, [], 'C'),
        ]),
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'D'),
          createHtmlElement('td', {}, [], 'E'),
          createHtmlElement('td', {}, [], 'F'),
        ])
      ])
    ]);
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [innerTable]),
          createHtmlElement('td', {}, [], 'Regular'),
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    const nested = result.rows[0].cells[0].nestedTable!;
    expect(nested.rows[0].cells[0].colSpan).toBe(2);
    expect(nested.rows[0].cells[0].content).toBe('Merged Inner');
  });

  it('should handle nested table with thead and tfoot', () => {
    const innerTable = createHtmlElement('table', {}, [
      createHtmlElement('thead', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('th', {}, [], 'Inner Header'),
        ])
      ]),
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Inner Body'),
        ])
      ]),
      createHtmlElement('tfoot', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Inner Footer'),
        ])
      ])
    ]);
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [innerTable]),
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    const nested = result.rows[0].cells[0].nestedTable!;
    expect(nested.rows).toHaveLength(3);
    expect(nested.rows[0].rowType).toBe('header');
    expect(nested.rows[1].rowType).toBe('body');
    expect(nested.rows[2].rowType).toBe('footer');
  });

  it('should parse custom max depth limit', () => {
    // Create 3 levels deep, but limit to 2
    const level3 = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Level 3'),
        ])
      ])
    ]);
    const level2 = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [level3]),
        ])
      ])
    ]);
    const level1 = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [level2]),
        ])
      ])
    ]);

    // Parse with max depth = 2
    const result = parseDocxTable(level1, 0, 2);
    // Level 1 (depth 0) -> has nested
    expect(result.rows[0].cells[0].nestedTable).toBeDefined();
    // Level 2 (depth 1) -> at depth limit (max=2, currentDepth=1, so 1 < 2 is true)
    const l2 = result.rows[0].cells[0].nestedTable!;
    expect(l2.rows[0].cells[0].nestedTable).toBeDefined();
    // Level 3 (depth 2) -> depth limit exceeded (2 >= 2)
    const l3 = l2.rows[0].cells[0].nestedTable!;
    expect(l3.depthLimitExceeded).toBe(true);
    // Content should include Level 3 text (since it's parsed without nesting)
    expect(l3.rows[0].cells[0].content).toBe('Level 3');
    expect(l3.rows[0].cells[0].nestedTable).toBeUndefined();
  });
});

describe('parseDocxTable with paragraph format', () => {
  it('should extract paragraph format from cell with p element', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [
            createHtmlElement('p', { style: 'text-align: center; margin-left: 24pt;' }, [], 'Centered text')
          ])
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].paragraphFormat).toBeDefined();
    expect(result.rows[0].cells[0].paragraphFormat?.alignment).toBe('center');
    expect(result.rows[0].cells[0].paragraphFormat?.indentLeft).toBe(24);
  });

  it('should extract paragraph format with multiple styles', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [
            createHtmlElement('p', { 
              style: 'text-align: justify; margin-left: 24pt; text-indent: 24pt; line-height: 18pt; margin-top: 12pt; margin-bottom: 12pt;' 
            }, [], 'Formatted text')
          ])
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].paragraphFormat).toBeDefined();
    expect(result.rows[0].cells[0].paragraphFormat?.alignment).toBe('justify');
    expect(result.rows[0].cells[0].paragraphFormat?.indentLeft).toBe(24);
    expect(result.rows[0].cells[0].paragraphFormat?.indentFirstLine).toBe(24);
    expect(result.rows[0].cells[0].paragraphFormat?.lineSpacing).toBe(18);
    expect(result.rows[0].cells[0].paragraphFormat?.spaceBefore).toBe(12);
    expect(result.rows[0].cells[0].paragraphFormat?.spaceAfter).toBe(12);
  });

  it('should return undefined paragraph format when no p element', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [], 'Plain text without p element')
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].paragraphFormat).toBeUndefined();
  });

  it('should extract paragraph format from first p element only', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [
            createHtmlElement('p', { style: 'text-align: left;' }, [], 'First paragraph'),
            createHtmlElement('p', { style: 'text-align: right;' }, [], 'Second paragraph')
          ])
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].paragraphFormat).toBeDefined();
    expect(result.rows[0].cells[0].paragraphFormat?.alignment).toBe('left');
  });

  it('should extract paragraph format from nested p element', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [
            createHtmlElement('div', {}, [
              createHtmlElement('p', { style: 'text-align: center; margin-left: 48pt;' }, [], 'Nested paragraph')
            ])
          ])
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].paragraphFormat).toBeDefined();
    expect(result.rows[0].cells[0].paragraphFormat?.alignment).toBe('center');
    expect(result.rows[0].cells[0].paragraphFormat?.indentLeft).toBe(48);
  });

  it('should handle cell with no style on p element', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [
            createHtmlElement('p', {}, [], 'Text without style')
          ])
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].paragraphFormat).toBeDefined();
    expect(result.rows[0].cells[0].paragraphFormat).toEqual({});
  });

  it('should handle multiple cells with different paragraph formats', () => {
    const table = createHtmlElement('table', {}, [
      createHtmlElement('tbody', {}, [
        createHtmlElement('tr', {}, [
          createHtmlElement('td', {}, [
            createHtmlElement('p', { style: 'text-align: left;' }, [], 'Left')
          ]),
          createHtmlElement('td', {}, [
            createHtmlElement('p', { style: 'text-align: center;' }, [], 'Center')
          ]),
          createHtmlElement('td', {}, [
            createHtmlElement('p', { style: 'text-align: right;' }, [], 'Right')
          ])
        ])
      ])
    ]);

    const result = parseDocxTable(table);
    expect(result.rows[0].cells[0].paragraphFormat?.alignment).toBe('left');
    expect(result.rows[0].cells[1].paragraphFormat?.alignment).toBe('center');
    expect(result.rows[0].cells[2].paragraphFormat?.alignment).toBe('right');
  });
});
