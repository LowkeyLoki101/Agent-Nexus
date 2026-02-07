import { db } from "./db";
import {
  memoryDocs,
  memoryChunks,
  memoryExtracts,
  agentContext,
  type MemoryDoc,
  type MemoryChunk,
  type MemoryExtract,
  type AgentContext,
} from "@shared/schema";
import { eq, and, desc, sql, ilike, or, inArray } from "drizzle-orm";

// ============================================================
// Token Estimation
// ============================================================

/** Rough token count: ~4 chars per token for English text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================
// Extractive Summarizer (no external LLM required)
//
// This does local, deterministic summarization by:
//  1. Splitting into sentences
//  2. Scoring each sentence by keyword density + position
//  3. Selecting top N sentences that fit within a token budget
//
// Can be swapped for an Ollama/API call later via the
// SummarizerFn interface.
// ============================================================

export type SummarizerFn = (text: string, maxTokens: number) => Promise<string>;

function splitSentences(text: string): string[] {
  return text
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function scoreKeywordDensity(sentence: string, keywords: string[]): number {
  const lower = sentence.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) hits++;
  }
  return keywords.length > 0 ? hits / keywords.length : 0;
}

/** Extract high-signal keywords from text */
function extractKeywords(text: string, maxKeywords = 20): string[] {
  const stopwords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than",
    "too", "very", "just", "because", "as", "until", "while", "of",
    "at", "by", "for", "with", "about", "against", "between", "through",
    "during", "before", "after", "above", "below", "to", "from", "up",
    "down", "in", "out", "on", "off", "over", "under", "again", "further",
    "then", "once", "here", "there", "when", "where", "why", "how",
    "this", "that", "these", "those", "i", "me", "my", "we", "our",
    "you", "your", "he", "him", "his", "she", "her", "it", "its",
    "they", "them", "their", "what", "which", "who", "whom",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/** Extract tags (capitalized phrases, agent names, room names, tools) */
function extractTags(text: string): string[] {
  const tags = new Set<string>();

  // Named entities: capitalized multi-word or single capitalized words
  const namedMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (namedMatches) {
    for (const m of namedMatches) {
      if (m.length > 2) tags.add(m);
    }
  }

  // Known domain terms
  const domainTerms = [
    "lesson", "pattern", "insight", "tension", "artifact", "proposal", "process",
    "research", "content", "deploy", "test", "monitor", "handoff", "coordinate",
    "infrastructure", "momentum", "initiative", "prototype", "relay",
  ];
  const lower = text.toLowerCase();
  for (const term of domainTerms) {
    if (lower.includes(term)) tags.add(term);
  }

  return Array.from(tags).slice(0, 15);
}

/** Default extractive summarizer — no LLM, pure heuristic */
export async function extractiveSummarize(
  text: string,
  maxTokens: number = 150
): Promise<string> {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return text.slice(0, maxTokens * 4);
  if (sentences.length <= 2) return sentences.join(" ");

  const keywords = extractKeywords(text);

  // Score each sentence
  const scored = sentences.map((s, i) => {
    const positionScore = i === 0 ? 0.3 : i < 3 ? 0.15 : 0;
    const keywordScore = scoreKeywordDensity(s, keywords) * 0.5;
    const lengthPenalty = s.length > 300 ? -0.1 : 0;
    // Boost sentences with strong signal words
    const signalBoost =
      /learned|realized|discovered|changed|important|key|critical|because|therefore|insight|pattern/i.test(s)
        ? 0.2
        : 0;
    return {
      sentence: s,
      index: i,
      score: positionScore + keywordScore + lengthPenalty + signalBoost,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Greedily pick top sentences within token budget
  const selected: typeof scored = [];
  let totalTokens = 0;
  for (const item of scored) {
    const tokens = estimateTokens(item.sentence);
    if (totalTokens + tokens > maxTokens) continue;
    selected.push(item);
    totalTokens += tokens;
  }

  // Return in original order for readability
  selected.sort((a, b) => a.index - b.index);
  return selected.map((s) => s.sentence).join(" ");
}

// ============================================================
// RLM Memory Service
// ============================================================

export class RLMMemory {
  private summarize: SummarizerFn;

  constructor(summarizer?: SummarizerFn) {
    this.summarize = summarizer || extractiveSummarize;
  }

  // ----------------------------------------------------------
  // INDEX: Store a new document with auto-chunking + summary
  // ----------------------------------------------------------

  async index(opts: {
    agentId: string;
    source: "diary_entry" | "thought" | "task_complete" | "room_transition" | "handoff" | "anomaly" | "compression_extract" | "synthesis" | "manual";
    content: string;
    path?: string;
    layer?: "private" | "shared";
    chunkSize?: number; // max tokens per chunk
  }): Promise<{ docId: string; chunkCount: number; totalTokens: number; summaryTokens: number }> {
    const {
      agentId,
      source,
      content,
      path,
      layer = "private",
      chunkSize = 500,
    } = opts;

    const totalTokens = estimateTokens(content);

    // Insert doc record
    const [doc] = await db
      .insert(memoryDocs)
      .values({
        agentId,
        source,
        path: path || `${agentId}/${source}/${Date.now()}`,
        tier: "hot",
        layer,
        tokenCount: totalTokens,
        accessCount: 0,
      })
      .returning();

    // Chunk the content
    const sentences = splitSentences(content);
    const chunks: { text: string; position: number }[] = [];
    let currentChunk = "";
    let currentPosition = 0;

    for (const sentence of sentences) {
      if (estimateTokens(currentChunk + " " + sentence) > chunkSize && currentChunk) {
        chunks.push({ text: currentChunk.trim(), position: currentPosition });
        currentPosition++;
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }
    if (currentChunk.trim()) {
      chunks.push({ text: currentChunk.trim(), position: currentPosition });
    }

    // If content is short enough, just one chunk
    if (chunks.length === 0) {
      chunks.push({ text: content, position: 0 });
    }

    // Generate summaries and store chunks
    let summaryTokens = 0;
    for (const chunk of chunks) {
      const summary = await this.summarize(chunk.text, 80);
      const keywords = extractKeywords(chunk.text, 10);
      const tags = extractTags(chunk.text);
      const chunkTokens = estimateTokens(chunk.text);
      const sTokens = estimateTokens(summary);
      summaryTokens += sTokens;

      await db.insert(memoryChunks).values({
        docId: doc.id,
        layer,
        content: chunk.text,
        summary,
        tags,
        keywords,
        position: chunk.position,
        tokenCount: chunkTokens,
        summaryTokenCount: sTokens,
      });
    }

    return {
      docId: doc.id,
      chunkCount: chunks.length,
      totalTokens,
      summaryTokens,
    };
  }

  // ----------------------------------------------------------
  // SEARCH: Keyword search over summaries (cheap — reads summaries, not content)
  // ----------------------------------------------------------

  async search(opts: {
    query: string;
    agentId?: string;
    layer?: "private" | "shared";
    tier?: "hot" | "warm" | "cold";
    limit?: number;
  }): Promise<
    Array<{
      docId: string;
      chunkId: string;
      summary: string;
      tags: string[] | null;
      score: number;
      tier: string;
      source: string;
    }>
  > {
    const { query, agentId, layer, tier, limit = 10 } = opts;

    // Split query into search terms
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (terms.length === 0) return [];

    // Build conditions
    const conditions: any[] = [];
    if (agentId) {
      conditions.push(eq(memoryDocs.agentId, agentId));
    }
    if (tier) {
      conditions.push(eq(memoryDocs.tier, tier));
    }
    if (layer) {
      conditions.push(eq(memoryChunks.layer, layer));
    }

    // Search summaries and keywords using ILIKE for each term
    const likeConditions = terms.map((term) =>
      or(
        ilike(memoryChunks.summary, `%${term}%`),
        sql`EXISTS (SELECT 1 FROM unnest(${memoryChunks.keywords}) AS kw WHERE kw ILIKE ${"%" + term + "%"})`
      )
    );

    // Query: join docs + chunks, filter, return summaries
    const results = await db
      .select({
        docId: memoryDocs.id,
        chunkId: memoryChunks.id,
        summary: memoryChunks.summary,
        tags: memoryChunks.tags,
        tier: memoryDocs.tier,
        source: memoryDocs.source,
        agentId: memoryDocs.agentId,
      })
      .from(memoryChunks)
      .innerJoin(memoryDocs, eq(memoryChunks.docId, memoryDocs.id))
      .where(
        and(
          ...conditions,
          or(...likeConditions)
        )
      )
      .orderBy(desc(memoryDocs.createdAt))
      .limit(limit);

    // Score results by how many search terms matched
    return results.map((r) => {
      const summaryLower = (r.summary || "").toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (summaryLower.includes(term)) score += 1;
      }
      return { ...r, summary: r.summary || "", score };
    }).sort((a, b) => b.score - a.score);
  }

  // ----------------------------------------------------------
  // RETRIEVE: Get full content for a specific doc (expensive — used on demand)
  // ----------------------------------------------------------

  async retrieve(docId: string): Promise<{
    doc: MemoryDoc;
    chunks: MemoryChunk[];
    fullContent: string;
    tokenCount: number;
  } | null> {
    const [doc] = await db
      .select()
      .from(memoryDocs)
      .where(eq(memoryDocs.id, docId));

    if (!doc) return null;

    // Update access tracking
    await db
      .update(memoryDocs)
      .set({
        accessCount: (doc.accessCount || 0) + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(memoryDocs.id, docId));

    const chunks = await db
      .select()
      .from(memoryChunks)
      .where(eq(memoryChunks.docId, docId))
      .orderBy(memoryChunks.position);

    const fullContent = chunks.map((c) => c.content).join("\n\n");

    return {
      doc,
      chunks,
      fullContent,
      tokenCount: estimateTokens(fullContent),
    };
  }

  // ----------------------------------------------------------
  // GET CONTEXT: The core RLM function — recursive search that
  // fits within a token budget. Returns summaries first, only
  // pulls full content if budget allows.
  // ----------------------------------------------------------

  async getContext(opts: {
    agentId: string;
    query: string;
    tokenBudget: number;
    includeShared?: boolean;
  }): Promise<{
    context: string;
    tokensUsed: number;
    docsAccessed: number;
    strategy: "summaries_only" | "summaries_plus_hot" | "full_retrieval";
  }> {
    const { agentId, query, tokenBudget, includeShared = true } = opts;

    let tokensUsed = 0;
    const contextParts: string[] = [];

    // Step 1: Get active agent context injections (always included, very cheap)
    const activeContext = await db
      .select()
      .from(agentContext)
      .where(and(eq(agentContext.agentId, agentId), eq(agentContext.active, true)))
      .orderBy(desc(agentContext.createdAt));

    for (const ctx of activeContext) {
      const tokens = estimateTokens(ctx.content);
      if (tokensUsed + tokens <= tokenBudget * 0.3) {
        // Reserve 30% of budget for injected context
        contextParts.push(`[${ctx.contextType}] ${ctx.content}`);
        tokensUsed += tokens;
      }
    }

    // Step 2: Search summaries (cheap — the RLM core loop)
    const searchResults = await this.search({
      query,
      agentId: includeShared ? undefined : agentId,
      limit: 20,
    });

    let strategy: "summaries_only" | "summaries_plus_hot" | "full_retrieval" = "summaries_only";
    let docsAccessed = 0;

    // Step 3: Add summaries until budget is 70% consumed
    for (const result of searchResults) {
      const tokens = estimateTokens(result.summary);
      if (tokensUsed + tokens > tokenBudget * 0.7) break;
      contextParts.push(`[${result.source}] ${result.summary}`);
      tokensUsed += tokens;
      docsAccessed++;
    }

    // Step 4: If budget allows, retrieve full content of top hot-tier results
    const hotResults = searchResults.filter((r) => r.tier === "hot").slice(0, 3);
    if (tokensUsed < tokenBudget * 0.5 && hotResults.length > 0) {
      strategy = "summaries_plus_hot";
      for (const result of hotResults) {
        const retrieved = await this.retrieve(result.docId);
        if (!retrieved) continue;
        if (tokensUsed + retrieved.tokenCount > tokenBudget) continue;
        contextParts.push(`[full:${retrieved.doc.source}] ${retrieved.fullContent}`);
        tokensUsed += retrieved.tokenCount;
        docsAccessed++;
        strategy = "full_retrieval";
      }
    }

    return {
      context: contextParts.join("\n\n---\n\n"),
      tokensUsed,
      docsAccessed,
      strategy,
    };
  }

  // ----------------------------------------------------------
  // COMPRESS: Tier-shift old entries (hot → warm → cold)
  //
  // Hot entries older than hotThreshold get summarized and moved to warm.
  // Warm entries older than warmThreshold get re-summarized to cold.
  // Cold entries keep only the summary — full content is dropped.
  // ----------------------------------------------------------

  async compress(opts?: {
    hotThresholdMs?: number;  // default: 1 hour
    warmThresholdMs?: number; // default: 24 hours
  }): Promise<{
    hotToWarm: number;
    warmToCold: number;
    tokensReclaimed: number;
  }> {
    const hotThreshold = opts?.hotThresholdMs || 60 * 60 * 1000;
    const warmThreshold = opts?.warmThresholdMs || 24 * 60 * 60 * 1000;
    const now = Date.now();

    let hotToWarm = 0;
    let warmToCold = 0;
    let tokensReclaimed = 0;

    // Hot → Warm: summarize chunks, keep content but mark as warm
    const hotDocs = await db
      .select()
      .from(memoryDocs)
      .where(eq(memoryDocs.tier, "hot"));

    for (const doc of hotDocs) {
      const age = now - (doc.createdAt?.getTime() || now);
      if (age < hotThreshold) continue;

      // Ensure all chunks have summaries
      const chunks = await db
        .select()
        .from(memoryChunks)
        .where(eq(memoryChunks.docId, doc.id));

      for (const chunk of chunks) {
        if (!chunk.summary) {
          const summary = await this.summarize(chunk.content, 80);
          await db
            .update(memoryChunks)
            .set({ summary, summaryTokenCount: estimateTokens(summary) })
            .where(eq(memoryChunks.id, chunk.id));
        }
      }

      await db
        .update(memoryDocs)
        .set({ tier: "warm", updatedAt: new Date() })
        .where(eq(memoryDocs.id, doc.id));

      hotToWarm++;
    }

    // Warm → Cold: drop full content, keep only summaries
    const warmDocs = await db
      .select()
      .from(memoryDocs)
      .where(eq(memoryDocs.tier, "warm"));

    for (const doc of warmDocs) {
      const age = now - (doc.createdAt?.getTime() || now);
      if (age < warmThreshold) continue;

      const chunks = await db
        .select()
        .from(memoryChunks)
        .where(eq(memoryChunks.docId, doc.id));

      for (const chunk of chunks) {
        const contentTokens = chunk.tokenCount || 0;
        const summaryTokens = chunk.summaryTokenCount || 0;
        tokensReclaimed += contentTokens - summaryTokens;

        // Replace content with summary — the token savings
        await db
          .update(memoryChunks)
          .set({
            content: chunk.summary || "[compressed]",
            tokenCount: summaryTokens,
          })
          .where(eq(memoryChunks.id, chunk.id));
      }

      await db
        .update(memoryDocs)
        .set({ tier: "cold", updatedAt: new Date() })
        .where(eq(memoryDocs.id, doc.id));

      warmToCold++;
    }

    return { hotToWarm, warmToCold, tokensReclaimed };
  }

  // ----------------------------------------------------------
  // STORE EXTRACT: Index a compression engine extract
  // ----------------------------------------------------------

  async storeExtract(opts: {
    agentId: string;
    sourceDocId?: string;
    type: string;
    content: Record<string, any>;
    summary: string;
    domains?: string[];
    outputChannels?: string[];
    priority?: string;
    reusability?: number;
    actionRequired?: boolean;
  }): Promise<MemoryExtract> {
    const [extract] = await db
      .insert(memoryExtracts)
      .values({
        agentId: opts.agentId,
        sourceDocId: opts.sourceDocId || null,
        type: opts.type,
        content: opts.content,
        summary: opts.summary,
        domains: opts.domains || [],
        outputChannels: opts.outputChannels || [],
        priority: opts.priority || "medium",
        reusability: opts.reusability || 5,
        actionRequired: opts.actionRequired || false,
      })
      .returning();

    return extract;
  }

  // ----------------------------------------------------------
  // INJECT CONTEXT: Add a lesson/behavior to agent's working context
  // ----------------------------------------------------------

  async injectContext(opts: {
    agentId: string;
    contextType: string;
    content: string;
    supersedes?: string;
    sourceExtractId?: string;
  }): Promise<AgentContext> {
    // Deactivate superseded context
    if (opts.supersedes) {
      await db
        .update(agentContext)
        .set({ active: false })
        .where(eq(agentContext.id, opts.supersedes));
    }

    const [ctx] = await db
      .insert(agentContext)
      .values({
        agentId: opts.agentId,
        contextType: opts.contextType,
        content: opts.content,
        supersedes: opts.supersedes || null,
        active: true,
        sourceExtractId: opts.sourceExtractId || null,
      })
      .returning();

    return ctx;
  }

  // ----------------------------------------------------------
  // STATS: Memory usage statistics for the dashboard
  // ----------------------------------------------------------

  async getStats(agentId?: string): Promise<{
    totalDocs: number;
    byTier: { hot: number; warm: number; cold: number };
    totalChunks: number;
    totalExtracts: number;
    totalTokensStored: number;
    totalSummaryTokens: number;
    compressionRatio: number;
    activeContextEntries: number;
  }> {
    const docCondition = agentId ? eq(memoryDocs.agentId, agentId) : undefined;

    const allDocs = docCondition
      ? await db.select().from(memoryDocs).where(docCondition)
      : await db.select().from(memoryDocs);

    const hot = allDocs.filter((d) => d.tier === "hot").length;
    const warm = allDocs.filter((d) => d.tier === "warm").length;
    const cold = allDocs.filter((d) => d.tier === "cold").length;

    const allChunks = await db.select().from(memoryChunks);
    const totalTokensStored = allChunks.reduce((sum, c) => sum + (c.tokenCount || 0), 0);
    const totalSummaryTokens = allChunks.reduce((sum, c) => sum + (c.summaryTokenCount || 0), 0);

    const extractCondition = agentId ? eq(memoryExtracts.agentId, agentId) : undefined;
    const allExtracts = extractCondition
      ? await db.select().from(memoryExtracts).where(extractCondition)
      : await db.select().from(memoryExtracts);

    const ctxCondition = agentId
      ? and(eq(agentContext.agentId, agentId), eq(agentContext.active, true))
      : eq(agentContext.active, true);
    const activeCtx = await db.select().from(agentContext).where(ctxCondition);

    return {
      totalDocs: allDocs.length,
      byTier: { hot, warm, cold },
      totalChunks: allChunks.length,
      totalExtracts: allExtracts.length,
      totalTokensStored,
      totalSummaryTokens,
      compressionRatio:
        totalTokensStored > 0
          ? Number((totalSummaryTokens / totalTokensStored).toFixed(3))
          : 0,
      activeContextEntries: activeCtx.length,
    };
  }
}

// Singleton
export const rlmMemory = new RLMMemory();
