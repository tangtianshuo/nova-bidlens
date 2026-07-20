import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DetectionPreset, DETECTION_PRESETS } from './detection-preset';

afterEach(cleanup);

// ─── Preset selection ───────────────────────────────────────────────

describe('DetectionPreset', () => {
  it('renders all three presets', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    expect(screen.getByText('严格')).toBeTruthy();
    expect(screen.getByText('标准')).toBeTruthy();
    expect(screen.getByText('宽松')).toBeTruthy();
  });

  it('shows recommended badge on standard preset', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    expect(screen.getByText('推荐')).toBeTruthy();
  });

  it('calls onChange when preset is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DetectionPreset
        value="standard"
        onChange={onChange}
        submissionCount={3}
        hasBaseline
      />,
    );
    await user.click(screen.getByText('严格'));
    expect(onChange).toHaveBeenCalledWith('strict');
  });

  it('shows detail text for selected preset', () => {
    render(
      <DetectionPreset
        value="strict"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    expect(screen.getByText(/更高召回/)).toBeTruthy();
    // Detail should be visible for selected
    expect(screen.getByText(/相似度阈值更低/)).toBeTruthy();
  });

  it('does not show detail text for unselected presets', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    // Strict detail should not be visible when standard is selected
    expect(screen.queryByText(/相似度阈值更低/)).toBeNull();
  });
});

// ─── Launch section ─────────────────────────────────────────────────

describe('DetectionPreset launch section', () => {
  it('shows submission count and baseline status', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={5}
        hasBaseline
      />,
    );
    expect(screen.getByText(/5 个投标文件/)).toBeTruthy();
    expect(screen.getByText(/招标基线/)).toBeTruthy();
  });

  it('shows no-baseline warning when baseline is absent', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline={false}
      />,
    );
    const warnings = screen.getAllByText(/未提供招标基线/);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('hides no-baseline warning when baseline is present', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    expect(screen.queryByText(/未提供招标基线文件/)).toBeNull();
  });

  it('shows start button', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    expect(screen.getByText('开始分析')).toBeTruthy();
  });

  it('disables start button when canStart is false', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
        canStart={false}
        startDisabledReason="文件验证未通过"
      />,
    );
    const btn = screen.getByText('开始分析');
    expect(btn.closest('button')).toBeDisabled();
  });

  it('shows disabled reason when canStart is false', () => {
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
        canStart={false}
        startDisabledReason="文件验证未通过"
      />,
    );
    expect(screen.getByText('文件验证未通过')).toBeTruthy();
  });
});

// ─── Confirmation dialog ────────────────────────────────────────────

describe('DetectionPreset confirmation dialog', () => {
  it('shows confirmation dialog when start clicked', async () => {
    const user = userEvent.setup();
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    await user.click(screen.getByText('开始分析'));
    expect(screen.getByText('确认开始分析')).toBeTruthy();
    expect(screen.getByText(/雷同性分析/)).toBeTruthy();
  });

  it('calls onStartAnalysis when confirmed', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <DetectionPreset
        value="strict"
        onChange={() => {}}
        onStartAnalysis={onStart}
        submissionCount={5}
        hasBaseline
      />,
    );
    await user.click(screen.getByText('开始分析'));
    await user.click(screen.getByText('确认开始'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('closes dialog when cancel clicked', async () => {
    const user = userEvent.setup();
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    await user.click(screen.getByText('开始分析'));
    expect(screen.getByText('确认开始分析')).toBeTruthy();
    await user.click(screen.getByText('取消'));
    expect(screen.queryByText('确认开始分析')).toBeNull();
  });

  it('shows baseline info in confirmation when baseline present', async () => {
    const user = userEvent.setup();
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline
      />,
    );
    await user.click(screen.getByText('开始分析'));
    expect(screen.getByText(/已关联招标基线文件/)).toBeTruthy();
  });

  it('shows no-baseline warning in confirmation when baseline absent', async () => {
    const user = userEvent.setup();
    render(
      <DetectionPreset
        value="standard"
        onChange={() => {}}
        submissionCount={3}
        hasBaseline={false}
      />,
    );
    await user.click(screen.getByText('开始分析'));
    // Dialog + launch section both show baseline warnings
    const warnings = screen.getAllByText(/未提供招标基线/);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Preset definitions ─────────────────────────────────────────────

describe('DETECTION_PRESETS', () => {
  it('defines exactly 3 presets', () => {
    expect(DETECTION_PRESETS).toHaveLength(3);
  });

  it('has strict > standard > loose ordering', () => {
    expect(DETECTION_PRESETS[0].id).toBe('strict');
    expect(DETECTION_PRESETS[1].id).toBe('standard');
    expect(DETECTION_PRESETS[2].id).toBe('loose');
  });

  it('each preset has required fields', () => {
    for (const preset of DETECTION_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.detail).toBeTruthy();
      expect(preset.icon).toBeTruthy();
    }
  });
});
