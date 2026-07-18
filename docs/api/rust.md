# Rust JSON-RPC 接口文档

> 版本：v1.0 | 最后更新：2026-07-17

---

## 一、概述

Rust 引擎通过 stdio JSON-RPC 提供服务，使用换行符分隔的 JSON 消息。

---

## 二、接口列表

### 2.1 ping

健康检查。

**请求：**

```json
{
  "id": "1",
  "method": "ping",
  "params": {}
}
```

**响应：**

```json
{
  "id": "1",
  "result": {
    "pong": true,
    "version": "0.1.0"
  }
}
```

---

### 2.2 compare

文档比对。

**请求：**

```json
{
  "id": "2",
  "method": "compare",
  "params": {
    "doc_a": { ... },
    "doc_b": { ... },
    "options": {
      "similarity_threshold": 0.45
    }
  }
}
```

**响应：**

```json
{
  "id": "2",
  "result": {
    "task_id": "...",
    "items": [...],
    "summary": { ... }
  }
}
```

---

## 三、调用示例

### 3.1 Node.js 调用

```typescript
import { spawn } from 'child_process';

const engine = spawn('bidlens-engine');

// 发送请求
const request = {
  id: '1',
  method: 'ping',
  params: {}
};
engine.stdin.write(JSON.stringify(request) + '\n');

// 接收响应
engine.stdout.on('data', (data) => {
  const response = JSON.parse(data.toString());
  console.log(response);
});
```
