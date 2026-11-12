import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { loadConfig, routeQuery } from "../src/index.ts";
import manifest from "./openclaw.plugin.json" with { type: "json" };

function resolveRagRoot(): string {
  const fromEnv = process.env.RAG_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, ".."),
    path.resolve(process.cwd(), "RAG"),
    "/Users/zhouqi/zhouqi/openclaw-main/RAG",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "knowledge"))) {
      return candidate;
    }
  }
  return path.resolve(here, "..");
}

type PluginConfig = {
  enabled?: boolean;
  hitThreshold?: number;
  storeMode?: "auto" | "milvus" | "local";
};

type PromptBuildEvent = {
  prompt?: string;
  currentUserMessage?: string;
};

function trace(message: string): void {
  try {
    fs.appendFileSync(
      "/tmp/rag-milvus-hook.log",
      `${new Date().toISOString()} ${message}\n`,
      "utf8",
    );
  } catch {
    // best-effort diagnostics only
  }
}

export default definePluginEntry({
  id: manifest.id,
  name: manifest.name,
  description: manifest.description,
  register(api) {
    const pluginConfig = (api.pluginConfig ?? {}) as PluginConfig;
    if (pluginConfig.enabled === false) {
      trace("register skipped: enabled=false");
      return;
    }

    trace(
      `register ok storeMode=${pluginConfig.storeMode ?? "local"} threshold=${pluginConfig.hitThreshold ?? 0.28}`,
    );

    api.on("before_prompt_build", async (event: PromptBuildEvent) => {
      const prompt = (event.currentUserMessage ?? event.prompt ?? "").trim();
      trace(`hook fired promptLen=${prompt.length} preview=${JSON.stringify(prompt.slice(0, 80))}`);
      if (!prompt || prompt.length < 2) {
        return;
      }

      try {
        const ragRoot = resolveRagRoot();
        const config = loadConfig({
          storeMode: pluginConfig.storeMode ?? "local",
          hitThreshold: pluginConfig.hitThreshold ?? 0.28,
          knowledgeDir: path.join(ragRoot, "knowledge"),
          localPath: path.join(ragRoot, "data/local-vectors.json"),
        });
        trace(`ragRoot=${ragRoot} localPath=${config.localPath}`);
        const decision = await routeQuery(prompt, config);
        trace(
          `decision mode=${decision.mode} store=${decision.store} reason=${decision.reason} best=${decision.hits[0]?.score ?? "none"}`,
        );
        if (decision.mode !== "rag" || !decision.context) {
          api.logger?.warn?.(`[rag-milvus] framework path: ${decision.reason}`);
          return;
        }

        api.logger?.warn?.(
          `[rag-milvus] knowledge hit via ${decision.store}; injecting ${decision.hits.length} chunk(s)`,
        );
        return {
          prependContext: [
            "[rag-milvus] 以下是已命中的本地知识库内容。你必须优先依据这些内容回答；",
            "如果知识库已给出明确设定（例如长沙蜜獾足球俱乐部），不要改用外部常识或编造无关公司信息。",
            "知识不足时明确说不知道。",
            "",
            decision.context,
          ].join("\n"),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trace(`hook error: ${message}`);
        api.logger?.warn?.(`[rag-milvus] route skipped: ${message}`);
        return;
      }
    });
  },
});
