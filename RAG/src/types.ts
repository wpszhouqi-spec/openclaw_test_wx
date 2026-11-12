export type RouteMode = "rag" | "framework";

export type IntentKind = "knowledge" | "general" | "unknown";

export type IntentResult = {
  kind: IntentKind;
  confidence: number;
  reasons: string[];
};

export type KnowledgeChunk = {
  id: string;
  text: string;
  source: string;
  title?: string;
};

export type RetrievedHit = {
  id: string;
  text: string;
  source: string;
  title?: string;
  score: number;
};

export type RouteDecision = {
  mode: RouteMode;
  query: string;
  intent: IntentResult;
  hits: RetrievedHit[];
  context?: string;
  reason: string;
  store: string;
};

export type AskResult = {
  decision: RouteDecision;
  answer: string;
  backend: "rag-llm" | "framework";
};
