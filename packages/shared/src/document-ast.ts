export type NodeId = string;

export interface DocumentAst {
  id: string;
  filename: string;
  sha256: string;
  pageCount: number | null;
  wordCount: number;
  parserVersion: string;
  blocks: BlockNode[];
  comments?: Comment[];
  revisions?: Revision[];
}

export type BlockNode = ParagraphNode | SectionNode | ListNode | TableNode;

export interface ParagraphNode {
  type: 'paragraph';
  id: NodeId;
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
}

export interface SectionNode {
  type: 'section';
  id: NodeId;
  title: string;
  level: number;
  children: BlockNode[];
  pageStart: number | null;
  pageEnd: number | null;
}

export interface ListNode {
  type: 'list';
  id: NodeId;
  ordered: boolean;
  items: ParagraphNode[];
  pageStart: number | null;
  pageEnd: number | null;
}

export interface TableNode {
  type: 'table';
  id: NodeId;
  rows: string[][];
  pageStart: number | null;
  pageEnd: number | null;
}

export interface Comment {
  id: string;
  author: string;
  date: string;
  content: string;
  range: CommentRange;
  replies: Comment[];
  resolved: boolean;
}

export interface CommentRange {
  startNodeId: string;
  startOffset: number;
  endNodeId: string;
  endOffset: number;
}

export interface Revision {
  id: string;
  author: string;
  date: string;
  revisionType: 'insert' | 'delete' | 'formatChange' | 'moveFrom' | 'moveTo';
  content: {
    text: string;
    format?: any;
    position: {
      nodeId: string;
      offset: number;
    };
  };
  accepted?: boolean;
}
