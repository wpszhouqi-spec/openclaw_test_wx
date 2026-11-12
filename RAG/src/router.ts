import type { RagConfig } from "./config.ts";
import { classifyIntent } from "./intent.ts";
import { buildContext, isKnowledgeHit, retrieve } from "./retrieve.ts";
import { openStore } from "./store/index.ts";
import type { RouteDecision } from "./types.ts";

/**
 * Intent → retrieve → route:
 * - non-knowledge intent → current OpenClaw framework
 * - knowledge intent + score hit → RAG path
 * - knowledge intent + miss → current OpenClaw framework
 */
export async function routeQuery(
  query: string,
  config: RagConfig,
): Promise<RouteDecision> {
  const intent = classifyIntent(query);

  if (intent.kind === "general") {
    return {
      mode: "framework",
      query,
      intent,
      hits: [],
      reason: "intent classified as general chat/tooling; skip RAG",
      store: "none",
    };
  }

  const opened = await openStore(config);
  try {
    const hits = await retrieve(opened.store, config, query);
    const { hit, best } = isKnowledgeHit(hits, config.hitThreshold);
    if (!hit) {
      return {
        mode: "framework",
        query,
        intent,
        hits,
        reason: best
          ? `best score ${best.score.toFixed(3)} < threshold ${config.hitThreshold}; fallback to framework`
          : "no retrieval hits; fallback to framework",
        store: opened.store.name,
      };
    }

    return {
      mode: "rag",
      query,
      intent,
      hits,
      context: buildContext(hits, config.hitThreshold),
      reason: `knowledge hit (best=${best?.score.toFixed(3)}); use RAG`,
      store: opened.store.name,
    };
  } finally {
    await opened.store.close?.();
  }
}
