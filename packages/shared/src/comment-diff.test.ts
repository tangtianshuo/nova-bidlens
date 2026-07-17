import { describe, expect, it } from 'vitest';
import { compareComments, compareRevisions } from './comment-diff.js';
import type { ParsedComment } from './parser/docx-comments.js';
import type { ParsedRevision } from './parser/docx-revisions.js';

// ============ 批注测试数据 ============

const baseComment: ParsedComment = {
  id: '1',
  author: '张三',
  date: '2024-01-15T10:30:00Z',
  content: '这是一条批注',
  range: {
    startNodeId: 'p_0',
    startOffset: 0,
    endNodeId: 'r_1',
    endOffset: 5
  },
  replies: [],
  resolved: false
};

const modifiedComment: ParsedComment = {
  ...baseComment,
  content: '这是修改后的批注'
};

const secondComment: ParsedComment = {
  id: '2',
  author: '李四',
  date: '2024-01-15T11:00:00Z',
  content: '这是另一条批注',
  range: {
    startNodeId: 'p_2',
    startOffset: 0,
    endNodeId: 'r_3',
    endOffset: 10
  },
  replies: [],
  resolved: false
};

const thirdComment: ParsedComment = {
  id: '3',
  author: '王五',
  date: '2024-01-15T12:00:00Z',
  content: '这是第三条批注',
  range: {
    startNodeId: 'p_4',
    startOffset: 0,
    endNodeId: 'r_5',
    endOffset: 8
  },
  replies: [],
  resolved: true
};

// ============ 修订测试数据 ============

const baseRevision: ParsedRevision = {
  id: '1',
  author: '张三',
  date: '2024-01-15T10:30:00Z',
  revisionType: 'insert',
  content: {
    text: '新插入的文本',
    format: { bold: true },
    position: { nodeId: 'p_0', offset: 5 }
  }
};

const modifiedRevision: ParsedRevision = {
  ...baseRevision,
  content: {
    ...baseRevision.content,
    text: '修改后的插入文本'
  }
};

const secondRevision: ParsedRevision = {
  id: '2',
  author: '李四',
  date: '2024-01-15T11:00:00Z',
  revisionType: 'delete',
  content: {
    text: '被删除的文本',
    position: { nodeId: 'p_1', offset: 10 }
  }
};

const thirdRevision: ParsedRevision = {
  id: '3',
  author: '王五',
  date: '2024-01-15T12:00:00Z',
  revisionType: 'formatChange',
  content: {
    text: '格式变更文本',
    format: { italic: true },
    position: { nodeId: 'p_2', offset: 0 }
  },
  accepted: true
};

// ============ 批注比对测试 ============

describe('compareComments', () => {
  it('应该检测新增的批注', () => {
    const left: ParsedComment[] = [];
    const right: ParsedComment[] = [baseComment];

    const result = compareComments(left, right);

    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toEqual(baseComment);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该检测删除的批注', () => {
    const left: ParsedComment[] = [baseComment];
    const right: ParsedComment[] = [];

    const result = compareComments(left, right);

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toEqual(baseComment);
    expect(result.added).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该检测未变化的批注', () => {
    const left: ParsedComment[] = [baseComment];
    const right: ParsedComment[] = [{ ...baseComment }];

    const result = compareComments(left, right);

    expect(result.unchanged).toHaveLength(1);
    expect(result.unchanged[0]).toEqual(baseComment);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it('应该检测内容修改的批注', () => {
    const left: ParsedComment[] = [baseComment];
    const right: ParsedComment[] = [modifiedComment];

    const result = compareComments(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].left).toEqual(baseComment);
    expect(result.modified[0].right).toEqual(modifiedComment);
    expect(result.modified[0].changes).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('content');
    expect(result.modified[0].changes[0].leftValue).toBe('这是一条批注');
    expect(result.modified[0].changes[0].rightValue).toBe('这是修改后的批注');
  });

  it('应该检测作者修改的批注', () => {
    const authorModified: ParsedComment = { ...baseComment, author: '新作者' };
    const left: ParsedComment[] = [baseComment];
    const right: ParsedComment[] = [authorModified];

    const result = compareComments(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('author');
    expect(result.modified[0].changes[0].leftValue).toBe('张三');
    expect(result.modified[0].changes[0].rightValue).toBe('新作者');
  });

  it('应该检测解决状态修改的批注', () => {
    const resolvedModified: ParsedComment = { ...baseComment, resolved: true };
    const left: ParsedComment[] = [baseComment];
    const right: ParsedComment[] = [resolvedModified];

    const result = compareComments(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('resolved');
    expect(result.modified[0].changes[0].leftValue).toBe(false);
    expect(result.modified[0].changes[0].rightValue).toBe(true);
  });

  it('应该处理多个批注的混合场景', () => {
    const left: ParsedComment[] = [baseComment, secondComment];
    const right: ParsedComment[] = [modifiedComment, thirdComment];

    const result = compareComments(left, right);

    // baseComment 被修改，secondComment 被删除，thirdComment 被新增
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe('3');
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].id).toBe('2');
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].left.id).toBe('1');
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该处理完全相同的批注列表', () => {
    const comments = [baseComment, secondComment, thirdComment];
    const left = [...comments];
    const right = [...comments];

    const result = compareComments(left, right);

    expect(result.unchanged).toHaveLength(3);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it('应该处理空列表', () => {
    const result = compareComments([], []);

    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该递归比较回复批注', () => {
    const reply: ParsedComment = {
      id: 'reply_1',
      author: '李四',
      date: '2024-01-15T11:00:00Z',
      content: '这是一条回复',
      range: { startNodeId: '', startOffset: 0, endNodeId: '', endOffset: 0 },
      replies: [],
      resolved: false
    };

    const modifiedReply: ParsedComment = {
      ...reply,
      content: '这是修改后的回复'
    };

    const left: ParsedComment[] = [
      { ...baseComment, replies: [reply] }
    ];
    const right: ParsedComment[] = [
      { ...baseComment, replies: [modifiedReply] }
    ];

    const result = compareComments(left, right);

    // 主批注未变化，但回复被修改
    expect(result.unchanged).toHaveLength(1);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].left.id).toBe('reply_1');
  });

  it('应该检测批注范围变更', () => {
    const rangeModified: ParsedComment = {
      ...baseComment,
      range: {
        startNodeId: 'p_0',
        startOffset: 0,
        endNodeId: 'r_1',
        endOffset: 10  // 不同的偏移量
      }
    };

    const left: ParsedComment[] = [baseComment];
    const right: ParsedComment[] = [rangeModified];

    const result = compareComments(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('range');
  });
});

// ============ 修订比对测试 ============

describe('compareRevisions', () => {
  it('应该检测新增的修订', () => {
    const left: ParsedRevision[] = [];
    const right: ParsedRevision[] = [baseRevision];

    const result = compareRevisions(left, right);

    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toEqual(baseRevision);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该检测删除的修订', () => {
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [];

    const result = compareRevisions(left, right);

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toEqual(baseRevision);
    expect(result.added).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该检测未变化的修订', () => {
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [{ ...baseRevision }];

    const result = compareRevisions(left, right);

    expect(result.unchanged).toHaveLength(1);
    expect(result.unchanged[0]).toEqual(baseRevision);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it('应该检测内容修改的修订', () => {
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [modifiedRevision];

    const result = compareRevisions(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].left).toEqual(baseRevision);
    expect(result.modified[0].right).toEqual(modifiedRevision);
    expect(result.modified[0].changes).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('content.text');
    expect(result.modified[0].changes[0].leftValue).toBe('新插入的文本');
    expect(result.modified[0].changes[0].rightValue).toBe('修改后的插入文本');
  });

  it('应该检测修订类型修改', () => {
    const typeModified: ParsedRevision = { ...baseRevision, revisionType: 'delete' };
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [typeModified];

    const result = compareRevisions(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('revisionType');
    expect(result.modified[0].changes[0].leftValue).toBe('insert');
    expect(result.modified[0].changes[0].rightValue).toBe('delete');
  });

  it('应该检测作者修改的修订', () => {
    const authorModified: ParsedRevision = { ...baseRevision, author: '新作者' };
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [authorModified];

    const result = compareRevisions(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('author');
    expect(result.modified[0].changes[0].leftValue).toBe('张三');
    expect(result.modified[0].changes[0].rightValue).toBe('新作者');
  });

  it('应该检测格式修改的修订', () => {
    const formatModified: ParsedRevision = {
      ...baseRevision,
      content: {
        ...baseRevision.content,
        format: { bold: false, italic: true }
      }
    };
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [formatModified];

    const result = compareRevisions(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('content.format');
  });

  it('应该检测接受状态修改的修订', () => {
    const acceptedModified: ParsedRevision = { ...baseRevision, accepted: true };
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [acceptedModified];

    const result = compareRevisions(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes[0].field).toBe('accepted');
    expect(result.modified[0].changes[0].leftValue).toBeUndefined();
    expect(result.modified[0].changes[0].rightValue).toBe(true);
  });

  it('应该处理多个修订的混合场景', () => {
    const left: ParsedRevision[] = [baseRevision, secondRevision];
    const right: ParsedRevision[] = [modifiedRevision, thirdRevision];

    const result = compareRevisions(left, right);

    // baseRevision 被修改，secondRevision 被删除，thirdRevision 被新增
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe('3');
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].id).toBe('2');
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].left.id).toBe('1');
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该处理完全相同的修订列表', () => {
    const revisions = [baseRevision, secondRevision, thirdRevision];
    const left = [...revisions];
    const right = [...revisions];

    const result = compareRevisions(left, right);

    expect(result.unchanged).toHaveLength(3);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it('应该处理空列表', () => {
    const result = compareRevisions([], []);

    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('应该检测多个字段同时修改', () => {
    const multiFieldModified: ParsedRevision = {
      ...baseRevision,
      author: '新作者',
      revisionType: 'delete',
      content: {
        ...baseRevision.content,
        text: '新内容'
      }
    };
    const left: ParsedRevision[] = [baseRevision];
    const right: ParsedRevision[] = [multiFieldModified];

    const result = compareRevisions(left, right);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].changes).toHaveLength(3);

    const fields = result.modified[0].changes.map(c => c.field);
    expect(fields).toContain('revisionType');
    expect(fields).toContain('author');
    expect(fields).toContain('content.text');
  });
});
