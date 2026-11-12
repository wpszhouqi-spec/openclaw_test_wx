import type { RagConfig } from "../config.ts";
import { LocalJsonStore } from "./local-store.ts";
import { MilvusStore } from "./milvus-store.ts";
import type { VectorStore } from "./types.ts";

export type OpenedStore = {
  store: VectorStore;
  requested: RagConfig["storeMode"];
  note?: string;
};

export async function openStore(config: RagConfig): Promise<OpenedStore> {
  if (config.storeMode === "local") {
    const store = new LocalJsonStore(config.localPath, config.embedDim);
    await store.ensureReady();
    return { store, requested: "local" };
  }

  if (config.storeMode === "milvus") {
    const store = new MilvusStore({
      address: config.milvusAddress,
      collection: config.milvusCollection,
      dim: config.embedDim,
      timeoutMs: config.milvusTimeoutMs,
    });
    await store.ensureReady();
    return { store, requested: "milvus" };
  }

  // auto: prefer Milvus, fall back to local when unreachable
  try {
    const store = new MilvusStore({
      address: config.milvusAddress,
      collection: config.milvusCollection,
      dim: config.embedDim,
      timeoutMs: config.milvusTimeoutMs,
    });
    await store.ensureReady();
    return { store, requested: "auto" };
  } catch (error) {
    const store = new LocalJsonStore(config.localPath, config.embedDim);
    await store.ensureReady();
    return {
      store,
      requested: "auto",
      note: `Milvus unavailable (${formatError(error)}); using local store`,
    };
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export type { VectorStore } from "./types.ts";
