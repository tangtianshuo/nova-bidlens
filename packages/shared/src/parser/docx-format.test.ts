import { describe, expect, it } from "vitest";
import { extractTextFormat, extractRunNodes, extractParagraphFormat, TextFormat, RunNode, ParagraphFormat } from "./docx-format.js";

// 模拟HTML元素
function createHtmlElement(
  tagName: string,
  attributes: Record<string, string> = {},
  children: any[] = [],
  textContent?: string
): any {
  return {
    tagName,
    attributes,
    children,
    textContent
  };
}

describe('extractTextFormat', () => {
  it('should extract font-family from style', () => {
    const element = createHtmlElement('span', {
      style: 'font-family: Arial;'
    });
    const format = extractTextFormat(element);
    expect(format.fontFamily).toBe('Arial');
  });

  it('should extract font-size in pt', () => {
    const element = createHtmlElement('span', {
      style: 'font-size: 12pt;'
    });
    const format = extractTextFormat(element);
    expect(format.fontSize).toBe(12);
  });

  it('should convert font-size from px to pt', () => {
    const element = createHtmlElement('span', {
      style: 'font-size: 16px;'
    });
    const format = extractTextFormat(element);
    expect(format.fontSize).toBe(12); // 16 * 0.75 = 12
  });

  it('should extract color', () => {
    const element = createHtmlElement('span', {
      style: 'color: #ff0000;'
    });
    const format = extractTextFormat(element);
    expect(format.color).toBe('#ff0000');
  });

  it('should extract background-color', () => {
    const element = createHtmlElement('span', {
      style: 'background-color: yellow;'
    });
    const format = extractTextFormat(element);
    expect(format.backgroundColor).toBe('yellow');
  });

  it('should detect bold from font-weight', () => {
    const element = createHtmlElement('span', {
      style: 'font-weight: bold;'
    });
    const format = extractTextFormat(element);
    expect(format.bold).toBe(true);
  });

  it('should detect bold from numeric font-weight (600+)', () => {
    const element = createHtmlElement('span', {
      style: 'font-weight: 700;'
    });
    const format = extractTextFormat(element);
    expect(format.bold).toBe(true);
  });

  it('should detect italic from font-style', () => {
    const element = createHtmlElement('span', {
      style: 'font-style: italic;'
    });
    const format = extractTextFormat(element);
    expect(format.italic).toBe(true);
  });

  it('should detect underline from text-decoration', () => {
    const element = createHtmlElement('span', {
      style: 'text-decoration: underline;'
    });
    const format = extractTextFormat(element);
    expect(format.underline).toBe(true);
  });

  it('should detect strikethrough from text-decoration', () => {
    const element = createHtmlElement('span', {
      style: 'text-decoration: line-through;'
    });
    const format = extractTextFormat(element);
    expect(format.strikethrough).toBe(true);
  });

  it('should detect both underline and strikethrough', () => {
    const element = createHtmlElement('span', {
      style: 'text-decoration: underline line-through;'
    });
    const format = extractTextFormat(element);
    expect(format.underline).toBe(true);
    expect(format.strikethrough).toBe(true);
  });

  it('should detect superscript from vertical-align', () => {
    const element = createHtmlElement('span', {
      style: 'vertical-align: super;'
    });
    const format = extractTextFormat(element);
    expect(format.verticalAlign).toBe('superscript');
  });

  it('should detect subscript from vertical-align', () => {
    const element = createHtmlElement('span', {
      style: 'vertical-align: sub;'
    });
    const format = extractTextFormat(element);
    expect(format.verticalAlign).toBe('subscript');
  });

  it('should extract letter-spacing', () => {
    const element = createHtmlElement('span', {
      style: 'letter-spacing: 2pt;'
    });
    const format = extractTextFormat(element);
    expect(format.letterSpacing).toBe(2);
  });

  it('should convert letter-spacing from px to pt', () => {
    const element = createHtmlElement('span', {
      style: 'letter-spacing: 4px;'
    });
    const format = extractTextFormat(element);
    expect(format.letterSpacing).toBe(3); // 4 * 0.75 = 3
  });

  it('should detect bold from <b> tag', () => {
    const element = createHtmlElement('b');
    const format = extractTextFormat(element);
    expect(format.bold).toBe(true);
  });

  it('should detect bold from <strong> tag', () => {
    const element = createHtmlElement('strong');
    const format = extractTextFormat(element);
    expect(format.bold).toBe(true);
  });

  it('should detect italic from <i> tag', () => {
    const element = createHtmlElement('i');
    const format = extractTextFormat(element);
    expect(format.italic).toBe(true);
  });

  it('should detect italic from <em> tag', () => {
    const element = createHtmlElement('em');
    const format = extractTextFormat(element);
    expect(format.italic).toBe(true);
  });

  it('should detect underline from <u> tag', () => {
    const element = createHtmlElement('u');
    const format = extractTextFormat(element);
    expect(format.underline).toBe(true);
  });

  it('should detect strikethrough from <s> tag', () => {
    const element = createHtmlElement('s');
    const format = extractTextFormat(element);
    expect(format.strikethrough).toBe(true);
  });

  it('should detect strikethrough from <strike> tag', () => {
    const element = createHtmlElement('strike');
    const format = extractTextFormat(element);
    expect(format.strikethrough).toBe(true);
  });

  it('should detect strikethrough from <del> tag', () => {
    const element = createHtmlElement('del');
    const format = extractTextFormat(element);
    expect(format.strikethrough).toBe(true);
  });

  it('should detect superscript from <sup> tag', () => {
    const element = createHtmlElement('sup');
    const format = extractTextFormat(element);
    expect(format.verticalAlign).toBe('superscript');
  });

  it('should detect subscript from <sub> tag', () => {
    const element = createHtmlElement('sub');
    const format = extractTextFormat(element);
    expect(format.verticalAlign).toBe('subscript');
  });

  it('should return empty format for plain elements', () => {
    const element = createHtmlElement('span');
    const format = extractTextFormat(element);
    expect(format).toEqual({});
  });

  it('should combine multiple format properties', () => {
    const element = createHtmlElement('span', {
      style: 'font-family: Arial; font-size: 14pt; color: blue; font-weight: bold; font-style: italic;'
    });
    const format = extractTextFormat(element);
    expect(format.fontFamily).toBe('Arial');
    expect(format.fontSize).toBe(14);
    expect(format.color).toBe('blue');
    expect(format.bold).toBe(true);
    expect(format.italic).toBe(true);
  });
});

describe('extractRunNodes', () => {
  it('should extract plain text as single run', () => {
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('span', {}, [], 'Hello World')
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('Hello World');
    expect(runs[0].format).toEqual({});
  });

  it('should split runs by format changes', () => {
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('span', {}, [], 'Normal '),
      createHtmlElement('b', {}, [], 'Bold'),
      createHtmlElement('span', {}, [], ' Normal')
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(3);
    expect(runs[0].text).toBe('Normal ');
    expect(runs[0].format.bold).toBeUndefined();
    expect(runs[1].text).toBe('Bold');
    expect(runs[1].format.bold).toBe(true);
    expect(runs[2].text).toBe(' Normal');
    expect(runs[2].format.bold).toBeUndefined();
  });

  it('should merge adjacent runs with same format', () => {
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('b', {}, [], 'Hello '),
      createHtmlElement('b', {}, [], 'World')
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('Hello World');
    expect(runs[0].format.bold).toBe(true);
  });

  it('should handle nested formatting', () => {
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('b', {}, [
        createHtmlElement('i', {}, [], 'Bold and Italic')
      ])
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('Bold and Italic');
    expect(runs[0].format.bold).toBe(true);
    expect(runs[0].format.italic).toBe(true);
  });

  it('should handle mixed formatting', () => {
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('span', {}, [], 'Start '),
      createHtmlElement('b', {}, [
        createHtmlElement('i', {}, [], 'Bold Italic ')
      ]),
      createHtmlElement('u', {}, [], 'Underline'),
      createHtmlElement('span', {}, [], ' End')
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(4);
    expect(runs[0].text).toBe('Start ');
    expect(runs[1].text).toBe('Bold Italic ');
    expect(runs[1].format.bold).toBe(true);
    expect(runs[1].format.italic).toBe(true);
    expect(runs[2].text).toBe('Underline');
    expect(runs[2].format.underline).toBe(true);
    expect(runs[3].text).toBe(' End');
  });

  it('should handle empty paragraph', () => {
    const paragraph = createHtmlElement('p', {}, []);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(0);
  });

  it('should handle paragraph with only whitespace', () => {
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('span', {}, [], '   ')
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('   ');
  });

  it('should extract format from style attributes', () => {
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('span', { style: 'font-size: 12pt; color: red;' }, [], 'Styled'),
      createHtmlElement('span', { style: 'font-size: 14pt;' }, [], ' text')
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(2);
    expect(runs[0].format.fontSize).toBe(12);
    expect(runs[0].format.color).toBe('red');
    expect(runs[1].format.fontSize).toBe(14);
    expect(runs[1].format.color).toBeUndefined();
  });

  it('should handle complex real-world example', () => {
    // 模拟一个典型的Word文档段落
    const paragraph = createHtmlElement('p', {}, [
      createHtmlElement('span', { style: 'font-family: Arial; font-size: 11pt;' }, [], 'This is '),
      createHtmlElement('b', { style: 'font-family: Arial; font-size: 11pt;' }, [
        createHtmlElement('span', {}, [], 'bold')
      ]),
      createHtmlElement('span', { style: 'font-family: Arial; font-size: 11pt;' }, [], ' and '),
      createHtmlElement('i', { style: 'font-family: Arial; font-size: 11pt;' }, [
        createHtmlElement('span', {}, [], 'italic')
      ]),
      createHtmlElement('span', { style: 'font-family: Arial; font-size: 11pt;' }, [], ' text.')
    ]);
    const runs = extractRunNodes(paragraph);
    expect(runs).toHaveLength(5);
    expect(runs[0].text).toBe('This is ');
    expect(runs[0].format.fontFamily).toBe('Arial');
    expect(runs[0].format.fontSize).toBe(11);
    expect(runs[1].text).toBe('bold');
    expect(runs[1].format.bold).toBe(true);
    expect(runs[1].format.fontFamily).toBe('Arial');
    expect(runs[2].text).toBe(' and ');
    expect(runs[3].text).toBe('italic');
    expect(runs[3].format.italic).toBe(true);
    expect(runs[4].text).toBe(' text.');
  });
});

describe('extractParagraphFormat', () => {
  it('should extract left alignment', () => {
    const element = createHtmlElement('p', {
      style: 'text-align: left;'
    });
    const format = extractParagraphFormat(element);
    expect(format.alignment).toBe('left');
  });

  it('should extract center alignment', () => {
    const element = createHtmlElement('p', {
      style: 'text-align: center;'
    });
    const format = extractParagraphFormat(element);
    expect(format.alignment).toBe('center');
  });

  it('should extract right alignment', () => {
    const element = createHtmlElement('p', {
      style: 'text-align: right;'
    });
    const format = extractParagraphFormat(element);
    expect(format.alignment).toBe('right');
  });

  it('should extract justify alignment', () => {
    const element = createHtmlElement('p', {
      style: 'text-align: justify;'
    });
    const format = extractParagraphFormat(element);
    expect(format.alignment).toBe('justify');
  });

  it('should extract margin-left in pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-left: 24pt;'
    });
    const format = extractParagraphFormat(element);
    expect(format.indentLeft).toBe(24);
  });

  it('should convert margin-left from px to pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-left: 32px;'
    });
    const format = extractParagraphFormat(element);
    expect(format.indentLeft).toBe(24); // 32 * 0.75 = 24
  });

  it('should extract margin-right in pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-right: 12pt;'
    });
    const format = extractParagraphFormat(element);
    expect(format.indentRight).toBe(12);
  });

  it('should convert margin-right from px to pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-right: 16px;'
    });
    const format = extractParagraphFormat(element);
    expect(format.indentRight).toBe(12); // 16 * 0.75 = 12
  });

  it('should extract text-indent in pt', () => {
    const element = createHtmlElement('p', {
      style: 'text-indent: 24pt;'
    });
    const format = extractParagraphFormat(element);
    expect(format.indentFirstLine).toBe(24);
  });

  it('should convert text-indent from px to pt', () => {
    const element = createHtmlElement('p', {
      style: 'text-indent: 32px;'
    });
    const format = extractParagraphFormat(element);
    expect(format.indentFirstLine).toBe(24); // 32 * 0.75 = 24
  });

  it('should extract line-height in pt', () => {
    const element = createHtmlElement('p', {
      style: 'line-height: 18pt;'
    });
    const format = extractParagraphFormat(element);
    expect(format.lineSpacing).toBe(18);
  });

  it('should convert line-height from px to pt', () => {
    const element = createHtmlElement('p', {
      style: 'line-height: 24px;'
    });
    const format = extractParagraphFormat(element);
    expect(format.lineSpacing).toBe(18); // 24 * 0.75 = 18
  });

  it('should extract line-height without unit', () => {
    const element = createHtmlElement('p', {
      style: 'line-height: 1.5;'
    });
    const format = extractParagraphFormat(element);
    expect(format.lineSpacing).toBe(1.5);
  });

  it('should extract margin-top in pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-top: 12pt;'
    });
    const format = extractParagraphFormat(element);
    expect(format.spaceBefore).toBe(12);
  });

  it('should convert margin-top from px to pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-top: 16px;'
    });
    const format = extractParagraphFormat(element);
    expect(format.spaceBefore).toBe(12); // 16 * 0.75 = 12
  });

  it('should extract margin-bottom in pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-bottom: 12pt;'
    });
    const format = extractParagraphFormat(element);
    expect(format.spaceAfter).toBe(12);
  });

  it('should convert margin-bottom from px to pt', () => {
    const element = createHtmlElement('p', {
      style: 'margin-bottom: 16px;'
    });
    const format = extractParagraphFormat(element);
    expect(format.spaceAfter).toBe(12); // 16 * 0.75 = 12
  });

  it('should extract multiple paragraph formats', () => {
    const element = createHtmlElement('p', {
      style: 'text-align: center; margin-left: 24pt; text-indent: 24pt; line-height: 18pt; margin-top: 12pt; margin-bottom: 12pt;'
    });
    const format = extractParagraphFormat(element);
    expect(format.alignment).toBe('center');
    expect(format.indentLeft).toBe(24);
    expect(format.indentFirstLine).toBe(24);
    expect(format.lineSpacing).toBe(18);
    expect(format.spaceBefore).toBe(12);
    expect(format.spaceAfter).toBe(12);
  });

  it('should return empty object for no style', () => {
    const element = createHtmlElement('p');
    const format = extractParagraphFormat(element);
    expect(format).toEqual({});
  });

  it('should handle empty style string', () => {
    const element = createHtmlElement('p', { style: '' });
    const format = extractParagraphFormat(element);
    expect(format).toEqual({});
  });
});
