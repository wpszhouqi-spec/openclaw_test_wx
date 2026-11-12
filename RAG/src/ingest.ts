import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { RagConfig } from "./config.ts";
import { LocalHashEmbedder } from "./embedder.ts";
import { openStore } from "./store/index.ts";
import type { KnowledgeChunk } from "./types.ts";

const TEXT_EXTS = new Set([".md", ".txt", ".markdown"]);

export async function ingestKnowledge(config: RagConfig): Promise<{
  files: number;
  chunks: number;
  store: string;
  note?: string;
}> {
  const files = await listKnowledgeFiles(config.knowledgeDir);
  const chunks = (
    await Promise.all(files.map(async (file) => chunkFile(file, config.knowledgeDir)))
  ).flat();

  const embedder = new LocalHashEmbedder(config.embedDim);
  const opened = await openStore(config);
  try {
    const upserts = chunks.map((chunk) => ({
      ...chunk,
      embedding: embedder.embed(`${chunk.title ?? ""}\n${chunk.text}`),
    }));
    const written = await opened.store.upsert(upserts);
    return {
      files: files.length,
      chunks: written,
      store: opened.store.name,
      note: opened.note,
    };
  } finally {
    await opened.store.close?.();
  }
}

async function listKnowledgeFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && TEXT_EXTS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function chunkFile(filePath: string, root: string): Promise<KnowledgeChunk[]> {
  const raw = await fs.readFile(filePath, "utf8");
  const relative = path.relative(root, filePath);
  const title = path.basename(filePath, path.extname(filePath));
  const sections = splitSections(raw);
  return sections.map((section, index) => {
    const body = section.trim();
    const idSeed = `${relative}#${index}:${body.slice(0, 64)}`;
    const id = createHash("sha1").update(idSeed).digest("hex").slice(0, 24);
    return {
      id,
      text: body,
      source: relative,
      title: sectionTitle(section, title, index),
    };
  });
}

function splitSections(raw: string): string[] {
  const parts = raw
    .split(/\n(?=#{1,3}\s)/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 0) {
    return parts;
  }
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20);
  return paragraphs.length > 0 ? paragraphs : [raw.trim()].filter(Boolean);
}

function sectionTitle(section: string, fallback: string, index: number): string {
  const heading = section.match(/^#{1,3}\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim();
  }
  return `${fallback}#${index + 1}`;
}
