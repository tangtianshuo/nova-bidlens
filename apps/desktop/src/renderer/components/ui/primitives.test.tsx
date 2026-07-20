/**
 * Keyboard and focus tests for shadcn UI primitives.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Button, buttonVariants } from './button';
import { Badge, badgeVariants } from './badge';
import { Separator } from './separator';
import { Skeleton } from './skeleton';

afterEach(cleanup);

describe('Button', () => {
  it('renders with default variant and size', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn).toBeTruthy();
    expect(btn.className).toContain('secondary');
  });

  it('renders with primary variant', () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole('button', { name: 'Primary' });
    expect(btn.className).toContain('accent');
  });

  it('renders with active variant', () => {
    render(<Button variant="active">Active</Button>);
    const btn = screen.getByRole('button', { name: 'Active' });
    // active variant uses accent-soft background
    expect(btn.className).toContain('accent-soft');
  });

  it('renders with icon size', () => {
    render(<Button size="icon" aria-label="icon btn">X</Button>);
    const btn = screen.getByRole('button', { name: 'icon btn' });
    // icon size sets fixed h-[34px] w-[34px]
    expect(btn.className).toContain('h-[34px]');
    expect(btn.className).toContain('w-[34px]');
  });

  it('is focusable via keyboard', async () => {
    const user = userEvent.setup();
    render(<Button>Focus me</Button>);
    const btn = screen.getByRole('button', { name: 'Focus me' });

    await user.tab();
    expect(btn).toHaveFocus();
  });

  it('activates on Enter key', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Enter</Button>);

    await user.tab();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates on Space key', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Space</Button>);

    await user.tab();
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is not focusable when disabled', async () => {
    const user = userEvent.setup();
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });

    await user.tab();
    expect(btn).not.toHaveFocus();
  });

  it('applies focus-visible ring classes', () => {
    render(<Button>Ring</Button>);
    const btn = screen.getByRole('button', { name: 'Ring' });
    expect(btn.className).toContain('focus-visible:ring-2');
  });

  it('supports asChild via Slot', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/test');
  });
});

describe('buttonVariants', () => {
  it('returns a class string for valid variant/size', () => {
    const cls = buttonVariants({ variant: 'primary', size: 'sm' });
    expect(typeof cls).toBe('string');
    expect(cls.length).toBeGreaterThan(0);
  });
});

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.tagName).toBe('SPAN');
  });

  it('renders semantic diff variants', () => {
    const { rerender } = render(<Badge variant="added">Added</Badge>);
    expect(screen.getByText('Added').className).toContain('added');

    rerender(<Badge variant="deleted">Deleted</Badge>);
    expect(screen.getByText('Deleted').className).toContain('deleted');

    rerender(<Badge variant="modified">Modified</Badge>);
    expect(screen.getByText('Modified').className).toContain('modified');

    rerender(<Badge variant="uncertain">Uncertain</Badge>);
    // uncertain uses muted text color
    expect(screen.getByText('Uncertain').className).toContain('text-muted');
  });

  it('renders risk variants', () => {
    const { rerender } = render(<Badge variant="risk-high">High</Badge>);
    expect(screen.getByText('High').className).toContain('risk-high');

    rerender(<Badge variant="risk-medium">Medium</Badge>);
    expect(screen.getByText('Medium').className).toContain('risk-medium');

    rerender(<Badge variant="risk-low">Low</Badge>);
    expect(screen.getByText('Low').className).toContain('risk-low');
  });

  it('renders table variant', () => {
    render(<Badge variant="table">Table</Badge>);
    expect(screen.getByText('Table').className).toContain('table');
  });
});

describe('badgeVariants', () => {
  it('returns a class string for each variant', () => {
    const variants = [
      'default', 'accent', 'added', 'deleted', 'modified',
      'uncertain', 'table', 'risk-high', 'risk-medium', 'risk-low',
    ] as const;
    for (const v of variants) {
      const cls = badgeVariants({ variant: v });
      expect(typeof cls).toBe('string');
      expect(cls.length).toBeGreaterThan(0);
    }
  });
});

describe('Separator', () => {
  it('renders horizontal by default', () => {
    const { container } = render(<Separator />);
    const sep = container.firstChild as HTMLElement;
    expect(sep.getAttribute('data-orientation')).toBe('horizontal');
  });

  it('renders vertical when specified', () => {
    const { container } = render(<Separator orientation="vertical" />);
    const sep = container.firstChild as HTMLElement;
    expect(sep.getAttribute('data-orientation')).toBe('vertical');
  });

  it('has decorative role by default', () => {
    const { container } = render(<Separator />);
    const sep = container.firstChild as HTMLElement;
    expect(sep.getAttribute('role')).toBe('none');
  });
});

describe('Skeleton', () => {
  it('renders a div with animate-pulse', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('animate-pulse');
  });

  it('accepts custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-full');
  });
});

describe('Tab navigation across components', () => {
  it('tabs through multiple buttons in order', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Button>First</Button>
        <Button>Second</Button>
        <Button disabled>Nope</Button>
        <Button>Third</Button>
      </div>
    );

    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();

    // Disabled button is skipped
    await user.tab();
    expect(screen.getByRole('button', { name: 'Third' })).toHaveFocus();
  });
});
