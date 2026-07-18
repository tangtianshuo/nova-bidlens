# AGENT.md - Desktop 应用层

> 层级：Electron桌面应用
> 路径：apps/desktop/
> 最后更新：2026-07-17

---

## 一、模块概述

### 1.1 职责

Desktop模块是BidLens的Electron桌面应用层，负责：
- 窗口管理和系统交互
- IPC通信桥接（主进程↔渲染进程）
- 文件系统操作
- 自动更新
- UI渲染和用户交互

### 1.2 架构

`
apps/desktop/
├── electron/              # 主进程 (CommonJS)
│   └── src/main/
│       └── index.ts       # 入口，IPC处理器注册
├── src/
│   ├── main/              # 主进程代码
│   ├── renderer/          # 渲染进程 (React)
│   │   ├── components/    # 通用组件
│   │   ├── features/      # 功能模块
│   │   │   └── compare/   # 比对功能
│   │   ├── hooks/         # 自定义Hook
│   │   └── stores/        # Zustand状态
│   └── preload/           # 预加载脚本
│       └── index.ts       # contextBridge
└── package.json
`

---

## 二、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 35.x | 桌面框架 |
| React | 19.x | UI框架 |
| Vite | 6.x | 构建工具 |
| TypeScript | 5.x | 类型系统 |
| Zustand | 5.x | 状态管理 |
| TanStack Query | 5.x | 异步状态 |
| TailwindCSS | 4.x | 样式 |
| shadcn/ui | - | UI组件库 |
| Vitest | 3.x | 测试 |

---

## 三、核心模块

### 3.1 主进程 (Main Process)

`	ypescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { registerCompareHandlers } from './compare-handlers';

let mainWindow: BrowserWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
}

app.whenReady().then(() => {
    createWindow();
    registerCompareHandlers(ipcMain, mainWindow);
});
`

### 3.2 IPC处理器

`	ypescript
// src/main/compare-handlers.ts
export function registerCompareHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow) {
    ipcMain.handle('compare:start', async (event, request) => {
        // 启动比对任务
        const taskId = generateTaskId();
        
        // 异步执行比对
        executeCompare(taskId, request, (progress) => {
            mainWindow.webContents.send('compare:progress', progress);
        });
        
        return { taskId };
    });
    
    ipcMain.handle('compare:cancel', async (event, taskId) => {
        // 取消比对任务
    });
}
`

### 3.3 预加载脚本

`	ypescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { BidLensApi } from '@bidlens/shared';

const api: BidLensApi = {
    startCompare: (request) => ipcRenderer.invoke('compare:start', request),
    cancelCompare: (taskId) => ipcRenderer.invoke('compare:cancel', taskId),
    onCompareProgress: (callback) => {
        ipcRenderer.on('compare:progress', (event, progress) => callback(progress));
    },
};

contextBridge.exposeInMainWorld('bidlens', api);
`

### 3.4 渲染进程组件

`	ypescript
// src/renderer/features/compare/ReviewWorkbench.tsx
export function ReviewWorkbench({ diffAst }: { diffAst: DiffAst }) {
    return (
        <div className="grid grid-cols-3 h-full">
            <DocumentPanel title="文档A" items={diffAst.items} side="left" />
            <DiffPanel items={diffAst.items} />
            <DocumentPanel title="文档B" items={diffAst.items} side="right" />
        </div>
    );
}
`

---

## 四、关键组件

| 组件 | 路径 | 功能 |
|------|------|------|
| ReviewWorkbench | features/compare/ | 三栏比对工作台 |
| TableDiffView | components/ | 表格差异视图 |
| TableCellView | components/ | 单元格差异视图 |
| DiffItemCard | components/ | 差异项卡片 |
| DocumentPanel | components/ | 文档面板 |

---

## 五、状态管理

`	ypescript
// src/renderer/stores/compare-store.ts
import { create } from 'zustand';

interface CompareState {
    taskId: string | null;
    status: 'idle' | 'comparing' | 'completed' | 'error';
    progress: number;
    diffAst: DiffAst | null;
    error: string | null;
    
    startCompare: (request: CompareRequest) => Promise<void>;
    cancelCompare: () => void;
    reset: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
    taskId: null,
    status: 'idle',
    progress: 0,
    diffAst: null,
    error: null,
    
    startCompare: async (request) => {
        set({ status: 'comparing', progress: 0 });
        const { taskId } = await window.bidlens.startCompare(request);
        set({ taskId });
    },
    cancelCompare: () => { /* ... */ },
    reset: () => { /* ... */ },
}));
`

---

## 六、开发指南

### 6.1 命令

`ash
# 开发模式
pnpm --filter @bidlens/desktop dev

# 测试
pnpm --filter @bidlens/desktop test

# 构建
pnpm --filter @bidlens/desktop build
`

### 6.2 添加新组件

`	ypescript
// 1. 创建组件文件
// src/renderer/components/MyComponent.tsx

// 2. 创建测试文件
// src/renderer/components/MyComponent.test.tsx

// 3. 导出组件
// src/renderer/components/index.ts
export { MyComponent } from './MyComponent';
`

### 6.3 添加新的IPC处理器

`	ypescript
// 1. 在shared中定义API接口
// packages/shared/src/ipc.ts

// 2. 在主进程实现处理器
// src/main/my-handlers.ts

// 3. 在preload中桥接
// src/preload/index.ts

// 4. 在渲染进程中使用
// window.bidlens.myMethod()
`

---

## 七、测试

### 7.1 组件测试

`	ypescript
// src/renderer/components/TableDiffView.test.tsx
import { render, screen } from '@testing-library/react';
import { TableDiffView } from './TableDiffView';

describe('TableDiffView', () => {
    it('renders table with diff', () => {
        render(<TableDiffView tableA={mockTableA} tableB={mockTableB} diffResult={mockDiff} />);
        expect(screen.getByRole('table')).toBeInTheDocument();
    });
});
`

### 7.2 运行测试

`ash
# 运行所有桌面测试
pnpm --filter @bidlens/desktop test

# 运行特定测试
pnpm vitest run apps/desktop/src/renderer/components/TableDiffView.test.tsx
`

---

## 八、常见问题

| 问题 | 解决方案 |
|------|----------|
| Electron启动失败 | 检查Node.js版本，清理node_modules |
| IPC通信无响应 | 检查preload脚本是否正确加载 |
| 热更新失效 | 重启dev server |
| 构建产物过大 | 检查externals配置 |

---

## 九、相关文档

- [总架构设计](../../docs/01-总体架构设计.md)
- [React前端设计](../../docs/03-模块设计-React前端.md)
- [IPC协议设计](../../docs/06-IPC通信协议设计.md)

## 四、Vite 配置规范（重要）

## 四点五、产品窗口与标题栏

- Renderer owns the product title bar and uses a drag region for frameless/hidden-titlebar windows.
- Electron's native application menu is disabled; product commands belong in the renderer top bar.
- Development tools are opt-in and must never open automatically with the application.

### 4.1 开发服务器配置

`typescript
// apps/desktop/vite.config.ts
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,  // 必须固定端口
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'fs/promises', 'crypto', 'path', 'os', 'fs',
        'child_process', 'docx4js', 'pdf-parse'
      ]
    }
  },
});
`

### 4.2 为什么需要 strictPort: true

Electron 主进程硬编码加载 http://127.0.0.1:5173：

`typescript
// src/main/index.ts
if (isDev) {
  win.loadURL('http://127.0.0.1:5173');
}
`

如果端口 5173 被占用，Vite 会自动选择 5174、5175 等端口，但 Electron 仍然尝试连接 5173，导致加载空白页面。

### 4.3 为什么需要 ase: './'

打包后 Electron 使用 ile:// 协议加载 HTML：
`typescript
// src/main/index.ts
win.loadFile(path.join(__dirname, '../renderer/index.html'));
`

如果 ase 是默认的 /，资源路径会变成 /assets/index.js（绝对路径），在 ile:// 协议下会指向错误位置。设置 ase: './' 后路径变为 ./assets/index.js（相对路径）。

---

## 五、渲染进程导入规范（Critical）

### 5.1 导入规则

**渲染进程（src/renderer/）必须从 @bidlens/shared/types-only 导入：**

`typescript
// ✅ 正确
import type { CompareResult, DiffItem } from '@bidlens/shared/types-only';
import { isTableDiffItem } from '@bidlens/shared/types-only';

// ❌ 错误 - 会导致 crypto 模块 externalize 错误
import type { CompareResult } from '@bidlens/shared';
import { isTableDiffItem } from '@bidlens/shared';
`

### 5.2 原因

@bidlens/shared 的完整导出包含 docx4js 等依赖 Node.js 模块的解析器。渲染进程运行在浏览器环境，不能使用这些模块。

### 5.3 检查清单

- [ ] src/renderer/ 下所有 .tsx 文件的导入路径是否使用 @bidlens/shared/types-only
- [ ] 新增组件时是否正确使用 types-only 导入

