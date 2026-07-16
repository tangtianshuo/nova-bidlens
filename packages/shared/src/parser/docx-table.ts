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
 */
function processMergedCells(rows: ParsedRow[]): void {
  // 创建网格以跟踪已使用的单元格
  const grid: boolean[][] = [];
  
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!grid[rowIndex]) {
      grid[rowIndex] = [];
    }
    
    let colIndex = 0;
    for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
      const cell = row.cells[cellIndex];
      
      // 跳过已使用的单元格位置
      while (grid[rowIndex][colIndex]) {
        colIndex++;
      }
      
      // 处理水平合并
      if (cell.colSpan && cell.colSpan > 1) {
        for (let i = 1; i < cell.colSpan; i++) {
          grid[rowIndex][colIndex + i] = true;
        }
      }
      
      // 处理垂直合并
      if (cell.rowSpan && cell.rowSpan > 1) {
        for (let i = 1; i < cell.rowSpan; i++) {
          if (!grid[rowIndex + i]) {
            grid[rowIndex + i] = [];
          }
          grid[rowIndex + i][colIndex] = true;
        }
      }
      
      colIndex += cell.colSpan || 1;
    }
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
      rowCells.push(cell.content);
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
