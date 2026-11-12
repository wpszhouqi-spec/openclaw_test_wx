# RAG（Milvus）

根目录独立模块：把「意图理解 → 检索 → LLM」接到 OpenClaw。

## 分流规则

```text
用户问题
  │
  ├─ 意图 = 闲聊/通用任务 ──────────────► 当前 OpenClaw 框架（openclaw agent）
  │
  └─ 意图 = 知识问答
        │
        ├─ Milvus/本地检索命中 ─────────► RAG：知识片段 + LLM
        └─ 未命中 ─────────────────────► 当前 OpenClaw 框架
```

## 目录

| 路径 | 作用 |
| --- | --- |
| `knowledge/` | 待入库知识（md/txt） |
| `src/` | 意图、向量库、路由、OpenClaw 回退 |
| `docker-compose.yml` | 本地 Milvus |
| `plugin/` | 可选：挂到 Gateway `before_prompt_build` |
| `data/` | 本地向量缓存（gitignore） |

## 快速开始

```bash
cd RAG
pnpm install
cp .env.example .env

# 本机无 Docker 时默认可用 local 向量库跑通
pnpm smoke

# 有 Docker 时启动 Milvus，再强制走 milvus
pnpm milvus:up
RAG_STORE=milvus pnpm ingest
RAG_STORE=milvus pnpm route -- "如何配置微信插件？"
```

## 常用命令

```bash
pnpm ingest                 # 导入 knowledge/
pnpm route -- "问题"        # 只看分流结果
pnpm ask -- "问题"          # 分流后真正调用 LLM / OpenClaw
```

## 与 OpenClaw 的关系

- **未接入 Gateway 主链路时**：用 `pnpm ask` 作为前置路由器。
- **后续挂主链路**：安装 `plugin/`，命中时注入 `prependContext`；未命中不改写，继续现有框架。

```bash
# 示例（Gateway 可加载本地插件后再启用）
openclaw plugins install ./RAG/plugin
```

## 配置要点

见 `.env.example`：

- `RAG_STORE=auto|milvus|local`
- `MILVUS_ADDRESS=127.0.0.1:19530`
- `RAG_HIT_THRESHOLD=0.28`
- `OPENCLAW_MODEL=minimax/MiniMax-M3`

当前 embedding 使用本地确定性 hash，便于无外网/无 embedding Key 时先搭通链路；上线前替换为正式 embedding 服务即可，路由接口不变。
