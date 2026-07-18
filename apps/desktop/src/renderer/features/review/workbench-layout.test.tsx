/**
 * P4-18: Tests for workbench layout with resizable panels.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WorkbenchLayout } from './workbench-layout';

vi.mock('../../components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
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

describe('WorkbenchLayout', () => {
  beforeEach(cleanup);

  it('renders three panels', () => {
    render(
      <WorkbenchLayout
        leftPanel={<div>Left Panel</div>}
        centerPanel={<div>Center Panel</div>}
        rightPanel={<div>Right Panel</div>}
      />
    );
    expect(screen.getByText('Left Panel')).toBeTruthy();
    expect(screen.getByText('Center Panel')).toBeTruthy();
    expect(screen.getByText('Right Panel')).toBeTruthy();
  });

  it('renders collapse buttons', () => {
    render(
      <WorkbenchLayout
        leftPanel={<div>Left</div>}
        centerPanel={<div>Center</div>}
        rightPanel={<div>Right</div>}
      />
    );
    expect(screen.getByLabelText('折叠左侧面板')).toBeTruthy();
    expect(screen.getByLabelText('折叠右侧面板')).toBeTruthy();
  });

  it('has region landmarks', () => {
    const { container } = render(
      <WorkbenchLayout
        leftPanel={<div>Left</div>}
        centerPanel={<div>Center</div>}
        rightPanel={<div>Right</div>}
      />
    );
    const regions = container.querySelectorAll('[role="region"]');
    expect(regions.length).toBeGreaterThanOrEqual(2);
  });
});
