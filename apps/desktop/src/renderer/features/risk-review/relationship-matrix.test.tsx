import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { RelationshipMatrix } from './relationship-matrix';
import { buildReadyScenario } from '../../__fixtures__/risk-project';

afterEach(cleanup);

describe('RelationshipMatrix', () => {
  it('renders table with grid role', () => {
    const project = buildReadyScenario();
    render(<RelationshipMatrix submissions={project.submissions} findings={project.findings} />);
    expect(screen.getByRole('grid')).toBeTruthy();
  });

  it('renders submission names as headers', () => {
    const project = buildReadyScenario();
    render(<RelationshipMatrix submissions={project.submissions} findings={project.findings} />);
    // Names are truncated in the matrix, check for partial matches
    const allText = screen.getAllByText(/公司/);
    expect(allText.length).toBeGreaterThanOrEqual(3);
  });

  it('renders diagonal cells with dash', () => {
    const project = buildReadyScenario();
    render(<RelationshipMatrix submissions={project.submissions} findings={project.findings} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(project.submissions.length);
  });

  it('renders similarity percentages in cells', () => {
    const project = buildReadyScenario();
    render(<RelationshipMatrix submissions={project.submissions} findings={project.findings} />);
    // Should have percentage values
    const percentages = screen.getAllByText(/%$/);
    expect(percentages.length).toBeGreaterThan(0);
  });

  it('calls onCellClick when a non-diagonal cell is clicked', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    const project = buildReadyScenario();
    render(
      <RelationshipMatrix
        submissions={project.submissions}
        findings={project.findings}
        onCellClick={onCellClick}
      />,
    );
    // Find a gridcell and click it
    const cells = screen.getAllByRole('gridcell');
    if (cells.length > 0) {
      await user.click(cells[0]);
      expect(onCellClick).toHaveBeenCalled();
    }
  });

  it('shows message when fewer than 2 submissions', () => {
    const subs = [buildReadyScenario().submissions[0]];
    render(<RelationshipMatrix submissions={subs} findings={[]} />);
    expect(screen.getByText(/至少需要 2 个文件/)).toBeTruthy();
  });

  it('supports keyboard navigation on cells', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    const project = buildReadyScenario();
    render(
      <RelationshipMatrix
        submissions={project.submissions}
        findings={project.findings}
        onCellClick={onCellClick}
      />,
    );
    const cells = screen.getAllByRole('gridcell');
    if (cells.length > 0) {
      cells[0].focus();
      await user.keyboard('{Enter}');
      expect(onCellClick).toHaveBeenCalled();
    }
  });
});
