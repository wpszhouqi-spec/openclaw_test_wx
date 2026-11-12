# MiniMax 模型配置

OpenClaw 支持 MiniMax API Key 与 OAuth（Coding Plan）两种方式。

## 国内 API Key

非交互写入国内节点：

```bash
openclaw onboard --non-interactive --accept-risk \
  --auth-choice minimax-cn-api \
  --minimax-api-key "<YOUR_KEY>" \
  --skip-channels --skip-daemon --skip-skills --skip-ui --skip-search --skip-hooks --skip-health
```

结果：

- provider：`minimax`
- 默认模型：`minimax/MiniMax-M3`
- 节点：`https://api.minimaxi.com/anthropic`
- 凭据档案：`minimax:cn`（保存在 OpenClaw SQLite，不进仓库）

## 连通测试

```bash
openclaw agent --agent main --model minimax/MiniMax-M3 --thinking off -m "只回复：联通成功"
```

## 与 OAuth 的区别

- API Key 使用 provider id `minimax`
- OAuth Coding Plan 使用 provider id `minimax-portal`
