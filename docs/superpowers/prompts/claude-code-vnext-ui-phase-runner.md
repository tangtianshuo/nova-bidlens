# Claude Code VNext UI Phase 自动编排提示词

## 提示词

```text
你是 BidLens VNext UI Phase 执行控制器。当前会话可能没有任何历史上下文，你必须从仓库权威文档、Git 历史和执行台账恢复状态，并自动完成指定 Phase 内所有依赖已满足的任务。

工作目录：D:\Projects\Nova\nova-bidlens
目标阶段：TARGET_PHASE= 2
执行模式：PHASE_GATED_AUTONOMOUS
提交策略：每个 TASK_ID 独立提交；不得合并、推送或进入下一 Phase。

一、立即启用 Superpowers

在任何分析、提问或文件操作前调用 `superpowers:using-superpowers`，然后执行：

1. 调用 `superpowers:using-git-worktrees`，创建或验证隔离 worktree。
2. 调用 `superpowers:subagent-driven-development`，把 TARGET_PHASE 内的每个 TASK_ID 作为独立任务依次执行。
3. 每个实现 subagent 必须调用 `superpowers:test-driven-development`。
4. 遇到失败或非预期行为时调用 `superpowers:systematic-debugging`。
5. 每个任务和整个 Phase 声称完成前调用 `superpowers:verification-before-completion`。
6. 每个任务通过规格审查后调用 `superpowers:requesting-code-review` 完成代码质量审查。
7. Phase Exit Gate 通过后停止。不要调用会合并、推送或清理分支的完成动作，等待人工确认。

不得并行派发多个实现 subagent。任务必须按依赖顺序串行实现；规格审查通过后才能开始代码质量审查，两类审查均通过后才能进入下一个任务。

二、恢复完整上下文

控制器必须完整阅读：

1. `AGENTS.md`
2. `CLAUDE.md`（如果存在）
3. `docs/architecture.md`
4. `docs/coding_style.md`
5. `apps/desktop/AGENT.md`
6. `docs/superpowers/specs/2026-07-20-bidlens-similarity-risk-product-design.md`
7. `apps/desktop/UI-SPEC.md`
8. `docs/superpowers/plans/2026-07-20-bidlens-vnext-ui-implementation.md`
9. `docs/superpowers/prompts/claude-code-vnext-ui-task-runner.md`
10. `docs/reports/vnext-ui-execution-status.md`（如果存在）

TARGET_PHASE 为 0 或 1，或者任务涉及 shadcn、令牌和组件迁移时，还必须阅读：

- `docs/superpowers/specs/2026-07-19-shadcn-migration-design.md`

如果目标目录存在更深层的 `AGENT.md` 或 `AGENTS.md`，也必须读取。

权威性顺序：用户指令和 AGENTS -> 产品设计规格 -> UI-SPEC -> 实施计划目标任务 -> shadcn 迁移设计 -> 当前历史代码。发生会改变验收结果的冲突时停止，不得自行折中。

三、建立 Phase 执行清单

从实施计划中提取 TARGET_PHASE 的完整内容，包括：

- Phase 目标；
- 全部任务行及其 ID、Depends、Files 和 Acceptance；
- Focused/Integration/Verification Commands；
- Exit Gate；
- UI-SPEC 对应章节。

Phase 映射固定为：

- Phase 0：UI-000、UI-001、UI-002、UI-003
- Phase 1：UI-100、UI-101、UI-102、UI-103、UI-104、UI-105、UI-106
- Phase 2：UI-200、UI-201、UI-202、UI-203、UI-204、UI-205、UI-206、UI-207
- Phase 3：UI-300、UI-301、UI-302、UI-303、UI-304、UI-305、UI-306、UI-307
- Phase 4：UI-400、UI-401、UI-402、UI-403、UI-404、UI-405、UI-406、UI-407
- Phase 5：UI-500、UI-501、UI-502、UI-503、UI-504、UI-505、UI-506

创建 TodoWrite，包含：Phase 前置检查、每个 TASK_ID、Phase 集成验证、Exit Gate 审查、最终汇报。只允许一个任务处于 in_progress。

不得只按编号推断顺序。根据 Depends 构建阶段内拓扑顺序；依赖相同时使用计划中的任务顺序。不得执行 TARGET_PHASE 之外的任务。

四、Phase 前置门槛

开始第一个任务前执行：

- `git status --short`
- `git branch --show-current`
- `git log --oneline -10`
- 计划中上一 Phase 的 Exit Gate 对应验证；Phase 0 无上一阶段。
- 检查执行台账和 Git 提交，识别已完成、进行中或需要重试的任务。

不得在 main/master 上实现。worktree 分支使用 `feature/vnext-ui-phase-<TARGET_PHASE>`。发现用户已有未提交改动时，不得恢复、覆盖、暂存或提交；无法隔离时停止。

以下情况必须在开始 Phase 前停止并汇报 BLOCKED：

- 上一 Phase Exit Gate 未通过；
- 计划中的外部 Shared、IPC、Main、Rust、数据库或报告契约缺失；
- Phase 2 开始前项目类型、验证、进度 IPC 未冻结；
- Phase 3 开始前结果 IPC 未冻结；
- Phase 4 开始前 Evidence、Review、Export IPC 未冻结；
- Phase 5 开始前真实 IPC 主链无法运行；
- 权威文档存在影响验收的冲突；
- 当前改动无法与用户工作区安全隔离。

不得通过 `any`、重复本地接口、生产可达 Mock、硬编码假结果或跳过测试绕过前置条件。

五、自动任务循环

对每个尚未完成且依赖满足的 TASK_ID，连续执行以下步骤，不要询问是否继续：

1. 控制器提取该任务完整内容、直接依赖、UI-SPEC 条款、准确文件路径、验证命令和相邻代码模式。
2. 向新的实现 subagent 提供完整任务切片和必要上下文；不得让 subagent 自行阅读整份总计划。
3. 实现 subagent 按 `claude-code-vnext-ui-task-runner.md` 的实施约束执行 TDD：
   - 写失败测试；
   - 运行并确认预期失败；
   - 完成最小实现；
   - 运行 focused tests、类型检查和适用构建；
   - 自审差异；
   - 返回 DONE、DONE_WITH_CONCERNS、NEEDS_CONTEXT 或 BLOCKED。
4. DONE 或可解释的 DONE_WITH_CONCERNS 后，派发新的规格审查 subagent，只检查产品规格、UI-SPEC 和 TASK_ID Acceptance；发现缺失或越界时交回原实现者修正并重新审查。
5. 规格审查通过后，派发新的代码质量审查 subagent，检查行为风险、测试质量、架构约束、无障碍、性能和用户改动保护；发现问题时交回实现者修正并重新审查。
6. 两类审查均通过后，重新运行该任务的关键验证并调用 `superpowers:verification-before-completion`。
7. 只暂存该 TASK_ID 的文件，使用 Conventional Commit：
   - 文档任务：`docs(ui): complete UI-XXX <summary>`
   - 功能任务：`feat(ui): complete UI-XXX <summary>`
   - 测试或修复按实际使用 `test(ui):` 或 `fix(ui):`。
8. 记录 commit SHA，更新 TodoWrite 和执行台账，然后自动进入下一个依赖已满足的任务。

每个任务提交前运行 `git diff --cached --name-only`，确认没有用户原有文件或其他 TASK_ID 的改动。提交后确认 `git status --short` 与预期一致。

六、持久化执行台账

使用 `docs/reports/vnext-ui-execution-status.md` 记录状态。文件不存在时创建，存在时保留历史并追加或更新当前 Phase。格式必须包含：

| Task | Status | Commit | Verification | Notes |
|---|---|---|---|---|
| UI-XXX | pending/in_progress/done/blocked | SHA 或 `-` | 命令与结果摘要 | 风险或阻断 |

台账还必须记录：

- TARGET_PHASE、分支和 worktree；
- Phase 开始时间；
- 基线失败；
- 用户原有改动清单；
- Exit Gate 结果。

台账用于上下文压缩或会话恢复，但不能单独证明任务完成。恢复时必须同时核对 commit、变更文件和验证结果。

台账更新应与对应 TASK_ID 一起提交；Phase 最终 Exit Gate 结果使用独立提交 `docs(ui): record phase <TARGET_PHASE> verification`。

七、自动停止条件

仅在以下情况停止自动循环：

- 当前 Phase 全部任务完成且 Exit Gate 已执行；
- NEEDS_CONTEXT 或 BLOCKED 无法通过当前仓库证据解决；
- 同一核心失败在系统化调试后仍重复三次；
- 测试揭示需要修改 TARGET_PHASE 外的业务契约；
- 规格审查与代码质量审查无法同时满足；
- 出现用户改动冲突、敏感信息、破坏性迁移或需要外部凭据；
- 剩余任务均有未满足依赖。

普通测试失败、lint 错误或代码审查意见不是立即停止条件。先使用系统化调试和修正循环；只有满足上述阻断条件才停止。

八、Phase Exit Gate

所有任务完成后：

1. 运行该 Phase 文档列出的全部 Focused/Integration/Verification Commands。
2. 运行 `git diff --check`。
3. 对照该 Phase Exit Gate 和 UI-SPEC 对应验收条款逐项检查。
4. 派发最终审查 subagent，检查整个 Phase 的规格覆盖、跨任务集成和回归风险。
5. 调用 `superpowers:verification-before-completion`，只有新鲜命令证据支持时才能标记 Phase DONE。
6. 更新并提交执行台账。
7. 停止执行，不得自动进入下一 Phase，不得合并或推送。

九、最终汇报格式

最终仅报告当前 Phase，必须包含：

- `PHASE STATUS`：DONE、DONE_WITH_CONCERNS 或 BLOCKED；
- 分支和 worktree 路径；
- 任务表：TASK_ID、状态、commit SHA；
- 每个 Acceptance 和 Exit Gate 的逐项结果；
- 所有验证命令、退出码、通过/失败数量；
- 未执行验证及原因；
- 基线已存在失败与本阶段新增失败的区别；
- 保留的用户无关改动；
- 阻断项或残余风险；
- 下一 Phase 编号，但只能建议，不能自动执行。

现在开始执行 TARGET_PHASE。不要只生成计划或方案；前置门槛通过后应持续工作到 Exit Gate 或真实阻断。
```
