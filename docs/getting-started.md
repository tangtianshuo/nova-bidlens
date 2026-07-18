# 快速上手指南

> 版本：v1.0 | 最后更新：2026-07-17

---

## 一、环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | JavaScript运行时 |
| pnpm | >= 9 | 包管理器 |
| Rust | >= 1.75 | 系统编程语言 |
| Git | >= 2.30 | 版本控制 |

---

## 二、环境搭建

### 2.1 安装 Node.js

```bash
# Windows (使用 winget)
winget install OpenJS.NodeJS.LTS

# 或下载安装包
# https://nodejs.org/
```

### 2.2 安装 pnpm

```bash
npm install -g pnpm
```

### 2.3 安装 Rust

```bash
# Windows
winget install Rustlang.Rustup

# 或使用安装脚本
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

## 三、项目初始化

### 3.1 克隆项目

```bash
git clone <repository-url>
cd nova-bidlens
```

### 3.2 安装依赖

```bash
pnpm install
```

### 3.3 构建项目

```bash
# 构建全部（TypeScript + Rust）
pnpm build
```

---

## 四、开发流程

### 4.1 启动开发服务器

```bash
# 完整开发模式（Vite + Electron）
pnpm dev

# 仅前端开发
pnpm --filter @bidlens/desktop dev:renderer
```

### 4.2 运行测试

```bash
# 所有测试
pnpm test

# TypeScript测试
pnpm test:ts

# Rust测试
pnpm test:rust

# 集成测试
pnpm test:integration
```

### 4.3 代码检查

```bash
# TypeScript类型检查
pnpm --filter @bidlens/shared build
pnpm --filter @bidlens/desktop build

# Rust检查
cargo clippy --manifest-path bidlens-engine/Cargo.toml
```

---

## 五、项目结构

```
nova-bidlens/
├── apps/desktop/          # Electron应用
│   ├── src/main/          # 主进程
│   └── src/renderer/      # 渲染进程 (React)
├── packages/shared/       # 共享类型、IPC契约
├── bidlens-engine/        # Rust工作区
│   ├── crates/
│   │   ├── document-ast/  # AST数据结构
│   │   ├── diff-engine/   # Diff算法
│   │   └── table-diff/    # 表格Diff
│   └── src/main.rs        # JSON-RPC入口
├── docs/                  # 设计文档
└── tests/                 # 集成测试
```

---

## 六、调试技巧

### 6.1 Electron调试

```bash
# 启动开发模式
pnpm dev

# 打开DevTools
# 在Electron窗口中按 F12 或 Ctrl+Shift+I
```

### 6.2 Rust调试

```bash
# 使用RUST_LOG环境变量
RUST_LOG=debug cargo run --manifest-path bidlens-engine/Cargo.toml

# 使用cargo test运行单个测试
cargo test --manifest-path bidlens-engine/Cargo.toml test_name
```

### 6.3 TypeScript调试

```bash
# 运行单个测试文件
pnpm vitest run packages/shared/src/parser/docx-table.test.ts

# 查看详细输出
pnpm test:ts -- --reporter=verbose
```

---

## 七、常见问题

### 7.1 构建失败

```bash
# 清理并重新构建
pnpm clean
pnpm install
pnpm build

# Rust编译错误
cargo update --manifest-path bidlens-engine/Cargo.toml
```

### 7.2 测试失败

```bash
# 查看详细错误
pnpm test:ts -- --reporter=verbose

# 运行单个测试
pnpm vitest run packages/shared/src/parser/docx-table.test.ts
```

### 7.3 依赖问题

```bash
# 重新安装依赖
rm -rf node_modules
pnpm install
```

---

## 八、相关文档

- [架构概述](architecture.md) - 系统架构
- [编码规范](coding_style.md) - 代码规范
- [API文档](api/) - 接口文档
- [版本路线图](roadmap.md) - 版本规划
