/**
 * Semantic state utilities for risk review UI.
 * Pure functions — no React, no side effects, no DOM access.
 * Returns CSS variable references so components stay theme-aware.
 */

import type { MatchType, TaskStatus, ReviewStatus } from '@bidlens/shared/types-only';

// ── Risk level ──────────────────────────────────────────────────

export type RiskLevel = 'high' | 'medium' | 'low';

export function getRiskColor(level: RiskLevel): string {
  return `var(--risk-${level})`;
}

export function getRiskBg(level: RiskLevel): string {
  return `var(--risk-${level}-bg)`;
}

export function getRiskBorder(level: RiskLevel): string {
  return `var(--risk-${level}-border)`;
}

export function getRiskLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    high: '高风险',
    medium: '中风险',
    low: '低风险',
  };
  return labels[level];
}

// ── Detector category ───────────────────────────────────────────

export type DetectorCategory = 'text' | 'table' | 'entity';

export function getDetectorColor(category: DetectorCategory): string {
  return `var(--detector-${category})`;
}

export function getDetectorBg(category: DetectorCategory): string {
  return `var(--detector-${category}-bg)`;
}

export function getDetectorLabel(category: DetectorCategory): string {
  const labels: Record<DetectorCategory, string> = {
    text: '文本检测',
    table: '表格检测',
    entity: '实体检测',
  };
  return labels[category];
}

// ── Task / pipeline status ──────────────────────────────────────

export function getStatusColor(status: TaskStatus): string {
  return `var(--status-${statusToToken(status)})`;
}

export function getStatusBg(status: TaskStatus): string {
  return `var(--status-${statusToToken(status)}-bg)`;
}

export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    draft: '草稿',
    validating: '验证中',
    parsing_baseline: '解析基准文档',
    parsing_review: '解析审查文档',
    comparing: '对比中',
    finalizing: '生成报告',
    ready: '已完成',
    cancelling: '取消中',
    cancelled: '已取消',
    failed: '失败',
    interrupted: '已中断',
  };
  return labels[status];
}

/** Map TaskStatus to CSS token name (merges parsing_baseline + parsing_review). */
function statusToToken(status: TaskStatus): string {
  if (status === 'parsing_baseline' || status === 'parsing_review') return 'parsing';
  return status;
}

// ── Diff match type ─────────────────────────────────────────────

export type DiffMatchVariant = 'added' | 'deleted' | 'modified' | 'uncertain';

const MATCH_TO_VARIANT: Record<MatchType, DiffMatchVariant | null> = {
  added: 'added',
  deleted: 'deleted',
  modified: 'modified',
  uncertain: 'uncertain',
  identical: null,
  moved: 'modified',
  split: 'modified',
  merged: 'modified',
};

export function getDiffVariant(matchType: MatchType): DiffMatchVariant | null {
  return MATCH_TO_VARIANT[matchType];
}

export function getDiffColor(matchType: MatchType): string | null {
  const v = getDiffVariant(matchType);
  return v ? `var(--color-${v})` : null;
}

export function getDiffBg(matchType: MatchType): string | null {
  const v = getDiffVariant(matchType);
  return v ? `var(--color-${v}-bg)` : null;
}

export function getDiffBorder(matchType: MatchType): string | null {
  const v = getDiffVariant(matchType);
  return v ? `var(--color-${v}-border)` : null;
}

export function getDiffLabel(matchType: MatchType): string {
  const labels: Record<MatchType, string> = {
    identical: '相同',
    modified: '修改',
    added: '新增',
    deleted: '删除',
    moved: '移动',
    split: '拆分',
    merged: '合并',
    uncertain: '不确定',
  };
  return labels[matchType];
}

// ── Review status ───────────────────────────────────────────────

export function getReviewStatusLabel(status: ReviewStatus): string {
  const labels: Record<ReviewStatus, string> = {
    unreviewed: '未审查',
    confirmed: '已确认',
    'needs-confirmation': '待确认',
    ignored: '已忽略',
  };
  return labels[status];
}
