import { describe, it, expect } from 'vitest';
import { mapContentListToAst, parseTableBody, resetNodeIdCounter, type ContentListItem } from './mapper.js';

describe('parseTableBody', () => {
  it('parses simple HTML table to rows[][]', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>';
    expect(parseTableBody(html)).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('handles th tags', () => {
    const html = '<table><tr><th>Name</th><th>Value</th></tr><tr><td>X</td><td>1</td></tr></table>';
    expect(parseTableBody(html)).toEqual([['Name', 'Value'], ['X', '1']]);
  });

  it('strips nested HTML tags inside cells', () => {
    const html = '<table><tr><td><b>Bold</b> text</td><td><i>Italic</i></td></tr></table>';
    expect(parseTableBody(html)).toEqual([['Bold text', 'Italic']]);
  });

  it('decodes HTML entities', () => {
    const html = '<table><tr><td>A&amp;B</td><td>&lt;C&gt;</td><td>&nbsp;D</td></tr></table>';
    expect(parseTableBody(html)).toEqual([['A&B', '<C>', 'D']]);
  });

  it('returns empty array for no rows', () => {
    expect(parseTableBody('<table></table>')).toEqual([]);
  });
});

describe('mapContentListToAst', () => {
  it('maps text_level=0 to ParagraphNode', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: 'Hello world', text_level: 0, page_idx: 0 },
    ];
    const blocks = mapContentListToAst(items);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'paragraph',
      text: 'Hello world',
      pageStart: 1,
      pageEnd: 1,
    });
  });

  it('maps text_level=1 to SectionNode', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: 'Chapter 1', text_level: 1, page_idx: 0 },
    ];
    const blocks = mapContentListToAst(items);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'section',
      title: 'Chapter 1',
      level: 1,
      children: [],
    });
  });

  it('nests level-2 section under level-1', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: 'Chapter 1', text_level: 1, page_idx: 0 },
      { type: 'text', text: 'Section 1.1', text_level: 2, page_idx: 0 },
    ];
    const blocks = mapContentListToAst(items);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('section');
    const ch1 = blocks[0] as any;
    expect(ch1.children).toHaveLength(1);
    expect(ch1.children[0]).toMatchObject({ type: 'section', title: 'Section 1.1', level: 2 });
  });

  it('nests paragraphs under current section', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: 'Chapter 1', text_level: 1, page_idx: 0 },
      { type: 'text', text: 'Some content', text_level: 0, page_idx: 0 },
    ];
    const blocks = mapContentListToAst(items);
    const ch1 = blocks[0] as any;
    expect(ch1.children).toHaveLength(1);
    expect(ch1.children[0]).toMatchObject({ type: 'paragraph', text: 'Some content' });
  });

  it('maps table type to TableNode', () => {
    const items: ContentListItem[] = [
      { type: 'table', table_body: '<table><tr><td>A</td><td>B</td></tr></table>', page_idx: 1 },
    ];
    const blocks = mapContentListToAst(items);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'table',
      rows: [['A', 'B']],
      pageStart: 2,
    });
  });

  it('ignores page_number, header, image types', () => {
    const items: ContentListItem[] = [
      { type: 'page_number', text: '1', page_idx: 0 },
      { type: 'header', text: 'Header', page_idx: 0 },
      { type: 'image', img_path: '/img.png', page_idx: 0 },
    ];
    expect(mapContentListToAst(items)).toEqual([]);
  });

  it('skips empty text', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: '  ', text_level: 0, page_idx: 0 },
      { type: 'text', text: '', text_level: 0, page_idx: 0 },
    ];
    expect(mapContentListToAst(items)).toEqual([]);
  });

  it('maintains document order for mixed content', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: 'First', text_level: 0, page_idx: 0 },
      { type: 'text', text: 'Heading', text_level: 1, page_idx: 0 },
      { type: 'text', text: 'Under heading', text_level: 0, page_idx: 0 },
      { type: 'table', table_body: '<table><tr><td>X</td></tr></table>', page_idx: 1 },
    ];
    const blocks = mapContentListToAst(items);
    // "Under heading" and table nest under "Heading" section
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', text: 'First' });
    expect(blocks[1].type).toBe('section');
    const heading = blocks[1] as any;
    expect(heading.children).toHaveLength(2);
    expect(heading.children[0]).toMatchObject({ type: 'paragraph', text: 'Under heading' });
    expect(heading.children[1]).toMatchObject({ type: 'table', rows: [['X']] });
  });

  it('handles sibling sections at same level', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: 'Ch1', text_level: 1, page_idx: 0 },
      { type: 'text', text: 'Ch2', text_level: 1, page_idx: 1 },
    ];
    const blocks = mapContentListToAst(items);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'section', title: 'Ch1' });
    expect(blocks[1]).toMatchObject({ type: 'section', title: 'Ch2' });
  });

  it('converts page_idx from 0-indexed to 1-indexed', () => {
    const items: ContentListItem[] = [
      { type: 'text', text: 'On page 3', text_level: 0, page_idx: 2 },
    ];
    const blocks = mapContentListToAst(items);
    expect(blocks[0]).toMatchObject({ pageStart: 3, pageEnd: 3 });
  });
});
