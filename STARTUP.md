# BidLens 快速启动指南

## 启动脚本说明

项目提供了两种启动脚本：

### 1. PowerShell 脚本 (start-dev.ps1)

`powershell
# 启动 Electron 开发环境（默认）
.\start-dev.ps1

# 启动 Demo 服务器
.\start-dev.ps1 -Demo

# 运行测试
.\start-dev.ps1 -Test

# 构建项目
.\start-dev.ps1 -Build
`

### 2. 批处理脚本 (start-dev.bat)

`cmd
# 启动 Electron 开发环境（默认）
start-dev.bat

# 启动 Demo 服务器
start-dev.bat demo

# 运行测试
start-dev.bat test

# 构建项目
start-dev.bat build
`

---

## 启动模式说明

### 默认模式：Electron 开发环境

启动完整的 Electron 桌面应用开发环境，包括：
- 编译 Rust 引擎
- 启动 Vite 开发服务器
- 启动 Electron 应用

**访问方式：** 自动打开 Electron 窗口

**适用场景：**
- 功能开发
- 界面调试
- 完整功能测试

---

### Demo 模式：HTTP 服务器

启动 Python HTTP 服务器，提供静态文件服务。

**访问方式：** http://localhost:8000

**适用场景：**
- 快速预览
- 无需 Electron 环境
- 演示展示

---

### Test 模式：运行测试

运行所有测试套件：
1. TypeScript 单元测试
2. Rust 单元测试
3. 集成测试

**适用场景：**
- 代码提交前验证
- CI/CD 流程
- 回归测试

---

### Build 模式：构建项目

构建生产版本：
- TypeScript 编译
- Vite 打包
- Rust 编译

**适用场景：**
- 发布前构建
- 性能测试
- 生产环境部署

---

## 环境要求

### 必需环境

- **Node.js**: >= 18.0.0
- **pnpm**: >= 9.0.0
- **Rust**: >= 1.70.0
- **Cargo**: 随 Rust 安装

### 可选环境

- **Python**: >= 3.8 (Demo 模式需要)

---

## 常见问题

### Q1: 启动时报错 "找不到 pnpm"

**解决方案：**
`ash
npm install -g pnpm
`

### Q2: Rust 编译失败

**解决方案：**
`ash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 更新 Rust
rustup update
`

### Q3: 端口被占用

**解决方案：**
`ash
# 查找占用端口的进程
netstat -ano | findstr :8000

# 终止进程
taskkill /PID <进程ID> /F
`

### Q4: 依赖安装失败

**解决方案：**
`ash
# 清除缓存
pnpm store prune

# 重新安装
pnpm install
`

---

## 开发工作流

### 日常开发

`ash
# 1. 启动开发环境
.\start-dev.ps1

# 2. 修改代码...

# 3. 运行测试
.\start-dev.ps1 -Test

# 4. 构建验证
.\start-dev.ps1 -Build
`

### 功能测试

`ash
# 1. 启动 Demo 服务器
.\start-dev.ps1 -Demo

# 2. 在浏览器中访问 http://localhost:8000

# 3. 测试功能...
`

---

## 目录结构

`
nova-bidlens/
├── apps/
│   └── desktop/          # Electron 应用
├── bidlens-engine/       # Rust 引擎
├── demo/                 # 演示文件
├── packages/
│   └── shared/           # 共享代码
├── start-dev.ps1         # PowerShell 启动脚本
├── start-dev.bat         # 批处理启动脚本
└── package.json          # 项目配置
`

---

## 更多信息

- [架构设计文档](AI文档智能比对平台-架构设计文档.md)
- [开发计划](docs/02-v02-full-fidelity-plan.md)
- [API 文档](docs/06-IPC通信协议设计.md)
