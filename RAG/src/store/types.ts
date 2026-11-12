import type { KnowledgeChunk, RetrievedHit } from "../types.ts";

export type UpsertChunk = KnowledgeChunk & {
  embedding: number[];
};

export type VectorStore = {
  readonly name: string;
  ensureReady(): Promise<void>;
  upsert(chunks: UpsertChunk[]): Promise<number>;
  search(embedding: number[], topK: number): Promise<RetrievedHit[]>;
  close?(): Promise<void>;
};
