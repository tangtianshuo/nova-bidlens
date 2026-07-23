/**
 * 解析器类型定义
 */

import type { DocumentAst } from '../document-ast.js';

/**
 * 解析输入
 */
export interface ParseInput {
  /** 文件绝对路径 */
  filePath: string;
  /** 文件名 (含扩展名) */
  fileName: string;
  /** 文件大小 (bytes) */
  fileSize: number;
  /** MIME 类型 (可选) */
  mimeType?: string;
}

/**
 * 解析选项
 */
export interface ParseOptions {
  /** 保真级别 1-5 */
  fidelityLevel: 1 | 2 | 3 | 4 | 5;
  /** 是否提取批注 */
  extractComments: boolean;
  /** 是否提取修订记录 */
  extractRevisions: boolean;
  /** 是否提取图片 */
  extractImages: boolean;
  /** 最大解析页数 (0 = 不限制) */
  maxPages: number;
  /** 超时时间 (ms, 0 = 不限制) */
  timeout: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * 解析警告
 */
export interface ParseWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  location?: {
    nodeId?: string;
    page?: number;
    paragraph?: number;
  };
}

/**
 * 解析结果
 */
export interface ParseResult {
  /** 是否成功 */
  success: boolean;
  /** Document AST (成功时有值) */
  ast?: DocumentAst;
  /** 解析警告 (非致命问题) */
  warnings: ParseWarning[];
  /** 解析耗时 (ms) */
  duration: number;
  /** 使用的适配器 ID */
  parserId: string;
  /** 错误信息 (失败时有值) */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 文档解析器统一接口
 */
export interface DocumentParser {
  /** 适配器唯一标识 */
  readonly id: string;
  /** 适配器名称 (用户可读) */
  readonly name: string;
  /** 支持的文件扩展名列表 */
  readonly supportedExtensions: string[];
  /** 支持的 MIME 类型列表 */
  readonly mimeTypes: string[];
  /** 优先级 (数字越小越优先) */
  readonly priority: number;

  /**
   * 检查是否能处理给定文件
   */
  canParse(input: ParseInput): Promise<boolean>;

  /**
   * 执行解析
   */
  parse(input: ParseInput, options: ParseOptions): Promise<ParseResult>;
}
