import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { EvidenceViewport } from './evidence-viewport';
import type { Evidence } from '../../__fixtures__/risk-project';

afterEach(cleanup);

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'ev-test-001',
    detectorType: 'text',
    matchBasis: 'semantic',
    similarityScore: 0.92,
    sourceSubmissionId: 'sub-1',
    sourceNodeId: 'node-42',
    sourceOriginalText: '本项目拟投入技术人员共计15人',
    sourceNormalizedText: '本项目拟投入技术人员共计15人',
    sourceSectionPath: [],
    sourcePageRange: null,
    sourceTableLocation: null,
    targetSubmissionId: 'sub-2',
    targetNodeId: 'node-42',
    targetOriginalText: '本项目拟投入技术人员共计15人',
    targetNormalizedText: '本项目拟投入技术人员共计15人',
    targetSectionPath: [],
    targetPageRange: null,
    targetTableLocation: null,
    contextBefore: '（三）项目团队配置',
    contextAfter: '（四）质量保证措施',
    tenderFiltered: false,
    tenderFilterReason: null,
    ruleVersion: '1.0.0',
    ...overrides,
  };
}

describe('EvidenceViewport', () => {
  it('shows empty state when no evidence', () => {
    render(<EvidenceViewport evidence={[]} submissionNames={new Map()} />);
    expect(screen.getByText('该发现项暂无证据')).toBeTruthy();
  });

  it('renders evidence count', () => {
    const evidence = [makeEvidence({ id: 'ev1' }), makeEvidence({ id: 'ev2' })];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    expect(screen.getByText('2 条证据')).toBeTruthy();
  });

  it('renders evidence original text', () => {
    const evidence = [makeEvidence()];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    // Text appears in both source and target blocks
    const matches = screen.getAllByText(/本项目拟投入技术人员共计15人/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders submission names from map', () => {
    const evidence = [makeEvidence({ sourceSubmissionId: 'sub-1', targetSubmissionId: 'sub-2' })];
    const names = new Map([['sub-1', 'A公司投标文件.docx'], ['sub-2', 'B公司投标文件.docx']]);
    render(<EvidenceViewport evidence={evidence} submissionNames={names} />);
    expect(screen.getByText('A公司投标文件.docx')).toBeTruthy();
    expect(screen.getByText('B公司投标文件.docx')).toBeTruthy();
  });

  it('renders similarity score', () => {
    const evidence = [makeEvidence({ similarityScore: 0.85 })];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('renders match basis badge', () => {
    const evidence = [makeEvidence({ matchBasis: 'lexical' })];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    expect(screen.getByText('词法')).toBeTruthy();
  });

  it('renders tender filter notice', () => {
    const evidence = [makeEvidence({ tenderFiltered: true, tenderFilterReason: '招标文件公共段落' })];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    expect(screen.getByText(/已过滤招标公共内容/)).toBeTruthy();
  });

  it('has region role with aria-label', () => {
    const evidence = [makeEvidence()];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    expect(screen.getByRole('region', { name: '证据视图' })).toBeTruthy();
  });
});
