import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { EvidenceViewport } from './evidence-viewport';
import type { Evidence } from '../../__fixtures__/risk-project';

afterEach(cleanup);

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'ev-test-001',
    submissionId: 'sub-1',
    blockIndex: 42,
    originalText: '本项目拟投入技术人员共计15人',
    normalizedText: '本项目拟投入技术人员共计15人',
    matchBasis: 'semantic',
    similarityScore: 0.92,
    contextBefore: '（三）项目团队配置',
    contextAfter: '（四）质量保证措施',
    tenderFiltered: false,
    tenderFilterReason: null,
    ...overrides,
  };
}

describe('EvidenceViewport', () => {
  it('shows empty state when no evidence', () => {
    render(<EvidenceViewport evidence={[]} submissionNames={new Map()} />);
    expect(screen.getByText('选择一个发现项查看证据')).toBeTruthy();
  });

  it('renders evidence count', () => {
    const evidence = [makeEvidence({ id: 'ev1' }), makeEvidence({ id: 'ev2' })];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    expect(screen.getByText('2 条证据')).toBeTruthy();
  });

  it('renders evidence original text', () => {
    const evidence = [makeEvidence()];
    render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
    expect(screen.getByText(/本项目拟投入技术人员共计15人/)).toBeTruthy();
  });

  it('renders submission name from map', () => {
    const evidence = [makeEvidence({ submissionId: 'sub-1' })];
    const names = new Map([['sub-1', 'A公司投标文件.docx']]);
    render(<EvidenceViewport evidence={evidence} submissionNames={names} />);
    expect(screen.getByText('A公司投标文件.docx')).toBeTruthy();
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
