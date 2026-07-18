/**
 * P4-08: Resizable/collapsible workbench panels.
 * Three-panel layout: left navigation, center viewport, right details.
 * Panel sizes persist to localStorage.
 */

import { useState, useCallback, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Tooltip } from '../../components/ui/tooltip';

// Storage key for panel sizes
const STORAGE_KEY = 'bidlens-workbench-panels';

// Minimum panel widths (px)
const MIN_LEFT = 200;
const MIN_CENTER = 560;
const MIN_RIGHT = 280;

// Default sizes
const DEFAULT_LEFT = 280;
const DEFAULT_RIGHT = 320;

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
    // Ignore parse errors
  }
  return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
}

function savePanelSizes(sizes: PanelSizes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Ignore storage errors
  }
}

interface WorkbenchLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  className?: string;
}

export function WorkbenchLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  className,
}: WorkbenchLayoutProps) {
  const [sizes, setSizes] = useState<PanelSizes>(loadPanelSizes);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [autoRightCollapsed, setAutoRightCollapsed] = useState(false);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

  // Persist sizes on change
  useEffect(() => {
    savePanelSizes(sizes);
  }, [sizes]);

  useEffect(() => {
    const updateResponsiveState = () => setAutoRightCollapsed(window.innerWidth < 1120);
    updateResponsiveState();
    window.addEventListener('resize', updateResponsiveState);
    return () => window.removeEventListener('resize', updateResponsiveState);
  }, []);

  // Handle drag resize
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
            const newLeft = Math.max(MIN_LEFT, startSizes.left + delta);
            return { ...prev, left: newLeft };
          } else {
            const newRight = Math.max(MIN_RIGHT, startSizes.right - delta);
            return { ...prev, right: newRight };
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

  // Keyboard resize (arrow keys when focused on resizer)
  const handleKeyDown = useCallback(
    (panel: 'left' | 'right') => (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 50 : 10;
      setSizes((prev) => {
        if (panel === 'left') {
          if (e.key === 'ArrowLeft') return { ...prev, left: Math.max(MIN_LEFT, prev.left - step) };
          if (e.key === 'ArrowRight') return { ...prev, left: prev.left + step };
        } else {
          if (e.key === 'ArrowLeft') return { ...prev, right: prev.right + step };
          if (e.key === 'ArrowRight') return { ...prev, right: Math.max(MIN_RIGHT, prev.right - step) };
        }
        return prev;
      });
    },
    []
  );

  return (
    <div className={cn('flex h-full overflow-hidden', className)}>
      {/* Left panel */}
      {!leftCollapsed && (
        <div
          className="flex-shrink-0 border-r border-[var(--color-border)] overflow-hidden"
          style={{ width: sizes.left }}
          role="region"
          aria-label="差异导航"
        >
          {leftPanel}
        </div>
      )}

      {/* Left resizer */}
      <div
        className={cn(
          'w-1 cursor-col-resize hover:bg-[var(--color-accent)]/20 transition-colors flex-shrink-0',
          dragging === 'left' && 'bg-[var(--color-accent)]/30'
        )}
        onMouseDown={handleMouseDown('left')}
        onKeyDown={handleKeyDown('left')}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整左侧面板宽度"
        tabIndex={0}
      />

      {/* Center panel */}
      <div
        className="flex-1 overflow-hidden min-w-0"
        role="region"
        aria-label="比对视图"
      >
        {/* Collapse/expand controls */}
        <div className="flex items-center gap-1 h-8 px-2 border-b border-[var(--color-border)]">
          <Tooltip content={leftCollapsed ? '展开导航' : '折叠导航'}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              aria-label={leftCollapsed ? '展开左侧面板' : '折叠左侧面板'}
              className="h-6 w-6 p-0"
            >
              {leftCollapsed ? (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" />
              )}
            </Button>
          </Tooltip>

          <div className="flex-1" />

          <Tooltip content={rightCollapsed ? '展开详情' : '折叠详情'}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightCollapsed(!rightCollapsed)}
              aria-label={(rightCollapsed || autoRightCollapsed) ? '展开右侧面板' : '折叠右侧面板'}
              className="h-6 w-6 p-0"
            >
              {rightCollapsed || autoRightCollapsed ? (
                <PanelRightOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelRightClose className="h-3.5 w-3.5" />
              )}
            </Button>
          </Tooltip>
        </div>

        <div className="h-[calc(100%-2rem)] overflow-auto">
          {centerPanel}
        </div>
      </div>

      {/* Right resizer */}
      {!rightCollapsed && !autoRightCollapsed && (
        <div
          className={cn(
            'w-1 cursor-col-resize hover:bg-[var(--color-accent)]/20 transition-colors flex-shrink-0',
            dragging === 'right' && 'bg-[var(--color-accent)]/30'
          )}
          onMouseDown={handleMouseDown('right')}
          onKeyDown={handleKeyDown('right')}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整右侧面板宽度"
          tabIndex={0}
        />
      )}

      {/* Right panel */}
      {!rightCollapsed && !autoRightCollapsed && (
        <div
          className="flex-shrink-0 border-l border-[var(--color-border)] overflow-hidden"
          style={{ width: sizes.right }}
          role="region"
          aria-label="详情面板"
        >
          {rightPanel}
        </div>
      )}
    </div>
  );
}
