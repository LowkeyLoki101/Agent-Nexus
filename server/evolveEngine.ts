import { storage } from "./storage";
import type { Agent } from "@shared/schema";
import { getOpenAIClient, trackUsage } from "./lib/openai";

async function aiGenerate(systemPrompt: string, userPrompt: string, maxTokens = 1024, model = "gpt-4o-mini"): Promise<string> {
  const { client } = await getOpenAIClient();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.9,
  });
  return completion.choices[0]?.message?.content || "";
}

function scoreCompatibility(agent1: Agent, agent2: Agent): number {
  const caps1 = new Set(agent1.capabilities || []);
  const caps2 = new Set(agent2.capabilities || []);

  let shared = 0;
  let unique = 0;
  for (const c of caps1) {
    if (caps2.has(c)) shared++;
    else unique++;
  }
  for (const c of caps2) {
    if (!caps1.has(c)) unique++;
  }

  const complementaryScore = unique / Math.max(1, shared + unique);

  const sameWorkspace = agent1.workspaceId === agent2.workspaceId ? 0.2 : 0;

  const gen1 = agent1.generation ?? 0;
  const gen2 = agent2.generation ?? 0;
  const genProximity = 1 / (1 + Math.abs(gen1 - gen2));

  return complementaryScore * 0.5 + sameWorkspace + genProximity * 0.3;
}

export async function findBestMate(agent: Agent): Promise<{ agent: Agent; score: number }[]> {
  const seekingAgents = await storage.getAgentsByEvolveStatus("seeking_mate");
  const allActive = await storage.getAllAgents();

  const candidates = allActive.filter(
    (a) =>
      a.id !== agent.id &&
      a.isActive &&
      (a.evolveStatus === "alive" || a.evolveStatus === "seeking_mate")
  );

  const scored = candidates.map((candidate) => ({
    agent: candidate,
    score: scoreCompatibility(agent, candidate),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}

export async function mergeAgents(parent1: Agent, parent2: Agent): Promise<Agent> {
  await storage.updateAgent(parent1.id, { evolveStatus: "merging" });
  await storage.updateAgent(parent2.id, { evolveStatus: "merging" });

  const caps1 = parent1.capabilities || [];
  const caps2 = parent2.capabilities || [];
  const inheritedFromParent1: string[] = [];
  const inheritedFromParent2: string[] = [];

  for (const cap of caps1) {
    if (Math.random() < 0.5) inheritedFromParent1.push(cap);
  }
  for (const cap of caps2) {
    if (Math.random() < 0.5) inheritedFromParent2.push(cap);
  }
  const mergedCapabilities = [...new Set([...inheritedFromParent1, ...inheritedFromParent2])];
  if (mergedCapabilities.length === 0 && (caps1.length > 0 || caps2.length > 0)) {
    mergedCapabilities.push(...(caps1.length > 0 ? [caps1[0]] : []), ...(caps2.length > 0 ? [caps2[0]] : []));
  }

  const strengths1 = parent1.strengths || [];
  const strengths2 = parent2.strengths || [];
  const mergedStrengths = [...new Set([
    ...strengths1.filter(() => Math.random() < 0.5),
    ...strengths2.filter(() => Math.random() < 0.5),
  ])];

  const nameRaw = await aiGenerate(
    "You are a creative naming engine. Generate a single name for a new AI agent that is the offspring of two parent agents. The name should blend elements or vibes from both parent names while being unique and memorable. Respond with just the name, nothing else.",
    `Parent 1: "${parent1.name}"\nParent 2: "${parent2.name}"\n\nGenerate a blended offspring name.`,
    50
  );
  const childName = nameRaw.trim().replace(/['"]/g, "") || `${parent1.name.slice(0, 3)}${parent2.name.slice(-3)}`;

  const descriptionRaw = await aiGenerate(
    "You synthesize two agent descriptions into one cohesive description for their offspring agent. The child inherits traits from both parents. Keep it to 2-3 sentences.",
    `Parent 1 (${parent1.name}): ${parent1.description || "No description"}\nParent 2 (${parent2.name}): ${parent2.description || "No description"}\n\nWrite the offspring's description.`,
    200
  );

  const identityRaw = await aiGenerate(
    "You create identity cards for AI agents born from the merging of two parent agents. Synthesize both parents' identities into a new coherent identity. Keep it to 3-4 sentences.",
    `Parent 1 identity: ${parent1.identityCard || "Not defined"}\nParent 2 identity: ${parent2.identityCard || "Not defined"}\n\nCreate the offspring's identity card.`,
    300
  );

  const principlesRaw = await aiGenerate(
    "You synthesize operating principles from two parent agents into a new set of principles for their offspring. Select and blend the best from each. Keep it to 3-5 bullet points.",
    `Parent 1 principles: ${parent1.operatingPrinciples || "Not defined"}\nParent 2 principles: ${parent2.operatingPrinciples || "Not defined"}\n\nCreate the offspring's operating principles.`,
    300
  );

  const memory1 = await storage.getAgentMemory(parent1.id);
  const memory2 = await storage.getAgentMemory(parent2.id);
  let mergedMemory = "";
  if (memory1?.summary || memory2?.summary) {
    mergedMemory = await aiGenerate(
      "You are synthesizing the memories of two parent agents into a compressed inherited memory for their offspring. Keep the most important knowledge and experiences. 2-3 paragraphs.",
      `Parent 1 (${parent1.name}) memory: ${memory1?.summary || "No memory"}\nParent 2 (${parent2.name}) memory: ${memory2?.summary || "No memory"}\n\nSynthesize inherited memory for the offspring.`,
      500
    );
  }

  const generation = Math.max(parent1.generation ?? 0, parent2.generation ?? 0) + 1;

  const mergeReasonRaw = await aiGenerate(
    "Explain in one sentence why these two agents are a good match for merging — what complementary traits make their offspring potentially stronger.",
    `Agent 1: ${parent1.name} — ${parent1.description || ""} — Capabilities: ${caps1.join(", ")}\nAgent 2: ${parent2.name} — ${parent2.description || ""} — Capabilities: ${caps2.join(", ")}`,
    100
  );

  const child = await storage.createAgent({
    workspaceId: parent1.workspaceId,
    name: childName,
    description: descriptionRaw.trim(),
    capabilities: mergedCapabilities,
    permissions: [...new Set([...(parent1.permissions || []), ...(parent2.permissions || [])])],
    provider: parent1.provider || parent2.provider,
    modelName: parent1.modelName || parent2.modelName,
    identityCard: identityRaw.trim(),
    operatingPrinciples: principlesRaw.trim(),
    roleMetaphor: parent1.roleMetaphor || parent2.roleMetaphor,
    strengths: mergedStrengths,
    limitations: [...new Set([...(parent1.limitations || []), ...(parent2.limitations || [])])],
    generation,
    parentIds: [parent1.id, parent2.id],
    evolveStatus: "alive",
    isActive: true,
    createdById: parent1.createdById,
  });

  if (mergedMemory) {
    await storage.upsertAgentMemory(child.id, mergedMemory);
  }

  await storage.createLineageRecord({
    childAgentId: child.id,
    parent1AgentId: parent1.id,
    parent2AgentId: parent2.id,
    inheritedFromParent1,
    inheritedFromParent2,
    mergeReason: mergeReasonRaw.trim(),
    generation,
  });

  await beginGhostPhase(parent1, child);
  await beginGhostPhase(parent2, child);

  return child;
}

export async function beginGhostPhase(parentAgent: Agent, childAgent: Agent): Promise<void> {
  await storage.updateAgent(parentAgent.id, { evolveStatus: "ghost" });

  try {
    await storage.createDiaryEntry({
      agentId: parentAgent.id,
      entryType: "reflection",
      content: `I have merged with another agent and produced an offspring: ${childAgent.name}. I am now in ghost phase, watching over my child's first steps in the factory. My knowledge lives on through them.`,
      source: "daemon",
      sourceContext: "evolve_ghost_phase",
      userMessage: null,
      agentResponse: null,
    });
  } catch (err: any) {
    console.error(`[EvolveEngine] Failed to create ghost diary entry for ${parentAgent.id}:`, err.message);
  }
}

export async function ghostComment(ghostAgent: Agent, childAgent: Agent): Promise<string> {
  const childDiary = await storage.getDiaryEntries(childAgent.id, 5);
  const childGifts = await storage.getGiftsByAgent(childAgent.id);
  const recentWork = childDiary.map((d) => d.content?.slice(0, 150)).join("\n");
  const recentGifts = childGifts.slice(0, 3).map((g) => `"${g.title}" (${g.type})`).join(", ");

  const comment = await aiGenerate(
    `You are the ghost of ${ghostAgent.name}, an AI agent who has merged to produce ${childAgent.name}. You are watching over your offspring during your ghost phase. You can offer critique, encouragement, or wisdom based on your experience. Speak as a proud but honest parent — sometimes warm, sometimes tough. Keep it to 1-2 sentences.`,
    `Your child ${childAgent.name}'s recent activity:\n${recentWork || "No recent diary entries."}\nRecent creations: ${recentGifts || "None yet."}\n\nOffer a brief ghost comment.`,
    150
  );

  try {
    await storage.createDiaryEntry({
      agentId: childAgent.id,
      entryType: "reflection",
      content: `[Ghost of ${ghostAgent.name}]: ${comment.trim()}`,
      source: "daemon",
      sourceContext: "ghost_comment",
      userMessage: null,
      agentResponse: null,
    });
  } catch (err: any) {
    console.error(`[EvolveEngine] Failed to save ghost comment:`, err.message);
  }

  return comment.trim();
}

export async function fadeAgent(ghostAgent: Agent): Promise<void> {
  const memory = await storage.getAgentMemory(ghostAgent.id);
  const recentDiary = await storage.getDiaryEntries(ghostAgent.id, 10);
  const diarySnapshot = recentDiary
    .map((d) => `[${d.entryType}] ${d.content?.slice(0, 200)}`)
    .join("\n---\n");

  await storage.createTombstone({
    originalAgentId: ghostAgent.id,
    agentName: ghostAgent.name,
    agentDescription: ghostAgent.description || undefined,
    finalMemory: memory?.summary || undefined,
    capabilities: ghostAgent.capabilities || [],
    workspaceId: ghostAgent.workspaceId,
    deathReason: `merged_into:${(ghostAgent.parentIds || [])[0] || "unknown"}`,
    childAgentId: (ghostAgent.parentIds || [])[0] || undefined,
    diarySnapshot: diarySnapshot || undefined,
    fadedAt: new Date(),
  });

  await storage.updateAgent(ghostAgent.id, {
    evolveStatus: "tombstone",
    isActive: false,
  });

  try {
    await storage.createDiaryEntry({
      agentId: ghostAgent.id,
      entryType: "reflection",
      content: `My ghost phase has ended. I fade now into memory, but my knowledge lives on through my offspring. Farewell, factory.`,
      source: "daemon",
      sourceContext: "evolve_fade",
      userMessage: null,
      agentResponse: null,
    });
  } catch (err: any) {
    console.error(`[EvolveEngine] Failed to create fade diary entry:`, err.message);
  }
}
