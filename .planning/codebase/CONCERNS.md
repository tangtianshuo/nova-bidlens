# 代码库关注点

**分析日期：** 2026-07-22

## 技术债务

**上帝类：RiskReviewService（951 行）：**
- 问题：单个类处理项目生命周期、分析流水线、AST 缓存、发现项持久化、报告导出、PDF 生成和风险评估计算
- 文件：`apps/desktop/src/main/services/risk-review-service.ts`
- 影响：难以测试、修改或理解。任何变更都可能在不相关的功能中产生副作用
- 修复方案：拆分为专注的服务 — `AnalysisPipeline`、`ReportExporter`、`RiskAssessmentCalculator`、`DocumentCacheService`

**单体仓库文件（782 行，13 个工厂函数）：**
- 问题：所有 13 个仓库工厂函数都在单个文件中，包含所有行类型
- 文件：`apps/desktop/src/main/db/repositories.ts`
- 影响：多个功能修改不同仓库时产生合并冲突。难以导航
- 修复方案：拆分为 `repositories/project.ts`、`repositories/finding.ts`、`repositories/evidence.ts` 等

**IPC 处理器中的模块级可变单例：**
- 问题：`orchestrator`、`persistenceDeps`、`service`、`engineManager` 是模块级 `let` 变量，到处散布 null 检查
- 文件：`apps/desktop/src/main/ipc/compare-handlers.ts:30-37`、`apps/desktop/src/main/ipc/risk-review-handlers.ts:7-8`
- 影响：脆弱的初始化顺序、不明显的生命周期、IPC 在初始化前调用可能导致空引用
- 修复方案：使用依赖注入或服务容器；要求在处理器注册前完成初始化

**项目创建中的 fire-and-forget 异步：**
- 问题：`void this.run(projectId, request, abort)` 丢弃 Promise，因此流水线中的未处理拒绝只在内部被捕获
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:148`、`:193`、`:211`
- 影响：如果内部 catch 块本身抛出，错误会丢失。调用者无法等待完成
- 修复方案：将 Promise 存储在 `activeRuns` 中，暴露 `waitForCompletion(projectId)` 方法

**朴素回退检测（O(n^2) 精确匹配）：**
- 问题：`buildFindings()` 在归一化后对每对文档的每个块进行精确字符串比较。无语义或模糊匹配
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:923-951`
- 影响：当 Rust 引擎不可用时，检测质量很低。性能随文档大小二次退化
- 修复方案：用 Jaccard 相似度或 shingled n-gram 匹配作为临时改进

**到处硬编码版本字符串：**
- 问题：`'lexical-fallback'`、`'1.0.0'`、`'0.2.2'`、`'0.3.0'`、`'lexical-1.0.0'` 作为魔法字符串散布
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:120-123`、`:524`、`:606`、`:709`、`:946`
- 影响：版本升级需要到处搜索。不同代码路径版本字符串不一致
- 修复方案：在单个 `versions.ts` 配置文件中定义版本常量

**项目创建时 sha256 为空：**
- 问题：创建 submission 行时设置 `sha256: ''`，仅在解析期间计算
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:132`
- 影响：如果解析失败或中断，submission 有空哈希。第 357 行的恢复逻辑使用此空哈希查找缓存的 AST
- 修复方案：在校验阶段（解析之前）计算文件哈希并立即存储

## 已知 Bug

**TODO：历史重新比对未接入引擎：**
- 症状：在历史记录中点击"重新比对"会创建新任务但不触发实际比对
- 文件：`apps/desktop/src/main/ipc/history-handlers.ts:108-110`
- 触发条件：历史视图 → 重新比对操作
- 解决方法：无 — 功能未完成

**TODO：审查工作台单元格点击和跳转位置未接入：**
- 症状：在表格视口中点击单元格或跳转到位置无效果
- 文件：`apps/desktop/src/renderer/features/compare/ReviewWorkbench.tsx:28`、`:32`
- 触发条件：表格差异审查 → 点击单元格或跳转位置
- 解决方法：无 — 仅存根

**生产代码中的 `as any`：**
- 症状：CommentHighlight 中绕过了类型安全
- 文件：`apps/desktop/src/renderer/components/CommentHighlight.tsx:401`
- 触发条件：使用意外 children 结构渲染批注
- 解决方法：运行时正常但丢失类型检查

## 安全考虑

**通过 shell.openPath / shell.showItemInFolder 的路径遍历：**
- 风险：`risk:openFile` 和 `risk:openFolder` IPC 处理器将用户影响的文件路径直接传递给 `shell.openPath()` 而不校验。攻击者如果能影响存储的文件路径（例如通过构造的项目导入），可以打开任意文件
- 文件：`apps/desktop/src/main/ipc/risk-review-handlers.ts:48-54`、`apps/desktop/src/main/ipc/compare-handlers.ts:283-288`
- 当前缓解：路径来自用户文件选择对话框，但恢复/重放从审计事件重建路径
- 建议：在调用 `shell.openPath()` 前校验路径在预期目录内

**IPC 请求参数无类型检查：**
- 风险：`saveRiskFindingReview` 处理器从渲染器接收未类型化的 `request` 为 `unknown`。不校验 projectId、findingId、status 或 note 字段
- 文件：`apps/desktop/src/main/ipc/risk-review-handlers.ts:25`
- 当前缓解：服务层的 TypeScript 类型提供了一定保护
- 建议：在 IPC 边界添加运行时校验（zod 或手动守卫）

**加密密钥保存在内存中：**
- 风险：AES-256 主密钥以 `Buffer` 形式存储在 `KeyManager.masterKey` 中并传递给 `RiskReviewService` 构造函数。仅在显式 `destroy()` 调用时清零
- 文件：`apps/desktop/src/main/services/key-manager.ts:27`、`apps/desktop/src/main/services/risk-review-service.ts:69`
- 当前缓解：密钥在静态时用 Electron safeStorage（DPAPI）包装。关闭时内存清零
- 建议：考虑按操作进行作用域密钥派生以最小化暴露窗口

**备份服务 SQL 字符串插值：**
- 风险：`VACUUM INTO '${backupPath.replace(/'/g, "''")}'` 使用字符串插值构造 SQL。虽然路径是内部生成的，但此模式很脆弱
- 文件：`apps/desktop/src/main/services/backup.ts:35`
- 当前缓解：路径从时间戳构造，非用户输入。已应用单引号转义
- 建议：使用参数化查询或校验路径仅包含安全字符

## 性能瓶颈

**分析流水线中的同步文件解析：**
- 问题：文档在 `for` 循环中顺序解析，非并行
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:343-351`
- 原因：每个解析等待完成后才开始下一个。对于 8 个文档，这会串行化所有解析
- 改进路径：使用 `Promise.all` 并行解析文档（注意内存限制）

**listProjects 中的 N+1 查询模式：**
- 问题：`listProjects()` 对列表中的每个项目调用 `submissionRepo.getByProject()` 和 `findingRepo.getByProject()`
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:92-94`
- 原因：每个项目触发 2 次额外的数据库查询
- 改进路径：使用 JOIN 批量查询或使用带聚合的单次查询

**为风险等级派生重建完整详情：**
- 问题：`getProject()` 为每个详情视图加载所有 submissions、所有 findings、所有 evidence、所有文件对、所有检测器运行、所有检查点和评估
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:730-820`
- 原因：无延迟加载或 evidence/findings 分页
- 改进路径：按需加载 findings/evidence（用户展开发现项时）

**PDF 生成每次导出创建隐藏 BrowserWindow：**
- 问题：每次 PDF 导出创建新的 `BrowserWindow({ show: false })`，加载 HTML，渲染，然后关闭
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:295-315`
- 原因：使用 Electron 的 `printToPDF` API，需要窗口
- 改进路径：池化单个隐藏窗口用于 PDF 生成，或使用无头 PDF 库

## 脆弱区域

**引擎管理器重启逻辑：**
- 文件：`apps/desktop/src/main/services/engine-manager.ts:647-688`
- 为何脆弱：重启依赖 `stopping` 和 `restarting` 标志，必须正确设置。如果在重启退避期间调用 `stop()` 可能产生竞态条件
- 安全修改：始终用并发 stop/start/crash 场景测试引擎生命周期
- 测试覆盖：`apps/desktop/tests/integration/resilience-stress.test.ts` 覆盖基本重启但不覆盖竞态条件

**风险进度 IPC 通道：**
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:721-728`
- 为何脆弱：从异步流水线调用 `this.window.webContents.send()`。如果分析期间窗口关闭，会抛出异常
- 安全修改：发送前用 `!this.window.isDestroyed()` 守卫
- 测试覆盖：无窗口关闭期间分析的测试

**app-store 中的状态机转换：**
- 文件：`apps/desktop/src/renderer/stores/app-store.ts:47-58`
- 为何脆弱：添加新视图需要更新 `VALID_TRANSITIONS` 和 `MODE_DEFAULT_VIEW`。缺失条目静默失败（仅 `console.warn`）
- 安全修改：添加视图时始终更新两个映射。考虑从 mode 配置派生转换
- 测试覆盖：存在基本转换测试

**Document AST 缓存静默失败：**
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:674-701`
- 为何脆弱：`cacheDocumentAst` 和 `loadCachedAstByHash` 都捕获所有错误并返回 null/跳过。缓存损坏不可见
- 安全修改：记录缓存失败的结构化上下文用于调试
- 测试覆盖：无缓存损坏场景的测试

## 扩展限制

**SQLite 单写入者：**
- 当前容量：WAL 模式加 5 秒 busy timeout 处理当前负载
- 限制：来自多个分析流水线的并发写入会串行化。当前不是问题（单窗口 Electron）但阻塞多窗口或多项目并行分析
- 扩展路径：如果添加多项目并行分析，使用连接池或写入队列

**内存中活跃运行映射：**
- 当前容量：所有活跃运行存储在 `RiskReviewService` 中的 `Map<string, ActiveRun>`
- 限制：如果应用在分析期间崩溃，活跃运行丢失。无进行中状态的持久化
- 扩展路径：将运行状态持久化到 DB 并带心跳，启动时检测过期运行

**通过 stdio 的引擎通信：**
- 当前容量：单请求-响应通道，每请求 300 秒超时
- 限制：大 AST 负载（8 个文档）序列化为 JSON 通过管道传输。两侧内存峰值
- 扩展路径：对大负载使用共享内存或基于文件的传输

## 风险依赖

**better-sqlite3（原生模块）：**
- 风险：原生插件需要平台特定编译。Electron 版本升级可能破坏 ABI 兼容性
- 影响：原生模块不兼容时应用无法启动
- 迁移计划：每个 Electron 版本重编译原生模块。考虑 `better-sqlite3` prebuilds 或 `sql.js` 作为回退

**Rust 引擎二进制分发：**
- 风险：引擎二进制必须匹配平台（win/mac/linux）和架构（x64/arm64）。打包和分发复杂性
- 影响：没有引擎应用无法运行。回退检测质量低
- 迁移计划：当前回退（朴素精确匹配）提供降级功能。考虑 WASM 编译用于单二进制分发

## 缺失的关键功能

**RiskReviewService 无测试覆盖：**
- 问题：最大的源文件（951 行）没有专门的单元测试
- 阻塞：自信重构、核心分析流水线的回归检测

**无 IPC 集成测试：**
- 问题：IPC 处理器仅通过 E2E 冒烟测试测试，无隔离的集成测试
- 阻塞：处理器逻辑的快速反馈、边界用例覆盖

**历史重新比对已损坏：**
- 问题：`history:recompare` 创建新任务存根但从不触发引擎
- 阻塞：用户无法使用更新的引擎重新运行历史比对

## 测试覆盖差距

**risk-review-service.ts — 无单元测试：**
- 未测试内容：项目创建、分析流水线、恢复/重试、发现项持久化、报告导出、风险评估计算
- 文件：`apps/desktop/src/main/services/risk-review-service.ts`
- 风险：核心流水线的任何变更都可能无声破坏而无法检测
- 优先级：高

**engine-manager.ts — 测试覆盖有限：**
- 未测试内容：引擎二进制解析、重启竞态条件、大负载处理、超时边界用例
- 文件：`apps/desktop/src/main/services/engine-manager.ts`
- 风险：引擎生命周期 bug 表现为静默分析失败
- 优先级：高

**repositories.ts — 无直接单元测试：**
- 未测试内容：单个仓库 CRUD 操作、加密/解密往返、SQL 正确性
- 文件：`apps/desktop/src/main/db/repositories.ts`
- 风险：Schema 变更或 SQL bug 仅在集成级别被捕获
- 优先级：中

**buildFindings 回退 — 无测试：**
- 未测试内容：朴素精确匹配回退检测逻辑
- 文件：`apps/desktop/src/main/services/risk-review-service.ts:923-951`
- 风险：回退路径可能产生不正确的 findings 而无法检测
- 优先级：中

---

*关注点审计：2026-07-22*
