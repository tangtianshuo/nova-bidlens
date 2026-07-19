/**
 * Workbench layout matching V0.2.2 prototype.
 * 3-row grid: taskbar (50px) | filterbar (46px) | work-grid (1fr)
 * Work-grid: 5-column CSS Grid with resizable nav and detail panels.
 */

import { useState, useCallback, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from '../../components/ui/icon-button';
import { Tooltip } from '../../components/ui/tooltip';

const STORAGE_KEY = 'bidlens-workbench-panels';

const MIN_LEFT = 200;
const MAX_LEFT = 360;
const MIN_RIGHT = 280;
const MAX_RIGHT = 420;
const DEFAULT_LEFT = 280;
const DEFAULT_RIGHT = 320;
const NAV_COLLAPSED_WIDTH = 52;

interface PanelSizes {
  left: number;
  right: number;
}

function loadPanelSizes(): PanelSizes {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.left === 'number' && typeof parsed.right === 'number') {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
}

function savePanelSizes(sizes: PanelSizes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Ignore
  }
}

interface WorkbenchLayoutProps {
  taskbar: React.ReactNode;
  filterbar: React.ReactNode;
  navPanel: React.ReactNode;
  viewport: React.ReactNode;
  detailPanel: React.ReactNode;
  className?: string;
}

export function WorkbenchLayout({
  taskbar,
  filterbar,
  navPanel,
  viewport,
  detailPanel,
  className,
}: WorkbenchLayoutProps) {
  const [sizes, setSizes] = useState<PanelSizes>(loadPanelSizes);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [autoRightCollapsed, setAutoRightCollapsed] = useState(false);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const [detailOverlay, setDetailOverlay] = useState(false);

  useEffect(() => {
    savePanelSizes(sizes);
  }, [sizes]);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setAutoRightCollapsed(w < 1120);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleMouseDown = useCallback(
    (panel: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(panel);
      const startX = e.clientX;
      const startSizes = { ...sizes };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        setSizes((prev) => {
          if (panel === 'left') {
            return { ...prev, left: Math.max(MIN_LEFT, Math.min(MAX_LEFT, startSizes.left + delta)) };
          } else {
            return { ...prev, right: Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, startSizes.right - delta)) };
          }
        });
      };

      const handleMouseUp = () => {
        setDragging(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [sizes]
  );

  const handleKeyDown = useCallback(
    (panel: 'left' | 'right') => (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 50 : 10;
      setSizes((prev) => {
        if (panel === 'left') {
          if (e.key === 'ArrowLeft') return { ...prev, left: Math.max(MIN_LEFT, prev.left - step) };
          if (e.key === 'ArrowRight') return { ...prev, left: Math.min(MAX_LEFT, prev.left + step) };
        } else {
          if (e.key === 'ArrowLeft') return { ...prev, right: Math.min(MAX_RIGHT, prev.right + step) };
          if (e.key === 'ArrowRight') return { ...prev, right: Math.max(MIN_RIGHT, prev.right - step) };
        }
        return prev;
      });
    },
    []
  );

  const showRight = !rightCollapsed && !autoRightCollapsed;
  const navWidth = leftCollapsed ? NAV_COLLAPSED_WIDTH : sizes.left;

  return (
    <div
      className={cn('grid overflow-hidden', className)}
      style={{ gridTemplateRows: '50px 46px minmax(0, 1fr)' }}
    >
      {/* Row 1: Taskbar */}
      <div className="flex items-center gap-2.5 px-3.5 bg-[var(--color-bg)] border-b border-[var(--color-border)]" style={{ minHeight: 50 }}>
        {taskbar}
        <div className="flex-1" />
        {/* Detail toggle (visible when detail panel is hidden) */}
        {(autoRightCollapsed || rightCollapsed) && (
          <Tooltip content="打开差异详情">
            <IconButton
              icon={<PanelRightOpen className="h-4 w-4" />}
              tooltip="打开差异详情"
              onClick={() => setDetailOverlay(true)}
              aria-label="打开差异详情"
            />
          </Tooltip>
        )}
      </div>

      {/* Row 2: Filter bar */}
      <div className="flex items-center gap-[7px] px-3.5 bg-[var(--color-bg)] border-b border-[var(--color-border)] overflow-hidden" style={{ minHeight: 46 }}>
        {filterbar}
      </div>

      {/* Row 3: Work grid */}
      <div
        className="grid min-h-0 overflow-hidden"
        style={{
          gridTemplateColumns: `${navWidth}px 5px minmax(560px, 1fr) 5px ${showRight ? sizes.right : 0}px`,
        }}
      >
        {/* Nav panel */}
        <div
          className="min-w-0 min-h-0 bg-[var(--color-bg)] border-r border-[var(--color-border)] overflow-hidden"
          role="region"
          aria-label="差异导航"
        >
          {/* Panel head */}
          <div className="flex items-center justify-between gap-2 px-3 border-b border-[var(--color-border)]" style={{ height: 42, fontSize: 12, fontWeight: 700 }}>
            {!leftCollapsed && <span>差异导航</span>}
            <Tooltip content={leftCollapsed ? '展开导航' : '折叠导航'}>
              <IconButton
                icon={leftCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
                tooltip={leftCollapsed ? '展开导航' : '折叠导航'}
                onClick={() => setLeftCollapsed(!leftCollapsed)}
                aria-label={leftCollapsed ? '展开导航' : '折叠导航'}
                className="h-6 w-6"
              />
            </Tooltip>
          </div>
          <div className="overflow-auto" style={{ height: 'calc(100% - 42px)' }}>
            {navPanel}
          </div>
        </div>

        {/* Left resizer */}
        {!leftCollapsed && (
          <div
            className={cn(
              'cursor-col-resize relative',
              'bg-[var(--color-bg-muted)] hover:bg-[var(--color-accent-soft)]',
              dragging === 'left' && 'bg-[var(--color-accent-soft)]'
            )}
            onMouseDown={handleMouseDown('left')}
            onKeyDown={handleKeyDown('left')}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整导航宽度"
            tabIndex={0}
          >
            <div className="absolute w-px bg-[var(--color-border-strong)]" style={{ width: 1, height: 34, left: 2, top: 'calc(50% - 17px)' }} />
          </div>
        )}
        {leftCollapsed && <div />}

        {/* Center viewport */}
        <div className="min-w-0 min-h-0 overflow-hidden bg-[var(--color-bg-muted)]">
          {viewport}
        </div>

        {/* Right resizer */}
        {showRight && (
          <div
            className={cn(
              'cursor-col-resize relative',
              'bg-[var(--color-bg-muted)] hover:bg-[var(--color-accent-soft)]',
              dragging === 'right' && 'bg-[var(--color-accent-soft)]'
            )}
            onMouseDown={handleMouseDown('right')}
            onKeyDown={handleKeyDown('right')}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整详情宽度"
            tabIndex={0}
          >
            <div className="absolute w-px bg-[var(--color-border-strong)]" style={{ width: 1, height: 34, left: 2, top: 'calc(50% - 17px)' }} />
          </div>
        )}
        {!showRight && <div />}

        {/* Detail panel */}
        {showRight && (
          <div
            className="min-w-0 min-h-0 bg-[var(--color-bg)] border-l border-[var(--color-border)] overflow-hidden"
            role="region"
            aria-label="差异详情"
          >
            {detailPanel}
          </div>
        )}
      </div>

      {/* Detail overlay mode (when auto-collapsed or manually collapsed) */}
      {detailOverlay && !showRight && (
        <div
          className="fixed inset-0 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailOverlay(false); }}
        >
          <div
            className="absolute top-[98px] right-0 bottom-0 bg-[var(--color-bg)] border-l border-[var(--color-border)]"
            style={{ width: 'min(390px, 42vw)', boxShadow: 'var(--shadow)' }}
          >
            {/* Close button */}
            <div className="flex items-center justify-between px-3 border-b border-[var(--color-border)]" style={{ height: 42, fontSize: 12, fontWeight: 700 }}>
              <span>差异详情</span>
              <Tooltip content="收起差异详情">
                <IconButton
                  icon={<PanelRightClose className="h-3.5 w-3.5" />}
                  tooltip="收起差异详情"
                  onClick={() => setDetailOverlay(false)}
                  aria-label="收起差异详情"
                  className="h-6 w-6"
                />
              </Tooltip>
            </div>
            <div className="overflow-auto" style={{ height: 'calc(100% - 42px)' }}>
              {detailPanel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
