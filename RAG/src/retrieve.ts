import type { RagConfig } from "./config.ts";
import { LocalHashEmbedder } from "./embedder.ts";
import type { VectorStore } from "./store/types.ts";
import type { RetrievedHit } from "./types.ts";

export async function retrieve(
  store: VectorStore,
  config: RagConfig,
  query: string,
): Promise<RetrievedHit[]> {
  const embedder = new LocalHashEmbedder(config.embedDim);
  const embedding = embedder.embed(query);
  // Over-fetch then hybrid-rerank so short Chinese queries still surface lexical matches.
  const raw = await store.search(embedding, Math.max(config.topK * 3, 8));
  return hybridRerank(query, raw).slice(0, Math.max(1, config.topK));
}

const STOPWORDS = new Set([
  "什么",
  "怎么",
  "如何",
  "一下",
  "请根据",
  "根据",
  "已有",
  "知识",
  "简要",
  "介绍",
  "说说",
  "告诉",
  "我",
  "是",
  "的",
  "了",
  "吗",
  "呢",
  "啊",
  "what",
  "is",
  "the",
  "a",
  "an",
  "please",
  "tell",
  "about",
]);

function hybridRerank(query: string, hits: RetrievedHit[]): RetrievedHit[] {
  const terms = extractTerms(query);
  const normalizedQuery = query.normalize("NFKC").toLowerCase();
  return hits
    .map((hit) => {
      const haystack = `${hit.title ?? ""}\n${hit.source}\n${hit.text}`.toLowerCase();
      let overlap = 0;
      for (const term of terms) {
        if (haystack.includes(term)) {
          overlap += term.length >= 4 ? 1.4 : 1;
        }
      }
      const lexical =
        terms.size === 0 ? 0 : Math.min(overlap / Math.max(terms.size * 0.5, 1), 1);
      // Exact multi-char phrase bonus (e.g. 长沙蜜獾).
      let phraseBonus = 0;
      for (const phrase of extractPhrases(normalizedQuery)) {
        if (haystack.includes(phrase)) {
          phraseBonus = Math.max(phraseBonus, Math.min(0.55, phrase.length * 0.08));
        }
      }
      const score = Math.min(1, 0.35 * hit.score + 0.45 * lexical + phraseBonus);
      return { ...hit, score };
    })
    .sort((a, b) => b.score - a.score);
}

function extractTerms(query: string): Set<string> {
  const normalized = query.normalize("NFKC").toLowerCase();
  const terms = new Set<string>();
  for (const part of normalized.split(/[^\p{L}\p{N}]+/u)) {
    if (part.length >= 2 && !STOPWORDS.has(part)) {
      terms.add(part);
    }
  }
  const cjk = normalized.match(/[\u4e00-\u9fff]{2,8}/g) ?? [];
  for (const gram of cjk) {
    if (!STOPWORDS.has(gram)) {
      terms.add(gram);
    }
    if (gram.length >= 4) {
      for (let i = 0; i < gram.length - 1; i += 1) {
        const bi = gram.slice(i, i + 2);
        if (!STOPWORDS.has(bi)) {
          terms.add(bi);
        }
      }
    }
  }
  return terms;
}

function extractPhrases(query: string): string[] {
  const phrases: string[] = [];
  const cjk = query.match(/[\u4e00-\u9fff]{2,12}/g) ?? [];
  for (const gram of cjk) {
    if (!STOPWORDS.has(gram) && gram.length >= 3) {
      phrases.push(gram);
    }
  }
  return phrases;
}

export function isKnowledgeHit(
  hits: RetrievedHit[],
  threshold: number,
): { hit: boolean; best?: RetrievedHit } {
  const best = hits[0];
  if (!best) {
    return { hit: false };
  }
  return { hit: best.score >= threshold, best };
}

export function buildContext(hits: RetrievedHit[], threshold: number): string {
  const kept = hits.filter((hit) => hit.score >= threshold);
  const usable = kept.length > 0 ? kept : hits.slice(0, 1);
  return usable
    .map((hit, index) => {
      const header = `[#${index + 1} score=${hit.score.toFixed(3)} source=${hit.source}${
        hit.title ? ` title=${hit.title}` : ""
      }]`;
      return `${header}\n${hit.text}`;
    })
    .join("\n\n");
}
