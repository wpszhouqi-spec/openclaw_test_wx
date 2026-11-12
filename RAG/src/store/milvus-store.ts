import { MilvusClient, DataType, MetricType } from "@zilliz/milvus2-sdk-node";
import type { RetrievedHit } from "../types.ts";
import type { UpsertChunk, VectorStore } from "./types.ts";

export class MilvusStore implements VectorStore {
  readonly name = "milvus";
  private readonly client: MilvusClient;
  private readonly collection: string;
  private readonly dim: number;

  constructor(opts: { address: string; collection: string; dim: number; timeoutMs: number }) {
    this.client = new MilvusClient({
      address: opts.address,
      timeout: opts.timeoutMs,
    });
    this.collection = opts.collection;
    this.dim = opts.dim;
  }

  async ensureReady(): Promise<void> {
    await this.client.connectPromise;
    const has = await this.client.hasCollection({ collection_name: this.collection });
    if (has.value) {
      await this.client.loadCollectionSync({ collection_name: this.collection });
      return;
    }

    await this.client.createCollection({
      collection_name: this.collection,
      fields: [
        {
          name: "id",
          data_type: DataType.VarChar,
          is_primary_key: true,
          max_length: 128,
        },
        {
          name: "text",
          data_type: DataType.VarChar,
          max_length: 8192,
        },
        {
          name: "source",
          data_type: DataType.VarChar,
          max_length: 512,
        },
        {
          name: "title",
          data_type: DataType.VarChar,
          max_length: 256,
        },
        {
          name: "embedding",
          data_type: DataType.FloatVector,
          dim: this.dim,
        },
      ],
    });

    await this.client.createIndex({
      collection_name: this.collection,
      field_name: "embedding",
      index_name: "embedding_idx",
      index_type: "AUTOINDEX",
      metric_type: MetricType.COSINE,
    });
    await this.client.loadCollectionSync({ collection_name: this.collection });
  }

  async upsert(chunks: UpsertChunk[]): Promise<number> {
    if (chunks.length === 0) {
      return 0;
    }
    for (const chunk of chunks) {
      if (chunk.embedding.length !== this.dim) {
        throw new Error(
          `embedding dim mismatch for ${chunk.id}: got ${chunk.embedding.length}, expected ${this.dim}`,
        );
      }
    }

    const result = await this.client.upsert({
      collection_name: this.collection,
      data: chunks.map((chunk) => ({
        id: chunk.id,
        text: truncate(chunk.text, 8000),
        source: truncate(chunk.source, 500),
        title: truncate(chunk.title ?? "", 250),
        embedding: chunk.embedding,
      })),
    });
    if (result.status.error_code !== "Success") {
      throw new Error(`Milvus upsert failed: ${result.status.reason}`);
    }
    await this.client.flushSync({ collection_names: [this.collection] });
    return chunks.length;
  }

  async search(embedding: number[], topK: number): Promise<RetrievedHit[]> {
    const result = await this.client.search({
      collection_name: this.collection,
      data: [embedding],
      anns_field: "embedding",
      limit: Math.max(1, topK),
      metric_type: MetricType.COSINE,
      output_fields: ["id", "text", "source", "title"],
    });
    if (result.status.error_code !== "Success") {
      throw new Error(`Milvus search failed: ${result.status.reason}`);
    }

    const rows = Array.isArray(result.results) ? result.results : [];
    return rows.map((row) => ({
      id: String(row.id ?? row["id"] ?? ""),
      text: String(row.text ?? row["text"] ?? ""),
      source: String(row.source ?? row["source"] ?? ""),
      title: String(row.title ?? row["title"] ?? "") || undefined,
      score: Number(row.score ?? row["score"] ?? 0),
    }));
  }

  async close(): Promise<void> {
    await this.client.closeConnection();
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
