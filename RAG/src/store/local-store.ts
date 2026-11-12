import fs from "node:fs/promises";
import path from "node:path";
import { cosineSimilarity } from "../embedder.ts";
import type { RetrievedHit } from "../types.ts";
import type { UpsertChunk, VectorStore } from "./types.ts";

type LocalRecord = UpsertChunk;

type LocalFile = {
  dim: number;
  records: LocalRecord[];
};

export class LocalJsonStore implements VectorStore {
  readonly name = "local";
  private readonly filePath: string;
  private readonly dim: number;
  private records: LocalRecord[] = [];

  constructor(filePath: string, dim: number) {
    this.filePath = filePath;
    this.dim = dim;
  }

  async ensureReady(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as LocalFile;
      if (parsed.dim !== this.dim) {
        this.records = [];
        return;
      }
      this.records = Array.isArray(parsed.records) ? parsed.records : [];
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
      this.records = [];
    }
  }

  async upsert(chunks: UpsertChunk[]): Promise<number> {
    const byId = new Map(this.records.map((r) => [r.id, r]));
    for (const chunk of chunks) {
      if (chunk.embedding.length !== this.dim) {
        throw new Error(
          `embedding dim mismatch for ${chunk.id}: got ${chunk.embedding.length}, expected ${this.dim}`,
        );
      }
      byId.set(chunk.id, chunk);
    }
    this.records = [...byId.values()];
    const payload: LocalFile = { dim: this.dim, records: this.records };
    await fs.writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return chunks.length;
  }

  async search(embedding: number[], topK: number): Promise<RetrievedHit[]> {
    const scored = this.records
      .map((record) => ({
        id: record.id,
        text: record.text,
        source: record.source,
        title: record.title,
        score: cosineSimilarity(embedding, record.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK));
    return scored;
  }
}
