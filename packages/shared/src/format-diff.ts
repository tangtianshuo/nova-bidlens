import type { TextFormat, ParagraphFormat } from './parser/docx-format.js';

export interface FormatDiffResult {
  textFormatChanges: TextFormatChange[];
  paragraphFormatChanges: ParagraphFormatChange[];
  hasChanges: boolean;
}

export interface TextFormatChange {
  property: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

export interface ParagraphFormatChange {
  property: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * 比较两个文本格式对象，返回差异列表
 *
 * @param left - 左侧文本格式（旧格式）
 * @param right - 右侧文本格式（新格式）
 * @returns TextFormatChange[] 格式变化列表
 */
export function compareTextFormats(
  left: TextFormat | undefined,
  right: TextFormat | undefined
): TextFormatChange[] {
  const changes: TextFormatChange[] = [];
  const leftObj = left || {};
  const rightObj = right || {};

  // 定义所有需要比较的属性
  const properties: (keyof TextFormat)[] = [
    'fontFamily',
    'fontSize',
    'color',
    'backgroundColor',
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'verticalAlign',
    'letterSpacing',
  ];

  for (const prop of properties) {
    const leftVal = leftObj[prop];
    const rightVal = rightObj[prop];

    // 双方都有值但不同 -> modified
    if (leftVal !== undefined && rightVal !== undefined && leftVal !== rightVal) {
      changes.push({
        property: prop,
        oldValue: leftVal,
        newValue: rightVal,
        changeType: 'modified',
      });
    }
    // 左侧没有，右侧有 -> added
    else if (leftVal === undefined && rightVal !== undefined) {
      changes.push({
        property: prop,
        oldValue: undefined,
        newValue: rightVal,
        changeType: 'added',
      });
    }
    // 左侧有，右侧没有 -> removed
    else if (leftVal !== undefined && rightVal === undefined) {
      changes.push({
        property: prop,
        oldValue: leftVal,
        newValue: undefined,
        changeType: 'removed',
      });
    }
  }

  return changes;
}

/**
 * 比较两个段落格式对象，返回差异列表
 *
 * @param left - 左侧段落格式（旧格式）
 * @param right - 右侧段落格式（新格式）
 * @returns ParagraphFormatChange[] 格式变化列表
 */
export function compareParagraphFormats(
  left: ParagraphFormat | undefined,
  right: ParagraphFormat | undefined
): ParagraphFormatChange[] {
  const changes: ParagraphFormatChange[] = [];
  const leftObj = left || {};
  const rightObj = right || {};

  // 定义所有需要比较的属性
  const properties: (keyof ParagraphFormat)[] = [
    'alignment',
    'indentLeft',
    'indentRight',
    'indentFirstLine',
    'lineSpacing',
    'spaceBefore',
    'spaceAfter',
  ];

  for (const prop of properties) {
    const leftVal = leftObj[prop];
    const rightVal = rightObj[prop];

    // 双方都有值但不同 -> modified
    if (leftVal !== undefined && rightVal !== undefined && leftVal !== rightVal) {
      changes.push({
        property: prop,
        oldValue: leftVal,
        newValue: rightVal,
        changeType: 'modified',
      });
    }
    // 左侧没有，右侧有 -> added
    else if (leftVal === undefined && rightVal !== undefined) {
      changes.push({
        property: prop,
        oldValue: undefined,
        newValue: rightVal,
        changeType: 'added',
      });
    }
    // 左侧有，右侧没有 -> removed
    else if (leftVal !== undefined && rightVal === undefined) {
      changes.push({
        property: prop,
        oldValue: leftVal,
        newValue: undefined,
        changeType: 'removed',
      });
    }
  }

  return changes;
}

/**
 * 计算两个文档格式的完整差异
 *
 * @param leftTextFormat - 左侧文本格式
 * @param rightTextFormat - 右侧文本格式
 * @param leftParagraphFormat - 左侧段落格式
 * @param rightParagraphFormat - 右侧段落格式
 * @returns FormatDiffResult 完整的格式差异结果
 */
export function computeFormatDiff(
  leftTextFormat: TextFormat | undefined,
  rightTextFormat: TextFormat | undefined,
  leftParagraphFormat: ParagraphFormat | undefined,
  rightParagraphFormat: ParagraphFormat | undefined
): FormatDiffResult {
  const textFormatChanges = compareTextFormats(leftTextFormat, rightTextFormat);
  const paragraphFormatChanges = compareParagraphFormats(leftParagraphFormat, rightParagraphFormat);

  return {
    textFormatChanges,
    paragraphFormatChanges,
    hasChanges: textFormatChanges.length > 0 || paragraphFormatChanges.length > 0,
  };
}
