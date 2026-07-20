import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { NewProjectPage } from './new-project-page';
import { ProjectNameField } from './project-name-field';
import { TenderBaselineSlot } from './tender-baseline-slot';

afterEach(cleanup);

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
    // The label span contains "招标基线文件" and "(可选)"
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

  it('disables submit when name is empty', () => {
    render(<NewProjectPage />);
    const btn = screen.getByRole('button', { name: /下一步/ });
    expect(btn).toBeDisabled();
  });

  it('enables submit when name is valid', async () => {
    const user = userEvent.setup();
    render(<NewProjectPage />);
    await user.type(screen.getByLabelText(/项目名称/), '测试项目');
    const btn = screen.getByRole('button', { name: /下一步/ });
    expect(btn).not.toBeDisabled();
  });

  it('calls onSubmit with form data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NewProjectPage onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/项目名称/), '测试项目');
    await user.click(screen.getByRole('button', { name: /下一步/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: '测试项目',
      baseline: null,
    });
  });

  it('shows hint when submit is disabled', () => {
    render(<NewProjectPage />);
    expect(screen.getByText(/请输入项目名称后继续/)).toBeTruthy();
  });

  it('hides hint when submit is enabled', async () => {
    const user = userEvent.setup();
    render(<NewProjectPage />);
    await user.type(screen.getByLabelText(/项目名称/), '测试项目');
    expect(screen.queryByText(/请输入项目名称后继续/)).toBeNull();
  });

  it('shows no-baseline warning on the page', () => {
    render(<NewProjectPage />);
    expect(screen.getByText(/误报风险较高/)).toBeTruthy();
  });

  it('includes placeholder for submission files', () => {
    render(<NewProjectPage />);
    expect(screen.getByText(/投标文件将在下一步添加/)).toBeTruthy();
  });
});
