# Prompt Optimization Process

This guide summarizes how Promptly's enhancer runs the optimization flow so users understand what happens between your input and the final, cleaned prompt.

## 1) Input Layer (结构化输入)
- **用户意图提取**：前端收集原始 prompt，并允许附加文件元数据；后端对文件名进行安全清洗以避免注入，并将类型与大小标准化。
- **反向澄清钩子**：当缺少 `prompt` 时直接返回 400，提醒用户补齐核心输入。
- **结构化输入**：附件被封装为 `[ATTACHMENT_METADATA]` 块，确保额外上下文与用户正文分隔；异常附件自动降级为安全的空值（`unnamed_file`、`0 B`、`application/octet-stream`）。

## 2) Spec Layer (规格封装)
- **核心构件**：后端在调用 LLM 之前组合出一个包含背景与约束的 system prompt，强调“清晰、分段、易懂、利于模型解析”。
- **标准化**：文件类别（IMAGE/VIDEO/PDF 等）与尺寸统一格式化，减少歧义；异常文件名被截断并规范化，非法大小统一为 `0 B` 以避免脏数据污染。
- **版本稳定性**：当前增强模板是固定文案，确保多次调用保持一致行为。

## 3) Compiler Layer (Prompt 生成)
- **分块生成**：用户正文 + `[ATTACHMENT_METADATA_START/END]` 作为输入块；system 块定义角色与输出要求；最终构成对 LLM 的调用载荷。
- **模板化**：增强提示使用确定性描述，避免随机指令漂移。
- **安全补全**：对缺失或异常字段（如空附件数组）提供默认安全值。

## 4) Test Layer (稳定性验证)
- **格式自检**：后端在写入 LLM 前检查 `prompt` 是否存在、类型是否正确。
- **行为校验**：LLM 调用统一使用低随机度温度（0.2）以追求一致输出；错误路径集中处理，确保异常返回 JSON 而非崩溃。
- **边界案例**：无附件、多附件、异常文件名均被标准化，减少极端输入的影响。

## 5) Iteration Layer (迭代修复)
- **错误捕获**：`handleEnhanceError` 统一捕获并报告 LLM 停用、内部错误等场景，返回稳定的错误结构。
- **体验反馈**：前端横幅和按钮禁用提示 LLM 状态，用户能立刻看到可用性并避免重复提交。
- **版本滚动**：改动通过 Git 记录，便于对比与回滚，形成可复现的 Prompt 演进历史。

## 6) Outcome Layer (结果交付)
- **最终输出**：响应只包含增强后的 prompt 及处理的附件数量，避免多余解释，同时明确由 LLM 生成改写结果（中间不会跳过模型）。
- **可解释性**：日志打印附件摘要，帮助诊断输入与输出的关系；文档说明清晰描述了各层的职责。

## 快速复用
- 如需在其他项目复用：保留 system prompt 模板与附件上下文包装逻辑；若引入新模态或解析方式，可在 Input/Spec 层扩展而不影响下游结构。
