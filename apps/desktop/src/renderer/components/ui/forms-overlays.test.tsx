/**
 * Tests for form, overlay, and data surface components.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { FormMessage } from './form-message';
import { Alert, AlertTitle, AlertDescription } from './alert';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from './sheet';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from './popover';
import { Checkbox } from './checkbox';
import { RadioGroup, RadioGroupItem } from './radio-group';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './select';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './collapsible';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from './pagination';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './table';
import { FieldError } from '../feedback/field-error';

afterEach(cleanup);

// -- FormMessage --

describe('FormMessage', () => {
  it('renders with role="alert" for screen reader announcement', () => {
    render(<FormMessage>Required field</FormMessage>);
    const msg = screen.getByRole('alert');
    expect(msg.textContent).toBe('Required field');
  });

  it('renders error variant by default', () => {
    render(<FormMessage>Error text</FormMessage>);
    const msg = screen.getByRole('alert');
    expect(msg.className).toContain('deleted');
  });

  it('renders description variant', () => {
    render(<FormMessage variant="description">Help text</FormMessage>);
    const msg = screen.getByRole('alert');
    expect(msg.className).toContain('muted');
  });

  it('supports custom className', () => {
    render(<FormMessage className="mt-1">Text</FormMessage>);
    const msg = screen.getByRole('alert');
    expect(msg.className).toContain('mt-1');
  });
});

// -- FieldError (updated to use FormMessage) --

describe('FieldError', () => {
  it('renders error message with alert role', () => {
    render(<FieldError message="Name is required" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Name is required');
  });

  it('includes an alert icon', () => {
    const { container } = render(<FieldError message="Error" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});

// -- Alert --

describe('Alert', () => {
  it('renders with role="alert"', () => {
    render(<Alert>Warning message</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Warning message');
  });

  it('renders destructive variant', () => {
    render(<Alert variant="destructive">Error</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('deleted');
  });

  it('renders warning variant', () => {
    render(<Alert variant="warning">Caution</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('modified');
  });

  it('renders with title and description', () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>You can add components to your app.</AlertDescription>
      </Alert>
    );
    expect(screen.getByText('Heads up').tagName).toBe('H5');
    expect(screen.getByText('You can add components to your app.')).toBeTruthy();
  });
});

// -- AlertDialog --

describe('AlertDialog', () => {
  it('opens on trigger click and shows content', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          <AlertDialogAction>Confirm</AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    );

    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Are you sure?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });

  it('closes on cancel click', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm</AlertDialogTitle>
          <AlertDialogDescription>Are you sure?</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    );

    await user.click(screen.getByText('Delete'));
    expect(screen.getByText('Confirm')).toBeTruthy();

    await user.click(screen.getByText('Cancel'));
    // After cancel, the content should be removed from DOM
    expect(screen.queryByText('Are you sure?')).toBeNull();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Dialog</AlertDialogTitle>
          <AlertDialogDescription>Press escape</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    );

    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Dialog')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Press escape')).toBeNull();
  });
});

// -- Sheet --

describe('Sheet', () => {
  it('opens on trigger click and shows content', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side="right">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navigation panel</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Menu')).toBeTruthy();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Panel</SheetTitle>
          <SheetDescription>Content here</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Panel')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Content here')).toBeNull();
  });
});

// -- Popover --

describe('Popover', () => {
  it('opens on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Click me</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    );

    await user.click(screen.getByText('Click me'));
    expect(screen.getByText('Popover content')).toBeTruthy();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Details</PopoverContent>
      </Popover>
    );

    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Details')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Details')).toBeNull();
  });
});

// -- Checkbox --

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    const { container } = render(<Checkbox aria-label="Accept" />);
    const checkbox = container.querySelector('[role="checkbox"]');
    expect(checkbox).toBeTruthy();
    expect(checkbox?.getAttribute('data-state')).toBe('unchecked');
  });

  it('toggles on click', async () => {
    const user = userEvent.setup();
    const { container } = render(<Checkbox aria-label="Accept" />);
    const checkbox = container.querySelector('[role="checkbox"]')!;

    await user.click(checkbox);
    expect(checkbox.getAttribute('data-state')).toBe('checked');
  });

  it('toggles via keyboard (Space)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Checkbox aria-label="Accept" />);
    const checkbox = container.querySelector('[role="checkbox"]')!;

    await user.tab();
    expect(checkbox).toHaveFocus();

    await user.keyboard(' ');
    expect(checkbox.getAttribute('data-state')).toBe('checked');

    await user.keyboard(' ');
    expect(checkbox.getAttribute('data-state')).toBe('unchecked');
  });

  it('can be set to checked by default', () => {
    const { container } = render(<Checkbox defaultChecked aria-label="Pre-checked" />);
    const checkbox = container.querySelector('[role="checkbox"]');
    expect(checkbox?.getAttribute('data-state')).toBe('checked');
  });
});

// -- RadioGroup --

describe('RadioGroup', () => {
  it('renders items', () => {
    const { container } = render(
      <RadioGroup>
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    );
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(2);
  });

  it('selects item on click', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RadioGroup>
        <RadioGroupItem value="a" aria-label="A" />
        <RadioGroupItem value="b" aria-label="B" />
      </RadioGroup>
    );
    const radios = container.querySelectorAll('[role="radio"]');

    await user.click(radios[1]);
    expect(radios[1].getAttribute('data-state')).toBe('checked');
    expect(radios[0].getAttribute('data-state')).toBe('unchecked');
  });

  it('renders with defaultValue pre-selected', () => {
    const { container } = render(
      <RadioGroup defaultValue="b">
        <RadioGroupItem value="a" aria-label="A" />
        <RadioGroupItem value="b" aria-label="B" />
        <RadioGroupItem value="c" aria-label="C" />
      </RadioGroup>
    );
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios[0].getAttribute('data-state')).toBe('unchecked');
    expect(radios[1].getAttribute('data-state')).toBe('checked');
    expect(radios[2].getAttribute('data-state')).toBe('unchecked');
  });
});

// -- Select (jsdom has known pointer-events issues with Radix Select portals) --

describe('Select', () => {
  it('renders trigger with placeholder', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Apple</SelectItem>
          <SelectItem value="b">Banana</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByText('Pick one')).toBeTruthy();
  });

  it('trigger is focusable via keyboard', async () => {
    const user = userEvent.setup();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="x">X</SelectItem>
        </SelectContent>
      </Select>
    );

    await user.tab();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('trigger has combobox role', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByRole('combobox')).toBeTruthy();
  });
});

// -- Collapsible --

describe('Collapsible', () => {
  it('toggles content visibility on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>
    );

    // Content should be hidden initially
    expect(screen.queryByText('Hidden content')).toBeNull();

    await user.click(screen.getByText('Toggle'));
    expect(screen.getByText('Hidden content')).toBeTruthy();

    await user.click(screen.getByText('Toggle'));
    // Content should be hidden again after second click
    expect(screen.queryByText('Hidden content')).toBeNull();
  });

  it('toggles via keyboard (Space)', async () => {
    const user = userEvent.setup();
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Details</CollapsibleContent>
      </Collapsible>
    );

    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByText('Details')).toBeTruthy();

    await user.keyboard(' ');
    expect(screen.queryByText('Details')).toBeNull();
  });
});

// -- Pagination --

describe('Pagination', () => {
  it('renders navigation with aria-label', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );

    const nav = screen.getByRole('navigation');
    expect(nav.getAttribute('aria-label')).toBe('pagination');
  });

  it('marks active page link', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#" isActive>2</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );

    const link = screen.getByText('2');
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('previous and next links have aria-labels', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );

    expect(screen.getByLabelText('Go to previous page')).toBeTruthy();
    expect(screen.getByLabelText('Go to next page')).toBeTruthy();
  });
});

// -- Table --

describe('Table', () => {
  it('renders a semantic table structure', () => {
    render(
      <Table>
        <TableCaption>Test table</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('Test table').tagName).toBe('CAPTION');
    expect(screen.getByText('Name').tagName).toBe('TH');
    expect(screen.getByText('Alpha').tagName).toBe('TD');
  });

  it('renders multiple rows', () => {
    render(
      <Table>
        <TableBody>
          <TableRow><TableCell>A</TableCell></TableRow>
          <TableRow><TableCell>B</TableCell></TableRow>
          <TableRow><TableCell>C</TableCell></TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
  });
});
