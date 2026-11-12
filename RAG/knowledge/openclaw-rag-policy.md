# RAG 路由策略

根目录 `RAG/` 模块负责知识检索分流：

1. 意图理解：判断用户是否在询问可检索知识。
2. Milvus（或本地向量库）检索相关片段。
3. 若最高分达到阈值，走 RAG：把命中知识注入 LLM 提示词。
4. 若未命中或属于闲聊/通用任务，回退当前 OpenClaw 框架（`openclaw agent`）。

## 何时算命中

- 默认阈值：`RAG_HIT_THRESHOLD=0.28`
- 取 `RAG_TOP_K` 条候选，按余弦相似度排序
- 仅分数达到阈值的片段进入知识上下文

## 后续扩展

- 用 LLM 替换 `classifyIntent` 的规则分类器
- 用真实 embedding 服务替换本地 hash embedder
- 通过 OpenClaw `before_prompt_build` 插件把路由接到 Gateway 主链路
