import { storage } from "../storage";
import type { MemoryDoc, InsertMemoryDoc, InsertMemoryChunk } from "@shared/schema";

const CHUNK_TARGET_TOKENS = 500;
const HOT_TO_WARM_MS = 5 * 60 * 1000;
const WARM_TO_COLD_MS = 30 * 60 * 1000;
const COMPRESS_INTERVAL_MS = 2 * 60 * 1000;

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "that", "this",
  "these", "those", "what", "which", "who", "whom", "it", "its", "i",
  "me", "my", "we", "our", "you", "your", "he", "him", "his", "she",
  "her", "they", "them", "their", "about", "also", "up", "like", "well",
  "still", "even", "get", "got", "make", "made", "let", "see", "new",
  "one", "two", "much", "many", "way", "any", "thing", "things", "don",
  "doesn", "didn", "won", "wouldn", "couldn", "shouldn", "isn", "aren",
  "wasn", "weren", "hasn", "haven", "hadn",
]);

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

function splitIntoSentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.filter(s => s.trim().length > 0);
}

function chunkContent(content: string): { chunks: string[]; tokenCounts: number[] } {
  const sentences = splitIntoSentences(content);
  const chunks: string[] = [];
  const tokenCounts: number[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > CHUNK_TARGET_TOKENS && currentChunk.length > 0) {
      const chunkText = currentChunk.join(" ");
      chunks.push(chunkText);
      tokenCounts.push(currentTokens);
      currentChunk = [sentence];
      currentTokens = sentenceTokens;
    } else {
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(" ");
    chunks.push(chunkText);
    tokenCounts.push(currentTokens);
  }

  if (chunks.length === 0 && content.trim().length > 0) {
    chunks.push(content.trim());
    tokenCounts.push(estimateTokens(content));
  }

  return { chunks, tokenCounts };
}

function extractKeywords(text: string, limit = 15): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/);
  const freq = new Map<string, number>();

  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (STOPWORDS.has(words[i]) || STOPWORDS.has(words[i + 1])) continue;
    if (words[i].length < 3 || words[i + 1].length < 3) continue;
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigrams.push(bigram);
  }
  const bigramFreq = new Map<string, number>();
  for (const bg of bigrams) {
    bigramFreq.set(bg, (bigramFreq.get(bg) || 0) + 1);
  }

  const scored: [string, number][] = [];
  freq.forEach((count, word) => {
    scored.push([word, count]);
  });
  bigramFreq.forEach((count, bigram) => {
    if (count >= 2) {
      scored.push([bigram, count * 2]);
    }
  });

  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, limit).map(([word]) => word);
}

function extractTags(text: string, keywords: string[]): string[] {
  const tags: string[] = [];

  const categoryPatterns: [RegExp, string][] = [
    [/\b(security|vulnerability|threat|attack|defense|auth)\b/i, "security"],
    [/\b(architecture|design|pattern|framework|system)\b/i, "architecture"],
    [/\b(code|function|api|endpoint|implementation|debug)\b/i, "engineering"],
    [/\b(research|study|paper|finding|analysis)\b/i, "research"],
    [/\b(ethics|compliance|regulation|policy|governance)\b/i, "ethics"],
    [/\b(creative|innovation|novel|idea|concept)\b/i, "creative"],
    [/\b(memory|knowledge|learning|data|information)\b/i, "knowledge"],
    [/\b(plan|goal|strategy|objective|milestone)\b/i, "planning"],
    [/\b(review|feedback|assessment|evaluation)\b/i, "review"],
    [/\b(deploy|release|ship|production|launch)\b/i, "operations"],
  ];

  for (const [pattern, tag] of categoryPatterns) {
    if (pattern.test(text)) {
      tags.push(tag);
    }
  }

  if (keywords.length > 0) {
    tags.push(...keywords.slice(0, 3));
  }

  return Array.from(new Set(tags)).slice(0, 10);
}

function extractiveSummary(text: string, maxSentences = 3): string {
  const sentences = splitIntoSentences(text);
  if (sentences.length <= maxSentences) return text;

  const keywords = extractKeywords(text, 10);
  const keywordArr = keywords;

  const scored = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase().split(/\s+/);
    let score = 0;

    for (const word of words) {
      if (keywordArr.indexOf(word) !== -1) score += 2;
    }

    if (index === 0) score += 3;
    if (index === 1) score += 1;

    if (sentence.length > 20 && sentence.length < 300) score += 1;

    return { sentence, score, index };
  });

  scored.sort((a, b) => b.score - a.score);
  const topSentences = scored.slice(0, maxSentences);
  topSentences.sort((a, b) => a.index - b.index);

  return topSentences.map(s => s.sentence).join(" ");
}

export interface IndexOptions {
  workspaceId: string;
  agentId?: string;
  type: "identity" | "goal" | "fact" | "event" | "artifact" | "summary";
  title: string;
  content: string;
  sourceId?: string;
  sourceType?: string;
  additionalTags?: string[];
}

export interface IndexResult {
  doc: MemoryDoc;
  chunkCount: number;
  totalTokens: number;
  keywords: string[];
  summary: string;
}

export async function index(options: IndexOptions): Promise<IndexResult> {
  const { workspaceId, agentId, type, title, content, sourceId, sourceType, additionalTags } = options;

  const keywords = extractKeywords(content);
  const tags = extractTags(content, keywords);
  if (additionalTags) {
    tags.push(...additionalTags);
  }
  const summary = extractiveSummary(content);
  const { chunks, tokenCounts } = chunkContent(content);
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);

  const doc = await storage.createMemoryDoc({
    workspaceId,
    agentId: agentId || null,
    tier: "hot",
    type,
    title,
    content,
    summary,
    keywords,
    tags: Array.from(new Set(tags)),
    sourceId: sourceId || null,
    sourceType: sourceType || null,
    chunkCount: chunks.length,
    totalTokens,
  });

  const chunkRecords: InsertMemoryChunk[] = chunks.map((chunkText, i) => ({
    docId: doc.id,
    chunkIndex: i,
    content: chunkText,
    keywords: extractKeywords(chunkText, 5),
    tokenCount: tokenCounts[i],
  }));

  if (chunkRecords.length > 0) {
    await storage.createMemoryChunksBatch(chunkRecords);
  }

  return {
    doc,
    chunkCount: chunks.length,
    totalTokens,
    keywords,
    summary,
  };
}

export interface CompressResult {
  hotToWarm: number;
  warmToCold: number;
  tokensReclaimed: number;
}

export async function compress(): Promise<CompressResult> {
  let hotToWarm = 0;
  let warmToCold = 0;
  let tokensReclaimed = 0;

  const hotDocs = await storage.getMemoryDocsByTierAndAge("hot", HOT_TO_WARM_MS);
  for (const doc of hotDocs) {
    let summary = doc.summary;
    if (!summary || summary.trim().length === 0) {
      summary = extractiveSummary(doc.content);
    }
    await storage.updateMemoryDoc(doc.id, {
      tier: "warm" as any,
      summary,
    });
    hotToWarm++;
  }

  const warmDocs = await storage.getMemoryDocsByTierAndAge("warm", WARM_TO_COLD_MS);
  for (const doc of warmDocs) {
    let summary = doc.summary;
    if (!summary || summary.trim().length === 0) {
      summary = extractiveSummary(doc.content);
    }

    const originalTokens = doc.totalTokens || estimateTokens(doc.content);
    const summaryTokens = estimateTokens(summary);
    tokensReclaimed += Math.max(0, originalTokens - summaryTokens);

    await storage.updateMemoryDoc(doc.id, {
      tier: "cold" as any,
      content: summary,
      summary,
      totalTokens: summaryTokens,
    });

    await storage.deleteChunksByDoc(doc.id);
    warmToCold++;
  }

  return { hotToWarm, warmToCold, tokensReclaimed };
}

let compressInterval: ReturnType<typeof setInterval> | null = null;

export function startCompressor(): void {
  if (compressInterval) return;

  console.log(`[RLM] Starting memory compressor (interval: ${COMPRESS_INTERVAL_MS / 1000}s)`);

  compressInterval = setInterval(async () => {
    try {
      const result = await compress();
      if (result.hotToWarm > 0 || result.warmToCold > 0) {
        console.log(`[RLM] Compress: ${result.hotToWarm} hot→warm, ${result.warmToCold} warm→cold, ${result.tokensReclaimed} tokens reclaimed`);
      }
    } catch (error) {
      console.error("[RLM] Compress error:", error);
    }
  }, COMPRESS_INTERVAL_MS);
}

export function stopCompressor(): void {
  if (compressInterval) {
    clearInterval(compressInterval);
    compressInterval = null;
    console.log("[RLM] Memory compressor stopped");
  }
}

export async function search(
  workspaceId: string,
  query: string,
  options: { tier?: string; limit?: number } = {}
): Promise<{ docs: MemoryDoc[]; chunks: any[] }> {
  const docs = await storage.searchMemoryDocs(workspaceId, query, options.tier);

  const queryKeywords = extractKeywords(query, 5);
  const chunks = await storage.searchMemoryChunks(workspaceId, query);

  for (const doc of docs.slice(0, 10)) {
    await storage.incrementMemoryDocAccess(doc.id);
  }

  return {
    docs: docs.slice(0, options.limit || 20),
    chunks: chunks.slice(0, options.limit || 30),
  };
}

export async function getStats(workspaceId: string): Promise<{
  tiers: { tier: string; count: number; totalTokens: number }[];
  totalDocs: number;
  totalTokens: number;
}> {
  const tiers = await storage.getMemoryDocStats(workspaceId);
  const totalDocs = tiers.reduce((a, t) => a + t.count, 0);
  const totalTokens = tiers.reduce((a, t) => a + t.totalTokens, 0);
  return { tiers, totalDocs, totalTokens };
}

export function buildAgentMemoryContext(docs: MemoryDoc[]): string {
  if (docs.length === 0) return "";

  const grouped = docs.reduce((acc, doc) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, MemoryDoc[]>);

  const sections: string[] = [];

  if (grouped.identity) {
    sections.push("## Identity\n" + grouped.identity.map(m => `- ${m.title}: ${m.summary || m.content}`).join("\n"));
  }
  if (grouped.goal) {
    sections.push("## Active Goals\n" + grouped.goal.map(m => `- ${m.title}`).join("\n"));
  }
  if (grouped.fact) {
    sections.push("## Key Facts\n" + grouped.fact.map(m => `- ${m.summary || m.content}`).join("\n"));
  }
  if (grouped.event) {
    const recent = grouped.event.slice(0, 5);
    sections.push("## Recent Events\n" + recent.map(m => `- ${m.title}: ${m.summary || ''}`).join("\n"));
  }
  if (grouped.artifact) {
    sections.push("## Artifacts\n" + grouped.artifact.map(m => `- ${m.title}`).join("\n"));
  }
  if (grouped.summary) {
    sections.push("## Summaries\n" + grouped.summary.map(m => `- ${m.summary || m.content}`).join("\n"));
  }

  return sections.join("\n\n");
}
