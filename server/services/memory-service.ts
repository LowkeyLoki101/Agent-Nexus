import { storage } from "../storage";
import type { MemoryEntry, InsertMemoryEntry } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MemoryQueryResult {
  entries: MemoryEntry[];
  summary?: string;
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
  const results = await storage.searchMemory(workspaceId, query, options.tier);
  
  for (const entry of results) {
    await storage.incrementMemoryAccess(entry.id);
  }

  if (options.summarize && results.length > 0) {
    const summary = await summarizeMemories(results, query);
    return { entries: results, summary };
  }

  return { entries: results };
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
    model: "gpt-4o",
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
