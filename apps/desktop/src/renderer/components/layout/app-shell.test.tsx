import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';

// Mock the TopBar component
vi.mock('./top-bar', () => ({
  TopBar: () => <div data-testid="top-bar-mock">TopBar</div>,
}));

describe('AppShell', () => {
  it('renders the top bar', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    expect(screen.getByTestId('top-bar-mock')).toBeDefined();
  });

  it('renders children in the content area', () => {
    render(
      <AppShell>
        <div data-testid="child-content">Test Content</div>
      </AppShell>,
    );
    expect(screen.getByTestId('child-content')).toBeDefined();
  });

  it('applies grid layout with 56px top bar', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell.style.gridTemplateRows).toBe('56px minmax(0, 1fr)');
  });

  it('has h-full class for full height', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain('h-full');
  });
});
