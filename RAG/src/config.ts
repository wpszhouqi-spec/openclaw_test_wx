import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function resolveRagRoot(): string {
  const fromEnv = process.env.RAG_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  const candidates = [
    path.resolve(here, ".."),
    path.resolve(process.cwd(), "RAG"),
    path.resolve(process.cwd(), "../RAG"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "knowledge"))) {
      return candidate;
    }
  }
  return path.resolve(here, "..");
}

export const RAG_ROOT = resolveRagRoot();

function env(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function envNumber(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = env(name).trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type RagConfig = {
  storeMode: "auto" | "milvus" | "local";
  milvusAddress: string;
  milvusCollection: string;
  milvusTimeoutMs: number;
  topK: number;
  hitThreshold: number;
  embedDim: number;
  knowledgeDir: string;
  localPath: string;
  openclawRoot: string;
  openclawBin: string;
  openclawAgentId: string;
  openclawModel: string;
  answerViaOpenclaw: boolean;
};

export function loadConfig(overrides: Partial<RagConfig> = {}): RagConfig {
  const storeRaw = env("RAG_STORE", "auto").toLowerCase();
  const storeMode =
    storeRaw === "milvus" || storeRaw === "local" || storeRaw === "auto"
      ? storeRaw
      : "auto";

  const openclawRoot = path.resolve(RAG_ROOT, env("OPENCLAW_ROOT", ".."));
  const openclawBin = path.resolve(
    RAG_ROOT,
    env("OPENCLAW_AGENT_BIN", path.join(openclawRoot, "openclaw.mjs")),
  );

  return {
    storeMode,
    milvusAddress: env("MILVUS_ADDRESS", "127.0.0.1:19530"),
    milvusCollection: env("MILVUS_COLLECTION", "openclaw_rag_chunks"),
    milvusTimeoutMs: envNumber("MILVUS_TIMEOUT_MS", 5000),
    topK: envNumber("RAG_TOP_K", 4),
    hitThreshold: envNumber("RAG_HIT_THRESHOLD", 0.22),
    embedDim: envNumber("RAG_EMBED_DIM", 384),
    knowledgeDir: path.resolve(RAG_ROOT, env("RAG_KNOWLEDGE_DIR", "./knowledge")),
    localPath: path.resolve(RAG_ROOT, env("RAG_LOCAL_PATH", "./data/local-vectors.json")),
    openclawRoot,
    openclawBin,
    openclawAgentId: env("OPENCLAW_AGENT_ID", "main"),
    openclawModel: env("OPENCLAW_MODEL", "minimax/MiniMax-M3"),
    answerViaOpenclaw: envBool("RAG_ANSWER_VIA_OPENCLAW", true),
    ...overrides,
  };
}
