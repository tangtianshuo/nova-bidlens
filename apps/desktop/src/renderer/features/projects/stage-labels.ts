/**
 * Shared stage labels used by both the analysis stage list and the
 * per-submission progress table. Superset of all statuses.
 */
export const STAGE_LABELS: Record<string, string> = {
  validating: '文件校验',
  parsing: '文档解析',
  filtering: '招标内容过滤',
  embedding: '向量化',
  retrieving: '候选召回',
  detecting: '混合精排',
  aggregating: '风险聚合',
  ready: '完成',
  partial: '部分结果',
  interrupted: '已中断',
  failed: '失败',
};
