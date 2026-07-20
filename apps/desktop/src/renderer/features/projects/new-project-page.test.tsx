import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { NewProjectPage } from './new-project-page';
import { ProjectNameField } from './project-name-field';
import { TenderBaselineSlot } from './tender-baseline-slot';
import type { SubmissionFile } from './submission-file-list';

afterEach(cleanup);

// ─── Helpers ────────────────────────────────────────────────────────

function makeSubmission(overrides: Partial<SubmissionFile> = {}): SubmissionFile {
  return {
    id: `file-${Math.random().toString(36).slice(2, 8)}`,
    name: '投标文件.docx',
    format: 'docx',
    sizeBytes: 2_500_000,
    pageCount: 120,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

const VALID_SUBMISSIONS: SubmissionFile[] = [
  makeSubmission({ id: 'f1', name: 'A公司.docx', sha256: 'a'.repeat(64) }),
  makeSubmission({ id: 'f2', name: 'B公司.docx', sha256: 'b'.repeat(64) }),
];

// ─── ProjectNameField ──────────────────────────────────────────────────

describe('ProjectNameField', () => {
  it('renders label and input', () => {
    render(<ProjectNameField value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/项目名称/)).toBeTruthy();
  });

  it('shows required error on blur when empty', async () => {
    const user = userEvent.setup();
    render(<ProjectNameField value="" onChange={() => {}} />);
    const input = screen.getByLabelText(/项目名称/);
    await user.click(input);
    await user.tab(); // blur
    expect(screen.getByRole('alert').textContent).toContain('不能为空');
  });

  it('shows min-length error on blur when too short', async () => {
    const user = userEvent.setup();
    render(<ProjectNameField value="a" onChange={() => {}} />);
    const input = screen.getByLabelText(/项目名称/);
    await user.click(input);
    await user.tab();
    expect(screen.getByRole('alert').textContent).toContain('至少');
  });

  it('does not show error before blur (untouched)', () => {
    render(<ProjectNameField value="" onChange={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides error when value becomes valid', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProjectNameField value="" onChange={() => {}} />);
    const input = screen.getByLabelText(/项目名称/);
    await user.click(input);
    await user.tab(); // blur, triggers touched
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(<ProjectNameField value="测试项目" onChange={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ─── TenderBaselineSlot ────────────────────────────────────────────────

describe('TenderBaselineSlot', () => {
  it('shows warning when no file is selected', () => {
    render(<TenderBaselineSlot value={null} onChange={() => {}} />);
    expect(screen.getByRole('alert').textContent).toContain('误报风险较高');
  });

  it('shows click prompt when empty', () => {
    render(<TenderBaselineSlot value={null} onChange={() => {}} />);
    expect(screen.getByText(/点击选择或拖放/)).toBeTruthy();
  });

  it('shows file info after selection', () => {
    render(
      <TenderBaselineSlot
        value={{ name: '招标文件.docx', format: 'docx', sizeBytes: 2_500_000 }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('招标文件.docx')).toBeTruthy();
    expect(screen.getByText(/DOCX/)).toBeTruthy();
    expect(screen.getByText(/MB/)).toBeTruthy();
  });

  it('hides warning when file is selected', () => {
    render(
      <TenderBaselineSlot
        value={{ name: 'test.docx', format: 'docx', sizeBytes: 1000 }}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls onChange(null) on remove click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TenderBaselineSlot
        value={{ name: 'test.docx', format: 'docx', sizeBytes: 1000 }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /移除基线文件/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows label with optional indicator', () => {
    const { container } = render(<TenderBaselineSlot value={null} onChange={() => {}} />);
    const label = container.querySelector('span.text-sm.font-medium');
    expect(label?.textContent).toContain('招标基线文件');
    expect(label?.textContent).toContain('可选');
  });
});

// ─── NewProjectPage ────────────────────────────────────────────────────

describe('NewProjectPage', () => {
  it('renders page title', () => {
    render(<NewProjectPage />);
    expect(screen.getByText('新建项目')).toBeTruthy();
  });

  it('disables submit when name is empty and no files', () => {
    render(<NewProjectPage />);
    const btn = screen.getByRole('button', { name: /下一步/ });
    expect(btn).toBeDisabled();
  });

  it('shows file list component with empty state', () => {
    render(<NewProjectPage />);
    expect(screen.getByText(/拖放投标文件到此处/)).toBeTruthy();
  });

  it('shows hint to enter project name when empty', () => {
    render(<NewProjectPage />);
    expect(screen.getByText(/请输入项目名称后继续/)).toBeTruthy();
  });

  it('shows hint to add files when name is valid but no files', async () => {
    const user = userEvent.setup();
    render(<NewProjectPage />);
    await user.type(screen.getByLabelText(/项目名称/), '测试项目');
    expect(screen.getByText(/请添加至少 2 个投标文件/)).toBeTruthy();
  });
});
