export { loadConfig, RAG_ROOT, type RagConfig } from "./config.ts";
export { LocalHashEmbedder, cosineSimilarity } from "./embedder.ts";
export { classifyIntent } from "./intent.ts";
export { ingestKnowledge } from "./ingest.ts";
export { retrieve, isKnowledgeHit, buildContext } from "./retrieve.ts";
export { routeQuery } from "./router.ts";
export { decideRoute, ask } from "./pipeline.ts";
export { runOpenClawAgent, buildRagPrompt } from "./framework.ts";
export { openStore } from "./store/index.ts";
export type {
  AskResult,
  IntentKind,
  IntentResult,
  KnowledgeChunk,
  RetrievedHit,
  RouteDecision,
  RouteMode,
} from "./types.ts";
