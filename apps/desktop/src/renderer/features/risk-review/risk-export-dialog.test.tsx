import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { RiskExportDialog } from './risk-export-dialog';

afterEach(cleanup);

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: () => {},
  projectStatus: 'ready' as const,
  totalFindings: 10,
  confirmedFindings: 3,
  importantFindings: 2,
};

describe('RiskExportDialog', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<RiskExportDialog {...DEFAULT_PROPS} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog when isOpen is true', () => {
    render(<RiskExportDialog {...DEFAULT_PROPS} />);
    expect(screen.getByRole('dialog', { name: '导出报告' })).toBeTruthy();
  });

  it('renders format options', () => {
    render(<RiskExportDialog {...DEFAULT_PROPS} />);
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('HTML')).toBeTruthy();
    expect(screen.getByText('Markdown')).toBeTruthy();
  });

  it('renders scope options with counts', () => {
    render(<RiskExportDialog {...DEFAULT_PROPS} />);
    expect(screen.getByText('全部发现项')).toBeTruthy();
    expect(screen.getByText('已确认')).toBeTruthy();
    expect(screen.getByText('标记重要')).toBeTruthy();
  });

  it('defaults to PDF format', () => {
    render(<RiskExportDialog {...DEFAULT_PROPS} />);
    const pdfBtn = screen.getByText('PDF');
    expect(pdfBtn.closest('button')?.className).toContain('accent');
  });

  it('calls onExport with selected format and scope', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<RiskExportDialog {...DEFAULT_PROPS} onExport={onExport} />);
    await user.click(screen.getByText('导出 10 项'));
    expect(onExport).toHaveBeenCalledWith('pdf', 'full');
  });

  it('changes format when clicked', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<RiskExportDialog {...DEFAULT_PROPS} onExport={onExport} />);
    await user.click(screen.getByText('HTML'));
    await user.click(screen.getByText(/导出 \d+ 项/));
    expect(onExport).toHaveBeenCalledWith('html', 'full');
  });

  it('changes scope when clicked', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<RiskExportDialog {...DEFAULT_PROPS} onExport={onExport} />);
    await user.click(screen.getByText('已确认'));
    await user.click(screen.getByText('导出 3 项'));
    expect(onExport).toHaveBeenCalledWith('pdf', 'confirmed');
  });

  it('shows partial warning for partial project', () => {
    render(<RiskExportDialog {...DEFAULT_PROPS} projectStatus="partial" />);
    expect(screen.getByText(/分析结果不完整/)).toBeTruthy();
  });

  it('shows degraded warning for degraded project', () => {
    render(<RiskExportDialog {...DEFAULT_PROPS} projectStatus="degraded" />);
    expect(screen.getByText(/降级模式/)).toBeTruthy();
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RiskExportDialog {...DEFAULT_PROPS} onClose={onClose} />);
    await user.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });
});
