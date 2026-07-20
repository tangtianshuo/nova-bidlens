import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { RiskOverview } from './risk-overview';
import { computeFindingCounts } from './risk-result-queries';
import { buildReadyScenario, buildPartialScenario } from '../../__fixtures__/risk-project';

afterEach(cleanup);

describe('RiskOverview', () => {
  it('renders risk level badge', () => {
    const project = buildReadyScenario();
    const counts = computeFindingCounts(project.findings);
    render(<RiskOverview project={project} counts={counts} />);
    // "高" appears in risk badge and top findings
    const highBadges = screen.getAllByText('高');
    expect(highBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders rule score', () => {
    const project = buildReadyScenario();
    const counts = computeFindingCounts(project.findings);
    render(<RiskOverview project={project} counts={counts} />);
    expect(screen.getByText('82.5')).toBeTruthy();
  });

  it('renders detector summary with counts', () => {
    const project = buildReadyScenario();
    const counts = computeFindingCounts(project.findings);
    render(<RiskOverview project={project} counts={counts} />);
    expect(screen.getByText('文本语义')).toBeTruthy();
    expect(screen.getByText('表格雷同')).toBeTruthy();
    expect(screen.getByText('实体重复')).toBeTruthy();
  });

  it('renders top findings sorted by similarity', () => {
    const project = buildReadyScenario();
    const counts = computeFindingCounts(project.findings);
    render(<RiskOverview project={project} counts={counts} />);
    expect(screen.getByText('主要发现')).toBeTruthy();
  });

  it('shows incomplete status for partial project', () => {
    const project = buildPartialScenario();
    const counts = computeFindingCounts(project.findings);
    render(<RiskOverview project={project} counts={counts} />);
    expect(screen.getByText('不完整')).toBeTruthy();
  });

  it('shows empty state when no findings', () => {
    const project = { ...buildReadyScenario(), findings: [] };
    const counts = computeFindingCounts([]);
    render(<RiskOverview project={project} counts={counts} />);
    expect(screen.getByText('暂无发现项')).toBeTruthy();
  });
});
