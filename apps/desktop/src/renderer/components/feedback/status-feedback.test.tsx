/**
 * Tests for StatusBadge, PersistentBanner, PageState, LoadingButton.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { RiskBadge, StatusBadge, ReviewBadge } from './status-badge';
import { PersistentBanner } from './persistent-banner';
import { PageState } from './page-state';
import { LoadingButton } from './loading-button';

afterEach(cleanup);

// -- RiskBadge --

describe('RiskBadge', () => {
  const levels = ['high', 'medium', 'low'] as const;

  for (const level of levels) {
    it(`renders ${level} risk with icon and label`, () => {
      render(<RiskBadge level={level} />);
      const badge = screen.getByText(
        level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'
      );
      expect(badge).toBeTruthy();
      // Badge should have an SVG icon sibling
      const svg = badge.parentElement?.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  }

  it('applies risk-high variant class', () => {
    const { container } = render(<RiskBadge level="high" />);
    expect(container.querySelector('[class*="risk-high"]')).toBeTruthy();
  });

  it('applies risk-medium variant class', () => {
    const { container } = render(<RiskBadge level="medium" />);
    expect(container.querySelector('[class*="risk-medium"]')).toBeTruthy();
  });

  it('applies risk-low variant class', () => {
    const { container } = render(<RiskBadge level="low" />);
    expect(container.querySelector('[class*="risk-low"]')).toBeTruthy();
  });
});

// -- StatusBadge --

describe('StatusBadge', () => {
  const terminalStatuses = [
    { status: 'ready' as const, label: '已完成' },
    { status: 'partial' as const, label: '部分结果' },
    { status: 'interrupted' as const, label: '已中断' },
    { status: 'failed' as const, label: '失败' },
  ];

  for (const { status, label } of terminalStatuses) {
    it(`renders ${status} with label "${label}"`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    });
  }

  const spinnerStatuses = [
    'validating',
    'parsing',
    'filtering',
    'embedding',
    'retrieving',
    'detecting',
    'aggregating',
  ] as const;

  for (const status of spinnerStatuses) {
    it(`renders ${status} with spinning icon`, () => {
      const { container } = render(<StatusBadge status={status} />);
      const spinIcon = container.querySelector('.animate-spin');
      expect(spinIcon).toBeTruthy();
    });
  }

  it('ready status does not have spinning icon', () => {
    const { container } = render(<StatusBadge status="ready" />);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});

// -- ReviewBadge --

describe('ReviewBadge', () => {
  const statuses = [
    { status: 'pending' as const, label: '待审查' },
    { status: 'confirmed' as const, label: '已确认' },
    { status: 'ignored' as const, label: '已忽略' },
    { status: 'important' as const, label: '重要' },
  ];

  for (const { status, label } of statuses) {
    it(`renders ${status} with label "${label}"`, () => {
      render(<ReviewBadge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    });
  }
});

// -- PersistentBanner --

describe('PersistentBanner', () => {
  it('renders warning variant with title', () => {
    render(<PersistentBanner title="降级提示" />);
    expect(screen.getByText('降级提示')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders info variant', () => {
    render(<PersistentBanner variant="info" title="提示" />);
    expect(screen.getByText('提示')).toBeTruthy();
  });

  it('renders children content', () => {
    render(
      <PersistentBanner title="Warning">
        <span>Details here</span>
      </PersistentBanner>
    );
    expect(screen.getByText('Details here')).toBeTruthy();
  });

  it('is not dismissable by default', () => {
    render(<PersistentBanner title="No dismiss" />);
    expect(screen.queryByLabelText('关闭')).toBeNull();
  });

  it('shows dismiss button when dismissable', () => {
    render(<PersistentBanner title="Dismiss me" dismissable />);
    expect(screen.getByLabelText('关闭')).toBeTruthy();
  });

  it('hides on dismiss click', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <PersistentBanner title="Bye" dismissable onDismiss={onDismiss} />
    );

    await user.click(screen.getByLabelText('关闭'));
    expect(screen.queryByText('Bye')).toBeNull();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('hides when hidden prop is true', () => {
    render(<PersistentBanner title="Hidden" hidden />);
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('is visible when hidden prop is false', () => {
    render(<PersistentBanner title="Visible" hidden={false} />);
    expect(screen.getByText('Visible')).toBeTruthy();
  });
});

// -- PageState --

describe('PageState', () => {
  it('renders loading state with skeleton', () => {
    const { container } = render(<PageState variant="loading" />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders loading with custom title for aria-label', () => {
    render(<PageState variant="loading" title="加载项目" />);
    expect(screen.getByLabelText('加载项目')).toBeTruthy();
  });

  it('renders empty state', () => {
    render(<PageState variant="empty" />);
    expect(screen.getByText('暂无数据')).toBeTruthy();
  });

  it('renders empty with custom title and description', () => {
    render(
      <PageState
        variant="empty"
        title="没有项目"
        description="请先创建一个分析项目"
      />
    );
    expect(screen.getByText('没有项目')).toBeTruthy();
    expect(screen.getByText('请先创建一个分析项目')).toBeTruthy();
  });

  it('renders error state', () => {
    render(<PageState variant="error" />);
    expect(screen.getByText('加载失败')).toBeTruthy();
  });

  it('renders error with action button', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <PageState variant="error" actionLabel="重试" onAction={onRetry} />
    );

    const btn = screen.getByText('重试');
    expect(btn).toBeTruthy();
    await user.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders interrupt state with default recovery button', () => {
    render(<PageState variant="interrupt" />);
    expect(screen.getByText('分析已中断')).toBeTruthy();
    expect(screen.getByText('恢复分析')).toBeTruthy();
  });

  it('renders interrupt with custom action label', () => {
    render(
      <PageState variant="interrupt" actionLabel="重新开始" onAction={() => {}} />
    );
    expect(screen.getByText('重新开始')).toBeTruthy();
  });

  it('renders children content', () => {
    render(
      <PageState variant="empty">
        <p>Custom child</p>
      </PageState>
    );
    expect(screen.getByText('Custom child')).toBeTruthy();
  });
});

// -- LoadingButton --

describe('LoadingButton', () => {
  it('renders children normally', () => {
    render(<LoadingButton>Submit</LoadingButton>);
    expect(screen.getByText('Submit')).toBeTruthy();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('shows spinner and disables when loading', () => {
    const { container } = render(<LoadingButton loading>Save</LoadingButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('sets aria-busy when loading', () => {
    render(<LoadingButton loading>Save</LoadingButton>);
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
  });

  it('does not set aria-busy when not loading', () => {
    render(<LoadingButton>Save</LoadingButton>);
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull();
  });

  it('can be disabled independently of loading', () => {
    render(<LoadingButton disabled>Disabled</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button').querySelector('.animate-spin')).toBeNull();
  });

  it('fires onClick when not loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<LoadingButton onClick={onClick}>Click</LoadingButton>);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when loading (disabled)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <LoadingButton loading onClick={onClick}>
        Click
      </LoadingButton>
    );

    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
