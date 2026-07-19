import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { NewCompareView } from './new-compare-view';

// Mock the stores using vi.hoisted + zustand-compatible selector pattern
const { mockStartTask } = vi.hoisted(() => ({
  mockStartTask: vi.fn(),
}));

const mockStoreState = { startTask: mockStartTask };

vi.mock('../../stores/app-store', () => ({
  useAppStore: (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

describe('NewCompareView', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    // Mock window.bidlens
    (window as any).bidlens = {
      selectFile: vi.fn(),
    };
  });

  it('renders the heading', () => {
    render(<NewCompareView />);
    expect(screen.getByText('新建比对')).toBeDefined();
  });

  it('renders the description', () => {
    render(<NewCompareView />);
    expect(screen.getByText('文档内容仅在本机处理')).toBeDefined();
  });

  it('renders baseline slot label', () => {
    render(<NewCompareView />);
    expect(screen.getByText('基准文档')).toBeDefined();
  });

  it('renders review slot label', () => {
    render(<NewCompareView />);
    expect(screen.getByText('审查文档')).toBeDefined();
  });

  it('renders file selection prompts', () => {
    render(<NewCompareView />);
    const selectButtons = screen.getAllByText('点击选择文件');
    expect(selectButtons.length).toBe(2);
  });

  it('disables start button when no files selected', () => {
    render(<NewCompareView />);
    const startButton = screen.getByText('开始比对').closest('button');
    expect(startButton).toBeDefined();
    expect(startButton?.hasAttribute('disabled')).toBe(true);
  });

  it('renders swap button', () => {
    render(<NewCompareView />);
    expect(screen.getByLabelText('交换基准和审查文档')).toBeDefined();
  });

  it('renders advanced settings toggle', () => {
    render(<NewCompareView />);
    const buttons = screen.getAllByText('高级设置');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows sensitivity options when advanced settings expanded', () => {
    render(<NewCompareView />);
    // Click the advanced settings toggle to expand
    const toggle = screen.getByText('高级设置');
    fireEvent.click(toggle);
    // Now the sensitivity options should be visible
    expect(screen.getByText('严格')).toBeDefined();
    expect(screen.getByText('标准')).toBeDefined();
    expect(screen.getByText('宽松')).toBeDefined();
  });

  it('validates files and starts a real comparison task', async () => {
    const selectFile = vi.fn()
      .mockResolvedValueOnce({ path: 'a.docx', name: 'a.docx', size: 10, format: 'docx' })
      .mockResolvedValueOnce({ path: 'b.docx', name: 'b.docx', size: 12, format: 'docx' });
    const validateFiles = vi.fn().mockResolvedValue({
      fileA: { supported: true },
      fileB: { supported: true },
      crossFormatDegradation: [],
    });
    const startCompare = vi.fn().mockResolvedValue({ taskId: 'task-real' });
    (window as any).bidlens = { selectFile, validateFiles, startCompare };
    render(<NewCompareView />);

    const selectButtons = screen.getAllByText('点击选择文件');
    fireEvent.click(selectButtons[0]);
    await waitFor(() => expect(screen.getByText('a.docx')).toBeDefined());
    fireEvent.click(screen.getAllByText('点击选择文件')[0]);
    await waitFor(() => expect(screen.getByText('b.docx')).toBeDefined());
    fireEvent.click(screen.getByText('开始比对'));

    await waitFor(() => expect(mockStartTask).toHaveBeenCalledWith('task-real'));
    expect(validateFiles).toHaveBeenCalledWith({ fileAPath: 'a.docx', fileBPath: 'b.docx' });
    expect(startCompare).toHaveBeenCalledWith({
      fileAPath: 'a.docx',
      fileBPath: 'b.docx',
      options: { sensitivity: 'standard' },
    });
  });
});
