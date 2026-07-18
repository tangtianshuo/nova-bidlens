/**
 * P4-18: Tests for review controls (status, importance, note).
 */

import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ReviewControls } from './review-controls';
import type { ReviewAnnotation } from '@bidlens/shared/types-only';

vi.mock('../../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('../../components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('../../components/ui/input', () => ({
  Textarea: ({ value, onChange, disabled, ...props }: any) => (
    <textarea value={value} onChange={onChange} disabled={disabled} {...props} />
  ),
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('ReviewControls', () => {
  beforeEach(cleanup);

  it('renders status buttons', () => {
    render(
      <ReviewControls
        matchId="m1"
        annotation={null}
        onSaveStatus={vi.fn()}
        onSaveImportant={vi.fn()}
        onSaveNote={vi.fn()}
      />
    );
    expect(screen.getByLabelText('确认')).toBeTruthy();
    expect(screen.getByLabelText('待确认')).toBeTruthy();
    expect(screen.getByLabelText('忽略')).toBeTruthy();
  });

  it('renders importance toggle', () => {
    render(
      <ReviewControls
        matchId="m1"
        annotation={null}
        onSaveStatus={vi.fn()}
        onSaveImportant={vi.fn()}
        onSaveNote={vi.fn()}
      />
    );
    expect(screen.getByLabelText('标记为重要')).toBeTruthy();
  });

  it('renders note textarea', () => {
    render(
      <ReviewControls
        matchId="m1"
        annotation={null}
        onSaveStatus={vi.fn()}
        onSaveImportant={vi.fn()}
        onSaveNote={vi.fn()}
      />
    );
    expect(screen.getByLabelText('审核备注')).toBeTruthy();
  });

  it('calls onSaveStatus when status button clicked', () => {
    const onSaveStatus = vi.fn();
    render(
      <ReviewControls
        matchId="m1"
        annotation={null}
        onSaveStatus={onSaveStatus}
        onSaveImportant={vi.fn()}
        onSaveNote={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('确认'));
    expect(onSaveStatus).toHaveBeenCalledWith('m1', 'confirmed');
  });

  it('toggles status back to unreviewed when same status clicked', () => {
    const onSaveStatus = vi.fn();
    const annotation: ReviewAnnotation = {
      id: 'a1',
      taskId: 't1',
      matchId: 'm1',
      status: 'confirmed',
      important: false,
      note: '',
      createdAt: '',
      updatedAt: '',
    };
    render(
      <ReviewControls
        matchId="m1"
        annotation={annotation}
        onSaveStatus={onSaveStatus}
        onSaveImportant={vi.fn()}
        onSaveNote={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('确认'));
    expect(onSaveStatus).toHaveBeenCalledWith('m1', 'unreviewed');
  });

  it('calls onSaveImportant when importance toggled', () => {
    const onSaveImportant = vi.fn();
    render(
      <ReviewControls
        matchId="m1"
        annotation={null}
        onSaveStatus={vi.fn()}
        onSaveImportant={onSaveImportant}
        onSaveNote={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('标记为重要'));
    expect(onSaveImportant).toHaveBeenCalledWith('m1', true);
  });

  it('shows "取消重要标记" when item is important', () => {
    const annotation: ReviewAnnotation = {
      id: 'a1',
      taskId: 't1',
      matchId: 'm1',
      status: 'unreviewed',
      important: true,
      note: '',
      createdAt: '',
      updatedAt: '',
    };
    render(
      <ReviewControls
        matchId="m1"
        annotation={annotation}
        onSaveStatus={vi.fn()}
        onSaveImportant={vi.fn()}
        onSaveNote={vi.fn()}
      />
    );
    expect(screen.getByLabelText('取消重要标记')).toBeTruthy();
  });

  it('autosaves note after debounce', async () => {
    vi.useFakeTimers();
    const onSaveNote = vi.fn();
    render(
      <ReviewControls
        matchId="m1"
        annotation={null}
        onSaveStatus={vi.fn()}
        onSaveImportant={vi.fn()}
        onSaveNote={onSaveNote}
      />
    );
    fireEvent.change(screen.getByLabelText('审核备注'), { target: { value: '测试备注' } });
    expect(onSaveNote).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(600); });
    expect(onSaveNote).toHaveBeenCalledWith('m1', '测试备注');
    vi.useRealTimers();
  });

  it('preloads note from annotation', () => {
    const annotation: ReviewAnnotation = {
      id: 'a1',
      taskId: 't1',
      matchId: 'm1',
      status: 'unreviewed',
      important: false,
      note: '已有备注',
      createdAt: '',
      updatedAt: '',
    };
    render(
      <ReviewControls
        matchId="m1"
        annotation={annotation}
        onSaveStatus={vi.fn()}
        onSaveImportant={vi.fn()}
        onSaveNote={vi.fn()}
      />
    );
    expect((screen.getByLabelText('审核备注') as HTMLTextAreaElement).value).toBe('已有备注');
  });
});
