/**
 * 文本格式信息
 */
export interface TextFormat {
  /** 字体名称 */
  fontFamily?: string;
  /** 字号（单位：pt） */
  fontSize?: number;
  /** 字体颜色 */
  color?: string;
  /** 背景颜色 */
  backgroundColor?: string;
  /** 是否粗体 */
  bold?: boolean;
  /** 是否斜体 */
  italic?: boolean;
  /** 是否下划线 */
  underline?: boolean;
  /** 是否删除线 */
  strikethrough?: boolean;
  /** 上标/下标 */
  verticalAlign?: "superscript" | "subscript";
  /** 字符间距（单位：pt） */
  letterSpacing?: number;
}

/**
 * 段落格式信息
 */
export interface ParagraphFormat {
  /** 对齐方式 */
  alignment?: "left" | "center" | "right" | "justify";
  /** 左缩进（单位：pt） */
  indentLeft?: number;
  /** 右缩进（单位：pt） */
  indentRight?: number;
  /** 首行缩进（单位：pt） */
  indentFirstLine?: number;
  /** 行距（单位：pt） */
  lineSpacing?: number;
  /** 段前间距（单位：pt） */
  spaceBefore?: number;
  /** 段后间距（单位：pt） */
  spaceAfter?: number;
}

/**
 * 运行节点（包含文本和格式）
 */
export interface RunNode {
  /** 文本内容 */
  text: string;
  /** 文本格式 */
  format: TextFormat;
}

/**
 * 默认文本格式
 */
const DEFAULT_FORMAT: TextFormat = {};

/**
 * 从style属性解析格式信息
 */
function parseStyleAttribute(style: string): TextFormat {
  const format: TextFormat = {};

  // 解析 font-family
  const fontFamilyMatch = style.match(/font-family:\s*([^;]+)/);
  if (fontFamilyMatch) {
    format.fontFamily = fontFamilyMatch[1].trim().replace(/[\"\']/g, "");
  }

  // 解析 font-size
  const fontSizeMatch = style.match(/font-size:\s*([\d.]+)(pt|px|em|rem)/);
  if (fontSizeMatch) {
    const value = parseFloat(fontSizeMatch[1]);
    const unit = fontSizeMatch[2];
    // 转换为pt
    if (unit === "pt") {
      format.fontSize = value;
    } else if (unit === "px") {
      format.fontSize = value * 0.75; // 1px ≈ 0.75pt
    }
  }

  // 解析 color
  const colorMatch = style.match(/(?:^|[^-])color:\s*([^;]+)/);
  if (colorMatch) {
    format.color = colorMatch[1].trim();
  }

  // 解析 background-color
  const bgColorMatch = style.match(/background-color:\s*([^;]+)/);
  if (bgColorMatch) {
    format.backgroundColor = bgColorMatch[1].trim();
  }

  // 解析 font-weight
  const fontWeightMatch = style.match(/font-weight:\s*(bold|[6-9]\d{2})/);
  if (fontWeightMatch) {
    format.bold = true;
  }

  // 解析 font-style
  const fontStyleMatch = style.match(/font-style:\s*italic/);
  if (fontStyleMatch) {
    format.italic = true;
  }

  // 解析 text-decoration
  const textDecorationMatch = style.match(/text-decoration:\s*([^;]+)/);
  if (textDecorationMatch) {
    const decoration = textDecorationMatch[1].trim();
    if (decoration.includes("underline")) {
      format.underline = true;
    }
    if (decoration.includes("line-through")) {
      format.strikethrough = true;
    }
  }

  // 解析 vertical-align
  const verticalAlignMatch = style.match(/vertical-align:\s*(super|sub)/);
  if (verticalAlignMatch) {
    format.verticalAlign = verticalAlignMatch[1] === "super" ? "superscript" : "subscript";
  }

  // 解析 letter-spacing
  const letterSpacingMatch = style.match(/letter-spacing:\s*([\d.]+)(pt|px)/);
  if (letterSpacingMatch) {
    const value = parseFloat(letterSpacingMatch[1]);
    const unit = letterSpacingMatch[2];
    format.letterSpacing = unit === "pt" ? value : value * 0.75;
  }

  return format;
}

/**
 * 从style属性解析段落格式信息
 */
function parseParagraphStyleAttribute(style: string): ParagraphFormat {
  const format: ParagraphFormat = {};

  // 解析 text-align
  const textAlignMatch = style.match(/text-align:\s*(left|center|right|justify)/);
  if (textAlignMatch) {
    format.alignment = textAlignMatch[1] as "left" | "center" | "right" | "justify";
  }

  // 解析 margin-left
  const marginLeftMatch = style.match(/margin-left:\s*([\d.]+)(pt|px|em|rem)/);
  if (marginLeftMatch) {
    const value = parseFloat(marginLeftMatch[1]);
    const unit = marginLeftMatch[2];
    if (unit === "pt") {
      format.indentLeft = value;
    } else if (unit === "px") {
      format.indentLeft = value * 0.75;
    }
  }

  // 解析 margin-right
  const marginRightMatch = style.match(/margin-right:\s*([\d.]+)(pt|px|em|rem)/);
  if (marginRightMatch) {
    const value = parseFloat(marginRightMatch[1]);
    const unit = marginRightMatch[2];
    if (unit === "pt") {
      format.indentRight = value;
    } else if (unit === "px") {
      format.indentRight = value * 0.75;
    }
  }

  // 解析 text-indent
  const textIndentMatch = style.match(/text-indent:\s*([\d.]+)(pt|px|em|rem)/);
  if (textIndentMatch) {
    const value = parseFloat(textIndentMatch[1]);
    const unit = textIndentMatch[2];
    if (unit === "pt") {
      format.indentFirstLine = value;
    } else if (unit === "px") {
      format.indentFirstLine = value * 0.75;
    }
  }

  // 解析 line-height
  const lineHeightMatch = style.match(/line-height:\s*([\d.]+)(pt|px|em|rem)?/);
  if (lineHeightMatch) {
    const value = parseFloat(lineHeightMatch[1]);
    const unit = lineHeightMatch[2] || "pt";
    if (unit === "pt") {
      format.lineSpacing = value;
    } else if (unit === "px") {
      format.lineSpacing = value * 0.75;
    }
  }

  // 解析 margin-top
  const marginTopMatch = style.match(/margin-top:\s*([\d.]+)(pt|px|em|rem)/);
  if (marginTopMatch) {
    const value = parseFloat(marginTopMatch[1]);
    const unit = marginTopMatch[2];
    if (unit === "pt") {
      format.spaceBefore = value;
    } else if (unit === "px") {
      format.spaceBefore = value * 0.75;
    }
  }

  // 解析 margin-bottom
  const marginBottomMatch = style.match(/margin-bottom:\s*([\d.]+)(pt|px|em|rem)/);
  if (marginBottomMatch) {
    const value = parseFloat(marginBottomMatch[1]);
    const unit = marginBottomMatch[2];
    if (unit === "pt") {
      format.spaceAfter = value;
    } else if (unit === "px") {
      format.spaceAfter = value * 0.75;
    }
  }

  return format;
}

/**
 * 从HTML元素中提取文本格式
 *
 * @param element - HTML元素
 * @returns TextFormat对象
 */
export function extractTextFormat(element: any): TextFormat {
  let format: TextFormat = {};

  // 从style属性提取格式
  const style = element.attributes?.style;
  if (style) {
    format = { ...format, ...parseStyleAttribute(style) };
  }

  // 处理格式标签
  const tagName = element.tagName?.toLowerCase();
  if (tagName === "b" || tagName === "strong") {
    format.bold = true;
  } else if (tagName === "i" || tagName === "em") {
    format.italic = true;
  } else if (tagName === "u") {
    format.underline = true;
  } else if (tagName === "s" || tagName === "strike" || tagName === "del") {
    format.strikethrough = true;
  } else if (tagName === "sup") {
    format.verticalAlign = "superscript";
  } else if (tagName === "sub") {
    format.verticalAlign = "subscript";
  }

  // 检查class属性中的格式提示
  const className = element.attributes?.class || "";
  if (className.includes("bold") || className.includes("Bold")) {
    format.bold = true;
  }
  if (className.includes("italic") || className.includes("Italic")) {
    format.italic = true;
  }

  return format;
}

/**
 * 从HTML元素中提取段落格式
 *
 * @param element - HTML段落元素
 * @returns ParagraphFormat对象
 */
export function extractParagraphFormat(element: any): ParagraphFormat {
  let format: ParagraphFormat = {};

  // 从style属性提取段落格式
  const style = element.attributes?.style;
  if (style) {
    format = { ...format, ...parseParagraphStyleAttribute(style) };
  }

  return format;
}

/**
 * 从段落元素中提取运行节点
 *
 * @param paragraph - 段落HTML元素
 * @returns RunNode数组
 */
export function extractRunNodes(paragraph: any): RunNode[] {
  const runs: RunNode[] = [];

  function traverse(node: any, parentFormat: TextFormat): void {
    // 提取当前节点的格式
    const nodeFormat = extractTextFormat(node);
    const mergedFormat: TextFormat = { ...parentFormat, ...nodeFormat };

    // 如果是文本节点（没有子节点）
    if (!node.children || node.children.length === 0) {
      const text = node.textContent || "";
      if (text) {
        runs.push({
          text,
          format: { ...mergedFormat }
        });
      }
      return;
    }

    // 递归处理子节点
    for (const child of node.children) {
      traverse(child, mergedFormat);
    }
  }

  traverse(paragraph, DEFAULT_FORMAT);

  return mergeAdjacentRuns(runs);
}

/**
 * 合并相邻的具有相同格式的运行节点
 */
function mergeAdjacentRuns(runs: RunNode[]): RunNode[] {
  if (runs.length === 0) return [];

  const merged: RunNode[] = [];
  let current = { ...runs[0] };

  for (let i = 1; i < runs.length; i++) {
    const next = runs[i];

    if (formatsEqual(current.format, next.format)) {
      current.text += next.text;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * 比较两个格式对象是否相等
 */
function formatsEqual(a: TextFormat, b: TextFormat): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.color === b.color &&
    a.backgroundColor === b.backgroundColor &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.verticalAlign === b.verticalAlign &&
    a.letterSpacing === b.letterSpacing
  );
}
