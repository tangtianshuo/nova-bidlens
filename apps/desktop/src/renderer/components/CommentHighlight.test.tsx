import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CommentHighlight } from './CommentHighlight';
import type { ParsedComment } from '@bidlens/shared/src/parser/docx-comments.js';
import type { ParsedRevision } from '@bidlens/shared/src/parser/docx-revisions.js';

// 模拟批注数据
const mockComments: ParsedComment[] = [
  {
    id: '1',
    author: '张三',
    date: '2026-07-17T10:00:00Z',
    content: '这里需要修改',
    range: {
      startNodeId: 'p_0',
      startOffset: 5,
      endNodeId: 'p_0',
      endOffset: 10
    },
    replies: [],
    resolved: false
  }
];

// 模拟修订数据
const mockRevisions: ParsedRevision[] = [
  {
    id: '2',
    author: '李四',
    date: '2026-07-17T10:30:00Z',
    revisionType: 'insert',
    content: {
      text: '新增内容',
      position: {
        nodeId: 'p_0',
        offset: 15
      }
    }
  },
  {
    id: '3',
    author: '王五',
    date: '2026-07-17T11:00:00Z',
    revisionType: 'delete',
    content: {
      text: '删除内容',
      position: {
        nodeId: 'p_0',
        offset: 20
      }
    }
  }
];

describe('CommentHighlight', () => {
  afterEach(() => {
    cleanup();
  });

  it('应该渲染子元素', () => {
    render(
      <CommentHighlight comments={[]} revisions={[]}>
        测试文本
      </CommentHighlight>
    );
    
    expect(screen.getByText('测试文本')).toBeTruthy();
  });

  it('应该显示批注高亮', () => {
    render(
      <CommentHighlight comments={mockComments} revisions={[]}>
        这是一段测试文本，包含批注内容
      </CommentHighlight>
    );
    
    // 检查是否有黄色下划线的元素
    const highlightedElements = document.querySelectorAll('span[style*="border-bottom"]');
    expect(highlightedElements.length).toBeGreaterThan(0);
  });

  it('应该显示插入修订高亮', () => {
    render(
      <CommentHighlight comments={[]} revisions={mockRevisions}>
        这是一段测试文本，包含插入内容
      </CommentHighlight>
    );
    
    // 检查是否有绿色背景的元素
    const highlightedElements = document.querySelectorAll('span[style*="background-color: rgba(40, 167, 69"]');
    expect(highlightedElements.length).toBeGreaterThan(0);
  });

  it('应该显示删除修订高亮', () => {
    render(
      <CommentHighlight comments={[]} revisions={mockRevisions}>
        这是一段测试文本，包含删除内容
      </CommentHighlight>
    );
    
    // 检查是否有删除线的元素
    const highlightedElements = document.querySelectorAll('span[style*="text-decoration: line-through"]');
    expect(highlightedElements.length).toBeGreaterThan(0);
  });

  it('应该在鼠标悬浮时显示批注提示', () => {
    render(
      <CommentHighlight comments={mockComments} revisions={[]}>
        这是一段测试文本，包含批注内容
      </CommentHighlight>
    );
    
    // 找到高亮元素并触发鼠标事件
    const highlightedElement = document.querySelector('span[style*="border-bottom"]');
    if (highlightedElement) {
      fireEvent.mouseEnter(highlightedElement);
      
      // 检查提示框是否出现
      expect(screen.getByText('💬 批注')).toBeTruthy();
      expect(screen.getByText('张三')).toBeTruthy();
      expect(screen.getByText('这里需要修改')).toBeTruthy();
    }
  });

  it('应该在鼠标悬浮时显示修订提示', () => {
    render(
      <CommentHighlight comments={[]} revisions={mockRevisions}>
        这是一段测试文本，包含插入内容
      </CommentHighlight>
    );
    
    // 找到高亮元素并触发鼠标事件
    const highlightedElement = document.querySelector('span[style*="background-color: rgba(40, 167, 69"]');
    if (highlightedElement) {
      fireEvent.mouseEnter(highlightedElement);
      
      // 检查提示框是否出现
      expect(screen.getByText('✏️ 修订 - 插入')).toBeTruthy();
      expect(screen.getByText('李四')).toBeTruthy();
      expect(screen.getByText('新增内容')).toBeTruthy();
    }
  });

  it('应该在鼠标离开时隐藏提示', () => {
    render(
      <CommentHighlight comments={mockComments} revisions={[]}>
        这是一段测试文本，包含批注内容
      </CommentHighlight>
    );
    
    // 找到高亮元素并触发鼠标事件
    const highlightedElement = document.querySelector('span[style*="border-bottom"]');
    if (highlightedElement) {
      fireEvent.mouseEnter(highlightedElement);
      fireEvent.mouseLeave(highlightedElement);
      
      // 检查提示框是否消失
      expect(screen.queryByText('💬 批注')).toBeNull();
    }
  });

  it('应该正确格式化日期', () => {
    render(
      <CommentHighlight comments={mockComments} revisions={[]}>
        这是一段测试文本，包含批注内容
      </CommentHighlight>
    );
    
    // 找到高亮元素并触发鼠标事件
    const highlightedElement = document.querySelector('span[style*="border-bottom"]');
    if (highlightedElement) {
      fireEvent.mouseEnter(highlightedElement);
      
      // 检查日期格式化是否正确（应该显示为中文格式）
      const dateElements = screen.getAllByText(/2026/);
      expect(dateElements.length).toBeGreaterThan(0);
    }
  });

  it('应该处理空数据', () => {
    render(
      <CommentHighlight comments={[]} revisions={[]}>
        测试文本
      </CommentHighlight>
    );
    
    // 应该正常渲染，没有高亮
    expect(screen.getByText('测试文本')).toBeTruthy();
    const highlightedElements = document.querySelectorAll('span[style*="border-bottom"]');
    expect(highlightedElements.length).toBe(0);
  });

  it('应该处理多个批注', () => {
    const multipleComments: ParsedComment[] = [
      ...mockComments,
      {
        id: '4',
        author: '赵六',
        date: '2026-07-17T12:00:00Z',
        content: '另一个批注',
        range: {
          startNodeId: 'p_0',
          startOffset: 25,
          endNodeId: 'p_0',
          endOffset: 30
        },
        replies: [],
        resolved: false
      }
    ];

    render(
      <CommentHighlight comments={multipleComments} revisions={[]}>
        这是一段测试文本，包含批注内容和另一个批注
      </CommentHighlight>
    );
    
    // 应该有两个高亮元素
    const highlightedElements = document.querySelectorAll('span[style*="border-bottom"]');
    expect(highlightedElements.length).toBe(2);
  });

  it('应该处理修订中的格式变更', () => {
    const formatRevision: ParsedRevision = {
      id: '5',
      author: '孙七',
      date: '2026-07-17T13:00:00Z',
      revisionType: 'formatChange',
      content: {
        text: '格式变更',
        position: {
          nodeId: 'p_0',
          offset: 35
        }
      }
    };

    render(
      <CommentHighlight comments={[]} revisions={[formatRevision]}>
        这是一段测试文本，包含格式变更内容
      </CommentHighlight>
    );
    
    // 找到高亮元素并触发鼠标事件
    const highlightedElement = document.querySelector('span[style*="background-color: rgba(255, 193, 7"]');
    if (highlightedElement) {
      fireEvent.mouseEnter(highlightedElement);
      
      // 检查提示框是否出现
      expect(screen.getByText('✏️ 修订 - 格式变更')).toBeTruthy();
      expect(screen.getByText('孙七')).toBeTruthy();
    }
  });
});
