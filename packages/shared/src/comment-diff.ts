/**
 * 批注/修订比对模块
 * 比较两个文档的批注和修订，检测新增、删除、修改和未变化的内容
 */

import type { ParsedComment, CommentRange } from './parser/docx-comments.js';
import type { ParsedRevision, TextFormat } from './parser/docx-revisions.js';

// ============ 批注比对结果 ============

export interface CommentDiff {
  left: ParsedComment;
  right: ParsedComment;
  changes: CommentChange[];
}

export interface CommentChange {
  field: string;
  leftValue: unknown;
  rightValue: unknown;
}

export interface CommentDiffResult {
  added: ParsedComment[];
  removed: ParsedComment[];
  modified: CommentDiff[];
  unchanged: ParsedComment[];
}

// ============ 修订比对结果 ============

export interface RevisionDiff {
  left: ParsedRevision;
  right: ParsedRevision;
  changes: RevisionChange[];
}

export interface RevisionChange {
  field: string;
  leftValue: unknown;
  rightValue: unknown;
}

export interface RevisionDiffResult {
  added: ParsedRevision[];
  removed: ParsedRevision[];
  modified: RevisionDiff[];
  unchanged: ParsedRevision[];
}

// ============ 批注比对 ============

/**
 * 比较两组批注列表，检测新增、删除、修改和未变化的批注
 * @param left 原始批注列表
 * @param right 新批注列表
 * @returns 比对结果
 */
export function compareComments(
  left: ParsedComment[],
  right: ParsedComment[]
): CommentDiffResult {
  const result: CommentDiffResult = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  };

  // 创建右侧批注的 ID 映射
  const rightMap = new Map<string, ParsedComment>();
  for (const comment of right) {
    rightMap.set(comment.id, comment);
  }

  // 跟踪已匹配的右侧批注 ID
  const matchedRightIds = new Set<string>();

  // 遍历左侧批注，与右侧进行匹配
  for (const leftComment of left) {
    const rightComment = rightMap.get(leftComment.id);

    if (!rightComment) {
      // 右侧没有对应的批注，标记为删除
      result.removed.push(leftComment);
      continue;
    }

    // 标记为已匹配
    matchedRightIds.add(leftComment.id);

    // 检查是否有变更
    const changes = diffComment(leftComment, rightComment);

    if (changes.length === 0) {
      // 没有变更，标记为未变化
      result.unchanged.push(leftComment);
    } else {
      // 有变更，标记为修改
      result.modified.push({
        left: leftComment,
        right: rightComment,
        changes
      });
    }

    // 递归比较回复
    const replyDiff = compareComments(leftComment.replies, rightComment.replies);
    // 将回复的变更合并到结果中
    result.added.push(...replyDiff.added);
    result.removed.push(...replyDiff.removed);
    result.modified.push(...replyDiff.modified);
    result.unchanged.push(...replyDiff.unchanged);
  }

  // 检查右侧新增的批注（不在左侧中的）
  for (const rightComment of right) {
    if (!matchedRightIds.has(rightComment.id)) {
      result.added.push(rightComment);
    }
  }

  return result;
}

/**
 * 比较单个批注的变更
 */
function diffComment(left: ParsedComment, right: ParsedComment): CommentChange[] {
  const changes: CommentChange[] = [];

  // 比较内容
  if (left.content !== right.content) {
    changes.push({
      field: 'content',
      leftValue: left.content,
      rightValue: right.content
    });
  }

  // 比较作者
  if (left.author !== right.author) {
    changes.push({
      field: 'author',
      leftValue: left.author,
      rightValue: right.author
    });
  }

  // 比较日期
  if (left.date !== right.date) {
    changes.push({
      field: 'date',
      leftValue: left.date,
      rightValue: right.date
    });
  }

  // 比较解决状态
  if (left.resolved !== right.resolved) {
    changes.push({
      field: 'resolved',
      leftValue: left.resolved,
      rightValue: right.resolved
    });
  }

  // 比较范围
  if (!isRangeEqual(left.range, right.range)) {
    changes.push({
      field: 'range',
      leftValue: left.range,
      rightValue: right.range
    });
  }

  return changes;
}

/**
 * 比较两个 CommentRange 是否相等
 */
function isRangeEqual(left: CommentRange, right: CommentRange): boolean {
  return (
    left.startNodeId === right.startNodeId &&
    left.startOffset === right.startOffset &&
    left.endNodeId === right.endNodeId &&
    left.endOffset === right.endOffset
  );
}

// ============ 修订比对 ============

/**
 * 比较两组修订列表，检测新增、删除、修改和未变化的修订
 * @param left 原始修订列表
 * @param right 新修订列表
 * @returns 比对结果
 */
export function compareRevisions(
  left: ParsedRevision[],
  right: ParsedRevision[]
): RevisionDiffResult {
  const result: RevisionDiffResult = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  };

  // 创建右侧修订的 ID 映射
  const rightMap = new Map<string, ParsedRevision>();
  for (const revision of right) {
    rightMap.set(revision.id, revision);
  }

  // 跟踪已匹配的右侧修订 ID
  const matchedRightIds = new Set<string>();

  // 遍历左侧修订，与右侧进行匹配
  for (const leftRevision of left) {
    const rightRevision = rightMap.get(leftRevision.id);

    if (!rightRevision) {
      // 右侧没有对应的修订，标记为删除
      result.removed.push(leftRevision);
      continue;
    }

    // 标记为已匹配
    matchedRightIds.add(leftRevision.id);

    // 检查是否有变更
    const changes = diffRevision(leftRevision, rightRevision);

    if (changes.length === 0) {
      // 没有变更，标记为未变化
      result.unchanged.push(leftRevision);
    } else {
      // 有变更，标记为修改
      result.modified.push({
        left: leftRevision,
        right: rightRevision,
        changes
      });
    }
  }

  // 检查右侧新增的修订（不在左侧中的）
  for (const rightRevision of right) {
    if (!matchedRightIds.has(rightRevision.id)) {
      result.added.push(rightRevision);
    }
  }

  return result;
}

/**
 * 比较单个修订的变更
 */
function diffRevision(left: ParsedRevision, right: ParsedRevision): RevisionChange[] {
  const changes: RevisionChange[] = [];

  // 比较修订类型
  if (left.revisionType !== right.revisionType) {
    changes.push({
      field: 'revisionType',
      leftValue: left.revisionType,
      rightValue: right.revisionType
    });
  }

  // 比较作者
  if (left.author !== right.author) {
    changes.push({
      field: 'author',
      leftValue: left.author,
      rightValue: right.author
    });
  }

  // 比较日期
  if (left.date !== right.date) {
    changes.push({
      field: 'date',
      leftValue: left.date,
      rightValue: right.date
    });
  }

  // 比较内容文本
  if (left.content.text !== right.content.text) {
    changes.push({
      field: 'content.text',
      leftValue: left.content.text,
      rightValue: right.content.text
    });
  }

  // 比较格式
  if (!isFormatEqual(left.content.format, right.content.format)) {
    changes.push({
      field: 'content.format',
      leftValue: left.content.format,
      rightValue: right.content.format
    });
  }

  // 比较位置
  if (!isPositionEqual(left.content.position, right.content.position)) {
    changes.push({
      field: 'content.position',
      leftValue: left.content.position,
      rightValue: right.content.position
    });
  }

  // 比较接受状态
  if (left.accepted !== right.accepted) {
    changes.push({
      field: 'accepted',
      leftValue: left.accepted,
      rightValue: right.accepted
    });
  }

  return changes;
}

/**
 * 比较两个 TextFormat 是否相等
 */
function isFormatEqual(left: TextFormat | undefined, right: TextFormat | undefined): boolean {
  if (left === undefined && right === undefined) return true;
  if (left === undefined || right === undefined) return false;

  return (
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline &&
    left.fontSize === right.fontSize &&
    left.fontFamily === right.fontFamily &&
    left.color === right.color &&
    left.strikethrough === right.strikethrough
  );
}

/**
 * 比较两个位置是否相等
 */
function isPositionEqual(
  left: { nodeId: string; offset: number },
  right: { nodeId: string; offset: number }
): boolean {
  return left.nodeId === right.nodeId && left.offset === right.offset;
}
