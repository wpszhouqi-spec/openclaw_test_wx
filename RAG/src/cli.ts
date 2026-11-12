#!/usr/bin/env node
import { loadConfig } from "./config.ts";
import { ingestKnowledge } from "./ingest.ts";
import { ask, decideRoute } from "./pipeline.ts";

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const config = loadConfig();

  switch (command) {
    case "ingest": {
      const result = await ingestKnowledge(config);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "route": {
      const query = readQuery(rest);
      if (!query) {
        throw new Error('Usage: pnpm route -- "your question"');
      }
      const decision = await decideRoute(query, config);
      console.log(JSON.stringify(decision, null, 2));
      return;
    }
    case "ask": {
      const query = readQuery(rest);
      if (!query) {
        throw new Error('Usage: pnpm ask -- "your question"');
      }
      const result = await ask(query, config);
      console.log(
        JSON.stringify(
          {
            mode: result.decision.mode,
            backend: result.backend,
            store: result.decision.store,
            reason: result.decision.reason,
            hits: result.decision.hits.map((h) => ({
              score: h.score,
              source: h.source,
              title: h.title,
            })),
            answer: result.answer,
          },
          null,
          2,
        ),
      );
      return;
    }
    case "smoke": {
      await runSmoke(config);
      return;
    }
    default:
      printHelp();
      if (command) {
        throw new Error(`Unknown command: ${command}`);
      }
  }
}

function readQuery(args: string[]): string {
  return args
    .filter((part) => part !== "--")
    .join(" ")
    .trim();
}

async function runSmoke(config: ReturnType<typeof loadConfig>): Promise<void> {
  process.env.RAG_STORE = process.env.RAG_STORE || "local";
  const localConfig = loadConfig({ storeMode: "local" });
  const ingested = await ingestKnowledge(localConfig);
  const hit = await decideRoute("如何配置微信插件扫码登录 openclaw-weixin？", localConfig);
  const miss = await decideRoute("今天心情怎么样，随便聊聊", localConfig);

  const report = {
    ok:
      ingested.chunks > 0 &&
      hit.mode === "rag" &&
      Boolean(hit.context) &&
      miss.mode === "framework",
    ingest: ingested,
    knowledgeHit: {
      mode: hit.mode,
      reason: hit.reason,
      bestScore: hit.hits[0]?.score ?? null,
      store: hit.store,
    },
    generalMiss: {
      mode: miss.mode,
      reason: miss.reason,
    },
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log(`OpenClaw RAG (Milvus)

Commands:
  ingest                 Index markdown/text under knowledge/
  route -- "<query>"     Intent + retrieve + route decision only
  ask -- "<query>"       Route then answer (RAG LLM or OpenClaw framework)
  smoke                  Local-store end-to-end routing proof

Env: see .env.example
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
