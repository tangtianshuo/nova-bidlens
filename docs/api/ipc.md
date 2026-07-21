# IPC 接口文档

> 版本：v2.0 | 最后更新：2026-07-18

---

## 一、概述

IPC (Inter-Process Communication) 接口用于 Electron 主进程与渲染进程之间的通信。

V0.2.2版本实现了完整的生产IPC合约，包括文件验证、比对任务管理、审核标注、历史记录、报告导出和设置管理。

---

## 二、接口列表

### 2.1 文件操作

#### `file:select`

打开文件选择对话框。

**响应：**

```typescript
interface SelectFileResponse {
  path: string;      // 文件路径
  name: string;      // 文件名
  size: number;      // 文件大小（字节）
  format: string;    // 文件格式（docx/pdf）
}
```

#### `file:validate`

验证两个文件的有效性和能力。

**请求参数：**

```typescript
interface ValidateFilesRequest {
  fileAPath: string;
  fileBPath: string;
}
```

**响应：**

```typescript
interface ValidateFilesResponse {
  fileA: FileValidationResult;
  fileB: FileValidationResult;
  crossFormatDegradation: string[];
}

interface FileValidationResult {
  valid: boolean;
  extension: string;
  size: number;
  capabilities: CapabilityResult[];
  errors: string[];
  warnings: string[];
}

interface CapabilityResult {
  dimension: 'content' | 'format' | 'comment' | 'revision';
  state: 'supported' | 'unsupported' | 'degraded' | 'unchanged' | 'changed';
  reason: string;
}
```

---

### 2.2 文档比对

#### `compare:start`

启动文档比对任务。

**请求参数：**

```typescript
interface StartCompareRequest {
  fileAPath: string;
  fileBPath: string;
  options: {
    sensitivity: 'strict' | 'standard' | 'loose';
  };
}
```

**响应：**

```typescript
interface StartCompareResponse {
  taskId: string;
}
```

**错误：**
- `ENGINE_BUSY` - 已有比对任务正在运行

#### `compare:cancel`

取消比对任务。

**请求参数：** `taskId: string`

**响应：**

```typescript
interface CancelCompareResponse {
  cancelled: boolean;
}
```

#### `compare:getResult`

获取比对结果。

**请求参数：** `taskId: string`

**响应：** `CompareResult`

```typescript
interface CompareResult {
  taskId: string;
  docA: DocumentAst;
  docB: DocumentAst;
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
  capabilities: CapabilityResult[];
  options: CompareOptions;
  warnings: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}
```

#### `compare:progress`

比对进度推送（主进程 → 渲染进程）。

```typescript
interface CompareProgress {
  taskId: string;
  stage: string;
  percent?: number;
  message?: string;
}
```

---

### 2.3 审核标注

#### `review:saveAnnotation`

保存审核标注。

**请求参数：**

```typescript
interface SaveAnnotationRequest {
  taskId: string;
  matchId: string;
  status?: 'unreviewed' | 'confirmed' | 'needs-confirmation' | 'ignored';
  important?: boolean;
  note?: string;
}
```

**响应：** `ReviewAnnotation`

```typescript
interface ReviewAnnotation {
  id: string;
  taskId: string;
  matchId: string;
  status: 'unreviewed' | 'confirmed' | 'needs-confirmation' | 'ignored';
  important: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}
```

#### `review:batchRead`

批量读取任务的所有标注。

**请求参数：** `taskId: string`

**响应：**

```typescript
interface BatchReadAnnotationsResponse {
  annotations: ReviewAnnotation[];
}
```

---

### 2.4 历史记录

#### `history:list`

获取历史任务列表。

**请求参数：**

```typescript
interface ListHistoryRequest {
  search?: string;
  statusFilter?: string;
}
```

**响应：**

```typescript
interface ListHistoryResponse {
  tasks: TaskSummary[];
}
```

#### `history:openSnapshot`

打开历史快照。

**请求参数：**

```typescript
interface OpenSnapshotRequest {
  taskId: string;
}
```

**响应：**

```typescript
interface OpenSnapshotResponse {
  result: CompareResult;
  annotations: ReviewAnnotation[];
}
```

#### `history:recompare`

重新比对。

**请求参数：**

```typescript
interface RecompareRequest {
  taskId: string;
  newFileAPath?: string;
  newFileBPath?: string;
  options?: CompareOptions;
}
```

**响应：**

```typescript
interface RecompareResponse {
  taskId: string;
}
```

#### `history:retain`

设置任务保留状态。

**请求参数：** `taskId: string`, `retained: boolean`

#### `history:delete`

删除任务。

**请求参数：** `taskId: string`

#### `history:clear`

清理历史记录。

**请求参数：**

```typescript
interface ClearHistoryRequest {
  type: 'all' | 'lru';
  confirm: boolean;
}
```

**响应：**

```typescript
interface ClearHistoryResponse {
  deletedCount: number;
}
```

---

### 2.5 报告导出

#### `export:report`

导出比对报告。

**请求参数：**

```typescript
interface ExportReportRequest {
  taskId: string;
  format: 'html' | 'markdown';
  scope: 'all' | 'current_filter' | 'important' | 'needs-confirmation';
  includeIdentical: boolean;
  matchIds?: string[]; // scope 为 current_filter 时传入当前可见差异 ID
}
```

**响应：**

```typescript
interface ExportReportResponse {
  filePath: string;
  format: string;
  itemCount: number;
}
```

#### `export:openFile`

打开导出的文件。

**请求参数：** `filePath: string`

#### `export:openFolder`

打开导出文件所在的文件夹。

**请求参数：** `folderPath: string`

---

### 2.6 设置管理

#### `settings:get`

获取应用设置。

**响应：**

```typescript
interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  historyCountLimit: number;
  storageLimitBytes: number;
}
```

#### `settings:update`

更新应用设置。

**请求参数：** `Partial<AppSettings>`

**响应：** `AppSettings`

#### `settings:storageReport`

获取存储报告。

**响应：**

```typescript
interface StorageReport {
  databaseSizeBytes: number;
  cacheSizeBytes: number;
  totalTaskCount: number;
  retainedCount: number;
  cleanableCount: number;
}
```

#### `settings:cleanup`

清理存储。

**请求参数：**

```typescript
interface CleanupRequest {
  type: 'all' | 'lru';
  confirm: boolean;
}
```

**响应：**

```typescript
interface CleanupResponse {
  deletedCount: number;
}
```

---

### 2.7 引擎管理

#### `engine:handshake`

引擎握手。

**响应：**

```typescript
interface EngineHandshake {
  engineVersion: string;
  protocolVersion: string;
  capabilities: string[];
}
```

---

## 三、调用示例

### 3.1 渲染进程调用

```typescript
// 选择文件
const file = await window.bidlens.selectFile();

// 验证文件
const validation = await window.bidlens.validateFiles({
  fileAPath: '/path/to/docA.docx',
  fileBPath: '/path/to/docB.docx'
});

// 启动比对
const { taskId } = await window.bidlens.startCompare({
  fileAPath: '/path/to/docA.docx',
  fileBPath: '/path/to/docB.docx',
  options: { sensitivity: 'standard' }
});

// 监听进度
window.bidlens.onCompareProgress((progress) => {
  console.log(`阶段: ${progress.stage}, 进度: ${progress.percent}%`);
});
});

// 监听结果
window.bidlens.onCompareResult((result) => {
  console.log('比对完成', result.diffAst);
});
```

### 3.2 主进程处理

```typescript
// 注册处理器
ipcMain.handle('compare:start', async (event, request) => {
  const taskId = generateTaskId();
  // 启动比对任务...
  return { taskId };
});
```
# 雷同性风险审查 IPC（V0.3 主链）

Renderer 通过 preload 调用以下项目级接口，主进程负责真实文件校验、AST 解析和确定性候选检测。所有结果均为审查线索，不构成串标认定。

| Channel | Request | Response |
|---|---|---|
| `risk:listProjects` | 无 | `AnalysisProjectSummary[]` |
| `risk:getProject` | `projectId` | `AnalysisProjectDetail` |
| `risk:createProject` | 项目名、2-8 个文件路径、可选基线、预设 | `{ projectId }` |
| `risk:cancelProject` | `projectId` | `{ projectId, cancelled }` |
| `risk:saveFindingReview` | 项目、发现项、人工状态和备注 | 更新后的 `RiskFinding` |
| `risk:progress` | 主进程推送 | `RiskProgress`（通过 `onRiskProgress` 订阅） |

当前实现使用本地解析器和可解释的词法候选检测，并明确记录 `embedding_unavailable` 降级状态；BGE-M3/Rust 检测器接入保持同一契约。
