import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from './top-bar';

const mockSetMode = vi.fn();
const mockSetView = vi.fn();

// Mock the stores
vi.mock('../../stores/app-store', () => ({
  useAppStore: vi.fn(() => ({
    mode: 'risk-review',
    view: 'new',
    setMode: mockSetMode,
    setView: mockSetView,
  })),
}));

// Mock SimpleTooltip to avoid TooltipProvider dependency
vi.mock('../ui/tooltip', () => ({
  SimpleTooltip: ({ children, content: _content }: { children: React.ReactNode; content: string }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    (window as any).bidlens = {
      windowMinimize: vi.fn().mockResolvedValue(undefined),
      windowMaximize: vi.fn().mockResolvedValue(undefined),
      windowClose: vi.fn().mockResolvedValue(undefined),
      windowIsMaximized: vi.fn().mockResolvedValue(false),
      onMaximizeChanged: vi.fn().mockReturnValue(() => {}),
    };
  });

  it('renders the brand name', () => {
    render(<TopBar />);
    expect(screen.getByText('BidLens')).toBeDefined();
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

  it('renders window control buttons', () => {
    render(<TopBar />);
    expect(screen.getAllByLabelText('最小化').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText(/最大化|还原/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('关闭').length).toBeGreaterThanOrEqual(1);
  });

  it('opens settings dialog when settings button is clicked', () => {
    render(<TopBar />);
    const settingsButton = screen.getAllByLabelText('打开设置')[0];
    fireEvent.click(settingsButton);
    expect(screen.getByTestId('settings-dialog-mock')).toBeDefined();
  });

});
