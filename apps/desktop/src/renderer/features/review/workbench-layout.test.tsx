/**
 * Tests for workbench layout with resizable panels.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WorkbenchLayout } from './workbench-layout';

vi.mock('../../components/ui/icon-button', () => ({
  IconButton: ({ icon, tooltip, ...props }: any) => (
    <button title={tooltip} {...props}>{icon}</button>
  ),
}));

vi.mock('../../components/ui/tooltip', () => ({
  Tooltip: ({ children, content }: any) => (
    <div title={typeof content === 'string' ? content : ''}>{children}</div>
  ),
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const defaultProps = {
  taskbar: <div>Taskbar</div>,
  filterbar: <div>Filterbar</div>,
  navPanel: <div>Nav Panel</div>,
  viewport: <div>Viewport</div>,
  detailPanel: <div>Detail Panel</div>,
};

describe('WorkbenchLayout', () => {
  beforeEach(cleanup);

  it('renders taskbar, filterbar, nav, and viewport', () => {
    const { container } = render(<WorkbenchLayout {...defaultProps} />);
    expect(screen.getByText('Taskbar')).toBeTruthy();
    expect(screen.getByText('Filterbar')).toBeTruthy();
    expect(screen.getByText('Nav Panel')).toBeTruthy();
    expect(screen.getByText('Viewport')).toBeTruthy();
    expect(container.querySelector('.workbench-taskbar')).not.toBeNull();
    expect(container.querySelector('.workbench-filterbar')).not.toBeNull();

    const workGrid = container.querySelector('.grid.min-h-0') as HTMLElement;
    expect(workGrid.style.gridTemplateColumns).toContain('minmax(0, 1fr)');
  });

  it('renders detail panel when window is wide enough', () => {
    // Set a wide viewport so detail panel is visible
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    render(<WorkbenchLayout {...defaultProps} />);
    expect(screen.getByText('Detail Panel')).toBeTruthy();
  });

  it('hides detail panel on narrow viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
    render(<WorkbenchLayout {...defaultProps} />);
    expect(screen.queryByText('Detail Panel')).toBeNull();
  });

  it('renders collapse button', () => {
    render(<WorkbenchLayout {...defaultProps} />);
    expect(screen.getByLabelText('折叠导航')).toBeTruthy();
  });

  it('has region landmarks', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    const { container } = render(<WorkbenchLayout {...defaultProps} />);
    const regions = container.querySelectorAll('[role="region"]');
    expect(regions.length).toBeGreaterThanOrEqual(2);
  });
});
