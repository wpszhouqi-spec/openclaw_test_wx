import { createHash } from "node:crypto";

/**
 * Deterministic local embedder for bootstrap / smoke without an external
 * embedding API. Replace with a hosted embedding provider when ready.
 */
export class LocalHashEmbedder {
  readonly dim: number;

  constructor(dim = 384) {
    if (dim < 32) {
      throw new Error("embed dim must be >= 32");
    }
    this.dim = dim;
  }

  embed(text: string): number[] {
    const normalized = text.normalize("NFKC").toLowerCase().trim();
    const vector = new Float64Array(this.dim);
    if (!normalized) {
      return Array.from(vector);
    }

    const tokens = tokenize(normalized);
    for (const token of tokens) {
      const h1 = hash32(`${token}:1`);
      const h2 = hash32(`${token}:2`);
      const i1 = h1 % this.dim;
      const i2 = h2 % this.dim;
      const sign1 = h1 & 1 ? 1 : -1;
      const sign2 = h2 & 1 ? 1 : -1;
      vector[i1] += sign1;
      vector[i2] += sign2 * 0.5;
    }

    // Character bigrams help short Chinese queries.
    for (let i = 0; i < normalized.length - 1; i += 1) {
      const gram = normalized.slice(i, i + 2);
      const h = hash32(`bg:${gram}`);
      vector[h % this.dim] += h & 1 ? 0.35 : -0.35;
    }

    return l2Normalize(vector);
  }
}

function tokenize(text: string): string[] {
  const parts = text
    .split(/[^\p{L}\p{N}]+/u)
    .map((p) => p.trim())
    .filter(Boolean);
  // Also keep contiguous CJK runs as tokens.
  const cjk = text.match(/[\u4e00-\u9fff]{1,4}/g) ?? [];
  return [...parts, ...cjk];
}

function hash32(input: string): number {
  const digest = createHash("sha256").update(input).digest();
  return digest.readUInt32BE(0);
}

function l2Normalize(vector: Float64Array): number[] {
  let sum = 0;
  for (const v of vector) {
    sum += v * v;
  }
  const norm = Math.sqrt(sum) || 1;
  return Array.from(vector, (v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
