import { ChevronLeft, ChevronRight, Minus, Plus, Maximize } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../components/ui/tooltip';

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
}

export function PdfToolbar({
  currentPage,
  totalPages,
  zoom,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onFitWidth,
}: PdfToolbarProps) {
  const btnClass = 'h-9 w-9';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 h-10 px-3 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
        {/* Page nav */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={onPrevPage}
              disabled={currentPage <= 1}
              aria-label="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>上一页</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              aria-label="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>下一页</TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums min-w-[3rem] text-center">
          {currentPage} / {totalPages}
        </span>

        {/* Zoom */}
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={onZoomOut}
              disabled={zoom <= 50}
              aria-label="缩小"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>缩小</TooltipContent>
        </Tooltip>
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums min-w-[2.5rem] text-center">
          {zoom}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={onZoomIn}
              disabled={zoom >= 200}
              aria-label="放大"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>放大</TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onClick={onFitWidth}
              aria-label="适应宽度"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>适应宽度</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
