import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from './top-bar';

// Mock the stores
vi.mock('../../stores/app-store', () => ({
  useAppStore: vi.fn(() => ({
    view: 'new',
    setView: vi.fn(),
  })),
}));

// Mock the theme module
vi.mock('../../lib/theme', () => ({
  getThemePreference: vi.fn(() => 'system'),
  setThemePreference: vi.fn(),
  watchSystemTheme: vi.fn(() => vi.fn()),
}));

// Mock the settings dialog to avoid Radix portal issues in tests
vi.mock('../../features/settings/settings-dialog', () => ({
  SettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="settings-dialog-mock">Settings Dialog Open</div> : null,
}));

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the brand name', () => {
    render(<TopBar />);
    expect(screen.getByText('BidLens')).toBeDefined();
  });

  it('renders new comparison button', () => {
    render(<TopBar />);
    const buttons = screen.getAllByLabelText('新建比对');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders history button', () => {
    render(<TopBar />);
    const buttons = screen.getAllByLabelText('最近比对');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders theme toggle button', () => {
    render(<TopBar />);
    const buttons = screen.getAllByLabelText(/切换主题/);
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders settings button', () => {
    render(<TopBar />);
    const buttons = screen.getAllByLabelText('打开设置');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens settings dialog when settings button is clicked', () => {
    render(<TopBar />);
    const settingsButton = screen.getAllByLabelText('打开设置')[0];
    fireEvent.click(settingsButton);
    expect(screen.getByTestId('settings-dialog-mock')).toBeDefined();
  });
});
