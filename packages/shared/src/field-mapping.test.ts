import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { camelToSnake, snakeToCamel, toSnakeCase, toCamelCase } from './field-mapping.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/v03-canonical.json'), 'utf8'));

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

// ─── V0.3 canonical fixture round-trip tests ───

const expectedSnakeKeys: Record<string, string[]> = {
  riskSubmission: ['id', 'file_name', 'file_format', 'file_size_bytes', 'page_count', 'sha256', 'status', 'warnings'],
  evidence: [
    'id', 'detector_type', 'match_basis', 'similarity_score',
    'source_submission_id', 'source_node_id', 'source_original_text', 'source_normalized_text',
    'source_section_path', 'source_page_range', 'source_table_location',
    'target_submission_id', 'target_node_id', 'target_original_text', 'target_normalized_text',
    'target_section_path', 'target_page_range', 'target_table_location',
    'context_before', 'context_after', 'tender_filtered', 'tender_filter_reason', 'rule_version',
  ],
  evidenceWithTable: ['source_table_location', 'target_table_location', 'tender_filtered', 'tender_filter_reason'],
  riskFinding: [
    'id', 'detector_type', 'risk_level', 'involved_submission_ids', 'evidence',
    'symmetric_similarity', 'directional_coverage', 'confidence_score', 'score_breakdown',
    'rule_version', 'review_status', 'important', 'review_note', 'reviewed_at',
  ],
  filePairAssessment: [
    'id', 'project_id', 'submission_a_id', 'submission_b_id',
    'directional_coverage_a_b', 'directional_coverage_b_a', 'symmetric_similarity',
    'risk_level', 'top_finding_ids', 'finding_count', 'rule_version', 'analysis_status',
  ],
  projectRiskAssessment: [
    'id', 'project_id', 'level', 'raw_rule_score', 'top_contributing_finding_ids',
    'preset', 'rule_version', 'analysis_status', 'high_value_finding_count',
    'involved_submission_count', 'strong_entity_hit_count', 'tender_discount_applied', 'incomplete_reason',
  ],
  reviewDecision: ['id', 'project_id', 'finding_id', 'status', 'important', 'note', 'created_at', 'updated_at'],
  analysisCheckpoint: [
    'id', 'project_id', 'phase', 'input_hash', 'processing_version',
    'completed_detectors', 'intermediate_result_ref', 'warnings', 'errors', 'created_at',
  ],
  auditEvent: ['id', 'project_id', 'event_type', 'payload', 'created_at'],
  exportedReport: ['id', 'project_id', 'format', 'scope', 'result_hash', 'file_path', 'created_at'],
};

const expectedSnakeNestedKeys: Record<string, Record<string, string[]>> = {
  evidenceWithTable: {
    sourceTableLocation: ['table_index', 'row_index', 'cell_index', 'header_context'],
    targetTableLocation: ['table_index', 'row_index', 'cell_index', 'header_context'],
  },
  riskFinding: {
    scoreBreakdown: [
      'exact_match_score', 'lexical_score', 'structural_score', 'entity_score', 'fact_score',
      'tender_discount', 'template_discount', 'fact_conflict_penalty', 'final_score', 'rule_version',
    ],
    directionalCoverage: ['from_id', 'to_id', 'coverage'],
  },
  filePairAssessment: {
    findingCount: ['high', 'medium', 'low'],
  },
};

describe('V0.3 fixture camelToSnake', () => {
  for (const [key, snakeKeys] of Object.entries(expectedSnakeKeys)) {
    it(`converts ${key} keys to snake_case`, () => {
      const obj = fixture[key];
      const snake = toSnakeCase(obj) as Record<string, unknown>;
      for (const sk of snakeKeys) {
        expect(snake).toHaveProperty(sk);
      }
    });
  }
});

describe('V0.3 fixture snakeToCamel round-trip', () => {
  for (const key of Object.keys(fixture).filter((k) => k !== 'meta')) {
    it(`round-trips ${key}: camel → snake → camel preserves all keys and values`, () => {
      const original = fixture[key];
      const roundTripped = toCamelCase(toSnakeCase(original));
      expect(roundTripped).toEqual(original);
    });
  }
});

describe('V0.3 fixture nested objects', () => {
  for (const [key, nestedMap] of Object.entries(expectedSnakeNestedKeys)) {
    for (const [nestedCamel, nestedSnakeKeys] of Object.entries(nestedMap)) {
      it(`converts ${key}.${nestedCamel} nested keys to snake_case`, () => {
        const obj = fixture[key];
        const snake = toSnakeCase(obj) as Record<string, unknown>;
        const snakeKey = camelToSnake(nestedCamel);
        const nested = snake[snakeKey] as Record<string, unknown>;
        if (Array.isArray(nested)) {
          for (const item of nested) {
            for (const sk of nestedSnakeKeys) {
              expect(item).toHaveProperty(sk);
            }
          }
        } else {
          for (const sk of nestedSnakeKeys) {
            expect(nested).toHaveProperty(sk);
          }
        }
      });
    }
  }
});

const enumFields: Record<string, { path: string; values: string[] }[]> = {
  riskSubmission: [
    { path: 'status', values: ['extracted'] },
    { path: 'fileFormat', values: ['docx'] },
  ],
  evidence: [
    { path: 'detectorType', values: ['text'] },
    { path: 'matchBasis', values: ['lexical'] },
  ],
  evidenceWithTable: [
    { path: 'detectorType', values: ['table'] },
    { path: 'matchBasis', values: ['structural'] },
  ],
  riskFinding: [
    { path: 'detectorType', values: ['text'] },
    { path: 'riskLevel', values: ['high'] },
    { path: 'reviewStatus', values: ['pending'] },
  ],
  filePairAssessment: [
    { path: 'riskLevel', values: ['high'] },
    { path: 'analysisStatus', values: ['complete'] },
  ],
  projectRiskAssessment: [
    { path: 'level', values: ['high'] },
    { path: 'preset', values: ['standard'] },
    { path: 'analysisStatus', values: ['complete'] },
  ],
  reviewDecision: [
    { path: 'status', values: ['confirmed'] },
  ],
  analysisCheckpoint: [
    { path: 'phase', values: ['detecting'] },
  ],
  auditEvent: [
    { path: 'eventType', values: ['analysis-started'] },
  ],
  exportedReport: [
    { path: 'format', values: ['pdf'] },
    { path: 'scope', values: ['confirmed'] },
  ],
};

describe('V0.3 fixture enum values survive round-trip', () => {
  for (const [key, fields] of Object.entries(enumFields)) {
    for (const { path, values } of fields) {
      it(`${key}.${path} round-trips as lowercase string`, () => {
        const original = fixture[key];
        const roundTripped = toCamelCase(toSnakeCase(original)) as Record<string, unknown>;
        expect(roundTripped[path]).toBe(values[0]);
        // Also verify the snake_case version keeps the same value
        const snake = toSnakeCase(original) as Record<string, unknown>;
        expect(snake[camelToSnake(path)]).toBe(values[0]);
      });
    }
  }
});
