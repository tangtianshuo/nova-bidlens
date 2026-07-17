import { describe, it, expect } from 'vitest';
import {
  compareTextFormats,
  compareParagraphFormats,
  computeFormatDiff,
} from './format-diff.js';
import type { TextFormat, ParagraphFormat } from './parser/docx-format.js';

describe('compareTextFormats', () => {
  it('should return empty array when both formats are undefined', () => {
    const result = compareTextFormats(undefined, undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array when both formats are identical', () => {
    const format: TextFormat = {
      fontFamily: 'Arial',
      fontSize: 12,
      bold: true,
    };
    const result = compareTextFormats(format, { ...format });
    expect(result).toEqual([]);
  });

  it('should detect added properties', () => {
    const left: TextFormat = {};
    const right: TextFormat = { fontFamily: 'Arial', fontSize: 12 };
    const result = compareTextFormats(left, right);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      property: 'fontFamily',
      oldValue: undefined,
      newValue: 'Arial',
      changeType: 'added',
    });
    expect(result[1]).toEqual({
      property: 'fontSize',
      oldValue: undefined,
      newValue: 12,
      changeType: 'added',
    });
  });

  it('should detect removed properties', () => {
    const left: TextFormat = { fontFamily: 'Arial', fontSize: 12 };
    const right: TextFormat = {};
    const result = compareTextFormats(left, right);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      property: 'fontFamily',
      oldValue: 'Arial',
      newValue: undefined,
      changeType: 'removed',
    });
    expect(result[1]).toEqual({
      property: 'fontSize',
      oldValue: 12,
      newValue: undefined,
      changeType: 'removed',
    });
  });

  it('should detect modified properties', () => {
    const left: TextFormat = { fontFamily: 'Arial', fontSize: 12, bold: true };
    const right: TextFormat = { fontFamily: 'Helvetica', fontSize: 14, bold: true };
    const result = compareTextFormats(left, right);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      {
        property: 'fontFamily',
        oldValue: 'Arial',
        newValue: 'Helvetica',
        changeType: 'modified',
      },
      {
        property: 'fontSize',
        oldValue: 12,
        newValue: 14,
        changeType: 'modified',
      },
    ]));
  });

  it('should detect boolean property changes', () => {
    const left: TextFormat = { bold: true, italic: false };
    const right: TextFormat = { bold: false, italic: true };
    const result = compareTextFormats(left, right);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      {
        property: 'bold',
        oldValue: true,
        newValue: false,
        changeType: 'modified',
      },
      {
        property: 'italic',
        oldValue: false,
        newValue: true,
        changeType: 'modified',
      },
    ]));
  });

  it('should detect verticalAlign changes', () => {
    const left: TextFormat = { verticalAlign: 'superscript' };
    const right: TextFormat = { verticalAlign: 'subscript' };
    const result = compareTextFormats(left, right);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      property: 'verticalAlign',
      oldValue: 'superscript',
      newValue: 'subscript',
      changeType: 'modified',
    });
  });

  it('should handle mixed changes', () => {
    const left: TextFormat = {
      fontFamily: 'Arial',
      fontSize: 12,
      bold: true,
      color: '#000000',
    };
    const right: TextFormat = {
      fontFamily: 'Helvetica',
      fontSize: 12,
      italic: true,
      color: '#000000',
    };
    const result = compareTextFormats(left, right);

    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining([
      {
        property: 'fontFamily',
        oldValue: 'Arial',
        newValue: 'Helvetica',
        changeType: 'modified',
      },
      {
        property: 'bold',
        oldValue: true,
        newValue: undefined,
        changeType: 'removed',
      },
      {
        property: 'italic',
        oldValue: undefined,
        newValue: true,
        changeType: 'added',
      },
    ]));
  });
});

describe('compareParagraphFormats', () => {
  it('should return empty array when both formats are undefined', () => {
    const result = compareParagraphFormats(undefined, undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array when both formats are identical', () => {
    const format: ParagraphFormat = {
      alignment: 'left',
      indentLeft: 10,
      lineSpacing: 1.5,
    };
    const result = compareParagraphFormats(format, { ...format });
    expect(result).toEqual([]);
  });

  it('should detect added properties', () => {
    const left: ParagraphFormat = {};
    const right: ParagraphFormat = { alignment: 'center', indentLeft: 20 };
    const result = compareParagraphFormats(left, right);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      property: 'alignment',
      oldValue: undefined,
      newValue: 'center',
      changeType: 'added',
    });
    expect(result[1]).toEqual({
      property: 'indentLeft',
      oldValue: undefined,
      newValue: 20,
      changeType: 'added',
    });
  });

  it('should detect removed properties', () => {
    const left: ParagraphFormat = { alignment: 'left', indentLeft: 10 };
    const right: ParagraphFormat = {};
    const result = compareParagraphFormats(left, right);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      property: 'alignment',
      oldValue: 'left',
      newValue: undefined,
      changeType: 'removed',
    });
    expect(result[1]).toEqual({
      property: 'indentLeft',
      oldValue: 10,
      newValue: undefined,
      changeType: 'removed',
    });
  });

  it('should detect modified properties', () => {
    const left: ParagraphFormat = {
      alignment: 'left',
      lineSpacing: 1.0,
      spaceBefore: 0,
    };
    const right: ParagraphFormat = {
      alignment: 'justify',
      lineSpacing: 1.5,
      spaceBefore: 10,
    };
    const result = compareParagraphFormats(left, right);

    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining([
      {
        property: 'alignment',
        oldValue: 'left',
        newValue: 'justify',
        changeType: 'modified',
      },
      {
        property: 'lineSpacing',
        oldValue: 1.0,
        newValue: 1.5,
        changeType: 'modified',
      },
      {
        property: 'spaceBefore',
        oldValue: 0,
        newValue: 10,
        changeType: 'modified',
      },
    ]));
  });

  it('should detect all alignment types', () => {
    const alignments = ['left', 'center', 'right', 'justify'] as const;

    for (let i = 0; i < alignments.length - 1; i++) {
      const left: ParagraphFormat = { alignment: alignments[i] };
      const right: ParagraphFormat = { alignment: alignments[i + 1] };
      const result = compareParagraphFormats(left, right);

      expect(result).toHaveLength(1);
      expect(result[0].property).toBe('alignment');
      expect(result[0].changeType).toBe('modified');
    }
  });

  it('should detect indentation changes', () => {
    const left: ParagraphFormat = {
      indentLeft: 10,
      indentRight: 20,
      indentFirstLine: 30,
    };
    const right: ParagraphFormat = {
      indentLeft: 15,
      indentRight: 25,
      indentFirstLine: 35,
    };
    const result = compareParagraphFormats(left, right);

    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining([
      {
        property: 'indentLeft',
        oldValue: 10,
        newValue: 15,
        changeType: 'modified',
      },
      {
        property: 'indentRight',
        oldValue: 20,
        newValue: 25,
        changeType: 'modified',
      },
      {
        property: 'indentFirstLine',
        oldValue: 30,
        newValue: 35,
        changeType: 'modified',
      },
    ]));
  });

  it('should detect spacing changes', () => {
    const left: ParagraphFormat = { spaceBefore: 0, spaceAfter: 0 };
    const right: ParagraphFormat = { spaceBefore: 10, spaceAfter: 20 };
    const result = compareParagraphFormats(left, right);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      {
        property: 'spaceBefore',
        oldValue: 0,
        newValue: 10,
        changeType: 'modified',
      },
      {
        property: 'spaceAfter',
        oldValue: 0,
        newValue: 20,
        changeType: 'modified',
      },
    ]));
  });
});

describe('computeFormatDiff', () => {
  it('should return hasChanges false when no changes', () => {
    const format: TextFormat = { fontFamily: 'Arial', fontSize: 12 };
    const result = computeFormatDiff(format, format, undefined, undefined);

    expect(result.hasChanges).toBe(false);
    expect(result.textFormatChanges).toEqual([]);
    expect(result.paragraphFormatChanges).toEqual([]);
  });

  it('should return hasChanges true when text format changes', () => {
    const left: TextFormat = { fontFamily: 'Arial' };
    const right: TextFormat = { fontFamily: 'Helvetica' };
    const result = computeFormatDiff(left, right, undefined, undefined);

    expect(result.hasChanges).toBe(true);
    expect(result.textFormatChanges).toHaveLength(1);
    expect(result.paragraphFormatChanges).toEqual([]);
  });

  it('should return hasChanges true when paragraph format changes', () => {
    const left: ParagraphFormat = { alignment: 'left' };
    const right: ParagraphFormat = { alignment: 'center' };
    const result = computeFormatDiff(undefined, undefined, left, right);

    expect(result.hasChanges).toBe(true);
    expect(result.textFormatChanges).toEqual([]);
    expect(result.paragraphFormatChanges).toHaveLength(1);
  });

  it('should return hasChanges true when both formats change', () => {
    const leftText: TextFormat = { fontFamily: 'Arial' };
    const rightText: TextFormat = { fontFamily: 'Helvetica' };
    const leftPara: ParagraphFormat = { alignment: 'left' };
    const rightPara: ParagraphFormat = { alignment: 'center' };
    const result = computeFormatDiff(leftText, rightText, leftPara, rightPara);

    expect(result.hasChanges).toBe(true);
    expect(result.textFormatChanges).toHaveLength(1);
    expect(result.paragraphFormatChanges).toHaveLength(1);
  });

  it('should handle undefined inputs gracefully', () => {
    const result = computeFormatDiff(undefined, undefined, undefined, undefined);

    expect(result.hasChanges).toBe(false);
    expect(result.textFormatChanges).toEqual([]);
    expect(result.paragraphFormatChanges).toEqual([]);
  });

  it('should compare complex format changes', () => {
    const leftText: TextFormat = {
      fontFamily: 'Arial',
      fontSize: 12,
      bold: true,
      color: '#000000',
    };
    const rightText: TextFormat = {
      fontFamily: 'Helvetica',
      fontSize: 14,
      italic: true,
      color: '#333333',
    };
    const leftPara: ParagraphFormat = {
      alignment: 'left',
      indentLeft: 10,
      lineSpacing: 1.0,
    };
    const rightPara: ParagraphFormat = {
      alignment: 'justify',
      indentLeft: 20,
      lineSpacing: 1.5,
      spaceBefore: 10,
    };

    const result = computeFormatDiff(leftText, rightText, leftPara, rightPara);

    expect(result.hasChanges).toBe(true);
    expect(result.textFormatChanges.length).toBeGreaterThan(0);
    expect(result.paragraphFormatChanges.length).toBeGreaterThan(0);
  });
});
