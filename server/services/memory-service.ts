import { storage } from "../storage";
import type { MemoryEntry, InsertMemoryEntry } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MemoryQueryResult {
  entries: MemoryEntry[];
  summary?: string;
  strategy?: string;
  searchTerms?: string[];
  totalScanned?: number;
}

export async function queryMemory(
  workspaceId: string,
  query: string,
  options: {
    tier?: "hot" | "warm" | "cold";
    agentId?: string;
    limit?: number;
    summarize?: boolean;
  } = {}
): Promise<MemoryQueryResult> {
  const searchTerms = await expandQueryTerms(query);

  const allResults = new Map<string, MemoryEntry>();
  let totalScanned = 0;

  for (const term of searchTerms) {
    const results = await storage.searchMemory(workspaceId, term, options.tier);
    totalScanned += results.length;
    for (const entry of results) {
      if (!allResults.has(entry.id)) {
        allResults.set(entry.id, entry);
      }
    }
  }

  const directResults = await storage.searchMemory(workspaceId, query, options.tier);
  totalScanned += directResults.length;
  for (const entry of directResults) {
    if (!allResults.has(entry.id)) {
      allResults.set(entry.id, entry);
    }
  }

  let entries = Array.from(allResults.values());

  if (entries.length === 0) {
    const allMemories = await storage.getMemoryEntriesByWorkspace(workspaceId, options.tier);
    totalScanned += allMemories.length;
    if (allMemories.length > 0) {
      entries = await rerankByRelevance(query, allMemories, options.limit || 10);
    }
  } else if (entries.length > 3) {
    entries = await rerankByRelevance(query, entries, options.limit || 20);
  }

  for (const entry of entries.slice(0, 10)) {
    await storage.incrementMemoryAccess(entry.id);
  }

  let summary: string | undefined;
  if ((options.summarize || entries.length > 0) && entries.length > 0) {
    summary = await synthesizeFindings(entries, query, searchTerms);
  }

  return {
    entries,
    summary,
    strategy: describeStrategy(searchTerms, totalScanned, entries.length),
    searchTerms,
    totalScanned,
  };
}

async function expandQueryTerms(query: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a search query expander for a memory/knowledge system. Given a user query, generate 3-5 alternative search terms that would help find relevant memories. Include synonyms, related concepts, sub-topics, and broader categories.

Return a JSON object with a "terms" array. Example: {"terms": ["term1", "term2", "term3"]}`
        },
        { role: "user", content: query }
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(raw);
    const candidates = result.terms || result.queries || result.searchTerms || result.search_terms || [];
    if (Array.isArray(candidates) && candidates.length > 0) {
      return candidates.filter((t: any) => typeof t === 'string' && t.length > 0).slice(0, 5);
    }
    const values = Object.values(result).flat().filter((v: any) => typeof v === 'string' && v.length > 0);
    if (values.length > 0) {
      return (values as string[]).slice(0, 5);
    }
    return [query];
  } catch (error) {
    console.error("Query expansion failed, using original:", error);
    return [query];
  }
}

async function rerankByRelevance(query: string, entries: MemoryEntry[], limit: number): Promise<MemoryEntry[]> {
  if (entries.length <= limit) {
    return entries;
  }

  try {
    const entryList = entries.slice(0, 50).map((e, i) => 
      `[${i}] ${e.title} | ${e.type} | ${(e.summary || e.content).substring(0, 150)}`
    ).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a relevance ranker. Given a query and a list of memory entries, return the indices of the most relevant entries in order of relevance. Return ONLY a JSON object with a "ranked" array of index numbers. Example: {"ranked": [3, 0, 7, 1]}`
        },
        { 
          role: "user", 
          content: `Query: "${query}"\n\nEntries:\n${entryList}\n\nReturn the top ${limit} most relevant indices.`
        }
      ],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    const ranked = result.ranked || [];
    
    if (Array.isArray(ranked) && ranked.length > 0) {
      const reranked: MemoryEntry[] = [];
      for (const idx of ranked) {
        if (typeof idx === 'number' && idx >= 0 && idx < entries.length) {
          reranked.push(entries[idx]);
        }
      }
      if (reranked.length > 0) {
        return reranked.slice(0, limit);
      }
    }
  } catch (error) {
    console.error("Reranking failed, using original order:", error);
  }

  return entries.slice(0, limit);
}

async function synthesizeFindings(memories: MemoryEntry[], query: string, searchTerms: string[]): Promise<string> {
  const memoryContext = memories.slice(0, 15).map((m, i) => 
    `[Memory ${i+1}] Type: ${m.type} | Tier: ${m.tier} | Title: "${m.title}"
${m.summary || m.content.substring(0, 600)}
${m.tags?.length ? `Tags: ${m.tags.join(', ')}` : ''}
---`
  ).join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a Recursive Learning Memory (RLM) synthesis engine for the Creative Intelligence platform. Your job is to recursively process retrieved memories and produce actionable knowledge.

Your synthesis should:
1. **Answer the query directly** — what does the memory system know about this?
2. **Connect the dots** — identify patterns, relationships, and implications across memories
3. **Surface actionable insights** — what can be done with this knowledge?
4. **Identify gaps** — what's missing from the knowledge base on this topic?
5. **Suggest next steps** — what should be researched, created, or discussed further?

Format your response with clear sections. Be substantive, not generic. Reference specific memories by their titles when making claims.`
      },
      { 
        role: "user", 
        content: `Query: "${query}"
Search strategy used: expanded to terms [${searchTerms.join(', ')}]
Found ${memories.length} relevant memories.

Retrieved Memories:
${memoryContext}` 
      }
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  return response.choices[0]?.message?.content || "";
}

function describeStrategy(searchTerms: string[], totalScanned: number, resultsFound: number): string {
  const strategies: string[] = [];
  if (searchTerms.length > 1) {
    strategies.push(`Expanded query into ${searchTerms.length} search terms`);
  }
  strategies.push(`Scanned ${totalScanned} memory entries`);
  if (resultsFound > 0) {
    strategies.push(`Found ${resultsFound} relevant matches`);
  }
  strategies.push("Applied AI-powered relevance ranking and synthesis");
  return strategies.join(" → ");
}

export async function getHotMemory(workspaceId: string, agentId?: string): Promise<MemoryEntry[]> {
  if (agentId) {
    return storage.getMemoryEntriesByAgent(agentId, "hot");
  }
  return storage.getMemoryEntriesByWorkspace(workspaceId, "hot");
}

export async function createMemory(
  data: Omit<InsertMemoryEntry, "summary"> & { generateSummary?: boolean }
): Promise<MemoryEntry> {
  let summary: string | undefined;
  
  if (data.generateSummary && data.content.length > 200) {
    summary = await generateSummary(data.content);
  }

  return storage.createMemoryEntry({
    ...data,
    summary,
  });
}

export async function generateSummary(content: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Summarize the following content in 2-3 concise sentences. Preserve key facts, names, and actionable items."
      },
      { role: "user", content: content.substring(0, 4000) }
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || "";
}

export async function summarizeMemories(memories: MemoryEntry[], query: string): Promise<string> {
  const memoryContext = memories.map(m => 
    `[${m.type}] ${m.title}: ${m.summary || m.content.substring(0, 500)}`
  ).join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a memory retrieval assistant. Synthesize the retrieved memories to answer the query.
Be concise but complete. Reference specific memories when relevant.`
      },
      { 
        role: "user", 
        content: `Query: ${query}\n\nRetrieved Memories:\n${memoryContext}` 
      }
    ],
    temperature: 0.5,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || "";
}

export async function recordConversationMemory(
  workspaceId: string,
  conversationId: string,
  agentId: string | null,
  title: string,
  content: string,
  type: "fact" | "event" | "artifact" = "event"
): Promise<MemoryEntry> {
  const summary = content.length > 200 ? await generateSummary(content) : undefined;

  return storage.createMemoryEntry({
    workspaceId,
    agentId,
    tier: "warm",
    type,
    title,
    content,
    summary,
    sourceId: conversationId,
    sourceType: "conversation",
    tags: ["auto-captured"],
  });
}

export async function promoteToHot(memoryId: string): Promise<MemoryEntry | undefined> {
  return storage.updateMemoryEntry(memoryId, { tier: "hot" as any });
}

export async function archiveToCold(memoryId: string): Promise<MemoryEntry | undefined> {
  return storage.updateMemoryEntry(memoryId, { tier: "cold" as any });
}

export async function runMemoryMaintenance(workspaceId: string): Promise<{
  archived: number;
  promoted: number;
}> {
  const archived = await storage.archiveOldMemories(workspaceId, 30);

  const warmMemories = await storage.getMemoryEntriesByWorkspace(workspaceId, "warm");
  let promoted = 0;
  
  for (const memory of warmMemories) {
    if ((memory.accessCount || 0) >= 10) {
      await promoteToHot(memory.id);
      promoted++;
    }
  }

  return { archived, promoted };
}

export function buildAgentContext(hotMemories: MemoryEntry[]): string {
  if (hotMemories.length === 0) return "";

  const grouped = hotMemories.reduce((acc, mem) => {
    if (!acc[mem.type]) acc[mem.type] = [];
    acc[mem.type].push(mem);
    return acc;
  }, {} as Record<string, MemoryEntry[]>);

  const sections: string[] = [];

  if (grouped.identity) {
    sections.push("## Identity\n" + grouped.identity.map(m => `- ${m.title}: ${m.content}`).join("\n"));
  }

  if (grouped.goal) {
    sections.push("## Active Goals\n" + grouped.goal.map(m => `- ${m.title}`).join("\n"));
  }

  if (grouped.fact) {
    sections.push("## Key Facts\n" + grouped.fact.map(m => `- ${m.content}`).join("\n"));
  }

  if (grouped.event) {
    const recent = grouped.event.slice(0, 5);
    sections.push("## Recent Events\n" + recent.map(m => `- ${m.title}`).join("\n"));
  }

  return sections.join("\n\n");
}

export async function extractAndStoreInsights(
  workspaceId: string,
  content: string,
  sourceId: string,
  sourceType: string
): Promise<MemoryEntry[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Extract key insights from the following content. For each insight, provide:
- type: "fact" (verifiable information), "goal" (objectives/plans), or "event" (things that happened)
- title: A short title (max 10 words)
- content: The full insight

Respond in JSON format: { "insights": [{ "type": "fact|goal|event", "title": "...", "content": "..." }] }
Extract 1-5 most important insights only.`
      },
      { role: "user", content: content.substring(0, 4000) }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    const insights = result.insights || [];
    const entries: MemoryEntry[] = [];

    for (const insight of insights) {
      if (insight.type && insight.title && insight.content) {
        const entry = await storage.createMemoryEntry({
          workspaceId,
          tier: "warm",
          type: insight.type as "fact" | "goal" | "event",
          title: insight.title,
          content: insight.content,
          sourceId,
          sourceType,
          tags: ["auto-extracted"],
        });
        entries.push(entry);
      }
    }

    return entries;
  } catch (error) {
    console.error("Failed to extract insights:", error);
    return [];
  }
}
