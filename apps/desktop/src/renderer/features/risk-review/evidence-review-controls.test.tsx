import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { EvidenceReviewControls } from './evidence-review-controls';

afterEach(cleanup);

describe('EvidenceReviewControls', () => {
  it('shows current status badge', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
      />,
    );
    expect(screen.getByText('待确认')).toBeTruthy();
  });

  it('shows confirmed status', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="confirmed"
        reviewNote=""
      />,
    );
    expect(screen.getByText('已确认')).toBeTruthy();
  });

  it('shows confirm, ignore, and important buttons', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
      />,
    );
    expect(screen.getByText('确认雷同')).toBeTruthy();
    expect(screen.getByText('忽略')).toBeTruthy();
    expect(screen.getByText('标记重要')).toBeTruthy();
  });

  it('calls onStatusChange with confirmed when confirm clicked', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
        onStatusChange={onStatusChange}
      />,
    );
    await user.click(screen.getByText('确认雷同'));
    expect(onStatusChange).toHaveBeenCalledWith('f1', 'confirmed');
  });

  it('calls onStatusChange with ignored when ignore clicked', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
        onStatusChange={onStatusChange}
      />,
    );
    await user.click(screen.getByText('忽略'));
    expect(onStatusChange).toHaveBeenCalledWith('f1', 'ignored');
  });

  it('calls onImportantChange when important clicked', async () => {
    const user = userEvent.setup();
    const onImportantChange = vi.fn();
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
        onImportantChange={onImportantChange}
      />,
    );
    await user.click(screen.getByText('标记重要'));
    expect(onImportantChange).toHaveBeenCalledWith('f1', true);
  });

  it('shows reset button when status is not pending', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="confirmed"
        reviewNote=""
      />,
    );
    expect(screen.getByText('重置')).toBeTruthy();
  });

  it('hides reset button when status is pending', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
      />,
    );
    expect(screen.queryByText('重置')).toBeNull();
  });

  it('disables confirm button when already confirmed', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="confirmed"
        reviewNote=""
      />,
    );
    expect(screen.getByText('确认雷同').closest('button')).toBeDisabled();
  });

  it('renders note textarea', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote="测试备注"
      />,
    );
    expect(screen.getByDisplayValue('测试备注')).toBeTruthy();
  });

  it('calls onNoteChange when note changes', async () => {
    const user = userEvent.setup();
    const onNoteChange = vi.fn();
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
        onNoteChange={onNoteChange}
      />,
    );
    const textarea = screen.getByPlaceholderText(/添加复核备注/);
    await user.type(textarea, '新');
    expect(onNoteChange).toHaveBeenCalledWith('f1', '新');
  });

  it('has region role', () => {
    render(
      <EvidenceReviewControls
        findingId="f1"
        currentStatus="pending"
        reviewNote=""
      />,
    );
    expect(screen.getByRole('region', { name: '人工复核' })).toBeTruthy();
  });
});
