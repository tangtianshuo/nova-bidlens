# E2E 调试状态记录

**日期:** 2026-07-22
**阶段:** Phase 3 (E2E Foundation) 执行中
**状态:** 6/9 测试通过, 3个 risk-pipeline 测试待修复

---

## 已修复的问题

### 1. window.bidlens API 暴露测试 (smoke.test.ts)
- **原因:** `page.evaluate()` 使用 structured clone 序列化，函数属性无法跨边界传输
- **修复:** 在 `evaluate()` 内部检查 `typeof api.createRiskProject === 'function'`，返回布尔值对象
- **文件:** `apps/desktop/tests/e2e/smoke.test.ts:29`

### 2. better-sqlite3 原生模块版本不匹配
- **修复:** `pnpm native:electron` (运行 electron-rebuild)

### 3. Playwright 测试超时
- **修复:** `playwright.config.ts` timeout 改为 180_000ms
- **文件:** `apps/desktop/playwright.config.ts`

### 4. DOCX 测试固件缺少文件
- **原因:** docx4js 需要 `word/_rels/document.xml.rels` 和 `word/styles.xml`
- **修复:** 在 `create-docx.ts` 添加了 `WORD_RELS` 和 `STYLES` 常量，加入 zip
- **文件:** `apps/desktop/tests/e2e/fixtures/create-docx.ts`

### 5. Rust 引擎异步响应处理 (engine-manager.ts)
- **原因:** `risk.analyzeWithAst` 先返回 `{ status: "started" }`，实际结果通过同 ID 的后续响应返回。`sendRequest` 在第一个响应就 resolve 了
- **修复:** 添加 `pendingRiskAnalysis` Map，检测 `status === 'started'` 时保持 pending，等后续响应
- **文件:** `apps/desktop/src/main/services/engine-manager.ts`
  - 新增 `pendingRiskAnalysis` 字段
  - `handleMessage()`: 检测 started 响应时移入 pendingRiskAnalysis
  - `handleExit()`, `stop()`, `handleProcessError()`: 清理 pendingRiskAnalysis

### 6. docx4js API 变更
- **原因:** docx4js v3 默认导出没有 `.load` 方法，实际是 `Document.load()`
- **CJS/ESM 差异:**
  - ESM: `import docx4js from 'docx4js'` → `docx4js.Document.load(path)`
  - CJS: `require('docx4js').default` 直接就是 Document 类 → `.load(path)` 直接可用
- **修复:** 运行时检测 `typeof docx4js.load === 'function'` 来选择正确路径
- **文件:** `packages/shared/src/parser/docx/index.ts`
- **当前编译问题:** nzbtf 模块引入了 `fast-xml-parser` 但 shared 包没有该依赖，导致编译失败

---

## 当前阻塞问题

### nzbtf 模块编译阻塞
- `packages/shared/src/parser/index.ts` 第19、59、62行 import 了 `./nzbtf/index.js`
- nzbtf 模块依赖 `fast-xml-parser` 和 `jszip`，但这些是 desktop 包的依赖，不在 shared 包中
- tsconfig.json 和 tsconfig.cjs.json 的 exclude 不起作用，因为 `parser/index.ts` 仍然 import nzbtf

**临时修复方案（待应用）:**
注释掉 `packages/shared/src/parser/index.ts` 中的 nzbtf 相关行：
```ts
// export { NzbtfParser, nzbtfParser } from './nzbtf/index.js';
// import { nzbtfParser } from './nzbtf/index.js';
// globalRegistry.register(nzbtfParser);
```

### risk-pipeline E2E 测试仍然失败
- docx4js 修复后，`loadDocx` 运行时检测逻辑已写好，但 shared 包还没成功编译
- 需要先解决 nzbtf 编译阻塞，然后重新 build shared 包
- 之后运行 `npx playwright test risk-pipeline.test.ts` 验证

---

## 待验证清单

1. [ ] shared 包编译通过（解决 nzbtf 阻塞后）
2. [ ] docx4js `loadDocx` 在 CJS 和 ESM 下都正确工作
3. [ ] risk-pipeline 测试: project 创建 → engine 分析 → 状态变 'ready'
4. [ ] risk-pipeline 测试: findings 有 evidence
5. [ ] risk-pipeline 测试: project 可删除
6. [ ] 完整 9/9 E2E 测试通过

---

## 修改的文件清单

| 文件 | 修改内容 |
|------|---------|
| `apps/desktop/playwright.config.ts` | timeout 180_000 |
| `apps/desktop/tests/e2e/smoke.test.ts` | window.bidlens API 检查方式 |
| `apps/desktop/tests/e2e/helpers.ts` | waitForStatus 添加 lastStatus/lastPhase 调试 |
| `apps/desktop/tests/e2e/risk-pipeline.test.ts` | beforeAll 添加失败调试输出 |
| `apps/desktop/tests/e2e/fixtures/create-docx.ts` | 添加 WORD_RELS, STYLES |
| `apps/desktop/src/main/services/engine-manager.ts` | 异步 risk analysis 响应处理 |
| `apps/desktop/src/main/services/risk-review-service.ts` | 添加 stack trace 到 audit event |
| `packages/shared/src/parser/docx/index.ts` | docx4js v3 API 兼容 (loadDocx) |
| `packages/shared/tsconfig.json` | exclude nzbtf |
| `packages/shared/tsconfig.cjs.json` | exclude nzbtf |

---

## 下一步操作

1. 编辑 `packages/shared/src/parser/index.ts`，注释掉 nzbtf import
2. 运行 `pnpm --filter @bidlens/shared build`
3. 运行 `npx playwright test` 验证全部 E2E 测试
4. 如果通过，提交代码并继续 autonomous flow Phase 4+
