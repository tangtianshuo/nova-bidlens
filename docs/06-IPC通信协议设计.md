# 6. IPC 通信协议设计

## 6.1 通信架构总览

BidLens 采用 **Electron 主进程 ↔ Rust 子进程** 的进程间通信架构。两者之间通过 **stdio（标准输入/输出）** 建立双向通信通道，使用 **换行符分隔的 JSON（Newline-Delimited JSON, NDJSON）** 作为消息编码格式。

### 6.1.1 架构拓扑图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Electron 主进程                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────────┐  │
│  │ IPC Router│  │ Process   │  │ Message   │  │ Health Checker  │  │
│  │           │  │ Manager   │  │ Serializer│  │                 │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────────┬────────┘  │
│        │              │              │                  │           │
│        └──────────────┴──────┬───────┴──────────────────┘           │
│                              │                                      │
│                     ┌────────▼────────┐                             │
│                     │  StdioBridge    │                             │
│                     │  (双向JSON流)   │                             │
│                     └────────┬────────┘                             │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                    ┌──────────┼──────────┐
                    │  stdin   │  stdout   │
                    │  (写入)   │  (读取)   │
                    └──────────┼──────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                     ┌────────▼────────┐                             │
│                     │  Stdio Server   │                             │
│                     │  (tokio stdin)  │                             │
│                     └────────┬────────┘                             │
│        ┌─────────────────────┼─────────────────────┐                │
│  ┌─────▼─────┐  ┌────────────▼──────────┐  ┌──────▼──────┐        │
│  │ JSON-RPC  │  │  Method Dispatcher   │  │  Response   │         │
│  │ Parser    │  │                      │  │  Encoder    │         │
│  └───────────┘  └──────────────────────┘  └─────────────┘         │
│                          │                                         │
│              ┌───────────┼───────────┐                             │
│              │           │           │                             │
│        ┌─────▼────┐ ┌────▼────┐ ┌────▼─────┐                     │
│        │ Compare  │ │ Embed   │ │ Model    │                      │
│        │ Engine   │ │ Engine  │ │ Manager  │                      │
│        └──────────┘ └─────────┘ └──────────┘                      │
│                                                                    │
│                    Rust 推理引擎子进程                               │
└────────────────────────────────────────────────────────────────────┘
```

### 6.1.2 为什么选择 stdio + NDJSON

| 维度 | stdio + NDJSON | 其他方案 |
|------|---------------|----------|
| 延迟 | 极低，内核管道直连 | HTTP 需要 TCP 栈开销 |
| 序列化开销 | JSON 轻量，一行一消息 | gRPC Protobuf 编解码更复杂 |
| 调试便利性 | 直接 `cat` 管道即可观察 | 需要专用抓包工具 |
| 跨平台 | 所有 OS 原生支持 | Named Pipe / Unix Socket 平台差异大 |
| 进程隔离 | 独立进程，崩溃不污染主进程 | napi-rs 绑定会拖垮主进程 |

### 6.1.3 消息流向

```
Request 流向（Node → Rust）:
  Electron Main Process
    → JSON.stringify({id, method, params})
    → process.stdin.write(jsonLine + "\n")
    → Rust stdin 读取
    → serde_json::from_str()
    → 分发到对应 handler

Response 流向（Rust → Node）:
  Rust handler 返回结果
    → serde_json::to_string({id, result})
    → stdout.write_all(json_bytes + b"\n")
    → Electron readline 解析
    → 匹配 id，resolve Promise
```

---

## 6.2 为什么不用 napi-rs

在技术选型阶段，团队评估了 `napi-rs`（Rust ↔ Node.js 原生绑定）方案。经过详细对比，最终选择 **子进程 + stdio JSON-RPC** 方案，以下是决策依据。

### 6.2.1 方案对比表

| 维度 | napi-rs (原生绑定) | stdio JSON-RPC (子进程) |
|------|-------------------|------------------------|
| **ABI 稳定性** | 需要针对每个 Node 版本重新编译 | 无 ABI 依赖，JSON 是通用格式 |
| **崩溃隔离** | Rust panic 会直接导致 Node 主进程崩溃 | 子进程崩溃可被捕获并自动重启 |
| **调试便利性** | 需要 lldb/gdb attach 到 Node 进程 | 独立进程，可单独用 Rust 调试器 |
| **构建复杂度** | 需要 node-gyp + napi 工具链 + 每平台编译 | 独立构建 Rust 二进制，解耦 |
| **内存安全** | 共享内存空间，GC 交互复杂 | 进程隔离，各自管理内存 |
| **部署体积** | `.node` 文件需要 platform-specific 分发 | 单一二进制，独立分发 |
| **开发效率** | 需要熟悉 napi 生命周期管理 | 标准 JSON，前后端团队都能理解 |
| **性能开销** | 接近零拷贝 | JSON 序列化约 1-5ms（可接受） |

### 6.2.2 崩溃隔离的关键性

```rust
// napi-rs 场景：Rust panic 直接杀死整个 Electron 进程
#[napi]
fn heavy_compute() -> String {
    // 如果这里 panic，整个应用崩溃
    // 用户正在编辑的文档丢失
    let result = dangerous_operation();
    result
}

// stdio 子进程场景：Rust 崩溃可被捕获
// Electron 主进程监听子进程 exit 事件
// 自动重启子进程，用户几乎无感知
rustProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    logger.error(`Rust engine crashed with code ${code}`);
    this.scheduleRestart(); // 自动重启
  }
});
```

### 6.2.3 性能开销实测

对于 BidLens 的典型场景，JSON 序列化开销可以忽略：

- **文档 AST**：约 200KB JSON，序列化耗时 ~2ms
- **Embedding 向量**：768 维 float 数组，JSON 编码 ~0.1ms
- **比对结果**：Diff 结果约 100KB，序列化耗时 ~1ms

相比 AI 推理本身的耗时（Embedding 约 2-5 秒，LLM 约 10-60 秒），IPC 序列化开销占比 **< 0.1%**，完全可接受。

---

## 6.3 JSON-RPC 协议规范

### 6.3.1 消息格式基础规则

```
规则 1: 每条消息必须是合法的 JSON 对象
规则 2: 每条消息以换行符 \n 结尾（必须是 LF，不是 CRLF）
规则 3: 单条消息最大 50MB（超大 AST 传输场景）
规则 4: UTF-8 编码，无 BOM
规则 5: 消息之间不能有空行
```

**示例（一行一消息）**：
```json
{"id":"req-001","method":"ping","params":{}}
{"id":"req-001","result":{"pong":true,"version":"0.1.0","uptime_ms":12345}}
```

### 6.3.2 请求格式

```typescript
interface JsonRpcRequest {
  id: string;          // 唯一请求 ID，用于匹配响应（UUID v4 或递增 ID）
  method: string;      // 方法名，如 "compare"、"embed"、"ping"
  params: object;      // 方法参数，具体结构由方法定义
}
```

**完整请求示例**：
```json
{
  "id": "req-compare-20260710-001",
  "method": "compare",
  "params": {
    "doc_a": { "format": "docx", "ast": { /* ... 完整 AST ... */ } },
    "doc_b": { "format": "docx", "ast": { /* ... 完整 AST ... */ } },
    "options": {
      "threshold": 0.75,
      "mode": "default",
      "language": "zh-CN"
    }
  }
}
```

### 6.3.3 成功响应格式

```typescript
interface JsonRpcSuccessResponse {
  id: string;          // 与请求 id 一一对应
  result: any;         // 方法返回值，结构由方法定义
}
```

**成功响应示例**：
```json
{
  "id": "req-compare-20260710-001",
  "result": {
    "pairs": [
      {
        "a_node_id": "section-1",
        "b_node_id": "section-3",
        "similarity": 0.92,
        "a_text": "投标方应提供...",
        "b_text": "投标人须提供..."
      }
    ],
    "unmatched_a": ["section-5"],
    "unmatched_b": ["section-7"],
    "stats": {
      "total_a": 10,
      "total_b": 12,
      "matched": 8,
      "processing_time_ms": 3500
    }
  }
}
```

### 6.3.4 错误响应格式

```typescript
interface JsonRpcErrorResponse {
  id: string;          // 与请求 id 对应
  error: {
    code: number;      // 错误码（整数）
    message: string;   // 用户可读的错误描述
    details?: any;     // 可选的详细错误信息（仅开发调试用）
  }
}
```

**错误响应示例**：
```json
{
  "id": "req-compare-20260710-002",
  "error": {
    "code": -32001,
    "message": "Model not found: bge-m3. Please download the model first.",
    "details": {
      "model_id": "bge-m3",
      "expected_path": "/Users/xxx/.bidlens/models/bge-m3.onnx",
      "download_url": "https://huggingface.co/BAAI/bge-m3/resolve/main/model.onnx"
    }
  }
}
```

### 6.3.5 进度事件格式

当方法执行耗时较长时（如 `compare`），引擎会通过进度事件实时报告进度：

```typescript
interface JsonRpcProgressEvent {
  id: string;          // 与原始请求 id 对应，表示该事件属于哪个请求
  event: "progress";   // 固定为 "progress"
  data: {
    phase: string;     // 当前阶段标识
    current: number;   // 当前进度值
    total: number;     // 总进度值
    message?: string;  // 可选的人类可读进度描述
    percent: number;   // 百分比 0-100
  }
}
```

**进度事件流示例**（一次 `compare` 请求的完整进度流）：
```json
{"id":"req-001","event":"progress","data":{"phase":"parse_a","current":1,"total":5,"message":"解析文档A...","percent":10}}
{"id":"req-001","event":"progress","data":{"phase":"parse_b","current":2,"total":5,"message":"解析文档B...","percent":20}}
{"id":"req-001","event":"progress","data":{"phase":"chunk","current":3,"total":5,"message":"文本分块...","percent":40}}
{"id":"req-001","event":"progress","data":{"phase":"embed","current":4,"total":5,"message":"向量化处理中 (45/120)...","percent":60}}
{"id":"req-001","event":"progress","data":{"phase":"match","current":5,"total":5,"message":"相似度匹配...","percent":90}}
{"id":"req-001","result":{"pairs":[...],"stats":{...}}}
```

### 6.3.6 通知消息格式

通知是单向推送，没有 `id` 字段，引擎不期望收到响应：

```typescript
interface JsonRpcNotification {
  method: string;      // 通知方法名
  params: object;      // 通知参数
}
```

**通知示例**：
```json
{"method":"log","params":{"level":"info","message":"Model bge-m3 loaded successfully","timestamp":"2026-07-10T10:30:00Z"}}
{"method":"model_download_progress","params":{"model_id":"qwen2-7b","percent":45.2,"speed_mbps":12.5}}
{"method":"resource_warning","params":{"type":"memory","usage_mb":1800,"threshold_mb":2000}}
```

---

## 6.4 方法列表详解

### 6.4.1 `ping` — 心跳检测

用于检测引擎子进程是否存活，以及获取引擎基础信息。

**请求**：
```json
{
  "id": "ping-001",
  "method": "ping",
  "params": {}
}
```

**成功响应**：
```json
{
  "id": "ping-001",
  "result": {
    "pong": true,
    "version": "0.1.0",
    "engine": "bidlens-rust",
    "uptime_ms": 86400000,
    "models_loaded": ["bge-m3"],
    "memory_usage_mb": 512
  }
}
```

**调用频率**：每 15 秒一次，连续 3 次无响应判定为进程异常。

---

### 6.4.2 `compare` — 核心比对方法

这是 BidLens 最核心的方法，接收两个文档的 AST，执行 AI 比对，返回匹配结果。

**请求**：
```json
{
  "id": "compare-001",
  "method": "compare",
  "params": {
    "doc_a": {
      "format": "docx",
      "filename": "招标文件A.docx",
      "ast": {
        "type": "Document",
        "children": [
          {
            "type": "Section",
            "id": "sec-1",
            "title": "第一章 投标须知",
            "level": 1,
            "children": [
              {
                "type": "Paragraph",
                "id": "para-1-1",
                "text": "1.1 项目概况：本项目为...",
                "token_count": 150
              }
            ]
          }
        ]
      }
    },
    "doc_b": {
      "format": "docx",
      "filename": "投标文件B.docx",
      "ast": { /* 同上结构 */ }
    },
    "options": {
      "threshold": 0.75,
      "mode": "default",
      "language": "zh-CN",
      "embedding_model": "bge-m3",
      "max_chunk_tokens": 512,
      "overlap_ratio": 0.1,
      "enable_rerank": false,
      "enable_llm_confirm": false,
      "preserve_order": true
    }
  }
}
```

**成功响应**：
```json
{
  "id": "compare-001",
  "result": {
    "pairs": [
      {
        "a_node_ids": ["para-1-1", "para-1-2"],
        "b_node_ids": ["para-2-1"],
        "similarity": 0.87,
        "type": "many_to_one",
        "a_texts": ["1.1 项目概况：本项目为...", "1.2 建设地点位于..."],
        "b_texts": ["项目概况及建设地点：本项目位于..."],
        "diff": {
          "added": ["位于城北新区"],
          "removed": [],
          "modified": [
            {"a": "本项目为", "b": "本项目位于"}
          ]
        }
      }
    ],
    "unmatched_a": [
      {
        "node_ids": ["para-5-1"],
        "texts": ["5.1 特殊技术要求..."],
        "reason": "no_match_above_threshold"
      }
    ],
    "unmatched_b": [
      {
        "node_ids": ["para-8-1"],
        "texts": ["8.1 本项目采用综合评分法..."],
        "reason": "no_match_above_threshold"
      }
    ],
    "stats": {
      "total_a_nodes": 45,
      "total_b_nodes": 52,
      "total_pairs": 38,
      "avg_similarity": 0.82,
      "one_to_one": 30,
      "one_to_many": 3,
      "many_to_one": 2,
      "many_to_many": 1,
      "unmatched_a": 4,
      "unmatched_b": 5,
      "order_changes": 2,
      "processing_time_ms": 4200,
      "phases": {
        "parse_ms": 120,
        "chunk_ms": 50,
        "embed_ms": 2800,
        "match_ms": 800,
        "diff_ms": 430
      }
    }
  }
}
```

---

### 6.4.3 `embed` — 单文档 Embedding 预热

预先对单个文档执行 Embedding，结果缓存后加速后续比对。

**请求**：
```json
{
  "id": "embed-001",
  "method": "embed",
  "params": {
    "doc_hash": "sha256:abc123...",
    "ast": { /* 文档 AST */ },
    "model": "bge-m3",
    "options": {
      "max_chunk_tokens": 512,
      "overlap_ratio": 0.1
    }
  }
}
```

**成功响应**：
```json
{
  "id": "embed-001",
  "result": {
    "doc_hash": "sha256:abc123...",
    "chunks_count": 45,
    "embedding_dim": 1024,
    "processing_time_ms": 2100,
    "cache_hit": false
  }
}
```

---

### 6.4.4 `load_model` / `unload_model` — 模型生命周期管理

**请求（load_model）**：
```json
{
  "id": "lm-001",
  "method": "load_model",
  "params": {
    "model_id": "bge-m3",
    "model_type": "embedding",
    "path": "/Users/xxx/.bidlens/models/bge-m3/model.onnx",
    "options": {
      "device": "cpu",
      "num_threads": 4,
      "cache_in_memory": true
    }
  }
}
```

**成功响应**：
```json
{
  "id": "lm-001",
  "result": {
    "model_id": "bge-m3",
    "loaded": true,
    "memory_usage_mb": 320,
    "load_time_ms": 1500
  }
}
```

**请求（unload_model）**：
```json
{
  "id": "ulm-001",
  "method": "unload_model",
  "params": { "model_id": "bge-m3" }
}
```

**成功响应**：
```json
{
  "id": "ulm-001",
  "result": {
    "model_id": "bge-m3",
    "unloaded": true,
    "freed_memory_mb": 320
  }
}
```

---

### 6.4.5 `model_status` — 模型状态查询

**请求**：
```json
{
  "id": "ms-001",
  "method": "model_status",
  "params": { "model_id": "bge-m3" }
}
```

**成功响应**：
```json
{
  "id": "ms-001",
  "result": {
    "model_id": "bge-m3",
    "status": "loaded",
    "type": "embedding",
    "memory_usage_mb": 320,
    "loaded_at": "2026-07-10T10:00:00Z",
    "last_used_at": "2026-07-10T10:30:00Z",
    "usage_count": 15,
    "avg_inference_ms": 45
  }
}
```

**状态枚举值**：`not_found` | `on_disk` | `loading` | `loaded` | `error`

---

### 6.4.6 `health` — 引擎健康状态

**请求**：
```json
{
  "id": "health-001",
  "method": "health",
  "params": {}
}
```

**成功响应**：
```json
{
  "id": "health-001",
  "result": {
    "status": "healthy",
    "version": "0.1.0",
    "uptime_ms": 86400000,
    "memory": {
      "total_mb": 16384,
      "used_mb": 6144,
      "engine_mb": 820,
      "models_mb": 640
    },
    "cpu": {
      "cores": 8,
      "usage_percent": 25.5,
      "active_tasks": 1
    },
    "models": {
      "loaded": ["bge-m3"],
      "available_on_disk": ["bge-m3", "gte-base", "qwen2-7b"],
      "total_disk_usage_mb": 4500
    },
    "tasks": {
      "running": 1,
      "queued": 0,
      "completed": 156,
      "failed": 2
    }
  }
}
```

---

### 6.4.7 `cancel` — 取消进行中的任务

**请求**：
```json
{
  "id": "cancel-001",
  "method": "cancel",
  "params": {
    "task_id": "compare-001"
  }
}
```

**成功响应**：
```json
{
  "id": "cancel-001",
  "result": {
    "cancelled": true,
    "task_id": "compare-001",
    "partial_result": null
  }
}
```

**如果任务已完成**：
```json
{
  "id": "cancel-001",
  "error": {
    "code": -32010,
    "message": "Task already completed or not found"
  }
}
```

---

## 6.5 错误码体系

### 6.5.1 错误码定义表

| 错误码 | 常量名 | HTTP 等价 | 含义 | 常见原因 | 客户端处理建议 |
|--------|--------|-----------|------|----------|---------------|
| -32700 | PARSE_ERROR | 400 | JSON 解析失败 | 消息格式非法、截断 | 记录日志，检查发送端 |
| -32600 | INVALID_REQUEST | 400 | 请求格式合法但内容无效 | 缺少必要参数 | 提示用户重新操作 |
| -32601 | METHOD_NOT_FOUND | 404 | 方法不存在 | 拼写错误、版本不匹配 | 检查引擎版本 |
| -32602 | INVALID_PARAMS | 400 | 参数类型或值无效 | 参数越界、类型错误 | 提示参数校验信息 |
| -32603 | INTERNAL_ERROR | 500 | 引擎内部错误 | 未知 bug | 记录日志，上报错误 |
| -32001 | MODEL_NOT_FOUND | 404 | 模型文件不存在 | 未下载、路径错误 | 引导用户下载模型 |
| -32002 | MODEL_LOAD_FAILED | 500 | 模型加载失败 | 文件损坏、内存不足 | 提示重新下载或释放内存 |
| -32003 | EMBEDDING_FAILED | 500 | Embedding 推理失败 | 输入过长、模型异常 | 截断输入或重试 |
| -32004 | DIFF_FAILED | 500 | 比对过程失败 | AST 结构异常 | 检查文档格式 |
| -32005 | INVALID_INPUT | 400 | 输入文档无效 | AST 为空、格式不支持 | 提示用户检查文档 |
| -32006 | TIMEOUT | 408 | 操作超时 | 文档过大、模型响应慢 | 提示用户精简文档 |
| -32007 | OUT_OF_MEMORY | 507 | 内存不足 | 文档过大、模型占用高 | 关闭其他任务、升级硬件 |
| -32008 | PROCESS_CRASHED | 503 | 引擎进程崩溃 | 未知错误 | 自动重启引擎 |
| -32009 | CANCELLED | 499 | 任务被取消 | 用户主动取消 | 正常流程，无需处理 |
| -32010 | TASK_NOT_FOUND | 404 | 任务不存在 | 已完成或已清理 | 刷新任务列表 |
| -32011 | MODEL_DOWNLOAD_FAILED | 502 | 模型下载失败 | 网络异常、服务器错误 | 提示检查网络 |
| -32012 | DOCUMENT_TOO_LARGE | 413 | 文档过大 | 超过内存限制 | 提示文档页数限制 |
| -32013 | UNSUPPORTED_FORMAT | 415 | 不支持的文档格式 | 文件类型不支持 | 提示支持格式列表 |

### 6.5.2 内部错误码到用户可见错误码的映射

```typescript
// Electron 主进程中的错误码映射层
const ERROR_USER_MESSAGES: Record<number, string> = {
  [-32001]: '模型未找到，请前往设置页面下载所需模型',
  [-32002]: '模型加载失败，请尝试重新下载模型',
  [-32003]: '文档向量化失败，请检查文档内容是否正常',
  [-32004]: '文档比对失败，请检查文档格式是否支持',
  [-32005]: '文档内容无效，请确认文档未损坏且包含文字内容',
  [-32006]: '处理超时，文档可能过大，建议拆分后重试',
  [-32007]: '内存不足，请关闭其他大型应用后重试',
  [-32008]: '处理引擎异常，正在自动重启...',
  [-32009]: '任务已取消',
  [-32012]: '文档过大（超过 1000 页），请拆分后重试',
  [-32013]: '不支持该文件格式，请使用 .docx / .pdf / .wps 文件',
};

function getUserFriendlyError(error: JsonRpcError): string {
  return ERROR_USER_MESSAGES[error.code] ?? `未知错误 (${error.code}): ${error.message}`;
}
```

---

## 6.6 连接生命周期管理

### 6.6.1 子进程 Spawn

```typescript
// Rust 引擎子进程启动配置
const rustProcess = spawn(RUST_ENGINE_PATH, [], {
  stdio: ['pipe', 'pipe', 'pipe'],  // stdin, stdout, stderr 全部 pipe
  env: {
    ...process.env,
    BIDLENS_LOG_LEVEL: 'info',       // 日志级别
    BIDLENS_MODEL_DIR: modelDir,      // 模型目录
    BIDLENS_CACHE_DIR: cacheDir,      // 缓存目录
    BIDLENS_MAX_MEMORY_MB: '2048',    // 最大内存限制
    BIDLENS_WORKER_THREADS: '4',      // 工作线程数
    RUST_BACKTRACE: '1',              // Rust 错误回溯
  },
  // Windows 下隐藏控制台窗口
  windowsHide: true,
});
```

### 6.6.2 健康检查机制

```
┌─────────────────────────────────────────────────────────────┐
│                    健康检查状态机                             │
│                                                             │
│    ┌──────────┐    ping成功    ┌──────────┐                 │
│    │  Healthy  │◄────────────│ Checking  │                 │
│    └──────────┘              └──────────┘                 │
│         │                        │                          │
│         │ ping超时               │ 3次连续超时               │
│         ▼                        ▼                          │
│    ┌──────────┐              ┌──────────┐                  │
│    │ Degraded │              │  Failed  │                  │
│    └──────────┘              └──────────┘                  │
│         │                        │                          │
│         │ 恂ping成功             │ 自动重启                  │
│         ▼                        ▼                          │
│    ┌──────────┐              ┌──────────┐                  │
│    │  Healthy  │              │Restarting│                  │
│    └──────────┘              └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

**健康检查参数**：
- **ping 间隔**：15 秒
- **单次 ping 超时**：5 秒
- **降级阈值**：连续 2 次 ping 失败
- **失败阈值**：连续 3 次 ping 失败，触发重启

### 6.6.3 自动重启策略（指数退避）

```
重启次数    等待时间    累计等待
第 1 次      1 秒        1 秒
第 2 次      2 秒        3 秒
第 3 次      4 秒        7 秒
第 4 次      8 秒       15 秒
第 5 次     16 秒       31 秒
第 6 次     停止重试，提示用户手动干预
```

**最大重试次数**：5 次（指数退避，base=1s, max=16s）

### 6.6.4 优雅关闭流程

```
步骤1: 发送 SIGTERM 信号
        ↓ (等待最多 5 秒)
步骤2: 检查是否所有进行中任务已取消
        ↓
步骤3a: 如果子进程正常退出 (exit code 0)
        → 清理资源，完成关闭
步骤3b: 如果 5 秒后仍未退出
        → 发送 SIGKILL 强制终止
        → 清理资源
```

**特殊情况**：正在执行比对任务时，先发送 `cancel` 请求，等待任务取消完成，再发送 SIGTERM。

---

## 6.7 取消机制详细设计

### 6.7.1 取消流程时序图

```
客户端                      Rust 引擎
  │                           │
  │ ──── cancel(task_id) ───► │
  │                           │ 查找 task_id 对应的 CancellationToken
  │                           │ 调用 token.cancel()
  │ ◄──── cancel result ───── │
  │                           │
  │                           │ 正在执行的异步任务检测到取消信号
  │                           │ 执行资源清理（释放模型锁、清理临时数据）
  │                           │
  │ ◄──── progress:cancelled ─│ （可选的取消确认回调）
  │                           │
```

### 6.7.2 Rust 侧 CancellationToken 传播

```rust
use tokio_util::sync::CancellationToken;
use std::sync::Arc;

struct TaskContext {
    id: String,
    cancel_token: CancellationToken,
    start_time: Instant,
}

impl TaskContext {
    /// 在每个长时间操作前检查取消状态
    async fn check_cancelled(&self) -> Result<(), AppError> {
        if self.cancel_token.is_cancelled() {
            return Err(AppError::Cancelled(self.id.clone()));
        }
        Ok(())
    }

    /// 带取消检查的超时等待
    async fn wait_with_cancel(&self, duration: Duration) -> Result<(), AppError> {
        tokio::select! {
            _ = tokio::time::sleep(duration) => Ok(()),
            _ = self.cancel_token.cancelled() => {
                Err(AppError::Cancelled(self.id.clone()))
            }
        }
    }
}

// 在 compare 方法的各个阶段插入取消检查
async fn compare(ctx: &TaskContext, params: CompareParams) -> Result<CompareResult, AppError> {
    // 阶段 1: 解析
    ctx.check_cancelled().await?;
    let (ast_a, ast_b) = parse_documents(&params).await?;

    // 阶段 2: 分块
    ctx.check_cancelled().await?;
    let chunks_a = chunk_document(&ast_a, &params.options);
    let chunks_b = chunk_document(&ast_b, &params.options);

    // 阶段 3: Embedding（耗时最长，需要更频繁检查）
    ctx.check_cancelled().await?;
    let embeddings_a = embed_chunks(&ctx, &chunks_a).await?;
    let embeddings_b = embed_chunks(&ctx, &chunks_b).await?;

    // 阶段 4: 匹配
    ctx.check_cancelled().await?;
    let pairs = compute_similarity(&embeddings_a, &embeddings_b, params.options.threshold);

    // 阶段 5: Diff
    ctx.check_cancelled().await?;
    let result = compute_diff(&pairs, &ast_a, &ast_b);

    Ok(result)
}
```

---

## 6.8 流量控制与背压

### 6.8.1 消息队列缓冲

```
┌───────────────────────────────────────────────────────────────┐
│                     Node.js 侧消息队列                        │
│                                                               │
│  ┌──────────┐     ┌──────────────────┐     ┌──────────────┐  │
│  │ 发送队列  │────►│  stdin.write()   │     │   接收缓冲    │  │
│  │ (有界)    │     │  (背压感知)       │     │   (有界)      │  │
│  │ max: 100 │     │                  │     │   max: 200   │  │
│  └──────────┘     └──────────────────┘     └──────────────┘  │
│       │                                         │            │
│       │ 队列满时                                  │ 解析完成    │
│       ▼                                         ▼            │
│  ┌──────────────────┐                  ┌──────────────────┐  │
│  │ 拒绝新请求       │                  │ 分发到等待的      │  │
│  │ 返回错误码       │                  │ Promise resolver │  │
│  │ -32014           │                  │                  │  │
│  └──────────────────┘                  └──────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 6.8.2 大 AST 传输分块策略

当文档 AST 超过 10MB 时，采用分块传输：

```
策略: 大 AST 不直接嵌入 params，而是使用 "AST 指针" 机制

1. Node 侧将大 AST 写入临时文件
2. 请求中传递文件路径而非 AST 内容
3. Rust 侧从文件读取

{
  "id": "compare-002",
  "method": "compare",
  "params": {
    "doc_a": {
      "format": "docx",
      "ast_ref": "/tmp/bidlens/ast-a-uuid.json",  // 文件引用
      "ast_size_bytes": 15728640
    },
    "doc_b": {
      "format": "docx",
      "ast_ref": "/tmp/bidlens/ast-b-uuid.json",
      "ast_size_bytes": 12582912
    }
  }
}
```

### 6.8.3 内存压力检测

```rust
// Rust 侧内存监控
fn check_memory_pressure() -> MemoryStatus {
    let sys_info = sysinfo::System::new_all();
    let total = sys_info.total_memory();
    let used = sys_info.used_memory();
    let usage_ratio = used as f64 / total as f64;

    match usage_ratio {
        r if r > 0.90 => MemoryStatus::Critical,   // 暂停接收新任务
        r if r > 0.80 => MemoryStatus::High,        // 发出警告通知
        r if r > 0.70 => MemoryStatus::Elevated,    // 记录日志
        _ => MemoryStatus::Normal,
    }
}
```

---

## 6.9 调试与日志

### 6.9.1 协议日志记录

```typescript
// Node 侧协议日志格式
interface ProtocolLogEntry {
  timestamp: string;        // ISO 8601
  direction: 'send' | 'recv';
  type: 'request' | 'response' | 'progress' | 'notification' | 'error';
  id?: string;
  method?: string;
  size_bytes: number;
  latency_ms?: number;      // 仅 response 类型有此字段
  error_code?: number;      // 仅 error 类型有此字段
}

// 日志示例
// [2026-07-10T10:30:00.123Z] SEND request id=compare-001 method=compare size=245KB
// [2026-07-10T10:30:01.456Z] RECV progress id=compare-001 phase=embed percent=45
// [2026-07-10T10:30:04.789Z] RECV response id=compare-001 latency=4666ms size=12KB
```

### 6.9.2 Rust 侧 tracing 日志

```rust
// 使用 tracing crate 结构化日志
use tracing::{info, warn, error, instrument, Span};

#[instrument(skip_all, fields(task_id = %ctx.id))]
async fn compare_handler(ctx: &TaskContext, params: CompareParams) -> Result<CompareResult> {
    let _span = Span::current();

    info!(
        doc_a_chars = params.doc_a.ast.total_chars(),
        doc_b_chars = params.doc_b.ast.total_chars(),
        threshold = params.options.threshold,
        "Starting comparison"
    );

    let start = Instant::now();

    // ... 执行比对 ...

    info!(
        elapsed_ms = start.elapsed().as_millis() as u64,
        pairs_count = result.pairs.len(),
        avg_similarity = result.stats.avg_similarity,
        "Comparison completed"
    );

    Ok(result)
}

// 日志输出到 stderr（不影响 stdout 的 JSON-RPC 通信）
// [2026-07-10T10:30:00.123Z INFO  bidlens::compare] Starting comparison doc_a_chars=15000 doc_b_chars=18000 threshold=0.75
// [2026-07-10T10:30:04.789Z INFO  bidlens::compare] Comparison completed elapsed_ms=4666 pairs_count=38 avg_similarity=0.82
```

### 6.9.3 性能指标收集

```json
// health 方法返回的性能指标
{
  "performance": {
    "last_24h": {
      "total_comparisons": 56,
      "avg_compare_time_ms": 4200,
      "p50_compare_time_ms": 3800,
      "p95_compare_time_ms": 8500,
      "p99_compare_time_ms": 15000
    },
    "phase_breakdown": {
      "parse_avg_ms": 120,
      "chunk_avg_ms": 50,
      "embed_avg_ms": 2800,
      "match_avg_ms": 800,
      "diff_avg_ms": 430
    },
    "resource_usage": {
      "peak_memory_mb": 1200,
      "avg_cpu_percent": 45.2,
      "model_load_count": 23,
      "cache_hit_rate": 0.65
    }
  }
}
```

**指标存储**：使用 SQLite `performance_metrics` 表滚动存储最近 7 天的指标数据，每条记录包含完整阶段耗时、资源快照，支持后续分析优化。
