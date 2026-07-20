/**
 * Overlay focus recovery regression tests.
 *
 * Verifies that focus is restored to the trigger element after an overlay
 * (Dialog, AlertDialog, Sheet, Popover) is closed.  These tests use the real
 * Radix UI components — Radix handles focus trapping and restoration internally.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './dialog';
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

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Focus recovery: Dialog
// ---------------------------------------------------------------------------

describe('Dialog focus recovery', () => {
  it('returns focus to trigger after Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <Dialog>
          <DialogTrigger>打开对话框</DialogTrigger>
          <DialogContent>
            <DialogTitle>标题</DialogTitle>
            <DialogDescription>内容</DialogDescription>
          </DialogContent>
        </Dialog>
      </div>
    );

    const trigger = screen.getByText('打开对话框');
    await user.click(trigger);
    expect(screen.getByText('标题')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('内容')).toBeNull();

    // Radix restores focus to the trigger after close
    expect(trigger).toHaveFocus();
  });

  it('returns focus to trigger after clicking the close button', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <Dialog>
          <DialogTrigger>打开</DialogTrigger>
          <DialogContent>
            <DialogTitle>标题</DialogTitle>
            <DialogDescription>描述</DialogDescription>
          </DialogContent>
        </Dialog>
      </div>
    );

    const trigger = screen.getByText('打开');
    await user.click(trigger);
    expect(screen.getByText('标题')).toBeTruthy();

    // Radix renders an aria-label="关闭" button
    const closeButton = screen.getByLabelText('关闭');
    await user.click(closeButton);

    expect(trigger).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// Focus recovery: AlertDialog
// ---------------------------------------------------------------------------

describe('AlertDialog focus recovery', () => {
  it('returns focus to trigger after Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <AlertDialog>
          <AlertDialogTrigger>删除</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>确认删除?</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销。</AlertDialogDescription>
            <AlertDialogAction>确认</AlertDialogAction>
            <AlertDialogCancel>取消</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );

    const trigger = screen.getByText('删除');
    await user.click(trigger);
    expect(screen.getByText('确认删除?')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('此操作不可撤销。')).toBeNull();

    expect(trigger).toHaveFocus();
  });

  it('returns focus to trigger after clicking cancel', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <AlertDialog>
          <AlertDialogTrigger>删除</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>确认</AlertDialogTitle>
            <AlertDialogDescription>确定吗?</AlertDialogDescription>
            <AlertDialogAction>确认</AlertDialogAction>
            <AlertDialogCancel>取消</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );

    const trigger = screen.getByText('删除');
    await user.click(trigger);

    await user.click(screen.getByText('取消'));
    expect(trigger).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// Focus recovery: Sheet
// ---------------------------------------------------------------------------

describe('Sheet focus recovery', () => {
  it('returns focus to trigger after Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <Sheet>
          <SheetTrigger>打开面板</SheetTrigger>
          <SheetContent side="right">
            <SheetTitle>菜单</SheetTitle>
            <SheetDescription>导航面板</SheetDescription>
          </SheetContent>
        </Sheet>
      </div>
    );

    const trigger = screen.getByText('打开面板');
    await user.click(trigger);
    expect(screen.getByText('菜单')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('导航面板')).toBeNull();

    expect(trigger).toHaveFocus();
  });

  it('returns focus to trigger after clicking close', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <Sheet>
          <SheetTrigger>打开面板</SheetTrigger>
          <SheetContent>
            <SheetTitle>面板</SheetTitle>
            <SheetDescription>内容</SheetDescription>
          </SheetContent>
        </Sheet>
      </div>
    );

    const trigger = screen.getByText('打开面板');
    await user.click(trigger);

    const closeButton = screen.getByLabelText('关闭');
    await user.click(closeButton);

    expect(trigger).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// Focus recovery: Popover
// ---------------------------------------------------------------------------

describe('Popover focus recovery', () => {
  it('returns focus to trigger after Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <Popover>
          <PopoverTrigger>详情</PopoverTrigger>
          <PopoverContent>弹出内容</PopoverContent>
        </Popover>
      </div>
    );

    const trigger = screen.getByText('详情');
    await user.click(trigger);
    expect(screen.getByText('弹出内容')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('弹出内容')).toBeNull();

    expect(trigger).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// Multiple overlays: sequential open/close
// ---------------------------------------------------------------------------

describe('Sequential overlay focus recovery', () => {
  it('focus returns to correct trigger when two dialogs are used sequentially', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Dialog>
          <DialogTrigger>第一个</DialogTrigger>
          <DialogContent>
            <DialogTitle>对话框1</DialogTitle>
            <DialogDescription>内容1</DialogDescription>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger>第二个</DialogTrigger>
          <DialogContent>
            <DialogTitle>对话框2</DialogTitle>
            <DialogDescription>内容2</DialogDescription>
          </DialogContent>
        </Dialog>
      </div>
    );

    const trigger1 = screen.getByText('第一个');
    const trigger2 = screen.getByText('第二个');

    // Open and close first
    await user.click(trigger1);
    expect(screen.getByText('对话框1')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(trigger1).toHaveFocus();

    // Open and close second
    await user.click(trigger2);
    expect(screen.getByText('对话框2')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(trigger2).toHaveFocus();
  });
});
