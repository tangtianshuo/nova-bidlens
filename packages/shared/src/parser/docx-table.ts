import { TableNode } from '../document-ast.js';

export interface ParsedTable {
  id: string;
  rows: ParsedRow[];
  properties?: TableProperties;
}

export interface ParsedRow {
  id: string;
  cells: ParsedCell[];
  rowType: 'header' | 'body' | 'footer';
}

export interface ParsedCell {
  id: string;
  content: string;
  rowSpan?: number;
  colSpan?: number;
  properties?: CellProperties;
  /** 标记是否为合并单元格占位符（被其他单元格的rowSpan/colSpan覆盖） */
  isPlaceholder?: boolean;
}

export interface TableProperties {
  width?: number;
  borders?: BorderStyle;
  alignment?: 'left' | 'center' | 'right';
}

export interface CellProperties {
  width?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
}

export interface BorderStyle {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

interface HtmlElement {
  tagName: string;
  attributes: Record<string, string>;
  children: HtmlElement[];
  textContent?: string;
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * 从HTML元素中提取属性
 */
function getAttribute(element: HtmlElement, name: string): string | undefined {
  return element.attributes[name];
}

/**
 * 解析HTML表格元素
 */
export function parseDocxTable(tableElement: HtmlElement): ParsedTable {
  if (tableElement.tagName !== 'table') {
    throw new Error('Expected a table element');
  }

  const tableId = generateId();
  const properties = extractTableProperties(tableElement);
  
  const rows: ParsedRow[] = [];
  let currentRowType: 'header' | 'body' | 'footer' = 'body';
  
  // 查找 thead, tbody, tfoot
  for (const child of tableElement.children) {
    if (child.tagName === 'thead') {
      currentRowType = 'header';
      for (const row of child.children) {
        if (row.tagName === 'tr') {
          rows.push(parseRow(row, currentRowType));
        }
      }
    } else if (child.tagName === 'tbody') {
      currentRowType = 'body';
      for (const row of child.children) {
        if (row.tagName === 'tr') {
          rows.push(parseRow(row, currentRowType));
        }
      }
    } else if (child.tagName === 'tfoot') {
      currentRowType = 'footer';
      for (const row of child.children) {
        if (row.tagName === 'tr') {
          rows.push(parseRow(row, currentRowType));
        }
      }
    } else if (child.tagName === 'tr') {
      // 直接位于 table 下的 tr
      rows.push(parseRow(child, currentRowType));
    }
  }
  
  // 处理合并单元格
  processMergedCells(rows);
  
  return {
    id: tableId,
    rows,
    properties
  };
}

/**
 * 解析表格行
 */
function parseRow(rowElement: HtmlElement, rowType: 'header' | 'body' | 'footer'): ParsedRow {
  const rowId = generateId();
  const cells: ParsedCell[] = [];
  
  for (const cell of rowElement.children) {
    if (cell.tagName === 'td' || cell.tagName === 'th') {
      cells.push(parseCell(cell));
    }
  }
  
  return {
    id: rowId,
    cells,
    rowType
  };
}

/**
 * 解析单元格
 */
function parseCell(cellElement: HtmlElement): ParsedCell {
  const cellId = generateId();
  const content = extractTextContent(cellElement);
  const properties = extractCellProperties(cellElement);
  
  const colSpan = getAttribute(cellElement, 'colspan');
  const rowSpan = getAttribute(cellElement, 'rowspan');
  
  return {
    id: cellId,
    content,
    colSpan: colSpan ? parseInt(colSpan, 10) : undefined,
    rowSpan: rowSpan ? parseInt(rowSpan, 10) : undefined,
    properties
  };
}

/**
 * 提取文本内容
 */
function extractTextContent(element: HtmlElement): string {
  if (element.textContent) {
    return element.textContent.trim();
  }
  
  let text = '';
  for (const child of element.children) {
    text += extractTextContent(child);
  }
  return text.trim();
}

/**
 * 提取表格属性
 */
function extractTableProperties(tableElement: HtmlElement): TableProperties {
  const properties: TableProperties = {};
  
  const width = getAttribute(tableElement, 'width');
  if (width) {
    properties.width = parseInt(width, 10);
  }
  
  const style = getAttribute(tableElement, 'style');
  if (style) {
    // 解析样式中的边框和对齐
    const borderMatch = style.match(/border:\s*([^;]+)/);
    if (borderMatch) {
      properties.borders = {
        top: borderMatch[1],
        bottom: borderMatch[1],
        left: borderMatch[1],
        right: borderMatch[1]
      };
    }
    
    const alignMatch = style.match(/text-align:\s*(left|center|right)/);
    if (alignMatch) {
      properties.alignment = alignMatch[1] as 'left' | 'center' | 'right';
    }
  }
  
  return properties;
}

/**
 * 提取单元格属性
 */
function extractCellProperties(cellElement: HtmlElement): CellProperties {
  const properties: CellProperties = {};
  
  const width = getAttribute(cellElement, 'width');
  if (width) {
    properties.width = parseInt(width, 10);
  }
  
  const style = getAttribute(cellElement, 'style');
  if (style) {
    const verticalAlignMatch = style.match(/vertical-align:\s*(top|middle|bottom)/);
    if (verticalAlignMatch) {
      properties.verticalAlign = verticalAlignMatch[1] as 'top' | 'middle' | 'bottom';
    }
    
    const bgColorMatch = style.match(/background-color:\s*([^;]+)/);
    if (bgColorMatch) {
      properties.backgroundColor = bgColorMatch[1].trim();
    }
  }
  
  return properties;
}

/**
 * 处理合并单元格
 * 
 * 该函数会：
 * 1. 创建一个网格来跟踪已使用的单元格位置
 * 2. 处理水平合并（colSpan）和垂直合并（rowSpan）
 * 3. 为被合并的单元格位置添加占位符
 */
function processMergedCells(rows: ParsedRow[]): void {
  if (rows.length === 0) return;
  
  // 计算最大列数（考虑colSpan）
  const maxCols = Math.max(...rows.map(row => {
    let cols = 0;
    for (const cell of row.cells) {
      cols += cell.colSpan || 1;
    }
    return cols;
  }), 0);
  
  // 创建网格以跟踪哪些位置被哪个单元格占用
  // 存储单元格在原始rows数组中的引用
  const grid: (ParsedCell | null)[][] = Array.from({ length: rows.length }, () => 
    Array(maxCols).fill(null)
  );
  
  // 第一遍：填充网格，标记所有被合并单元格占用的位置
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    let logicalCol = 0;
    
    for (const cell of row.cells) {
      const rowSpan = cell.rowSpan || 1;
      const colSpan = cell.colSpan || 1;
      
      // 跳过已被占用的位置
      while (logicalCol < maxCols && grid[rowIndex][logicalCol] !== null) {
        logicalCol++;
      }
      
      if (logicalCol >= maxCols) break;
      
      // 标记该合并单元格占用的所有位置
      for (let r = 0; r < rowSpan; r++) {
        for (let c = 0; c < colSpan; c++) {
          const targetRow = rowIndex + r;
          const targetCol = logicalCol + c;
          
          if (targetRow < rows.length && targetCol < maxCols) {
            grid[targetRow][targetCol] = cell;
          }
        }
      }
      
      logicalCol += colSpan;
    }
  }
  
  // 第二遍：根据网格重建每行的单元格列表
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const newCells: ParsedCell[] = [];
    let colIndex = 0;
    
    while (colIndex < maxCols) {
      const cellAtPosition = grid[rowIndex][colIndex];
      
      if (cellAtPosition === null) {
        // 空位置，添加占位符
        newCells.push({
          id: generateId(),
          content: '',
          isPlaceholder: true
        });
        colIndex++;
      } else {
        // 检查这个单元格是否是当前行的原始单元格
        const isOriginalCell = row.cells.includes(cellAtPosition);
        
        if (isOriginalCell) {
          // 这是当前行的原始单元格
          newCells.push(cellAtPosition);
          colIndex += cellAtPosition.colSpan || 1;
        } else {
          // 这是被其他行的合并单元格占用的位置，添加占位符
          newCells.push({
            id: generateId(),
            content: '',
            isPlaceholder: true
          });
          colIndex++;
        }
      }
    }
    
    // 替换行的单元格
    row.cells = newCells;
  }
}

/**
 * 将解析后的表格转换为Document AST格式
 */
export function convertToTableNode(parsedTable: ParsedTable): TableNode {
  const rows: string[][] = [];
  
  for (const row of parsedTable.rows) {
    const rowCells: string[] = [];
    for (const cell of row.cells) {
      // 跳过占位符，只保留实际内容
      if (!cell.isPlaceholder) {
        rowCells.push(cell.content);
      }
    }
    rows.push(rowCells);
  }
  
  return {
    type: 'table',
    id: parsedTable.id,
    rows,
    pageStart: null,
    pageEnd: null
  };
}
