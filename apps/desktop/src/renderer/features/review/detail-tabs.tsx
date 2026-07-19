/**
 * P4-10: Detail/Format/Source Comments/Revisions tabs.
 * Shows capability-aware tabs for viewing diff details.
 * Tabs reflect actual capability states (supported/unsupported/degraded).
 */

import { useState } from 'react';
import { FileText, Type, MessageSquare, GitBranch, Info } from 'lucide-react';
import type { DiffItem, CapabilityResult, FormatDiffResult, TextFormatChange } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { InlineDiff } from './inline-diff';
import { formatDiffSummary, resolveTextDiffTokens } from './diff-presentation';

interface DetailTabsProps {
  item: DiffItem;
  capabilities: CapabilityResult[];
  className?: string;
}

interface TabDef {
  id: string;
  label: string;
  icon: typeof FileText;
  dimension: string;
}

const TABS: TabDef[] = [
  { id: 'detail', label: '详情', icon: Info, dimension: 'content' },
  { id: 'format', label: '格式', icon: Type, dimension: 'format' },
  { id: 'comments', label: '批注', icon: MessageSquare, dimension: 'comment' },
  { id: 'revisions', label: '修订', icon: GitBranch, dimension: 'revision' },
];

function getCapabilityState(capabilities: CapabilityResult[], dimension: string): string {
  return capabilities.find((c) => c.dimension === dimension)?.state ?? 'unsupported';
}

function getTabState(tab: TabDef, capabilities: CapabilityResult[]): string {
  // Text detail is rendered locally from engine tokens or source text, so it is
  // available independently of the optional document capability dimensions.
  if (tab.id === 'detail') return 'supported';
  return getCapabilityState(capabilities, tab.dimension);
}

function CapabilityBadge({ state }: { state: string }) {
  if (state === 'supported') return null;
  if (state === 'unsupported') {
    return (
      <Badge variant="default" className="text-xs h-4 px-1">
        不支持
      </Badge>
    );
  }
  if (state === 'degraded') {
    return (
      <Badge variant="default" className="text-xs h-4 px-1 text-[var(--color-warning)]">
        降级
      </Badge>
    );
  }
  return null;
}

function DetailContent({ item }: { item: DiffItem }) {
  const tokens = resolveTextDiffTokens(item);
  if (tokens.length === 0) {
    return (
      <div className="space-y-2 p-4 text-sm text-[var(--color-text-muted)]">
        <p>{item.matchType === 'identical' ? '内容一致，无需展示字符级差异。' : '当前差异缺少可用于字符级对比的正文内容。'}</p>
        <p className="text-xs">可在中央文档视图中检查结构或表格变化。</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <InlineDiff tokens={tokens} />

      <div className="border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">
        <strong>摘要：</strong>{formatDiffSummary(item)}
      </div>
    </div>
  );
}

function FormatContent({ item }: { item: DiffItem }) {
  const formatDiff = item.formatDiff as FormatDiffResult | undefined;
  const changes: TextFormatChange[] = formatDiff
    ? [...formatDiff.textFormatChanges, ...formatDiff.paragraphFormatChanges]
    : [];

  if (changes.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-muted)]">
        无格式差异
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {changes.map((change, i) => (
        <div
          key={i}
          className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--color-border)] last:border-0"
        >
          <span className="text-[var(--color-text-muted)]">{change.property}</span>
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-deleted)] line-through">{String(change.oldValue)}</span>
            <span className="text-[var(--color-text-muted)]">→</span>
            <span className="text-[var(--color-added)]">{String(change.newValue)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentsContent() {
  return (
    <div className="p-4 text-sm text-[var(--color-text-muted)]">
      源文档批注将在后续版本中显示
    </div>
  );
}

function RevisionsContent() {
  return (
    <div className="p-4 text-sm text-[var(--color-text-muted)]">
      修订记录将在后续版本中显示
    </div>
  );
}

export function DetailTabs({ item, capabilities, className }: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState('detail');

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={cn('h-full flex flex-col', className)}
    >
      <TabsList className="border-b border-[var(--color-border)] rounded-none bg-transparent px-2" style={{ height: 42 }}>
        {TABS.map((tab) => {
          const state = getTabState(tab, capabilities);
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'rounded-none border-0 border-b-2 border-transparent text-[11px] gap-1 data-[state=active]:border-[var(--color-accent)] data-[state=active]:font-bold data-[state=active]:text-[var(--color-text)]',
                state === 'unsupported' && 'cursor-not-allowed text-[var(--color-disabled-text)]'
              )}
              style={{ height: 41, padding: '0 7px' }}
              disabled={state === 'unsupported'}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
              <CapabilityBadge state={state} />
            </TabsTrigger>
          );
        })}
      </TabsList>

      <div className="flex-1 overflow-auto">
        <TabsContent value="detail" className="m-0">
          <DetailContent item={item} />
        </TabsContent>
        <TabsContent value="format" className="m-0">
          <FormatContent item={item} />
        </TabsContent>
        <TabsContent value="comments" className="m-0">
          <CommentsContent />
        </TabsContent>
        <TabsContent value="revisions" className="m-0">
          <RevisionsContent />
        </TabsContent>
      </div>
    </Tabs>
  );
}
