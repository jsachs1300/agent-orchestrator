import crypto from "crypto";
import OpenAI from "openai";
import { getRedisClient } from "../core/redis-client";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const CACHE_KEY = "langcache:semantic";
const SIMILARITY_THRESHOLD = Number(process.env.LANGCACHE_THRESHOLD || 0.92);
const MAX_CACHE_ENTRIES = Number(process.env.LANGCACHE_MAX_ENTRIES || 50);

export type SemanticCacheEntry = {
  id: string;
  promptHash: string;
  prompt: string;
  embedding: number[];
  response: string;
  createdAt: string;
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, idx) => sum + ai * b[idx], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (!normA || !normB) return 0;
  return dot / (normA * normB);
}

async function embedPrompt(prompt: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for semantic caching");
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: prompt
  });
  return result.data[0]?.embedding || [];
}

async function ensureEntriesSize(
  client: Awaited<ReturnType<typeof getRedisClient>>,
  entries: SemanticCacheEntry[]
): Promise<void> {
  if (!client) return;
  if (entries.length <= MAX_CACHE_ENTRIES) return;

  const sorted = [...entries].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const excess = sorted.slice(0, entries.length - MAX_CACHE_ENTRIES);
  for (const entry of excess) {
    await client.hDel(CACHE_KEY, entry.id);
  }
}

export class LangCache {
  async get(prompt: string): Promise<string | null> {
    const client = await getRedisClient();
    if (!client) return null;

    let embedding: number[];
    try {
      embedding = await embedPrompt(prompt);
    } catch (err) {
      console.warn("Semantic cache embedding failed", err);
      return null;
    }
    const rawEntries = await client.hVals(CACHE_KEY);
    const entries: SemanticCacheEntry[] = rawEntries
      .map(value => {
        try {
          return JSON.parse(value) as SemanticCacheEntry;
        } catch (err) {
          return null;
        }
      })
      .filter((entry): entry is SemanticCacheEntry => Boolean(entry));

    let best: { response: string; score: number } | null = null;
    for (const entry of entries) {
      const score = cosineSimilarity(embedding, entry.embedding);
      if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
        best = { response: entry.response, score };
      }
    }

    return best ? best.response : null;
  }

  async set(prompt: string, response: string): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;

    let embedding: number[];
    try {
      embedding = await embedPrompt(prompt);
    } catch (err) {
      console.warn("Semantic cache embedding failed", err);
      return;
    }
    const entry: SemanticCacheEntry = {
      id: crypto.randomUUID(),
      promptHash: crypto.createHash("sha256").update(prompt).digest("hex"),
      prompt,
      embedding,
      response,
      createdAt: new Date().toISOString()
    };

    await client.hSet(CACHE_KEY, entry.id, JSON.stringify(entry));

    const rawEntries = await client.hVals(CACHE_KEY);
    const entries: SemanticCacheEntry[] = rawEntries
      .map(value => {
        try {
          return JSON.parse(value) as SemanticCacheEntry;
        } catch (err) {
          return null;
        }
      })
      .filter((entry): entry is SemanticCacheEntry => Boolean(entry));

    await ensureEntriesSize(client, entries);
  }
}

export async function getLangCache(): Promise<LangCache | null> {
  const client = await getRedisClient();
  if (!client) return null;
  return new LangCache();
}
