import type { IntentResult } from "./types.ts";

const KNOWLEDGE_PATTERNS: RegExp[] = [
  // Avoid matching 怎么样 / 怎样 as knowledge "怎么".
  /如何|怎么(?!样)|怎样(?!样)|什么是|配置|安装|文档|知识|说明|步骤|教程|指南|为什么|能否|可以吗/,
  /how\s+to|what\s+is|configure|setup|install|docs?|guide|why\b|where\b/i,
  /微信|minimax|gateway|openclaw|插件|通道|模型|api\s*key/i,
];

const GENERAL_PATTERNS: RegExp[] = [
  /你好|您好|在吗|嗨|hello|hi\b|hey\b/i,
  /讲个笑话|陪我聊|随便聊聊|今天天气|心情怎么样|聊会儿/,
  /帮我写代码|写个函数|debug|重构这段/,
];

/**
 * Lightweight intent gate. Later this can call an LLM classifier; keep the
 * return shape stable so the router does not care about the implementation.
 */
export function classifyIntent(query: string): IntentResult {
  const text = query.trim();
  const reasons: string[] = [];

  if (!text) {
    return { kind: "unknown", confidence: 0, reasons: ["empty query"] };
  }

  let generalHits = 0;
  for (const pattern of GENERAL_PATTERNS) {
    if (pattern.test(text)) {
      generalHits += 1;
      reasons.push(`matched general pattern: ${pattern.source}`);
    }
  }

  // Prefer explicit chitchat / tooling intents before knowledge retrieval.
  if (generalHits > 0) {
    return {
      kind: "general",
      confidence: Math.min(0.55 + generalHits * 0.15, 0.95),
      reasons,
    };
  }

  let knowledgeHits = 0;
  for (const pattern of KNOWLEDGE_PATTERNS) {
    if (pattern.test(text)) {
      knowledgeHits += 1;
      reasons.push(`matched knowledge pattern: ${pattern.source}`);
    }
  }

  if (knowledgeHits > 0) {
    return {
      kind: "knowledge",
      confidence: Math.min(0.55 + knowledgeHits * 0.12, 0.95),
      reasons,
    };
  }

  // Default to knowledge so unknown factual questions still attempt retrieval.
  return {
    kind: "knowledge",
    confidence: 0.4,
    reasons: ["no strong pattern; default to knowledge retrieval"],
  };
}
