/**
 * Stage labels keyed by AnalysisPhase + terminal ProjectStatus values.
 * Used by both the analysis stage list and the per-submission progress table.
 */
import type { AnalysisPhase, ProjectStatus } from '@bidlens/shared/types-only';

export const STAGE_LABELS: Record<AnalysisPhase | ProjectStatus, string> = {
  'validating': '文件校验',
  'parsing': '文档解析',
  'extracting-nodes': '节点提取',
  'extracting-entities': '实体提取',
  'filtering-tender-content': '招标内容过滤',
  'recalling-candidates': '候选召回',
  'detecting': '混合精排',
  'aggregating': '风险聚合',
  'persisting': '结果持久化',
  'completed': '完成',
  // Terminal project statuses
  'draft': '草稿',
  'running': '运行中',
  'ready': '完成',
  'partial': '部分结果',
  'interrupted': '已中断',
  'failed': '失败',
  'cancelled': '已取消',
};
