# BGE-M3 商业许可与分发审查

> 审查对象：`BAAI/bge-m3`
> 固定 revision：`5617a9f61b028005a4858fdac845db406aefb181`
> 技术核对日期：2026-07-19
> 技术结论：模型卡标记为 MIT，但固定 revision 未提供独立 LICENSE 文件；未经授权人员书面确认，不得将权重随商业模型包再分发。

## 已验证事实

- Hugging Face API 的 `cardData.license` 返回 `mit`。
- 官方仓库包含 `onnx/model.onnx` 和外部数据文件 `onnx/model.onnx_data`。
- `onnx/model.onnx_data` 大小为 2,266,820,608 bytes。
- 模型配置为 XLM-RoBERTa，hidden size 1024，最大位置长度 8194。
- Sentence Transformers 配置使用 CLS pooling 和归一化。
- 固定 revision 根目录未提供可直接读取的独立 `LICENSE` 文件。

## 必须由授权人员确认的问题

1. 模型卡的 MIT 标记是否覆盖固定 revision 的权重、ONNX 产物和 tokenizer。
2. BidLens 是否可修改、量化、重新打包并向商业客户离线分发这些产物。
3. 产品、安装器、关于页和模型包需要保留哪些版权及许可文本。
4. 上游更新后，是否需要重新执行许可审查。

## 决策写入规则

授权人员确认后，更新 `scripts/v03/model-feasibility/legal-decision.json`：

- `redistributionApproved`: 仅在书面批准后设为 `true`
- `reviewer`: 填写真实审查责任人或审批记录 ID
- `reviewedAt`: ISO 8601 时间

Phase 0 gate 在上述字段不完整时必须失败。
