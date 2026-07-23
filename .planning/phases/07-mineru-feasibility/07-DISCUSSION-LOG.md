# Phase 7: MinerU 可行性验证 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 07-mineru-feasibility
**Areas discussed:** 部署方式、API 后端选择、输出格式配置、延迟与配额评估、错误处理策略

---

## 部署方式

| Option | Description | Selected |
|--------|------------|----------|
| 本地 Docker 部署 | 原计划，pip install + Docker 测试 | |
| mineru.net 云端 API | 用户明确要求，无需本地部署 | ✓ |

**User's choice:** 使用 mineru.net 云端 API
**Notes:** 用户明确说"先不考虑本地部署的事情，mineru 提供了 API 版本的"

---

## API 选择

| Option | Description | Selected |
|--------|------------|----------|
| 精准解析 API (`/api/v4/extract/task`) | 需要 Token，≤200MB/200页，返回 ZIP 含 content_list.json | ✓ |
| Agent 轻量 API (`/api/v1/agent/parse/file`) | 无需 Token，≤10MB/20页，仅返回 Markdown | |

**User's choice:** 精准解析 API
**Notes:** 投标 PDF 常超过 20 页，且需要 content_list.json 映射到 DocumentAst。Agent 轻量 API 不满足需求。

---

## API 后端选择

| Option | Description | Selected |
|--------|------------|----------|
| pipeline（默认） | 通用多语言，CPU 可用，无幻觉，速度较快 | ✓ |
| vlm（推荐） | VLM 推理，最高精度，仅支持中英文 | ✓ |

**User's choice:** 两个都测，用数据决定
**Notes:** 先用 pipeline 测试，再用 vlm 对比，用真实数据决定最终选择

---

## 输出格式配置

| Option | Description | Selected |
|--------|------------|----------|
| 仅 content_list | 只要结构化 JSON | |
| content_list + markdown | 两种格式都要 | |
| ZIP 全量输出 | 完整验证所有输出 | ✓ |

**User's choice:** ZIP 全量输出
**Notes:** 完整验证 content_list.json + markdown + layout.json + model.json

---

## 延迟基准

| Option | Description | Selected |
|--------|------------|----------|
| <30秒/页 | 和本地基准一致 | |
| <60秒/页 | API 有网络开销，放宽 | |
| 测试后定 | 用真实数据决定 | ✓ |

**User's choice:** 测试后定
**Notes:** 不预设基准，用真实投标 PDF 测试后根据数据决定可接受性

---

## API 配额了解

| Option | Description | Selected |
|--------|------------|----------|
| 免费额度充足 | 不用担心 | |
| 有限制 | 我来说明 | ✓ |
| 需付费 | 可以接受 | |

**User's choice:** 有限制
**Notes:** 精准解析 API 每天 1000 页最高优先级，超出后降低优先级。文件≤200MB/200页，批量≤50个。

---

## 错误处理策略

| Option | Description | Selected |
|--------|------------|----------|
| 仅记录（推荐） | Phase 7 仅记录 API 错误行为 | ✓ |
| 设计 fallback 策略 | API 失败时 fallback 到 pdf-parse | |
| 完整错误处理 | 重试 + 超时 + fallback | |

**User's choice:** 仅记录
**Notes:** Phase 7 是可行性验证阶段，错误处理和降级策略在 Phase 8 设计

---

## Claude's Discretion

- 测试脚本的具体实现（HTTP 客户端选择、轮询逻辑、结果解析）
- 测试 PDF 的选取和分组方式

## Deferred Ideas

None — discussion stayed within phase scope
