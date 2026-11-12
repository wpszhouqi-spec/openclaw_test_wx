import type { RagConfig } from "./config.ts";
import { buildRagPrompt, runOpenClawAgent } from "./framework.ts";
import { routeQuery } from "./router.ts";
import type { AskResult, RouteDecision } from "./types.ts";

export async function decideRoute(query: string, config: RagConfig): Promise<RouteDecision> {
  return routeQuery(query, config);
}

/**
 * Full path: intent → retrieve → RAG LLM or current OpenClaw framework.
 */
export async function ask(query: string, config: RagConfig): Promise<AskResult> {
  const decision = await routeQuery(query, config);

  if (decision.mode === "rag" && decision.context) {
    if (!config.answerViaOpenclaw) {
      return {
        decision,
        backend: "rag-llm",
        answer: [
          "[RAG context only — set RAG_ANSWER_VIA_OPENCLAW=1 to call LLM]",
          decision.context,
        ].join("\n\n"),
      };
    }
    const answer = await runOpenClawAgent(
      config,
      buildRagPrompt(query, decision.context),
    );
    return { decision, backend: "rag-llm", answer };
  }

  const answer = await runOpenClawAgent(config, query);
  return { decision, backend: "framework", answer };
}
