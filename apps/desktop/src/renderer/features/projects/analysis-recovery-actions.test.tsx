import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AnalysisRecoveryActions } from './analysis-recovery-actions';

afterEach(cleanup);

// ─── Visibility ─────────────────────────────────────────────────────

describe('AnalysisRecoveryActions', () => {
  it('renders nothing for ready status without degradation', () => {
    const { container } = render(
      <AnalysisRecoveryActions
        status="ready"
        degradationReason={null}
        warnings={[]}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for running status', () => {
    const { container } = render(
      <AnalysisRecoveryActions
        status="running"
        degradationReason={null}
        warnings={[]}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for draft status', () => {
    const { container } = render(
      <AnalysisRecoveryActions
        status="draft"
        degradationReason={null}
        warnings={[]}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

// ─── Failed state ───────────────────────────────────────────────────

describe('AnalysisRecoveryActions - failed', () => {
  it('shows failure message', () => {
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={['分析过程中出现错误']}
      />,
    );
    expect(screen.getByText('分析失败')).toBeTruthy();
    expect(screen.getByText(/已处理的检查点已保留/)).toBeTruthy();
  });

  it('shows retry button', () => {
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={[]}
      />,
    );
    expect(screen.getByText('重试分析')).toBeTruthy();
  });

  it('shows back button', () => {
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={[]}
      />,
    );
    expect(screen.getByText('返回项目列表')).toBeTruthy();
  });

  it('calls onAction with retry when retry clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={[]}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByText('重试分析'));
    expect(onAction).toHaveBeenCalledWith('retry');
  });

  it('calls onAction with cancel when back clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={[]}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByText('返回项目列表'));
    expect(onAction).toHaveBeenCalledWith('cancel');
  });

  it('displays warnings', () => {
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={['模型加载超时', '磁盘空间不足']}
      />,
    );
    expect(screen.getByText(/模型加载超时/)).toBeTruthy();
    expect(screen.getByText(/磁盘空间不足/)).toBeTruthy();
  });

  it('shows elapsed time when provided', () => {
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={[]}
        elapsedMs={65000}
      />,
    );
    expect(screen.getByText(/1分5秒/)).toBeTruthy();
  });
});

// ─── Interrupted state ──────────────────────────────────────────────

describe('AnalysisRecoveryActions - interrupted', () => {
  it('shows interrupted message', () => {
    render(
      <AnalysisRecoveryActions
        status="interrupted"
        degradationReason={null}
        warnings={[]}
      />,
    );
    expect(screen.getByText('分析已中断')).toBeTruthy();
    expect(screen.getByText(/从最近检查点恢复/)).toBeTruthy();
  });

  it('shows resume and restart buttons', () => {
    render(
      <AnalysisRecoveryActions
        status="interrupted"
        degradationReason={null}
        warnings={[]}
      />,
    );
    expect(screen.getByText('恢复分析')).toBeTruthy();
    expect(screen.getByText('重新开始')).toBeTruthy();
  });

  it('calls onAction with resume when resume clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AnalysisRecoveryActions
        status="interrupted"
        degradationReason={null}
        warnings={[]}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByText('恢复分析'));
    expect(onAction).toHaveBeenCalledWith('resume');
  });

  it('calls onAction with retry when restart clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AnalysisRecoveryActions
        status="interrupted"
        degradationReason={null}
        warnings={[]}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByText('重新开始'));
    expect(onAction).toHaveBeenCalledWith('retry');
  });
});

// ─── Partial state ──────────────────────────────────────────────────

describe('AnalysisRecoveryActions - partial', () => {
  it('shows partial results message', () => {
    render(
      <AnalysisRecoveryActions
        status="partial"
        degradationReason="user_accepted_partial"
        warnings={[]}
      />,
    );
    expect(screen.getByText('部分结果可用')).toBeTruthy();
    expect(screen.getByText('不完整')).toBeTruthy();
  });

  it('shows view partial results button when hasPartialResults', () => {
    render(
      <AnalysisRecoveryActions
        status="partial"
        degradationReason="user_accepted_partial"
        warnings={[]}
        hasPartialResults
      />,
    );
    expect(screen.getByText('查看部分结果')).toBeTruthy();
  });

  it('hides view partial results button when no partial results', () => {
    render(
      <AnalysisRecoveryActions
        status="partial"
        degradationReason="user_accepted_partial"
        warnings={[]}
        hasPartialResults={false}
      />,
    );
    expect(screen.queryByText('查看部分结果')).toBeNull();
  });

  it('calls onAction with accept-partial when view clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AnalysisRecoveryActions
        status="partial"
        degradationReason="user_accepted_partial"
        warnings={[]}
        hasPartialResults
        onAction={onAction}
      />,
    );
    await user.click(screen.getByText('查看部分结果'));
    expect(onAction).toHaveBeenCalledWith('accept-partial');
  });

  it('shows re-analyze and continue buttons', () => {
    render(
      <AnalysisRecoveryActions
        status="partial"
        degradationReason="user_accepted_partial"
        warnings={[]}
      />,
    );
    expect(screen.getByText('重新分析')).toBeTruthy();
    expect(screen.getByText('继续分析')).toBeTruthy();
  });
});

// ─── Degraded state ─────────────────────────────────────────────────

describe('AnalysisRecoveryActions - degraded', () => {
  it('shows model unavailable degradation banner', () => {
    render(
      <AnalysisRecoveryActions
        status="ready"
        degradationReason="model_unavailable"
        warnings={[]}
      />,
    );
    expect(screen.getByText('本地模型不可用')).toBeTruthy();
    expect(screen.getByText(/传统匹配模式/)).toBeTruthy();
  });

  it('shows memory pressure degradation banner', () => {
    render(
      <AnalysisRecoveryActions
        status="ready"
        degradationReason="memory_pressure"
        warnings={[]}
      />,
    );
    expect(screen.getByText('内存不足')).toBeTruthy();
  });

  it('shows network error degradation banner', () => {
    render(
      <AnalysisRecoveryActions
        status="ready"
        degradationReason="network_error"
        warnings={[]}
      />,
    );
    expect(screen.getByText('网络异常')).toBeTruthy();
  });

  it('shows generic degradation for unknown reason', () => {
    render(
      <AnalysisRecoveryActions
        status="ready"
        degradationReason="unknown_reason"
        warnings={[]}
      />,
    );
    expect(screen.getByText('降级运行')).toBeTruthy();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe('AnalysisRecoveryActions - accessibility', () => {
  it('has region role with aria-label', () => {
    render(
      <AnalysisRecoveryActions
        status="failed"
        degradationReason={null}
        warnings={[]}
      />,
    );
    const region = screen.getByRole('region', { name: '分析恢复操作' });
    expect(region).toBeTruthy();
  });
});
