import { describe, expect, it } from 'vitest';
import { camelToSnake, snakeToCamel, toSnakeCase, toCamelCase } from './field-mapping.js';

describe('camelToSnake', () => {
  it('converts simple camelCase', () => {
    expect(camelToSnake('taskId')).toBe('task_id');
    expect(camelToSnake('matchId')).toBe('match_id');
    expect(camelToSnake('matchType')).toBe('match_type');
  });

  it('handles single word', () => {
    expect(camelToSnake('confidence')).toBe('confidence');
    expect(camelToSnake('similarity')).toBe('similarity');
  });

  it('handles multiple capitals', () => {
    expect(camelToSnake('pageStart')).toBe('page_start');
    expect(camelToSnake('backgroundColor')).toBe('background_color');
    expect(camelToSnake('indentFirstLine')).toBe('indent_first_line');
  });
});

describe('snakeToCamel', () => {
  it('converts simple snake_case', () => {
    expect(snakeToCamel('task_id')).toBe('taskId');
    expect(snakeToCamel('match_id')).toBe('matchId');
    expect(snakeToCamel('match_type')).toBe('matchType');
  });

  it('handles single word', () => {
    expect(snakeToCamel('confidence')).toBe('confidence');
    expect(snakeToCamel('similarity')).toBe('similarity');
  });

  it('handles multiple underscores', () => {
    expect(snakeToCamel('page_start')).toBe('pageStart');
    expect(snakeToCamel('background_color')).toBe('backgroundColor');
    expect(snakeToCamel('indent_first_line')).toBe('indentFirstLine');
  });
});

describe('toSnakeCase', () => {
  it('converts object keys recursively', () => {
    const input = {
      taskId: 't1',
      docAId: 'a',
      items: [{ matchId: 'm1', matchType: 'modified', sourceA: 'text' }],
    };
    const expected = {
      task_id: 't1',
      doc_a_id: 'a',
      items: [{ match_id: 'm1', match_type: 'modified', source_a: 'text' }],
    };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it('preserves arrays and primitives', () => {
    expect(toSnakeCase([1, 'two', null])).toEqual([1, 'two', null]);
    expect(toSnakeCase('hello')).toBe('hello');
    expect(toSnakeCase(42)).toBe(42);
  });
});

describe('toCamelCase', () => {
  it('converts object keys recursively', () => {
    const input = {
      task_id: 't1',
      doc_a_id: 'a',
      items: [{ match_id: 'm1', match_type: 'modified', source_a: 'text' }],
    };
    const expected = {
      taskId: 't1',
      docAId: 'a',
      items: [{ matchId: 'm1', matchType: 'modified', sourceA: 'text' }],
    };
    expect(toCamelCase(input)).toEqual(expected);
  });

  it('round-trips with toSnakeCase', () => {
    const original = {
      taskId: 't1',
      matchType: 'modified',
      sourceA: 'text',
      nodeIdsA: ['a1', 'a2'],
    };
    expect(toCamelCase(toSnakeCase(original))).toEqual(original);
  });
});
