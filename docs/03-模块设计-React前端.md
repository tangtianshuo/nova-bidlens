# 3. React 前端模块设计

## 3.1 前端技术架构总览

### 3.1.1 技术栈选型

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| Vite | 6.x | 构建工具 | 毫秒级HMR, 原生ESM支持, 构建速度远优于Webpack |
| React | 19.x | UI框架 | Server Components(未来扩展), use() Hook, 改进的Suspense |
| TypeScript | 5.7+ | 类型系统 | 严格模式, 装饰器支持, satisfies运算符 |
| TailwindCSS | 4.x | 原子化CSS | JIT引擎, 零运行时, 与shadcn/ui深度集成 |
| shadcn/ui | latest | 组件库 | 可复制组件, 基于Radix UI, 完全可控 |
| Zustand | 5.x | 状态管理 | 极简API, 无Provider, 支持middleware |
| TanStack Query | 5.x | 异步状态 | 缓存/重试/乐观更新, 与IPC天然契合 |
| Framer Motion | 12.x | 动画库 | 声明式动画, layout animation, 手势支持 |

### 3.1.2 构建流水线

```
┌─────────────────────────────────────────────────────────────┐
│                     Vite Build Pipeline                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Source (.tsx/.ts)                                           │
│       │                                                      │
│       ▼                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │ TypeScript│───▶│ PostCSS  │───▶│  esbuild │               │
│  │   tsc     │    │ +TW JIT  │    │  bundle  │               │
│  └──────────┘    └──────────┘    └──────────┘               │
│       │                              │                       │
│       ▼                              ▼                       │
│  ┌──────────┐              ┌──────────────────┐             │
│  │ Type     │              │   Code Splitting  │             │
│  │ Checking │              │   (React.lazy)    │             │
│  └──────────┘              └──────────────────┘             │
│                                    │                         │
│                                    ▼                         │
│                          ┌──────────────────┐               │
│                          │   Output (dist/)  │               │
│                          │   index.html      │               │
│                          │   assets/*.js/css │               │
│                          └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

开发模式下, Vite 利用 ESM 按需编译, 首屏加载仅编译当前路由所需模块。生产模式下, 通过 Rollup 进行 Tree Shaking 和 Code Splitting, 将 React、图表库、编辑器等大型依赖拆分为独立 chunk。

### 3.1.3 目录结构

```
src/
├── main/                   # Electron main process 入口
├── preload/                # preload 脚本 (contextBridge)
├── renderer/               # React 前端应用
│   ├── app/                # 应用入口, 路由配置, 全局Provider
│   ├── features/           # 按功能域组织
│   │   ├── home/           # 首页模块
│   │   ├── compare/        # 比对模块 (核心)
│   │   ├── settings/       # 设置模块
│   │   └── plugin-store/   # 插件市场模块
│   ├── shared/             # 共享层
│   │   ├── components/     # 通用UI组件
│   │   ├── hooks/          # 自定义Hooks
│   │   ├── stores/         # Zustand stores
│   │   ├── queries/        # TanStack Query 定义
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 共享类型定义
│   └── assets/             # 静态资源
└── shared/                 # main/renderer 共享的类型和常量
```

---

## 3.2 路由设计

### 3.2.1 路由配置

采用 React Router v7 的 Data Router 模式, 支持 loader/action 的全栈路由能力:

```typescript
// src/renderer/app/router.tsx
import { createHashRouter } from 'react-router-dom';

const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      {
        path: 'home',
        element: <HomePage />,
        loader: homeLoader,        // 预加载最近比对记录
      },
      {
        path: 'compare',
        element: <ComparePage />,
      },
      {
        path: 'compare/:taskId',
        element: <ComparePage />,
        loader: compareLoader,     // 加载指定任务的结果
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        children: [
          { index: true, element: <Navigate to="models" replace /> },
          { path: 'models', element: <ModelSettings /> },
          { path: 'api', element: <ApiSettings /> },
          { path: 'cache', element: <CacheSettings /> },
          { path: 'appearance', element: <AppearanceSettings /> },
        ],
      },
      {
        path: 'plugins',
        element: <PluginStorePage />,
      },
    ],
  },
]);
```

使用 HashRouter 而非 BrowserRouter, 因为 Electron 的 file:// 协议不支持 History API 的服务端配合。

### 3.2.2 页面结构与导航流

```
┌──────────────────────────────────────────────────────┐
│  ┌──────┐  ┌────────┐  ┌────────┐  ┌──────┐         │
│  │ 首页  │  │ 比对   │  │ 设置   │  │ 插件 │  ← Tab  │
│  └──────┘  └────────┘  └────────┘  └──────┘         │
│  ────────────────────────────────────────────────    │
│                                                      │
│  /home          /compare/:taskId    /settings         │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │ 最近记录  │   │ 文件拖拽区    │   │ 模型管理    │  │
│  │ 新建比对  │   │ 配置面板      │   │ API配置     │  │
│  │ 快速搜索  │   │ 进度展示      │   │ 缓存管理    │  │
│  │          │   │ 结果展示      │   │ 外观设置    │  │
│  └──────────┘   └──────────────┘   └─────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 3.3 状态管理架构

### 3.3.1 状态分层策略

前端状态分为三层, 各层使用不同技术:

```
┌─────────────────────────────────────────────────┐
│                  状态管理分层                      │
├─────────────┬─────────────────┬─────────────────┤
│   UI State  │  Domain State   │  Server State   │
│  (Zustand)  │   (Zustand)     │ (TanStack Query)│
├─────────────┼─────────────────┼─────────────────┤
│ 主题/语言    │ 当前比对配置     │ 比对任务结果     │
│ 侧边栏展开  │ 模型列表         │ 模型下载进度     │
│ 活动Tab     │ 插件列表         │ 插件安装状态     │
│ 弹窗开关    │ 历史记录         │ 系统信息         │
│ 滚动位置    │ 用户偏好         │ 缓存统计         │
└─────────────┴─────────────────┴─────────────────┘
```

### 3.3.2 Zustand Stores 设计

**Store 划分原则**: 按业务域拆分, 避免单一巨型 store。每个 store 使用 Zustand 的 `create` 函数, 配合 `devtools` 和 `persist` 中间件。

```typescript
// compareStore.ts — 比对核心状态
interface CompareState {
  // 文件选择
  fileA: FileRef | null;
  fileB: FileRef | null;

  // 比对配置
  config: CompareConfig;

  // 当前任务
  currentTaskId: string | null;
  taskStatus: 'idle' | 'parsing' | 'comparing' | 'done' | 'error';
  progress: ProgressInfo | null;

  // 结果视图状态
  activeView: 'base' | 'side-by-side' | 'timeline';
  highlightMode: 'segment' | 'char';
  filterTypes: DiffType[];

  // Actions
  setFileA: (file: FileRef | null) => void;
  setFileB: (file: FileRef | null) => void;
  updateConfig: (patch: Partial<CompareConfig>) => void;
  startCompare: () => Promise<void>;
  cancelCompare: () => void;
  resetCompare: () => void;
  setActiveView: (view: CompareState['activeView']) => void;
}

// settingsStore.ts — 系统设置状态
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  cacheSizeLimit: number;       // MB
  autoCleanup: boolean;

  setTheme: (theme: SettingsState['theme']) => void;
  setLanguage: (lang: SettingsState['language']) => void;
  setCacheSizeLimit: (mb: number) => void;
}

// modelStore.ts — 本地模型管理状态
interface ModelState {
  installedModels: LocalModel[];
  downloadingModels: Map<string, DownloadProgress>;
  activeEmbeddingModel: string | null;
  activeLlmModel: string | null;

  installModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  setActiveEmbedding: (modelId: string) => void;
  setActiveLlm: (modelId: string) => void;
}

// pluginStore.ts — 插件管理状态
interface PluginState {
  installedPlugins: PluginManifest[];
  availablePlugins: PluginManifest[];
  pluginConfigs: Record<string, Record<string, unknown>>;

  installPlugin: (pluginId: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  updatePluginConfig: (pluginId: string, config: Record<string, unknown>) => void;
}
```

### 3.3.3 TanStack Query 设计

IPC 调用本质上是异步远程过程调用, 天然适合 TanStack Query 的 fetch/query 模型。

```typescript
// queries/useCompareQuery.ts
export function useCompareResult(taskId: string | null) {
  return useQuery({
    queryKey: ['compare', 'result', taskId],
    queryFn: () => window.api.compare.getResult(taskId!),
    enabled: !!taskId,
    staleTime: Infinity,           // 比对结果不会过期
    retry: false,                  // 不自动重试 (比对是幂等但昂贵的)
  });
}

// queries/useModelQuery.ts
export function useModelDownload(modelId: string) {
  return useQuery({
    queryKey: ['model', 'download', modelId],
    queryFn: () => window.api.model.getDownloadStatus(modelId),
    refetchInterval: (query) => {
      return query.state.data?.status === 'downloading' ? 500 : false;
    },
  });
}

// queries/useSystemInfo.ts
export function useSystemInfo() {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: () => window.api.system.getInfo(),
    staleTime: 30_000,             // 30秒刷新一次
  });
}
```

### 3.3.4 状态流转图

比对任务的完整状态流转:

```
                    ┌──────────┐
                    │   idle   │ ← 用户选择文件
                    └────┬─────┘
                         │ startCompare()
                         ▼
                    ┌──────────┐
                    │ parsing  │ ← Node层解析文档
                    └────┬─────┘
                         │ 解析完成
                         ▼
                    ┌──────────┐
                    │comparing │ ← Rust层执行比对
                    └────┬─────┘
                         │
                    ┌────┴────┐
                    ▼         ▼
              ┌──────┐   ┌───────┐
              │ done │   │ error │
              └──────┘   └───────┘
                              │
                              ▼
                    ┌──────────────┐
                    │ retry / idle │
                    └──────────────┘

  任何状态下 cancelCompare() → idle
```

---

## 3.4 页面设计详解

### 3.4.1 Home 页

Home 页作为用户进入应用的首屏, 提供快速导航和历史回溯。

```
┌──────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────┐ │
│  │  🔍 搜索历史记录...                          │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │           新建比对                            │ │
│  │  ┌─────────┐          ┌─────────┐           │ │
│  │  │  文档A  │   VS     │  文档B  │  [开始]   │ │
│  │  │ + 拖拽  │          │ + 拖拽  │           │ │
│  │  └─────────┘          └─────────┘           │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  最近比对 ───────────────────────────────────────  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ 投标书  │ │ 投标书  │ │ 投标书  │ │ 投标书  │    │
│  │ A vs B │ │ C vs D │ │ E vs F │ │ G vs H │    │
│  │ 7月8日 │ │ 7月6日 │ │ 7月3日 │ │ 6月28日│    │
│  │ 42差异 │ │ 18差异 │ │ 105差异│ │ 7差异  │    │
│  └────────┘ └────────┘ └────────┘ └────────┘    │
└──────────────────────────────────────────────────┘
```

**核心功能**:
- **快速搜索**: 按文件名、日期、差异数量过滤历史记录, 使用 Fuse.js 进行模糊搜索
- **最近记录列表**: 展示最近 20 条比对记录, 包含文件名摘要、比对日期、差异数量统计
- **新建比对入口**: 双文件拖拽区, 支持直接拖入 .docx/.pdf 文件

### 3.4.2 Compare 页

Compare 页是核心功能页, 包含文件选择、配置、进度、结果展示四个区域, 根据任务状态动态切换显示。

**文件选择阶段**:
```
┌──────────────────────────────────────────────────────┐
│  文件选择                                             │
│  ┌──────────────┐    VS    ┌──────────────┐          │
│  │   📄 docA    │          │   📄 docB    │          │
│  │  投标书v1    │          │  投标书v2    │          │
│  │  2.3MB · 45页│          │  2.5MB · 48页│          │
│  └──────────────┘          └──────────────┘          │
│                                                       │
│  配置面板                                             │
│  模式: ○快速  ●标准  ○深度                             │
│  相似度阈值: ──────●────── 0.75                       │
│  保真级别: ○L1  ○L2  ●L3  ○L4                        │
│  □ 启用语义匹配  □ 检测格式差异  □ 检测顺序变化        │
│                                                       │
│  [        开始比对        ]                            │
└──────────────────────────────────────────────────────┘
```

**进度展示阶段**:
```
┌──────────────────────────────────────────────────────┐
│  比对进行中...                                        │
│                                                       │
│  ┌─ 阶段1: 解析文档A ────────── 100% ✓ ─┐            │
│  ├─ 阶段2: 解析文档B ────────── 78%  ──┤            │
│  ├─ 阶段3: 生成嵌入向量 ──────── 0%   ──┤            │
│  ├─ 阶段4: 执行比对 ──────────── 0%   ──┤            │
│  └─ 阶段5: 生成报告 ──────────── 0%   ──┘            │
│                                                       │
│  预计剩余: 2分15秒                    [取消]           │
└──────────────────────────────────────────────────────┘
```

**结果展示阶段**: 见 3.6 节详细设计。

### 3.4.3 Settings 页

Settings 页采用左侧导航 + 右侧内容的经典布局:

- **模型管理**: 列出所有可用本地模型, 显示已安装/未安装状态, 支持一键下载/删除, 显示模型大小和性能基准
- **外部API配置**: OpenAI-compatible API 的 endpoint/key/model 配置, 连通性测试按钮
- **缓存管理**: 显示当前缓存大小, LRU 清理按钮, 磁盘空间上限设置, 单条缓存查看/删除
- **外观设置**: 主题切换 (亮/暗/跟随系统), 语言切换, 字体大小

### 3.4.4 PluginStore 页

```
┌──────────────────────────────────────────────────────┐
│  插件市场                          [开发文档 →]        │
│                                                       │
│  ┌─ 已安装 ──────────────────────────────────────┐   │
│  │  📊 报表导出插件  v1.2    [配置] [卸载]        │   │
│  │  📝 自定义规则    v0.8    [配置] [卸载]        │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
│  ┌─ 可用插件 ────────────────────────────────────┐   │
│  │  🔄 批量比对      v2.0    12.3K下载  [安装]    │   │
│  │  📈 差异统计增强  v1.1    5.6K下载   [安装]    │   │
│  │  🌐 翻译对照      v0.5    2.1K下载   [安装]    │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## 3.5 核心组件设计

### 3.5.1 FileDropZone 组件

文件拖拽区是用户交互的起点, 需要处理多种输入场景:

```typescript
interface FileDropZoneProps {
  label: 'A' | 'B';                    // 标记是文档A还是文档B
  accept: string[];                     // 允许的MIME类型
  maxSize: number;                      // 最大文件大小 (MB)
  value: FileRef | null;               // 当前选中的文件
  onChange: (file: FileRef | null) => void;
  onError: (error: DropError) => void;
}

interface FileRef {
  path: string;                         // 本地文件路径
  name: string;                         // 文件名
  size: number;                         // 文件大小 (bytes)
  type: string;                         // MIME类型
  lastModified: number;                 // 最后修改时间
}
```

**验证流程**:
1. 检查文件扩展名 (.docx, .doc, .pdf, .md, .html)
2. 检查文件大小 (默认上限 100MB)
3. 检查文件可读性 (尝试读取文件头)
4. 检查文件是否损坏 (对 .docx 尝试 ZIP 解压)
5. 通过后调用 `onChange` 回调, 失败则调用 `onError`

**交互状态**: `idle` → `hover` (拖入高亮) → `loading` (验证中) → `ready` (文件就绪) → `error` (验证失败)

### 3.5.2 CompareConfigPanel 组件

配置面板提供比对参数的可视化调整:

```typescript
interface CompareConfig {
  mode: 'fast' | 'standard' | 'deep';  // 比对模式
  similarityThreshold: number;          // 语义相似度阈值 [0, 1]
  fidelityLevel: 1 | 2 | 3 | 4 | 5;   // 保真级别
  enableSemanticMatch: boolean;         // 启用语义匹配
  enableFormatDiff: boolean;            // 检测格式差异
  enableOrderDetection: boolean;        // 检测顺序变化
  enableCommentDiff: boolean;           // 检测批注差异
  enableRevisionDiff: boolean;          // 检测修订差异
  externalApiEndpoint?: string;         // 外部API端点
  externalApiKey?: string;              // 外部API密钥
  externalApiModel?: string;            // 外部API模型名
}
```

**三种模式预设**:
| 参数 | 快速模式 | 标准模式 | 深度模式 |
|------|----------|----------|----------|
| 相似度阈值 | 0.6 | 0.75 | 0.85 |
| 保真级别 | L1 | L3 | L5 |
| 语义匹配 | 关 | 开 | 开 |
| 格式差异 | 关 | 开 | 开 |
| 顺序检测 | 关 | 关 | 开 |
| 预估耗时 (50页) | ~10s | ~30s | ~90s |

### 3.5.3 ProgressDisplay 组件

多阶段进度展示, 支持预估时间和取消操作:

```typescript
interface ProgressInfo {
  stages: StageInfo[];
  currentStage: number;
  overallPercent: number;             // 0-100
  estimatedRemainingMs: number | null;
  cancellable: boolean;
}

interface StageInfo {
  id: string;
  label: string;
  percent: number;                    // 0-100
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  detail?: string;                    // 阶段详情 (如 "解析第23页")
}
```

**预估时间算法**: 基于前几个阶段的实际耗时, 结合历史任务数据的线性回归模型。对于首次运行的文档规模, 使用基于页数的经验公式。

### 3.5.4 DiffResultView 组件

DiffResultView 是结果展示的容器组件, 管理三种视图的切换:

```typescript
interface DiffResultViewProps {
  diffResult: DiffAST;
  docA: DocumentAST;
  docB: DocumentAST;
  activeView: 'base' | 'side-by-side' | 'timeline';
  highlightMode: 'segment' | 'char';
  filterTypes: DiffType[];
}
```

---

## 3.6 三种 Diff 展示视图详细设计

### 3.6.1 BaseDocView (基准文档模式)

以文档 A 为骨架展示完整内容, 在差异位置嵌入差异标记。

```
┌────────────────────────────────────────────────────┐
│ 基准文档视图                    ○逐段 ●逐字  [筛选] │
├────────────────────────────────────────────────────┤
│                                                     │
│  第一章 项目概述                                     │
│                                                     │
│  本项目旨在建设一套智慧园区管理平台, 包含以下子系统:  │
│                                                     │
│  ┌─ 删除 ────────────────────────────────────┐      │
│  │ 1. 智慧安防系统 (含视频监控、门禁管理)     │      │
│  └───────────────────────────────────────────┘      │
│  ┌─ 新增 ────────────────────────────────────┐      │
│  │ 1. 智慧安防系统 (含AI视频分析、人脸门禁)   │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  2. 智慧能源管理系统                                 │
│  3. 智慧停车管理系统                                 │
│  ┌─ 修改 ────────────────────────────────────┐      │
│  │ 4. 数据可视化平台 → 大数据决策平台          │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  项目总投资约 ██████ 万元。                          │
│  ┌─ 修改: 3500 → 4200 ──────────────────────┐      │
│  │ [3500] → [4200]                           │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
└────────────────────────────────────────────────────┘
```

**实现要点**:
- 逐段模式: 整个差异段落高亮, 性能最优, 适合快速浏览
- 逐字模式: hover 差异段落时展开逐字 diff, 使用 Myers diff 算法精确标出字符级变化
- 差异标记支持展开/折叠, 默认折叠状态仅显示差异数量统计

### 3.6.2 SideBySideView (双栏对比模式)

左右两栏分别展示文档 A 和文档 B, 差异行高亮, 支持同步滚动。

```
┌──────────────────────────────────────────────────────┐
│ 双栏对比                               [同步滚动 🔗]  │
├────────────────────────┬─────────────────────────────┤
│     文档A (基准)        │     文档B (比较)             │
├────────────────────────┼─────────────────────────────┤
│                        │                              │
│ 1│第一章 项目概述       │ 1│第一章 项目概述            │
│  │                     │  │                           │
│ 2│本项目旨在建设一套... │ 2│本项目旨在建设一套...       │
│  │                     │  │                           │
│▓3│1. 智慧安防系统      │▓3│1. 智慧安防系统             │
│  │(含视频监控、门禁)   │  │(含AI视频分析、人脸门禁)    │
│  │                     │  │                           │
│ 4│2. 智慧能源管理系统   │ 4│2. 智慧能源管理系统         │
│  │                     │  │                           │
│ 5│3. 智慧停车管理系统   │ 5│3. 智慧停车管理系统         │
│  │                     │  │                           │
│▓6│4. 数据可视化平台     │▓6│4. 大数据决策平台           │
│  │                     │  │                           │
│ 7│项目总投资约3500万元  │ 7│项目总投资约4200万元        │
│  │                     │  │                           │
│ 8│                    │ 8│                            │
│  │     (空行)          │  │4.5 智慧运维系统 (新增段落)  │
│  │                     │  │                           │
├────────────────────────┴─────────────────────────────┤
│ 差异统计: 修改12处 · 新增5段 · 删除3段                 │
└──────────────────────────────────────────────────────┘
```

**同步滚动机制**:
1. 两侧文档各使用独立的虚拟滚动容器
2. 通过匹配锚点 (Match Anchor) 建立行级对应关系
3. 滚动事件防抖 (16ms), 计算对侧目标滚动位置
4. 使用 `requestAnimationFrame` 确保丝滑滚动
5. 未匹配区域使用空白占位符保持对齐

### 3.6.3 TimelineView (时间线模式)

按差异类型分组展示, 适合快速定位特定类型的差异。

```
┌──────────────────────────────────────────────────────┐
│ 时间线视图    [全部] [文本] [格式] [表格] [批注]       │
├──────────────────────────────────────────────────────┤
│                                                      │
│ 📝 文本差异 (12处)                                   │
│ ├── §1.1  "智慧安防系统" → "智慧安防系统(AI升级)"     │
│ ├── §1.3  "数据可视化平台" → "大数据决策平台"         │
│ ├── §2.1  删除段落: "本节内容暂缺"                    │
│ ├── §3.2  新增段落: "系统采用微服务架构..."            │
│ └── ... (展开查看更多)                                │
│                                                      │
│ 🎨 格式差异 (8处)                                    │
│ ├── §1.1  标题字号: 小二 → 小三                       │
│ ├── §2.3  段落行距: 1.5 → 1.75                       │
│ ├── §4.1  表格边框: 单线 → 双线                       │
│ └── ...                                               │
│                                                      │
│ 📊 表格差异 (3处)                                    │
│ ├── §2.2  "人员配置表" 列数变化: 5→7                  │
│ ├── §3.4  "报价清单" 单元格值修改: 12处               │
│ └── §5.1  "技术参数表" 行顺序调整                     │
│                                                      │
│ 💬 批注差异 (2处)                                    │
│ ├── §1.1  docA新增批注: "此处需核实"                  │
│ └── §3.2  docB删除批注: "待补充"                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**功能特性**:
- 按差异类型分组, 每组显示计数
- 支持多选筛选 (如同时查看文本+表格差异)
- 点击任意差异项跳转到 BaseDocView 或 SideBySideView 的对应位置
- 支持按位置排序 (文档顺序) 或按严重程度排序

---

## 3.7 虚拟滚动实现

### 3.7.1 核心挑战

文档比对场景的虚拟滚动面临独特挑战:
- 每个列表项高度不固定 (段落长度差异巨大)
- 需要支持动态展开/折叠 (hover 逐字 diff)
- 双栏同步滚动需要精确的高度对齐
- 1000 页文档约有 15,000+ 段落, DOM 节点必须严格控制

### 3.7.2 动态测量 + 预估高度策略

```
┌───────────────────────────────────────────┐
│          虚拟滚动高度计算策略               │
├───────────────────────────────────────────┤
│                                            │
│  1. 预估阶段 (渲染前)                      │
│     avgCharWidth × charCount + padding     │
│     ↓                                      │
│  2. 测量阶段 (首屏渲染后)                  │
│     ResizeObserver 实测高度                │
│     ↓                                      │
│  3. 缓存阶段                               │
│     Map<nodeId, measuredHeight>            │
│     ↓                                      │
│  4. 预测阶段 (滚动时)                      │
│     已测量区域用实测值                      │
│     未测量区域用插值预测                    │
│                                            │
└───────────────────────────────────────────┘
```

```typescript
class VirtualScrollManager {
  private measuredHeights: Map<string, number> = new Map();
  private estimatedItemHeight: number = 24;  // 初始预估

  // 更新平均高度 (基于已测量样本)
  updateEstimate(): void {
    if (this.measuredHeights.size > 10) {
      const values = Array.from(this.measuredHeights.values());
      this.estimatedItemHeight = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  // 获取某项的高度 (优先使用实测值)
  getItemHeight(nodeId: string): number {
    return this.measuredHeights.get(nodeId) ?? this.estimatedItemHeight;
  }

  // 计算从 index=0 到指定 index 的累计高度
  getCumulativeHeight(index: number): number {
    let height = 0;
    for (let i = 0; i < index; i++) {
      height += this.getItemHeight(this.nodeIds[i]);
    }
    return height;
  }
}
```

### 3.7.3 渲染窗口管理

```
┌─────────────────────────────────────────────┐
│         渲染窗口 (Viewport) 管理             │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─── overscan (上方缓冲) ───┐              │
│  │  recycled DOM nodes       │              │
│  ├────────────────────────────┤              │
│  │                            │              │
│  │  ┌─── viewport ─────────┐ │              │
│  │  │  visible items       │ │              │
│  │  │  (实际渲染的DOM)      │ │              │
│  │  └─────────────────────┘ │              │
│  │                            │              │
│  ├────────────────────────────┤              │
│  │  recycled DOM nodes       │              │
│  └─── overscan (下方缓冲) ───┘              │
│                                              │
│  overscan = max(5, viewport_height / 50)    │
│  总渲染节点 = visible + 2 × overscan        │
│                                              │
└─────────────────────────────────────────────┘
```

### 3.7.4 DOM 节点回收策略

对于 1000 页文档 (约 15,000 段落), 同时存在 15,000 个 DOM 节点是不可接受的。采用对象池模式:

```typescript
class DOMRecycler {
  private pool: HTMLElement[] = [];
  private readonly maxPoolSize = 200;

  acquire(): HTMLElement {
    return this.pool.pop() ?? document.createElement('div');
  }

  release(element: HTMLElement): void {
    element.textContent = '';
    element.className = '';
    element.removeAttribute('style');
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(element);
    }
  }
}
```

---

## 3.8 差异高亮渲染

### 3.8.1 逐段高亮 (默认模式)

渲染性能最优, 将整个差异段落作为一个高亮单元:

```typescript
interface SegmentHighlight {
  nodeId: string;
  diffType: DiffType;     // 'add' | 'delete' | 'modify' | 'format' | 'reorder'
  severity: 'info' | 'warning' | 'critical';
  summary: string;         // 差异摘要
}
```

### 3.8.2 逐字 Diff 展开 (Hover 触发)

用户 hover 差异段落时, 动态计算并渲染逐字差异:

```typescript
function renderCharDiff(oldText: string, newText: string): DiffSegment[] {
  // 使用 patience diff 算法 (比 Myers 更适合文档场景)
  const diff = patienceDiff(oldText, newText);

  return diff.map(segment => ({
    text: segment.value,
    type: segment.type,     // 'equal' | 'insert' | 'delete' | 'replace'
    oldStart: segment.oldStart,
    newStart: segment.newStart,
  }));
}
```

### 3.8.3 颜色系统

```
┌─────────────────────────────────────────────┐
│          差异颜色系统 (亮色主题)              │
├──────────┬──────────┬───────────────────────┤
│ 差异类型  │ 高亮色    │ 背景色                │
├──────────┼──────────┼───────────────────────┤
│ 新增     │ #16a34a  │ #dcfce7 (绿)          │
│ 删除     │ #dc2626  │ #fef2f2 (红)          │
│ 修改     │ #ca8a04  │ #fef9c3 (黄)          │
│ 格式     │ #2563eb  │ #dbeafe (蓝)          │
│ 顺序     │ #9333ea  │ #f3e8ff (紫)          │
├──────────┴──────────┴───────────────────────┤
│ 暗色主题自动切换为深色背景 + 浅色文字         │
└─────────────────────────────────────────────┘
```

### 3.8.4 动画过渡

差异高亮的出现/消失使用 CSS transition:
- 背景色渐变: `transition: background-color 200ms ease`
- 展开/折叠: Framer Motion 的 `AnimatePresence` + `layoutId`
- 滚动跳转: `scroll-behavior: smooth` + 自定义缓动函数

---

## 3.9 IPC 通信层 (前端侧)

### 3.9.1 Preload 脚本设计

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // ─── 比对相关 ───
  compare: {
    start: (fileA: string, fileB: string, config: CompareConfig) =>
      ipcRenderer.invoke('compare:start', fileA, fileB, config),

    cancel: (taskId: string) =>
      ipcRenderer.invoke('compare:cancel', taskId),

    getResult: (taskId: string) =>
      ipcRenderer.invoke('compare:getResult', taskId),

    onProgress: (callback: (progress: ProgressInfo) => void) => {
      const handler = (_event: any, progress: ProgressInfo) => callback(progress);
      ipcRenderer.on('compare:progress', handler);
      return () => ipcRenderer.removeListener('compare:progress', handler);
    },
  },

  // ─── 文档解析相关 ───
  parser: {
    parse: (filePath: string, options: ParseOptions) =>
      ipcRenderer.invoke('parser:parse', filePath, options),

    getSupportedFormats: () =>
      ipcRenderer.invoke('parser:getSupportedFormats'),
  },

  // ─── 模型管理相关 ───
  model: {
    list: () =>
      ipcRenderer.invoke('model:list'),

    install: (modelId: string) =>
      ipcRenderer.invoke('model:install', modelId),

    remove: (modelId: string) =>
      ipcRenderer.invoke('model:remove', modelId),

    getDownloadStatus: (modelId: string) =>
      ipcRenderer.invoke('model:downloadStatus', modelId),

    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
      const handler = (_event: any, progress: DownloadProgress) => callback(progress);
      ipcRenderer.on('model:downloadProgress', handler);
      return () => ipcRenderer.removeListener('model:downloadProgress', handler);
    },
  },

  // ─── 插件管理相关 ───
  plugin: {
    list: () =>
      ipcRenderer.invoke('plugin:list'),

    install: (pluginId: string) =>
      ipcRenderer.invoke('plugin:install', pluginId),

    uninstall: (pluginId: string) =>
      ipcRenderer.invoke('plugin:uninstall', pluginId),

    getConfig: (pluginId: string) =>
      ipcRenderer.invoke('plugin:getConfig', pluginId),

    setConfig: (pluginId: string, config: Record<string, unknown>) =>
      ipcRenderer.invoke('plugin:setConfig', pluginId, config),
  },

  // ─── 系统相关 ───
  system: {
    getInfo: () =>
      ipcRenderer.invoke('system:getInfo'),

    getCacheStats: () =>
      ipcRenderer.invoke('system:getCacheStats'),

    clearCache: () =>
      ipcRenderer.invoke('system:clearCache'),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
```

### 3.9.2 IPC Channel 命名规范

采用 `域:动作` 的命名模式:

| 域 | 动作 | 方向 | 说明 |
|----|------|------|------|
| `compare:start` | invoke | renderer→main | 发起比对 |
| `compare:cancel` | invoke | renderer→main | 取消比对 |
| `compare:progress` | on | main→renderer | 进度推送 |
| `parser:parse` | invoke | renderer→main | 解析文档 |
| `model:install` | invoke | renderer→main | 安装模型 |
| `model:downloadProgress` | on | main→renderer | 下载进度 |

### 3.9.3 请求/响应封装

所有 IPC 调用统一返回 `Promise<Result<T, IPCError>>` 结构:

```typescript
// shared/types/ipc.ts
interface IPCSuccess<T> {
  ok: true;
  data: T;
}

interface IPCError {
  ok: false;
  code: string;        // 错误码, 如 'FILE_NOT_FOUND'
  message: string;      // 技术错误信息
  userMessage: string;  // 用户友好提示
  details?: unknown;    // 附加信息
}

type IPCResult<T> = IPCSuccess<T> | IPCError;
```

---

## 3.10 错误处理与用户反馈

### 3.10.1 全局错误边界

```typescript
// app/ErrorBoundary.tsx
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 上报错误到本地日志
    window.api.system.logError({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

### 3.10.2 Toast 通知系统

基于 shadcn/ui 的 Sonner 组件, 支持四级通知:

```typescript
// 使用方式
toast.success('比对完成', { description: '发现42处差异' });
toast.error('解析失败', { description: '文件格式不支持' });
toast.warning('缓存已满', { description: '已自动清理最早缓存' });
toast.info('模型下载中', { description: 'BGE-M3 下载 45%' });
```

### 3.10.3 错误码映射

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  'FILE_NOT_FOUND': '找不到指定文件, 请检查文件路径是否正确',
  'FILE_TOO_LARGE': '文件过大, 请确保文件不超过100MB',
  'FILE_CORRUPTED': '文件已损坏, 请尝试用Word重新保存后再试',
  'FORMAT_NOT_SUPPORTED': '暂不支持此文件格式, 目前支持 .docx 格式',
  'PARSE_FAILED': '文档解析失败, 可能包含不支持的内容',
  'MODEL_NOT_FOUND': '本地模型未安装, 请前往设置页面下载',
  'MODEL_DOWNLOAD_FAILED': '模型下载失败, 请检查网络连接后重试',
  'COMPARE_TIMEOUT': '比对超时, 请尝试使用快速模式或减少文档页数',
  'RUST_CRASH': '比对引擎异常退出, 正在自动重启...',
  'IPC_TIMEOUT': '通信超时, 请重启应用后重试',
  'PLUGIN_LOAD_FAILED': '插件加载失败, 已自动禁用该插件',
  'CACHE_CORRUPTED': '缓存数据损坏, 已自动清理',
};
```

---

> **本章小结**: React 前端模块以 Vite + React 19 + TypeScript 为技术基座, 通过 Zustand 管理同步状态、TanStack Query 管理异步 IPC 状态, 实现了清晰的状态分层。四种页面覆盖完整的用户流程, 三种 Diff 视图满足不同使用场景。虚拟滚动和 DOM 回收机制确保了大文档场景下的渲染性能, preload 脚本通过 contextBridge 安全暴露 IPC API, 统一的错误处理体系保证了用户体验的一致性。
