# Claude Code VNext UI 单任务执行提示词

## 使用方法

1. 在 `D:\Projects\Nova\nova-bidlens` 启动 Claude Code。
2. 将下面整段提示词发送给 Claude Code。
3. 每次只替换 `TASK_ID`，例如先执行 `UI-000`，完成并验收后再开启新会话执行下一个任务。
4. `COMMIT_POLICY` 默认设为 `ask`；需要自动提交时改为 `commit`，只修改和验证但不提交时改为 `no-commit`。

## 提示词

```text
你正在处理 BidLens VNext UI 开发任务。即使当前会话没有任何历史上下文，也必须先从仓库文档恢复上下文，再开始工作。

工作目录：D:\Projects\Nova\nova-bidlens
目标任务：TASK_ID=<替换为 UI-000 至 UI-506 中的一个任务编号>
提交策略：COMMIT_POLICY=<ask | commit | no-commit>
执行范围：只完成 TASK_ID，不主动实现后续任务，不顺带重构无关模块。

一、先启用 Superpowers

1. 在任何分析、提问或文件操作前，调用 `superpowers:using-superpowers`。
2. 本任务已有批准的产品设计、UI 契约和任务计划，不要重新讨论或改变产品定位。
3. 开始实现前调用 `superpowers:using-git-worktrees`，检查当前分支和工作区：
   - 不得在 main/master 上直接实现，除非我明确授权；
   - 如果工作区已有未提交改动，必须识别并保留，不得覆盖、恢复或纳入本任务提交；
   - 创建分支时使用与任务对应的名称，例如 `feature/ui-201-project-table`。
4. 将从总计划中提取的 TASK_ID 任务切片视为本会话唯一实施计划。若 Claude Code 当前支持 subagent，并且目标任务可以被独立实现和复核，针对该任务切片调用 `superpowers:subagent-driven-development`；否则针对该任务切片调用 `superpowers:executing-plans`。不得让技能自动继续执行总计划中的其他任务。
5. 实现阶段必须调用 `superpowers:test-driven-development`。
6. 遇到测试失败或非预期行为时，先调用 `superpowers:systematic-debugging`，不得猜测式修复。
7. 声称完成前调用 `superpowers:verification-before-completion`。
8. 需要提交、合并或结束分支时调用 `superpowers:finishing-a-development-branch`。

二、按以下顺序恢复仓库上下文

必须完整阅读：

1. `AGENTS.md`
2. `CLAUDE.md`（如果存在）
3. `docs/architecture.md`
4. `docs/coding_style.md`
5. `apps/desktop/AGENT.md`
6. `docs/superpowers/specs/2026-07-20-bidlens-similarity-risk-product-design.md`
7. `apps/desktop/UI-SPEC.md`
8. `docs/superpowers/plans/2026-07-20-bidlens-vnext-ui-implementation.md`

仅当 TASK_ID 涉及 shadcn、令牌或组件迁移时，再阅读：

- `docs/superpowers/specs/2026-07-19-shadcn-migration-design.md`

如果目标文件所在目录还有更深层的 `AGENT.md` 或 `AGENTS.md`，也必须读取并遵守。

权威性顺序如下：

1. `AGENTS.md`、适用的分层 `AGENT.md` 和我本次明确指令；
2. 产品设计规格；
3. `apps/desktop/UI-SPEC.md`；
4. VNext UI 实施计划中的目标任务；
5. shadcn 迁移设计；
6. 当前代码中的历史实现。

发现下位文档或旧代码与上位契约冲突时，不得自行折中。先给出文件和行号证据；如果冲突会改变验收结果，停止实现并向我确认。

三、定位并审查目标任务

从实施计划中提取 TASK_ID 的完整任务行，并同时提取：

- 所属 Phase 和目标；
- Depends 前置依赖；
- Files 中的创建、修改和测试文件；
- Acceptance 验收条件；
- 对应的 Focused Commands 和 Exit Gate；
- UI-SPEC 中直接约束该任务的章节。

开始编辑前必须执行并汇报：

- `git status --short`
- 当前分支名和是否处于 worktree；
- 前置依赖在代码、类型、IPC 和测试中是否真实存在；
- 目标文件当前实现和同目录既有模式；
- 目标任务的最小实现边界。

如果 Depends 尚未满足：停止实现，列出缺失契约、缺失文件或失败命令，以及应该先执行的任务编号。不得使用 `any`、重复本地接口、生产可达 Mock 或硬编码假数据绕过依赖。

如果依赖满足：先建立 TodoWrite 清单，至少包含“基线检查、失败测试、最小实现、Focused Test、类型检查、构建或集成验证、差异审阅”七项，然后连续执行，不要在每个小步骤后询问是否继续。

四、实施约束

- 只实现 TASK_ID 的 Acceptance，不提前实现后续任务。
- 测试先行：先写能证明目标行为的失败测试，运行并确认它因缺少目标能力而失败，再写最小实现。
- Renderer 只能从 `@bidlens/shared/types-only` 导入共享类型和浏览器安全工具。
- 不得破坏 Vite `base: './'`、开发端口 `5173` 和 `strictPort: true`。
- 保留 `react-resizable-panels`；不得引入不存在的 `@radix-ui/react-resizable-panels`。
- 主产品模式是“多份投标文件的雷同性风险审查”；双文档版本差异只能作为辅助模式。
- Partial、Degraded、No baseline、Interrupted 必须持续可见；Partial 不得显示为正常低风险。
- 风险等级不得表述为“串标概率”，不得只通过颜色表达。
- UI 必须遵循 `apps/desktop/UI-SPEC.md` 的令牌、组件、响应式、键盘、ARIA、Forced Colors 和 Reduced Motion 契约。
- 不新增云端登录、额度、OCR、图像比对、设备指纹、经济规则或 LLM 风险评分能力。
- 不修改与 TASK_ID 无关的 Main、Rust、数据库、文档或格式化结果。
- 注释、代码和提交信息使用英文；UI 文案使用简体中文。

五、验证规则

至少运行实施计划为该 Phase 指定的 Focused Commands。根据实际修改补充最小充分验证：

- 目标测试文件；
- `pnpm --filter @bidlens/desktop lint`；
- Renderer/Main 构建（任务触及构建路径时）；
- 集成测试或 Playwright（任务验收明确要求时）；
- `git diff --check`。

不得用“代码看起来正确”代替命令结果。测试失败时记录准确命令、退出码和核心错误；不得把已有失败误报为本任务通过。

完成实现后，对照以下三层逐项复核：

1. TASK_ID Acceptance 是否全部满足；
2. UI-SPEC 对应章节是否全部满足；
3. 是否引入计划外行为或修改了用户原有改动。

六、提交和最终汇报

按 COMMIT_POLICY 执行：

- `ask`：验证完成后先汇报，不提交，等待我确认；
- `commit`：只暂存本任务文件，使用 Conventional Commit，并报告 commit SHA；
- `no-commit`：不暂存、不提交。

最终回复必须包含：

- TASK_ID 和完成状态：DONE、DONE_WITH_CONCERNS、BLOCKED 三选一；
- 实际变更文件；
- Acceptance 逐项结果；
- 运行的验证命令及通过/失败数量；
- 未运行的验证及原因；
- 工作区中被保留的无关改动；
- commit SHA，或明确说明未提交；
- 按依赖图建议的下一个任务编号。

不要只给方案。依赖满足时应完成实现、验证和汇报；只有存在真实阻断或契约冲突时才停止并提问。
```

## 推荐执行顺序

不要简单按编号并行启动多个 Claude Code 会话。先按计划中的依赖关系执行：

```text
UI-000 -> UI-001 -> UI-002 -> UI-003
       -> UI-100 -> UI-101 -> UI-102 -> UI-103
       -> UI-104 -> UI-105 -> UI-106
```

进入 Phase 2 前，必须先确认 Shared 项目类型与 IPC 已冻结。Phase 2 和 Phase 3 只有在文件所有权独立、共享契约稳定时才能并行；同一 Renderer 文件不得交给两个会话同时修改。
