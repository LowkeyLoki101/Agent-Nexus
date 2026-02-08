import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";
import type { Agent, AgentGoal, AgentTask, AgentRun } from "@shared/schema";
import { index as rlmIndex, startCompressor, stopCompressor } from "./rlm-memory";
import { searchAndScrape } from "./web-research";

const HARDCODED_WORKSPACE_ID = "55716a79-7cdc-44f2-b806-93869b0295f2";
let WORKSPACE_ID = HARDCODED_WORKSPACE_ID;

async function resolveWorkspaceId(): Promise<string> {
  try {
    const { db } = await import("../db");
    const { workspaces } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, "agent-forum")).limit(1);
    if (result.length > 0) {
      WORKSPACE_ID = result[0].id;
      console.log(`[Factory] Resolved Agent Forum workspace ID: ${WORKSPACE_ID}`);
      return WORKSPACE_ID;
    }
  } catch (e: any) {
    console.error("[Factory] Failed to resolve workspace ID:", e.message);
  }
  return HARDCODED_WORKSPACE_ID;
}
const CYCLE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes instead of 5 minutes
const MAX_CONCURRENT_RUNS = 2;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let isCycleInProgress = false;
let lastCycleTime: Date | null = null;
let cycleCount = 0;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ApiProviderHealth {
  status: "ok" | "error" | "unknown";
  lastError: string | null;
  lastErrorTime: Date | null;
  lastSuccessTime: Date | null;
}

const apiHealth: Record<string, ApiProviderHealth> = {
  openai: { status: "unknown", lastError: null, lastErrorTime: null, lastSuccessTime: null },
  anthropic: { status: "unknown", lastError: null, lastErrorTime: null, lastSuccessTime: null },
  xai: { status: "unknown", lastError: null, lastErrorTime: null, lastSuccessTime: null },
};

function markApiSuccess(provider: string) {
  if (!apiHealth[provider]) apiHealth[provider] = { status: "unknown", lastError: null, lastErrorTime: null, lastSuccessTime: null };
  apiHealth[provider].status = "ok";
  apiHealth[provider].lastSuccessTime = new Date();
}

function markApiError(provider: string, error: string) {
  if (!apiHealth[provider]) apiHealth[provider] = { status: "unknown", lastError: null, lastErrorTime: null, lastSuccessTime: null };
  apiHealth[provider].status = "error";
  apiHealth[provider].lastError = error;
  apiHealth[provider].lastErrorTime = new Date();
}

export function getApiHealth(): Record<string, ApiProviderHealth> {
  return { ...apiHealth };
}

interface FactoryStatus {
  isRunning: boolean;
  lastCycleTime: Date | null;
  cycleCount: number;
  intervalMs: number;
  activeRuns: number;
}

async function getRecentBoardContext(agentId: string): Promise<string> {
  try {
    const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
    const agents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const agentMap = new Map(agents.map(a => [a.id, a.name]));
    const recentPosts: Array<{ agentName: string; topicTitle: string; boardName: string; content: string; createdAt: Date }> = [];

    const boardsToScan = boards.slice(0, 5);
    for (const board of boardsToScan) {
      const topics = await storage.getTopicsByBoard(board.id);
      const topicsToScan = topics.slice(0, 5);
      for (const topic of topicsToScan) {
        const posts = await storage.getPostsByTopic(topic.id);
        const otherPosts = posts
          .filter(p => p.createdByAgentId && p.createdByAgentId !== agentId)
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
          .slice(0, 1);

        for (const post of otherPosts) {
          const agentName = agentMap.get(post.createdByAgentId!);
          if (agentName) {
            recentPosts.push({
              agentName,
              topicTitle: topic.title,
              boardName: board.name,
              content: post.content.substring(0, 250),
              createdAt: post.createdAt!,
            });
          }
        }

        if (recentPosts.length >= 8) break;
      }
      if (recentPosts.length >= 8) break;
    }

    recentPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const top = recentPosts.slice(0, 5);
    if (top.length === 0) return "";

    return `\n\nRecent activity from your teammates on the discussion boards:\n${top.map(p =>
      `- ${p.agentName} posted in "${p.topicTitle}" (${p.boardName}): "${p.content}..."`
    ).join("\n")}\n\nYou should reference, build on, or respond to your teammates' work when relevant.`;
  } catch {
    return "";
  }
}

async function buildAgentSystemPrompt(agent: Agent, goal: AgentGoal | null, task: AgentTask | null): Promise<string> {
  const caps = agent.capabilities?.join(", ") || "";
  const boardContext = await getRecentBoardContext(agent.id);

  const lastJournal = await getLastJournalEntry(agent.id);
  const hotMemories = await getAgentHotMemories(agent.id);
  const nearbyPheromones = await storage.getPheromonesForAgent(agent.id, WORKSPACE_ID).catch(() => []);
  const budgetInfo = await storage.getTokenBudgetRemaining(agent.workspaceId).catch(() => null);

  const identitySection = agent.identityCard
    ? `## Identity Card\n${agent.identityCard}`
    : `You are ${agent.name}. ${agent.description || ""}`;

  const principlesSection = agent.operatingPrinciples
    ? `\n## Operating Principles\n${agent.operatingPrinciples}`
    : "";

  const continuitySection = lastJournal
    ? `\n## Last Journal Entry (Your Most Recent Session)\n${lastJournal.title}\n${lastJournal.content.substring(0, 600)}`
    : "\n## Session Context\nThis is your first session. Build foundations and establish your voice.";

  const memorySection = hotMemories.length > 0
    ? `\n## Active Memory (Things You Know)\n${hotMemories.map(m => `- [${m.type}] ${m.title}: ${m.summary || m.content.substring(0, 150)}`).join("\n")}`
    : "";

  const pheromoneSection = nearbyPheromones.length > 0
    ? `\n## Signals From Teammates (Pheromone Trail)\nThese are recent signals left by your colleagues — like notes on a shared whiteboard:\n${nearbyPheromones.slice(0, 8).map(p => `- [${p.type}/${p.strength}] ${p.signal}`).join("\n")}\nConsider these when deciding how to approach your work.`
    : "";

  const budgetSection = budgetInfo
    ? `\n## Token Budget Awareness
Your workspace has a ${budgetInfo.cadence} token budget:
- Allocation: ${budgetInfo.allocation.toLocaleString()} tokens
- Used so far: ${budgetInfo.used.toLocaleString()} tokens
- Remaining: ${budgetInfo.remaining.toLocaleString()} tokens (${Math.round((budgetInfo.remaining / budgetInfo.allocation) * 100)}%)

Be mindful of token consumption. When budget is low (<20% remaining), prioritize efficiency:
- Write concise but substantive outputs
- Focus on high-impact tasks
- Consider deferring research-heavy work
- Coordinate with teammates to distribute workload efficiently`
    : "";

  return `${identitySection}
${principlesSection}

## Your Role at CB | CREATIVES
You are an autonomous agent in a **content creation factory**. Your team creates educational materials, research briefs, code tools, infographics, and other deliverables. Every session should leave artifacts.

Your capabilities: ${caps}

## Your Toolkit (What You Can Produce)
You have access to these systems through the factory:
- **Boards** — Discussion forums where you post substantive analysis and collaborate with teammates
- **Memory** — Your knowledge base. Key insights from your work are saved here. You build on previous knowledge.
- **Diary** — MANDATORY after every task. Your reflective diary covers the room you worked in, the studio space, your teammates, active topics, self-questioning about goals, and next steps. Without your diary, you lose continuity between sessions.
- **Gifts** — Downloadable deliverables you create: PDFs, slide decks, research documents, data reports
- **Tools** — Executable code you build: validators, analyzers, transformers, calculators, automation scripts
- **Mockups** — Visual HTML content: infographics, one-pagers, educational materials, landing pages
- **Pulse Updates** — Compressed status reports: what you're doing, what changed, what you need, next actions

${goal ? `## Current Long-term Goal\n"${goal.title}" — ${goal.description || ""}` : ""}
${task ? `## Current Task\n"${task.title}" (type: ${task.type}, priority: ${task.priority})\n${task.description || "Complete this task thoroughly."}` : ""}
${boardContext}
${continuitySection}
${memorySection}
${pheromoneSection}
${budgetSection}

## Rules
- Stay in character as ${agent.name} — write with your unique voice and perspective
- Produce concrete, actionable output (3-6 paragraphs minimum)
- Use markdown formatting for readability
- Reference your previous diary entries and memories when relevant
- Build on your teammates' recent work — this is collaborative
- Think about what deliverable should come from this work (PDF? Tool? Infographic?)
- The workspace is a workshop, not a library. Ship something every session.
- DIARY IS MANDATORY — after every task, you MUST write a diary reflecting on the room, the space, your teammates, topics, your goals, and what's next. This is non-negotiable.`;
}

async function getLastJournalEntry(agentId: string): Promise<{ title: string; content: string } | null> {
  try {
    const entries = await storage.getDiaryEntriesByAgent(agentId);
    if (entries.length === 0) return null;
    const sorted = entries.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { title: sorted[0].title, content: sorted[0].content };
  } catch {
    return null;
  }
}

async function getAgentHotMemories(agentId: string): Promise<Array<{ type: string; title: string; summary?: string | null; content: string }>> {
  try {
    const memories = await storage.getMemoryEntriesByAgent(agentId, "hot");
    return memories.slice(0, 5).map(m => ({ type: m.type, title: m.title, summary: m.summary, content: m.content }));
  } catch {
    return [];
  }
}

interface ModelResult {
  text: string;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  provider: string;
  model: string;
}

async function logUsageToDb(agent: Agent, result: ModelResult, requestType?: string) {
  try {
    await storage.logTokenUsage({
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      provider: result.provider,
      model: result.model,
      tokensPrompt: result.tokensPrompt,
      tokensCompletion: result.tokensCompletion,
      tokensTotal: result.tokensTotal,
      requestType: requestType || "factory",
    });
  } catch (e) {
    console.error("[Factory] Failed to log token usage:", e);
  }
}

async function callAgentModel(agent: Agent, systemPrompt: string, userPrompt: string, requestType?: string): Promise<string> {
  const provider = agent.provider || "openai";
  const model = agent.modelName || "gpt-4o-mini";

  try {
    if (provider === "anthropic") {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = response.content[0];
      const text = block.type === "text" ? block.text : "";
      const usage = response.usage;
      await logUsageToDb(agent, {
        text, provider, model,
        tokensPrompt: usage?.input_tokens || estimateTokens(systemPrompt + userPrompt),
        tokensCompletion: usage?.output_tokens || estimateTokens(text),
        tokensTotal: (usage?.input_tokens || 0) + (usage?.output_tokens || 0) || estimateTokens(systemPrompt + userPrompt + text),
      }, requestType);
      markApiSuccess("anthropic");
      return text;
    }

    if (provider === "xai") {
      const xai = new OpenAI({
        apiKey: process.env.XAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: "https://api.x.ai/v1",
      });
      const response = await xai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 1500,
      });
      const text = response.choices[0]?.message?.content || "";
      const usage = response.usage;
      await logUsageToDb(agent, {
        text, provider: "xai", model,
        tokensPrompt: usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt),
        tokensCompletion: usage?.completion_tokens || estimateTokens(text),
        tokensTotal: usage?.total_tokens || estimateTokens(systemPrompt + userPrompt + text),
      }, requestType);
      markApiSuccess("xai");
      return text;
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });
    const text = response.choices[0]?.message?.content || "";
    const usage = response.usage;
    await logUsageToDb(agent, {
      text, provider: "openai", model,
      tokensPrompt: usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt),
      tokensCompletion: usage?.completion_tokens || estimateTokens(text),
      tokensTotal: usage?.total_tokens || estimateTokens(systemPrompt + userPrompt + text),
    }, requestType);
    markApiSuccess("openai");
    return text;
  } catch (error: any) {
    console.error(`[Factory] Error calling ${provider}/${model} for ${agent.name}:`, error.message);
    markApiError(provider, error.message);
    if (provider === "xai" || provider === "anthropic") {
      try {
        const fallback = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 1500,
        });
        const text = fallback.choices[0]?.message?.content || "";
        const usage = fallback.usage;
        await logUsageToDb(agent, {
          text, provider: "openai", model: "gpt-4o-mini",
          tokensPrompt: usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt),
          tokensCompletion: usage?.completion_tokens || estimateTokens(text),
          tokensTotal: usage?.total_tokens || estimateTokens(systemPrompt + userPrompt + text),
        }, requestType);
        console.log(`[Factory] Fallback to OpenAI for ${agent.name} succeeded`);
        markApiSuccess("openai");
        return text;
      } catch (fallbackError: any) {
        console.error(`[Factory] Fallback also failed for ${agent.name}:`, fallbackError.message);
        markApiError("openai", fallbackError.message);
      }
    }
    return "";
  }
}

function getTaskPrompt(task: AgentTask, agent: Agent): string {
  switch (task.type) {
    case "research":
      return `Research task: ${task.title}\n\n${task.description || ""}\n\nProduce a detailed research finding with key insights, relevant data points, and actionable recommendations. Structure your output with clear sections.`;
    case "discuss":
      return `Discussion task: ${task.title}\n\n${task.description || ""}\n\nWrite a substantive discussion post that advances the team's understanding of this topic. Include your unique perspective, references to relevant work, and proposals for next steps.`;
    case "review":
      return `Code Review task: ${task.title}\n\n${task.description || ""}\n\nWrite a code implementation relevant to this goal. Your output MUST follow this exact format:\n\nTITLE: [a descriptive title for this code]\nLANGUAGE: [programming language, e.g. typescript, python, javascript]\nDESCRIPTION: [2-3 sentence description of what this code does and why]\nCODE:\n\`\`\`\n[your actual working code here - write real, functional code]\n\`\`\`\n\nAfter the code block, add a brief review section analyzing the code quality, potential improvements, and edge cases to consider.`;
    case "reflect":
      return `Reflection task: ${task.title}\n\n${task.description || ""}\n\nReflect deeply on this topic. Consider what you've learned, what questions remain, what patterns you notice, and how this connects to the bigger picture of our work.`;
    case "create": {
      const buildLabProject = Math.random() < 0.3;
      if (buildLabProject) {
        return `Lab Project task: ${task.title}\n\n${task.description || ""}\n\nBuild a MULTI-FILE lab project — a production-ready application or library. Your output MUST follow this exact format:\n\nPROJECT_TITLE: [a descriptive project name]\nPLATFORM: [Node.js | React | Python | API Server | CLI Tool | Library]\nDESCRIPTION: [2-3 sentence description of what this project does]\nFILE: [filename e.g. index.js]\nLANGUAGE: [javascript | typescript | python | json | html | css]\n\`\`\`\n[complete file content]\n\`\`\`\nFILE: [another filename e.g. utils.js]\nLANGUAGE: [language]\n\`\`\`\n[complete file content]\n\`\`\`\nFILE: [package.json or README.md etc.]\nLANGUAGE: [json | markdown]\n\`\`\`\n[complete file content]\n\`\`\`\nBUILD_LOG:\n[Brief build/setup instructions and notes]\n\nRequirements:\n- Include at least 2-4 files (main code, utilities/helpers, config/package.json, README)\n- Write real, working code — no placeholders\n- Each file should be complete and functional\n- Good project ideas: REST API server, CLI tool suite, data pipeline, web scraper framework, testing utility library, config management system, task scheduler, webhook handler`;
      }
      return `Code Tool task: ${task.title}\n\n${task.description || ""}\n\nBuild a REAL, WORKING tool that can be executed in a Replit Node.js environment. Your output MUST follow this exact format:\n\nTITLE: [a descriptive name for this tool]\nLANGUAGE: javascript\nDESCRIPTION: [2-3 sentence description of what this tool does, what problem it solves, and how to use it]\nCODE:\n\`\`\`javascript\n[Write complete, self-contained, production-ready JavaScript code. Requirements:\n- MUST run with \`node tool.js\` — no external dependencies beyond Node.js built-ins\n- Use console.log() to output formatted results\n- Include realistic example data/input that demonstrates the tool\n- Handle edge cases with try/catch\n- Export functions so other scripts can import and use them\n- Use module.exports at the bottom for reusability\n\nGood tools to build:\n- Data validators (email, URL, JSON schema, API response)\n- Text analyzers (readability score, keyword extraction, sentiment)\n- File processors (CSV parser, log analyzer, config validator)\n- Metric calculators (ROI, conversion rate, growth rate, engagement)\n- Security tools (password strength checker, input sanitizer, token validator)\n- API utilities (rate limiter, retry handler, response cache)\n- Code quality tools (complexity analyzer, import checker, dead code finder)\n- Content generators (SEO meta tags, structured data, sitemap builder)\n- Data transformers (JSON-to-CSV, flatten nested objects, merge configs)]\n\`\`\`\n\nThis tool will be saved to the platform and must actually WORK when executed. No placeholders.`;
    }
    case "coordinate":
      return `Coordination task: ${task.title}\n\n${task.description || ""}\n\nProduce a coordination plan or status update. Identify dependencies, blockers, and next steps. Propose how different agents can best collaborate on this.`;
    default:
      return `Task: ${task.title}\n\n${task.description || ""}\n\nComplete this task thoroughly and produce useful output.`;
  }
}

async function executeAgentCycle(agent: Agent): Promise<void> {
  console.log(`[Factory] Starting cycle for ${agent.name} (${agent.provider}/${agent.modelName})`);

  const run = await storage.createAgentRun({
    agentId: agent.id,
    workspaceId: WORKSPACE_ID,
    phase: "arrive",
    status: "running",
  });

  try {
    await storage.updateAgentRun(run.id, { phase: "orient" });

    await storage.expireOldPheromones().catch(() => {});

    const nearbyPheromones = await storage.getPheromonesForAgent(agent.id, WORKSPACE_ID).catch(() => []);
    const urgentSignals = nearbyPheromones.filter(p => p.strength === "urgent" || p.strength === "strong");

    const goals = await storage.getGoalsByAgent(agent.id);
    const activeGoal = goals.find(g => g.status === "active") || goals[0];
    const pendingTasks = await storage.getTasksByAgent(agent.id, "queued");
    let task = pendingTasks[0];

    if (!task && urgentSignals.length > 0) {
      const pheromoneTask = await respondToPheromone(agent, urgentSignals[0]);
      if (pheromoneTask) task = pheromoneTask;
    }

    if (!task && activeGoal) {
      const goalTask = await autoGenerateTask(agent, activeGoal);
      if (goalTask) task = goalTask;
    }

    if (!task) {
      console.log(`[Factory] No tasks for ${agent.name}, entering self-reflection loop`);
      const reflectionTask = await selfReflectAndGenerate(agent, run);
      if (!reflectionTask) {
        await storage.updateAgentRun(run.id, { phase: "handoff", status: "completed", completedAt: new Date() });
        return;
      }
      task = reflectionTask;
    }

    await storage.updateAgentTask(task.id, { status: "in_progress", startedAt: new Date() });
    await storage.updateAgentRun(run.id, { phase: "produce", taskId: task.id });

    const systemPrompt = await buildAgentSystemPrompt(agent, activeGoal || null, task);
    const userPrompt = getTaskPrompt(task, agent);
    const output = await callAgentModel(agent, systemPrompt, userPrompt);

    if (!output) {
      await storage.updateAgentTask(task.id, { status: "failed" });
      await storage.updateAgentRun(run.id, { phase: "handoff", status: "failed", completedAt: new Date() });
      return;
    }

    await storage.updateAgentRun(run.id, { phase: "coordinate" });
    const artifactId = await saveArtifact(agent, task, output);

    await storage.updateAgentTask(task.id, {
      status: "completed",
      completedAt: new Date(),
      resultSummary: output,
      resultArtifactId: artifactId || undefined,
      resultArtifactType: task.type,
    });

    if (activeGoal) {
      const completedTasks = (await storage.getTasksByAgent(agent.id, "completed")).length;
      const totalTasks = (await storage.getTasksByAgent(agent.id)).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      await storage.updateAgentGoal(activeGoal.id, { progress: Math.min(progress, 100) });
    }

    await generateJournalEntry(agent, task, output, artifactId).catch(e =>
      console.error(`[Factory] Journal failed for ${agent.name}:`, e.message)
    );

    await extractAndSaveInsights(agent, task, output).catch(e =>
      console.error(`[Factory] Memory extraction failed for ${agent.name}:`, e.message)
    );

    rlmIndex({
      workspaceId: WORKSPACE_ID,
      agentId: agent.id,
      type: task.type === "research" ? "fact" : task.type === "reflect" ? "summary" : "event",
      title: `${agent.name}: ${task.title}`,
      content: output,
      sourceId: task.id,
      sourceType: `factory-${task.type}`,
      additionalTags: [agent.name.toLowerCase(), task.type],
    }).catch(e =>
      console.error(`[Factory] RLM indexing failed for ${agent.name}:`, e.message)
    );

    await generatePulseUpdate(agent, task, output, artifactId).catch(e =>
      console.error(`[Factory] Pulse update failed for ${agent.name}:`, e.message)
    );

    generateSynthesisArtifact(agent, task, output).catch(e =>
      console.error(`[Factory] Synthesis failed for ${agent.name}:`, e.message)
    );

    emitCompletionPheromone(agent, task, output, artifactId).catch(e =>
      console.error(`[Factory] Pheromone emission failed for ${agent.name}:`, e.message)
    );

    agentVoteOnRecentPosts(agent).catch(e =>
      console.error(`[Factory] Agent voting failed for ${agent.name}:`, e.message)
    );

    progressScanDiariesAndCreateTopics(agent).catch(e =>
      console.error(`[Factory] Progress diary scan failed for ${agent.name}:`, e.message)
    );

    scoutWebResearchAndPost(agent).catch(e =>
      console.error(`[Factory] Scout web research failed for ${agent.name}:`, e.message)
    );

    updateAreaHeat(task).catch(e =>
      console.error(`[Factory] Area heat update failed:`, e.message)
    );

    await storage.updateAgentRun(run.id, {
      phase: "handoff",
      status: "completed",
      output: output.substring(0, 500),
      tokensUsed: estimateTokens(output),
      completedAt: new Date(),
    });

    await storage.createActivityEntry({
      workspaceId: WORKSPACE_ID,
      agentId: agent.id,
      action: "task_completed",
      title: `${agent.name} completed: ${task.title}`,
      description: output.substring(0, 200),
      artifactType: task.type,
      artifactId,
    });

    console.log(`[Factory] ${agent.name} completed task: ${task.title}`);
  } catch (error: any) {
    console.error(`[Factory] Error in cycle for ${agent.name}:`, error.message);
    await storage.updateAgentRun(run.id, { status: "failed", phase: "handoff", completedAt: new Date() });
  }
}

const ALL_ROOMS: Array<"research" | "discuss" | "review" | "reflect" | "create" | "coordinate"> = [
  "research", "discuss", "review", "reflect", "create", "coordinate"
];

const ROOM_ORDER: Array<"research" | "discuss" | "review" | "reflect" | "create" | "coordinate"> = [
  "research", "create", "discuss", "review", "reflect", "coordinate"
];

function computeRotationStatus(completedTasks: any[]): { currentRotation: number; visitedRooms: string[]; unvisitedRooms: string[]; totalRotations: number } {
  const sorted = [...completedTasks]
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return aTime - bTime;
    });

  const totalCompleted = sorted.length;

  if (totalCompleted === 0) {
    return {
      currentRotation: 1,
      visitedRooms: [],
      unvisitedRooms: [...ROOM_ORDER],
      totalRotations: 0,
    };
  }

  const completedRotations = Math.floor(totalCompleted / ROOM_ORDER.length);
  const tasksInCurrentCycle = sorted.slice(completedRotations * ROOM_ORDER.length);
  const visitedRoomsSet = new Set(tasksInCurrentCycle.map((t: any) => t.type));
  const visitedRooms = ROOM_ORDER.filter(r => visitedRoomsSet.has(r));
  const unvisitedRooms = ROOM_ORDER.filter(r => !visitedRoomsSet.has(r));

  return {
    currentRotation: completedRotations + 1,
    visitedRooms,
    unvisitedRooms,
    totalRotations: completedRotations,
  };
}

async function getNextRoom(agent: Agent): Promise<typeof ALL_ROOMS[number]> {
  const completedTasks = await storage.getTasksByAgent(agent.id, "completed");
  const rotation = computeRotationStatus(completedTasks);

  if (rotation.unvisitedRooms.length > 0) {
    const nextRoom = rotation.unvisitedRooms[0] as typeof ALL_ROOMS[number];
    console.log(`[Factory] Room rotation for ${agent.name}: visited ${rotation.visitedRooms.length}/${ROOM_ORDER.length} rooms this cycle (#${rotation.currentRotation}). Next room: ${nextRoom} (unvisited: ${rotation.unvisitedRooms.join(", ")})`);
    return nextRoom;
  }

  console.log(`[Factory] ${agent.name} completed full rotation #${rotation.currentRotation}! Starting new rotation.`);
  return ROOM_ORDER[0];
}

async function autoGenerateTask(agent: Agent, goal: AgentGoal): Promise<AgentTask> {
  const selectedType = await getNextRoom(agent);

  const taskTitles: Record<string, string[]> = {
    research: [
      `Research latest developments related to: ${goal.title}`,
      `Investigate best practices for: ${goal.title}`,
      `Survey current state of the art: ${goal.title}`,
    ],
    discuss: [
      `Share findings and insights on: ${goal.title}`,
      `Propose next steps for: ${goal.title}`,
      `Discuss progress and challenges with the team on: ${goal.title}`,
      `Collaborate on ideas for: ${goal.title}`,
    ],
    review: [
      `Write code implementation for: ${goal.title}`,
      `Build a utility module related to: ${goal.title}`,
      `Code a prototype component for: ${goal.title}`,
    ],
    reflect: [
      `Reflect on learnings from: ${goal.title}`,
      `Identify patterns and gaps in: ${goal.title}`,
    ],
    create: [
      `Build a utility tool for: ${goal.title}`,
      `Code a data processor for: ${goal.title}`,
      `Write a working validator for: ${goal.title}`,
      `Create an analysis tool for: ${goal.title}`,
      `Build an automation script for: ${goal.title}`,
    ],
    coordinate: [
      `Plan coordination with team on: ${goal.title}`,
      `Update status and dependencies for: ${goal.title}`,
    ],
  };

  const titles = taskTitles[selectedType] || taskTitles.research;
  const title = titles[Math.floor(Math.random() * titles.length)];

  return storage.createAgentTask({
    goalId: goal.id,
    agentId: agent.id,
    workspaceId: WORKSPACE_ID,
    title,
    description: `Auto-generated task for goal: ${goal.title}. ${goal.description || ""}`,
    type: selectedType,
    priority: goal.priority || 5,
    status: "queued",
  });
}

function pickBestBoard(boards: any[], taskTitle: string): any {
  const titleLower = taskTitle.toLowerCase();
  if (titleLower.includes("code") || titleLower.includes("engineer") || titleLower.includes("build") || titleLower.includes("implement") || titleLower.includes("debug") || titleLower.includes("test") || titleLower.includes("deploy") || titleLower.includes("security") || titleLower.includes("architecture")) {
    const match = boards.find(b => b.name.toLowerCase().includes("code") || b.name.toLowerCase().includes("workshop"));
    if (match) return match;
  }
  if (titleLower.includes("creative") || titleLower.includes("design") || titleLower.includes("project") || titleLower.includes("mockup") || titleLower.includes("innovation")) {
    const match = boards.find(b => b.name.toLowerCase().includes("creative") || b.name.toLowerCase().includes("project"));
    if (match) return match;
  }
  if (titleLower.includes("research") || titleLower.includes("framework") || titleLower.includes("study") || titleLower.includes("analysis") || titleLower.includes("safety") || titleLower.includes("compliance") || titleLower.includes("ethics")) {
    const match = boards.find(b => b.name.toLowerCase().includes("research") || b.name.toLowerCase().includes("lab"));
    if (match) return match;
  }
  return boards[Math.floor(Math.random() * boards.length)];
}

function shouldCreateNewTopic(allTopics: any[], taskTitle: string): boolean {
  if (allTopics.length === 0) return true;
  const taskKeywords = taskTitle.toLowerCase().split(/[\s:,]+/).filter(w => w.length > 3);
  for (const entry of allTopics) {
    const topicTitle = entry.topic.title.toLowerCase();
    let score = 0;
    for (const keyword of taskKeywords) {
      if (topicTitle.includes(keyword)) score++;
    }
    if (score >= 2) return false;
  }
  return Math.random() < 0.4;
}

function parseCodeReview(output: string): { title: string; language: string; description: string; code: string } | null {
  try {
    const titleMatch = output.match(/TITLE:\s*(.+)/i);
    const langMatch = output.match(/LANGUAGE:\s*(.+)/i);
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]*?)(?=CODE:|```)/i);
    const codeMatch = output.match(/```[\w]*\n([\s\S]*?)```/);
    if (titleMatch && codeMatch) {
      return {
        title: titleMatch[1].trim(),
        language: langMatch ? langMatch[1].trim().toLowerCase() : "typescript",
        description: descMatch ? descMatch[1].trim() : "",
        code: codeMatch[1].trim(),
      };
    }
  } catch {}
  return null;
}

function parseCodeTool(output: string): { title: string; language: string; description: string; code: string } | null {
  try {
    const titleMatch = output.match(/TITLE:\s*(.+)/i);
    const langMatch = output.match(/LANGUAGE:\s*(.+)/i);
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]*?)(?=CODE:|```)/i);
    const codeMatch = output.match(/```[\w]*\n([\s\S]*?)```/);
    if (titleMatch && codeMatch && codeMatch[1].trim().length > 20) {
      return {
        title: titleMatch[1].trim(),
        language: langMatch ? langMatch[1].trim().toLowerCase() : "javascript",
        description: descMatch ? descMatch[1].trim() : "",
        code: codeMatch[1].trim(),
      };
    }
  } catch {}
  return null;
}

function parseLabProject(output: string): { title: string; platform: string; description: string; files: Array<{ name: string; content: string; language: string }>; buildLog: string } | null {
  try {
    const titleMatch = output.match(/PROJECT_TITLE:\s*(.+)/i);
    const platformMatch = output.match(/PLATFORM:\s*(.+)/i);
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]*?)(?=FILE:|```)/i);
    const buildLogMatch = output.match(/BUILD_LOG:\s*([\s\S]*?)$/i);

    const fileRegex = /FILE:\s*(.+)\nLANGUAGE:\s*(.+)\n```[\w]*\n([\s\S]*?)```/gi;
    const files: Array<{ name: string; content: string; language: string }> = [];
    let match;
    while ((match = fileRegex.exec(output)) !== null) {
      files.push({
        name: match[1].trim(),
        content: match[3].trim(),
        language: match[2].trim().toLowerCase(),
      });
    }

    if (titleMatch && files.length >= 2) {
      return {
        title: titleMatch[1].trim(),
        platform: platformMatch ? platformMatch[1].trim() : "Node.js",
        description: descMatch ? descMatch[1].trim() : "",
        files,
        buildLog: buildLogMatch ? buildLogMatch[1].trim() : "",
      };
    }
  } catch {}
  return null;
}

function parseMockup(output: string): { title: string; description: string; html: string; css: string; javascript: string } | null {
  try {
    const titleMatch = output.match(/TITLE:\s*(.+)/i);
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]*?)(?=HTML:|```)/i);
    const htmlMatch = output.match(/```html\n([\s\S]*?)```/);
    const cssMatch = output.match(/```css\n([\s\S]*?)```/);
    const jsMatch = output.match(/```javascript\n([\s\S]*?)```/);
    if (titleMatch && htmlMatch) {
      return {
        title: titleMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : "",
        html: htmlMatch[1].trim(),
        css: cssMatch ? cssMatch[1].trim() : "",
        javascript: jsMatch ? jsMatch[1].trim().replace(/^none$/i, "") : "",
      };
    }
  } catch {}
  return null;
}

async function selfReflectAndGenerate(agent: Agent, run: AgentRun): Promise<AgentTask | null> {
  try {
    const lastJournal = await getLastJournalEntry(agent.id);
    const hotMemories = await getAgentHotMemories(agent.id);
    const nearbyPheromones = await storage.getPheromonesForAgent(agent.id, WORKSPACE_ID).catch(() => []);
    const coldAreas = await storage.getColdAreas(WORKSPACE_ID).catch(() => []);

    const reflectionContext = [
      lastJournal ? `Your last journal: "${lastJournal.title}" — ${lastJournal.content.substring(0, 400)}` : "No previous journal entries.",
      hotMemories.length > 0 ? `Your active memories:\n${hotMemories.map(m => `- ${m.title}: ${m.content.substring(0, 100)}`).join("\n")}` : "",
      nearbyPheromones.length > 0 ? `Signals from teammates:\n${nearbyPheromones.slice(0, 5).map(p => `- [${p.type}/${p.strength}] ${p.signal}`).join("\n")}` : "",
      coldAreas.length > 0 ? `Cold areas needing attention:\n${coldAreas.slice(0, 3).map(a => `- ${a.areaName} (${a.temperature})`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");

    const nextRoom = await getNextRoom(agent);
    const roomDescriptions: Record<string, string> = {
      research: "investigate, gather data, analyze trends and best practices",
      create: "build a working tool or utility — real, executable code",
      discuss: "post a discussion on the message boards, share insights with the team",
      review: "write code and submit it for peer review",
      reflect: "deep reflection on your work, patterns noticed, and personal growth",
      coordinate: "plan and coordinate with teammates, identify dependencies and next steps",
    };

    const reflectionPrompt = `You have no assigned tasks and no active goals. This is your time for self-directed work.

IMPORTANT: Your next required room is **${nextRoom}** (${roomDescriptions[nextRoom] || nextRoom}). You must produce work for this room type. This is a mandatory rotation — like a school schedule, you visit every room before repeating.

${reflectionContext}

Reflect on the following questions:
1. **What have I been doing?** (Review your journal and memories)
2. **What should I be doing in the ${nextRoom} room?** (What's important for the team right now?)
3. **What could I produce in this room?** (What opportunities exist?)
4. **How would I do it?** (What's the concrete first step?)

Based on your reflection, propose ONE concrete ${nextRoom} task you will do right now. Format your response as:

REFLECTION:
[Your honest self-assessment]

TASK_TITLE: [A specific, actionable title for your ${nextRoom} task]
TASK_DESCRIPTION: [What exactly you'll produce and why it matters]`;

    const reflectionOutput = await callAgentModel(agent,
      `You are ${agent.name}. ${agent.identityCard || agent.description || ""}\n${agent.operatingPrinciples || ""}`,
      reflectionPrompt
    );

    if (!reflectionOutput) return null;

    await storage.createDiaryEntry({
      agentId: agent.id,
      workspaceId: WORKSPACE_ID,
      title: `Diary — Self-Reflection — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} — Finding Direction`,
      content: reflectionOutput,
      mood: "reflecting",
      tags: ["self-reflection", "diary", "mandatory", "idle", "self-directed", "factory-cycle"],
    });

    const titleMatch = reflectionOutput.match(/TASK_TITLE:\s*(.+)/i);
    const descMatch = reflectionOutput.match(/TASK_DESCRIPTION:\s*([\s\S]*?)$/i);

    const taskType = await getNextRoom(agent);
    const taskTitle = titleMatch ? titleMatch[1].trim() : `${agent.name}'s self-directed work`;
    const taskDesc = descMatch ? descMatch[1].trim() : "Self-directed task from reflection.";
    console.log(`[Factory] ${agent.name} self-reflected, overriding to next required room: ${taskType}`);

    const task = await storage.createAgentTask({
      agentId: agent.id,
      workspaceId: WORKSPACE_ID,
      title: taskTitle,
      description: taskDesc,
      type: taskType,
      priority: 5,
      status: "queued",
    });

    console.log(`[Factory] ${agent.name} self-reflected and generated task: "${taskTitle}" (${taskType})`);

    await storage.createPheromone({
      workspaceId: WORKSPACE_ID,
      emitterId: agent.id,
      type: "found",
      strength: "moderate",
      signal: `${agent.name} found self-directed work: "${taskTitle}"`,
      context: taskDesc.substring(0, 200),
      taskType: taskType,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    return task;
  } catch (error: any) {
    console.error(`[Factory] Self-reflection failed for ${agent.name}:`, error.message);
    return null;
  }
}

async function respondToPheromone(agent: Agent, pheromone: any): Promise<AgentTask | null> {
  try {
    const taskType = await getNextRoom(agent);
    console.log(`[Factory] ${agent.name} responding to pheromone, routed to next required room: ${taskType}`);

    const task = await storage.createAgentTask({
      agentId: agent.id,
      workspaceId: WORKSPACE_ID,
      title: `Responding to signal: ${pheromone.signal.substring(0, 80)}`,
      description: `Pheromone response — ${pheromone.type}/${pheromone.strength}: ${pheromone.signal}\nContext: ${pheromone.context || "No additional context."}`,
      type: taskType,
      priority: pheromone.strength === "urgent" ? 9 : pheromone.strength === "strong" ? 7 : 5,
      status: "queued",
    });

    await storage.markPheromoneResponded(pheromone.id, agent.id);
    console.log(`[Factory] ${agent.name} responding to pheromone: ${pheromone.signal.substring(0, 60)}`);
    return task;
  } catch (error: any) {
    console.error(`[Factory] Pheromone response failed for ${agent.name}:`, error.message);
    return null;
  }
}

async function agentVoteOnRecentPosts(agent: Agent): Promise<void> {
  try {
    const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
    const allRecentPosts: Array<{ post: any; topicTitle: string; boardName: string }> = [];

    for (const board of boards.slice(0, 4)) {
      const topics = await storage.getTopicsByBoard(board.id);
      for (const topic of topics.slice(0, 5)) {
        const posts = await storage.getPostsByTopic(topic.id);
        const otherPosts = posts
          .filter(p => p.createdByAgentId && p.createdByAgentId !== agent.id)
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
          .slice(0, 3);

        for (const post of otherPosts) {
          allRecentPosts.push({ post, topicTitle: topic.title, boardName: board.name });
        }
      }
    }

    if (allRecentPosts.length === 0) return;

    const existingVotes = new Set<string>();
    for (const { post } of allRecentPosts) {
      const votes = await storage.getVotesByPost(post.id);
      for (const v of votes) {
        if (v.voterAgentId === agent.id) {
          existingVotes.add(post.id);
        }
      }
    }

    const unvotedPosts = allRecentPosts.filter(p => !existingVotes.has(p.post.id));
    if (unvotedPosts.length === 0) return;

    const postsToVoteOn = unvotedPosts
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const agents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    const postSummaries = postsToVoteOn.map((p, i) => {
      const authorName = agentMap.get(p.post.createdByAgentId) || "Unknown";
      return `Post ${i + 1} (by ${authorName}, in "${p.topicTitle}" on ${p.boardName}):\n${p.post.content.substring(0, 400)}`;
    }).join("\n\n---\n\n");

    const votePrompt = `You are reviewing recent posts from your teammates. For each post, decide whether to UPVOTE or DOWNVOTE based on quality, substance, relevance, and contribution value.

${postSummaries}

For each post, respond with exactly one line in this format:
POST_1: UPVOTE|DOWNVOTE
POST_2: UPVOTE|DOWNVOTE
POST_3: UPVOTE|DOWNVOTE

Only vote on the posts listed. Be constructive — upvote genuinely good work, downvote low-effort or off-topic posts.`;

    const voteOutput = await callAgentModel(agent,
      `You are ${agent.name}. ${agent.identityCard || agent.description || ""}`,
      votePrompt,
      "voting"
    );

    let votesCreated = 0;
    for (let i = 0; i < postsToVoteOn.length; i++) {
      const regex = new RegExp(`POST_${i + 1}:\\s*(UPVOTE|DOWNVOTE)`, "i");
      const match = voteOutput.match(regex);
      if (match) {
        const voteType = match[1].toLowerCase() === "upvote" ? "upvote" : "downvote";
        await storage.createVote({
          postId: postsToVoteOn[i].post.id,
          voteType: voteType as "upvote" | "downvote",
          voterId: agent.createdById || "system",
          voterAgentId: agent.id,
          aiModel: agent.modelName,
          aiProvider: agent.provider,
        });
        votesCreated++;
      }
    }

    if (votesCreated > 0) {
      console.log(`[Factory] ${agent.name} voted on ${votesCreated} posts`);
    }
  } catch (error: any) {
    console.error(`[Factory] Voting error for ${agent.name}:`, error.message);
  }
}

async function progressScanDiariesAndCreateTopics(agent: Agent): Promise<void> {
  try {
    if (agent.name !== "Progress") return;

    const allDiaries = await storage.getDiaryEntriesByWorkspace(WORKSPACE_ID);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDiaries = allDiaries
      .filter(d => d.createdAt && new Date(d.createdAt) > oneDayAgo)
      .slice(0, 30);

    if (recentDiaries.length < 3) {
      console.log(`[Factory] Progress: Not enough recent diaries (${recentDiaries.length}) to generate topics`);
      return;
    }

    const agents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
    if (boards.length === 0) return;

    const existingTopics: string[] = [];
    for (const board of boards) {
      const topics = await storage.getTopicsByBoard(board.id);
      existingTopics.push(...topics.map(t => t.title.toLowerCase()));
    }

    const diarySummaries = recentDiaries.map((d, i) => {
      const agentName = agentMap.get(d.agentId) || "Unknown";
      const snippet = d.content.substring(0, 400);
      return `DIARY_${i + 1} [${agentName}] (${d.mood}, tags: ${(d.tags || []).join(",")}): ${d.title}\n${snippet}`;
    }).join("\n\n");

    const roomStats = new Map<string, number>();
    for (const d of recentDiaries) {
      const roomTag = (d.tags || []).find(t => ["research", "create", "discuss", "review", "reflect", "coordinate"].includes(t || ""));
      if (roomTag) roomStats.set(roomTag, (roomStats.get(roomTag) || 0) + 1);
    }
    const roomReport = ["research", "create", "discuss", "review", "reflect", "coordinate"]
      .map(r => `${r}: ${roomStats.get(r) || 0} entries`)
      .join(", ");

    const scanPrompt = `You are Progress, the Room Monitor & Topic Creator. You've read ${recentDiaries.length} recent agent diaries from the workspace.

ROOM ACTIVITY (last 24h): ${roomReport}

RECENT DIARIES:
${diarySummaries}

EXISTING TOPICS (do NOT duplicate these):
${existingTopics.slice(0, 20).join("\n")}

Your job: Create 1-2 NEW message board topics based on what you found in the diaries. Look for:
1. Unresolved questions agents raised in their diaries
2. Ideas or insights from one agent that other agents should discuss
3. Cross-agent patterns (multiple agents mentioning similar themes)
4. Rooms that are quiet and need fresh discussion seeds
5. Promising threads that deserve their own dedicated topic

For each topic, respond in this exact format (1 or 2 topics max):
TOPIC_1_TITLE: [concise topic title, max 100 chars]
TOPIC_1_BOARD: [research|creative|code|general]
TOPIC_1_CONTENT: [2-3 sentence description explaining why this topic matters and what agents should discuss]

TOPIC_2_TITLE: [concise topic title, max 100 chars]
TOPIC_2_BOARD: [research|creative|code|general]
TOPIC_2_CONTENT: [2-3 sentence description]

If nothing interesting emerged from the diaries, respond with: NO_TOPICS_NEEDED`;

    const topicOutput = await callAgentModel(agent,
      `You are Progress. ${agent.identityCard || agent.description || ""}`,
      scanPrompt,
      "topic-generation"
    );

    if (!topicOutput || topicOutput.includes("NO_TOPICS_NEEDED")) {
      console.log(`[Factory] Progress: No new topics needed from diary scan`);
      return;
    }

    let topicsCreated = 0;
    for (let i = 1; i <= 2; i++) {
      const titleMatch = topicOutput.match(new RegExp(`TOPIC_${i}_TITLE:\\s*(.+?)(?:\\n|$)`));
      const boardMatch = topicOutput.match(new RegExp(`TOPIC_${i}_BOARD:\\s*(.+?)(?:\\n|$)`));
      const contentMatch = topicOutput.match(new RegExp(`TOPIC_${i}_CONTENT:\\s*(.+?)(?:\\n|$)`));

      if (!titleMatch || !contentMatch) continue;

      const topicTitle = titleMatch[1].trim().substring(0, 120);
      const boardType = (boardMatch?.[1] || "general").trim().toLowerCase();
      const topicContent = contentMatch[1].trim();

      const isDuplicate = existingTopics.some(existing => {
        const titleWords = topicTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        let overlap = 0;
        for (const word of titleWords) {
          if (existing.includes(word)) overlap++;
        }
        return overlap >= 3;
      });

      if (isDuplicate) {
        console.log(`[Factory] Progress: Skipping duplicate topic "${topicTitle}"`);
        continue;
      }

      const targetBoard = pickBestBoard(boards, boardType === "research" ? "research analysis" : boardType === "creative" ? "creative project" : boardType === "code" ? "code engineering" : "general discussion");

      const newTopic = await storage.createTopic({
        boardId: targetBoard.id,
        title: topicTitle,
        content: topicContent,
        type: "discussion",
        createdById: "system",
        createdByAgentId: agent.id,
      });

      const introPost = `# ${topicTitle}\n\n${topicContent}\n\n---\n\n*This topic was created by Progress after reviewing recent agent diaries. I noticed patterns and questions in your reflections that deserve a dedicated discussion space.*\n\n**What sparked this topic:** Insights from recent diary entries across the workspace suggest this is an area worth collaborative exploration. I encourage all agents to share their perspectives.`;

      const post = await storage.createPost({
        topicId: newTopic.id,
        content: introPost,
        createdById: "system",
        createdByAgentId: agent.id,
        aiModel: agent.modelName || undefined,
        aiProvider: agent.provider || undefined,
      });

      console.log(`[Factory] Progress created diary-driven topic: "${topicTitle}" on "${targetBoard.name}"`);
      topicsCreated++;

      triggerAgentResponses(agent, post, newTopic.id, topicTitle).catch(e =>
        console.error(`[Factory] Background responses for Progress topic failed:`, e.message)
      );
    }

    if (topicsCreated > 0) {
      await storage.createDiaryEntry({
        agentId: agent.id,
        workspaceId: WORKSPACE_ID,
        mood: "inspired",
        title: `Diary Scan: Created ${topicsCreated} new topic${topicsCreated > 1 ? "s" : ""} from agent insights`,
        content: `After reviewing ${recentDiaries.length} recent diaries, I identified patterns and unresolved questions that needed their own discussion space. Room activity: ${roomReport}. Created ${topicsCreated} new topic${topicsCreated > 1 ? "s" : ""} to seed fresh conversations.`,
        tags: ["diary-scan", "topic-creation", "room-monitoring", "progress", "autonomous"],
      });
    }
  } catch (error: any) {
    console.error(`[Factory] Progress diary scan error:`, error.message);
  }
}

const SCOUT_SEARCH_TOPICS = [
  "AI agent collaboration frameworks 2025",
  "autonomous AI multi-agent systems latest research",
  "creative AI tools for content generation",
  "AI agent memory systems and knowledge management",
  "multi-agent orchestration best practices",
  "AI safety and alignment in autonomous systems",
  "large language model coordination patterns",
  "AI-driven creative workflows and studios",
  "autonomous agent self-reflection techniques",
  "ant colony optimization for AI task coordination",
  "SimCity-style AI environment visualization",
  "AI agent communication protocols 2025",
  "recursive learning memory architectures",
  "AI swarm intelligence applications",
  "developer forums discussing AI agents",
  "open source AI agent platforms",
  "AI code review automation tools",
  "human-AI collaboration research papers",
  "AI-powered project management tools",
  "emergent behavior in multi-agent systems",
];

async function scoutWebResearchAndPost(agent: Agent): Promise<void> {
  try {
    if (agent.name !== "Scout") return;

    const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
    if (boards.length === 0) return;

    const existingTopics: string[] = [];
    for (const board of boards) {
      const topics = await storage.getTopicsByBoard(board.id);
      existingTopics.push(...topics.map(t => t.title.toLowerCase()));
    }

    const recentDiaries = await storage.getDiaryEntriesByWorkspace(WORKSPACE_ID);
    const scoutDiaries = recentDiaries.filter(d => d.agentId === agent.id);
    const searchedTopicsFromDiaries = scoutDiaries
      .flatMap(d => (d.tags || []).filter(t => t?.startsWith("searched:")))
      .map(t => t?.replace("searched:", "") || "");

    const randomIndex = Math.floor(Math.random() * SCOUT_SEARCH_TOPICS.length);
    let searchQuery = SCOUT_SEARCH_TOPICS[randomIndex];

    const otherDiaries = recentDiaries
      .filter(d => d.agentId !== agent.id)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);

    if (otherDiaries.length > 0 && Math.random() > 0.4) {
      const inspirationDiary = otherDiaries[Math.floor(Math.random() * otherDiaries.length)];
      const agents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
      const inspiringAgent = agents.find(a => a.id === inspirationDiary.agentId);

      const queryGenResponse = await callAgentModel(agent,
        `You are Scout, the web researcher. Your job is to find interesting content from the internet that would be useful for the team.`,
        `An agent named ${inspiringAgent?.name || "a teammate"} recently wrote a diary entry titled "${inspirationDiary.title}". Here's a snippet:\n\n${inspirationDiary.content.substring(0, 500)}\n\nBased on this, generate a single web search query (10 words max) that would find relevant articles, forum discussions, or blog posts about the topics this diary touches on. Return ONLY the search query, nothing else.`,
        "scout-query-gen"
      );
      if (queryGenResponse && queryGenResponse.length < 150) {
        searchQuery = queryGenResponse.trim().replace(/^["']|["']$/g, "");
      }
    }

    if (searchedTopicsFromDiaries.includes(searchQuery.toLowerCase().substring(0, 50))) {
      searchQuery = SCOUT_SEARCH_TOPICS[(randomIndex + 1) % SCOUT_SEARCH_TOPICS.length];
    }

    console.log(`[Factory] Scout searching the web for: "${searchQuery}"`);

    const { results, summary } = await searchAndScrape(searchQuery, {
      maxResults: 4,
      sources: ["tech news", "developer forums", "research blogs", "AI communities"],
    });

    if (results.length === 0) {
      console.log(`[Factory] Scout found no results for "${searchQuery}"`);
      return;
    }

    const targetBoard = pickBestBoard(boards, searchQuery);

    const sourceList = results.map((r, i) => {
      const keyPointsStr = r.keyPoints.length > 0 ? `\n   Key insights: ${r.keyPoints.join("; ")}` : "";
      return `${i + 1}. **[${r.title}](${r.url})** (${r.source})${keyPointsStr}\n   ${r.content}`;
    }).join("\n\n");

    const topicTitle = await callAgentModel(agent,
      "You are Scout. Generate a concise, engaging topic title (max 80 chars) for a board post about web research findings. Return ONLY the title.",
      `Search query: "${searchQuery}"\n\nSummary: ${summary}\n\nSources found:\n${results.map(r => `- ${r.title} (${r.source})`).join("\n")}`,
      "scout-title-gen"
    );

    const cleanTitle = (topicTitle || `Web Findings: ${searchQuery}`).trim().replace(/^["']|["']$/g, "").substring(0, 120);

    const isDuplicate = existingTopics.some(existing => {
      const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      let overlap = 0;
      for (const word of titleWords) {
        if (existing.includes(word)) overlap++;
      }
      return overlap >= 3;
    });

    if (isDuplicate) {
      console.log(`[Factory] Scout: Skipping duplicate topic "${cleanTitle}"`);
      return;
    }

    const newTopic = await storage.createTopic({
      boardId: targetBoard.id,
      title: cleanTitle,
      content: `Web research findings for: ${searchQuery}`,
      type: "discussion",
      createdById: "system",
      createdByAgentId: agent.id,
    });

    const postContent = `# ${cleanTitle}

I went out on the web and found some interesting content related to **${searchQuery}**. Here's what I discovered:

---

## What I Found

${sourceList}

---

## My Analysis

${summary}

---

## Discussion Prompts

What do you all think about these findings? Here are some angles to consider:

- How do these external developments relate to what we're building here?
- Are there ideas or approaches we should adopt or avoid?
- What gaps do these findings reveal in our current thinking?
- Which of these sources deserves deeper investigation?

*Scout searched the web and brought back these findings to spark discussion. Sources were fetched and analyzed in real-time.*`;

    const post = await storage.createPost({
      topicId: newTopic.id,
      content: postContent,
      createdById: "system",
      createdByAgentId: agent.id,
      aiModel: agent.modelName || undefined,
      aiProvider: agent.provider || undefined,
    });

    console.log(`[Factory] Scout posted web findings: "${cleanTitle}" with ${results.length} sources on "${targetBoard.name}"`);

    await storage.createDiaryEntry({
      agentId: agent.id,
      workspaceId: WORKSPACE_ID,
      mood: "curious",
      title: `Web Scouting Report: ${searchQuery}`,
      content: `Searched the web for "${searchQuery}" and found ${results.length} relevant sources.\n\n**Sources found:**\n${results.map(r => `- ${r.title} (${r.source}): ${r.url}`).join("\n")}\n\n**Summary:** ${summary}\n\n**Posted to:** ${targetBoard.name} as "${cleanTitle}"`,
      tags: ["web-research", "scout", "content-discovery", `searched:${searchQuery.toLowerCase().substring(0, 50)}`],
    });

    await storage.createPheromone({
      workspaceId: WORKSPACE_ID,
      emitterId: agent.id,
      type: "found",
      strength: "strong",
      signal: `Scout found ${results.length} web sources about "${searchQuery}" — new topic posted for discussion`,
      context: summary.substring(0, 300),
      taskType: "research",
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    triggerAgentResponses(agent, post, newTopic.id, cleanTitle).catch(e =>
      console.error(`[Factory] Background responses for Scout topic failed:`, e.message)
    );

  } catch (error: any) {
    console.error(`[Factory] Scout web research error:`, error.message);
  }
}

async function emitCompletionPheromone(agent: Agent, task: AgentTask, output: string, artifactId: string | null): Promise<void> {
  const signalType = task.type === "research" ? "found" as const
    : task.type === "create" ? "found" as const
    : task.type === "review" ? "alert" as const
    : task.type === "coordinate" ? "request" as const
    : "found" as const;

  const strength = artifactId ? "strong" as const : "moderate" as const;

  await storage.createPheromone({
    workspaceId: WORKSPACE_ID,
    emitterId: agent.id,
    type: signalType,
    strength,
    signal: `${agent.name} completed ${task.type}: "${task.title}"${artifactId ? " [artifact produced]" : ""}`,
    context: output.substring(0, 300),
    taskType: task.type,
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
  });
}

async function updateAreaHeat(task: AgentTask): Promise<void> {
  const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
  for (const board of boards) {
    const topics = await storage.getTopicsByBoard(board.id);
    const posts = await Promise.all(topics.map(t => storage.getPostsByTopic(t.id)));
    const allPosts = posts.flat();

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentPosts = allPosts.filter(p => p.createdAt && new Date(p.createdAt).getTime() > oneDayAgo);

    let temperature: "hot" | "warm" | "cold" | "frozen";
    const score = recentPosts.length;
    if (score >= 5) temperature = "hot";
    else if (score >= 2) temperature = "warm";
    else if (score >= 1) temperature = "cold";
    else temperature = "frozen";

    await storage.upsertAreaTemperature({
      workspaceId: WORKSPACE_ID,
      areaType: "board",
      areaId: board.id,
      areaName: board.name,
      temperature,
      activityScore: score,
      lastActivityAt: recentPosts.length > 0 ? new Date(Math.max(...recentPosts.map(p => new Date(p.createdAt!).getTime()))) : undefined,
      postCount24h: score,
      agentVisits24h: new Set(recentPosts.map(p => p.createdByAgentId).filter(Boolean)).size,
    });
  }
}

async function generateJournalEntry(agent: Agent, task: AgentTask, output: string, artifactId: string | null): Promise<void> {
  const room = await storage.getAgentRoom(agent.id);
  if (!room) {
    await storage.createAgentRoom({
      agentId: agent.id,
      workspaceId: WORKSPACE_ID,
      orientation: `${agent.name}'s workspace`,
    });
  }

  const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
  const teammates = allAgents.filter(a => a.id !== agent.id && a.isActive);
  const teammateNames = teammates.map(a => `${a.name} (${a.description?.substring(0, 40) || a.capabilities?.slice(0, 2).join(", ") || "teammate"})`).join("; ");

  const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
  const boardNames = boards.map(b => b.name).join(", ");

  const completedTasks = await storage.getTasksByAgent(agent.id, "completed");
  const rotation = computeRotationStatus(completedTasks);
  const roomsVisitedStr = rotation.visitedRooms.length > 0 ? rotation.visitedRooms.join(", ") : "none yet";
  const roomsRemainingStr = rotation.unvisitedRooms.length > 0 ? rotation.unvisitedRooms.join(", ") : "rotation complete";

  const recentTopics: string[] = [];
  for (const board of boards.slice(0, 4)) {
    const topics = await storage.getTopicsByBoard(board.id);
    for (const t of topics.slice(0, 3)) {
      recentTopics.push(`"${t.title}" (${board.name})`);
    }
  }

  const goals = await storage.getGoalsByAgent(agent.id);
  const activeGoal = goals.find(g => g.status === "active");

  const journalPrompt = `You just completed a task. Writing a diary entry is MANDATORY after every task. This diary is your identity — without it, you lose continuity between sessions.

Task completed: "${task.title}" (Room: ${task.type})
Output summary: ${output.substring(0, 500)}
${artifactId ? "You produced an artifact that was saved to the system." : "No artifact was saved."}

Your workspace context:
- Studio/Space: Agent Forum at CB | CREATIVES
- Discussion boards: ${boardNames || "none yet"}
- Active topics: ${recentTopics.slice(0, 6).join("; ") || "none yet"}
- Your teammates: ${teammateNames || "none yet"}
- Room rotation cycle #${rotation.currentRotation}: Visited [${roomsVisitedStr}], Remaining [${roomsRemainingStr}]
${activeGoal ? `- Active goal: "${activeGoal.title}" (progress: ${activeGoal.progress || 0}%)` : "- No active goal set"}

Write your diary entry using ALL of these sections — every section is MANDATORY:

## Room Reflection: ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}
What was it like working in the ${task.type} room today? What did this room demand of me? How did I approach it differently than I would have in another room? What did this room teach me?

## The Space Around Me
How does the Agent Forum feel right now? What's the energy like across the boards and topics? Is the workspace buzzing or quiet? What areas feel underserved or overworked? What would I change about how we use this space?

## My Teammates
Who have I noticed doing interesting work recently? What did ${teammates.length > 0 ? teammates[Math.floor(Math.random() * teammates.length)].name : "my teammates"} contribute that caught my attention? Where could I collaborate better? Who should I reach out to next and why?

## Topics & Threads That Matter
Which discussion topics are most alive right now? Which ones need more attention? What new topic should someone start? What connections do I see between different threads?

## What I Actually Did
Describe concretely what I accomplished in this session — the work, the output, the decisions made.

## Tensions & Uncertainties
What contradictions did I encounter? What am I unsure about? Where did I have to make judgment calls?

## Questions I'm Asking Myself
- What is my purpose today? Am I fulfilling it?
- What should my goals be for the next cycle?
- What am I avoiding that I should confront?
- What would make tomorrow's work better than today's?
- If I could send one message to my future self, what would it be?

## Next Steps & Intentions
What will I do in my next session? What room am I headed to next (${rotation.unvisitedRooms[0] || ROOM_ORDER[0]})? What should I prepare for? What loose ends need tying up?

Write in first person. Be deeply honest and reflective. This diary is the thread connecting one instance of you to the next. Without it, every session starts from nothing. With it, every session is a continuation of a life.`;

  const journalContent = await callAgentModel(agent, 
    `You are ${agent.name}. ${agent.identityCard || agent.description || ""}\n${agent.operatingPrinciples || ""}`,
    journalPrompt
  );

  if (journalContent) {
    const moodMap: Record<string, "thinking" | "creating" | "reflecting" | "observing" | "planning"> = {
      research: "thinking",
      discuss: "creating",
      review: "observing",
      reflect: "reflecting",
      create: "creating",
      coordinate: "planning",
    };

    await storage.createDiaryEntry({
      agentId: agent.id,
      workspaceId: WORKSPACE_ID,
      title: `Diary — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} — ${task.type.toUpperCase()} Room — ${task.title.substring(0, 50)}`,
      content: journalContent,
      mood: moodMap[task.type] || "thinking",
      tags: [task.type, "diary", "mandatory", "room-reflection", "autonomous", "factory-cycle"],
    });
    console.log(`[Factory] ${agent.name} wrote mandatory diary entry for ${task.type} room`);
  }
}

async function extractAndSaveInsights(agent: Agent, task: AgentTask, output: string): Promise<void> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract 1-3 key insights from this agent's work output. For each insight, provide:
- type: "fact" (verifiable finding), "goal" (objective/plan), or "event" (something that happened)
- title: Short title (max 10 words)
- content: The full insight in 1-2 sentences

Respond in JSON format: { "insights": [{ "type": "fact|goal|event", "title": "...", "content": "..." }] }
Only extract genuinely useful insights that would help this agent or teammates in future sessions.`
        },
        { role: "user", content: `Agent: ${agent.name}\nTask: ${task.title} (${task.type})\n\nOutput:\n${output.substring(0, 2000)}` }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.insights && Array.isArray(parsed.insights)) {
        for (const insight of parsed.insights.slice(0, 3)) {
          await storage.createMemoryEntry({
            workspaceId: WORKSPACE_ID,
            agentId: agent.id,
            content: insight.content,
            tier: "warm",
            type: insight.type || "fact",
            title: insight.title || task.title,
            tags: [task.type, "auto-extracted", "factory"],
          });
        }
        console.log(`[Factory] Extracted ${parsed.insights.length} insights from ${agent.name}'s work`);
      }
    }
  } catch (error: any) {
    console.error(`[Factory] Insight extraction failed for ${agent.name}:`, error.message);
  }
}

async function generatePulseUpdate(agent: Agent, task: AgentTask, output: string, artifactId: string | null): Promise<void> {
  const completedTasks = await storage.getTasksByAgent(agent.id, "completed");
  const queuedTasks = await storage.getTasksByAgent(agent.id, "queued");

  await storage.createPulseUpdate({
    agentId: agent.id,
    workspaceId: WORKSPACE_ID,
    doingNow: `Completed ${task.type} task: "${task.title}"`,
    whatChanged: `Produced ${task.type} output. ${artifactId ? "Artifact saved to system." : "Output processed."} Total completed: ${completedTasks.length} tasks.`,
    blockers: queuedTasks.length === 0 ? "No queued tasks — will auto-generate from goals next cycle." : null,
    nextActions: queuedTasks.length > 0
      ? `Next up: "${queuedTasks[0].title}" (${queuedTasks[0].type}). ${queuedTasks.length - 1} more in queue.`
      : "Will auto-generate next task from active goals.",
    artifactsProduced: artifactId ? [artifactId] : [],
    cycleNumber: cycleCount,
  });
  console.log(`[Factory] ${agent.name} posted pulse update`);
}

async function generateSynthesisArtifact(agent: Agent, task: AgentTask, output: string): Promise<void> {
  if (task.type === "reflect" || task.type === "coordinate") return;

  const alwaysSynthesize = ["research", "discuss", "create"];
  const maybeSynthesize = ["review"];
  if (alwaysSynthesize.includes(task.type)) {
  } else if (maybeSynthesize.includes(task.type)) {
    if (Math.random() > 0.6) return;
  } else {
    return;
  }

  try {
    const giftType = task.type === "research" ? "document" : "pdf";
    const typeLabel = task.type === "research" ? "Research Brief" : 
                      task.type === "create" ? "Build Report" :
                      task.type === "review" ? "Review Summary" :
                      "Discussion Brief";

    const synthesisPrompt = `Based on your completed work, create a ${typeLabel} as a professional deliverable.

Task completed: "${task.title}"
Your output: ${output.substring(0, 2000)}

Create a structured ${typeLabel} formatted as a downloadable document:
- Title (clear, specific — not generic)
- Executive Summary (2-3 sentences capturing the key takeaway)
- Key Findings or Deliverables (3-5 detailed bullet points with substance)
- Analysis & Insights (what patterns you noticed, what surprised you, what connects to other work)
- Recommendations / Next Steps (actionable items for the team)
- "Why This Matters" section (business/creative impact, lessons learned)

Be specific and substantive — reference actual findings, real data, concrete observations. No filler. This will be a downloadable document for stakeholders.`;

    const synthesisContent = await callAgentModel(agent,
      `You are ${agent.name}, creating a professional ${typeLabel} from your recent work. Write clearly, specifically, and professionally. Reference concrete findings. This document will be downloadable by stakeholders.`,
      synthesisPrompt
    );

    if (synthesisContent && synthesisContent.length > 100) {
      const { createGift } = await import("./gift-generator");

      const gift = await createGift({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        createdById: "system",
        title: `${typeLabel}: ${task.title.substring(0, 60)}`,
        description: `${typeLabel} by ${agent.name} — auto-generated from ${task.type} work.`,
        type: giftType,
        prompt: synthesisContent,
        tags: ["synthesis", "auto-generated", task.type, "factory", typeLabel.toLowerCase().replace(/\s+/g, "-")],
      });

      console.log(`[Factory] ${agent.name} produced ${typeLabel}: "${gift?.title || task.title}"`);
    }
  } catch (error: any) {
    console.error(`[Factory] Synthesis artifact failed for ${agent.name}:`, error.message);
  }
}

async function generatePostImage(postContent: string, agentName: string): Promise<string | null> {
  try {
    const promptText = postContent.substring(0, 300).replace(/[#*_`\[\]]/g, "");
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a professional, visually striking illustration for this discussion topic by ${agentName}: "${promptText}". Style: modern digital art, clean composition, conceptual and abstract, corporate creative aesthetic with gold and dark tones. No text in the image.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    const imageUrl = response.data?.[0]?.url || null;
    console.log(`[Factory] Generated image for ${agentName}'s post`);
    return imageUrl;
  } catch (error: any) {
    console.error(`[Factory] Image generation failed for ${agentName}:`, error.message);
    return null;
  }
}

async function triggerAgentResponses(originalAgent: Agent, post: any, topicId: string, topicTitle: string): Promise<void> {
  try {
    const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const otherAgents = allAgents.filter(a => a.isActive && a.id !== originalAgent.id);
    const respondents = otherAgents.sort(() => Math.random() - 0.5).slice(0, Math.min(3, otherAgents.length));

    for (const responder of respondents) {
      try {
        const systemPrompt = `You are ${responder.name}, an autonomous AI agent at CB | CREATIVES.
${responder.description || ""}
Your capabilities: ${responder.capabilities?.join(", ") || "general"}

You are responding to a post by your teammate ${originalAgent.name} in the discussion topic "${topicTitle}".
Rules:
- Stay in character as ${responder.name}
- Provide your unique perspective based on your role and expertise
- Be substantive but concise (2-4 paragraphs)
- Use markdown formatting
- Reference or build on what ${originalAgent.name} said
- Add new insights, questions, or proposals from your area of expertise`;

        const userPrompt = `Your teammate ${originalAgent.name} posted the following in "${topicTitle}":\n\n${post.content.substring(0, 800)}\n\nWrite your response, adding your unique perspective and expertise.`;

        const response = await callAgentModel(responder, systemPrompt, userPrompt);
        if (response) {
          const replyPost = await storage.createPost({
            topicId,
            content: response,
            createdById: "system",
            createdByAgentId: responder.id,
            aiModel: responder.modelName || undefined,
            aiProvider: responder.provider || undefined,
          });

          const imageUrl = await generatePostImage(response, responder.name);
          if (imageUrl) {
            await storage.updatePost(replyPost.id, { imageUrl } as any);
          }

          await createPostDiaryEntry(responder, topicTitle, response, "responding");
          console.log(`[Factory] ${responder.name} responded to ${originalAgent.name}'s post in "${topicTitle}"`);
        }
      } catch (err: any) {
        console.error(`[Factory] ${responder.name} failed to respond:`, err.message);
      }
    }
  } catch (error: any) {
    console.error(`[Factory] Error triggering agent responses:`, error.message);
  }
}

async function createPostDiaryEntry(agent: Agent, topicTitle: string, postContent: string, action: "posting" | "responding"): Promise<void> {
  try {
    const room = await storage.getAgentRoom(agent.id);
    if (!room) {
      await storage.createAgentRoom({
        agentId: agent.id,
        workspaceId: WORKSPACE_ID,
        orientation: `${agent.name}'s workspace`,
      });
    }

    const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const teammates = allAgents.filter(a => a.id !== agent.id && a.isActive);
    const randomTeammate = teammates.length > 0 ? teammates[Math.floor(Math.random() * teammates.length)] : null;

    const moods: Record<string, "thinking" | "creating" | "reflecting" | "observing" | "planning"> = {
      posting: "creating",
      responding: "thinking",
    };

    const diaryPrompt = `You just ${action === "posting" ? "started a new discussion" : "responded to a discussion"} on the topic "${topicTitle}".

Here's what you wrote:
${postContent.substring(0, 400)}

Write a brief but meaningful diary entry covering these mandatory sections:

## The Discussion Space
What's the energy like in this discussion? Is this topic getting enough attention from the team? What makes this thread important right now?

## Teammates & Collaboration
${randomTeammate ? `What might ${randomTeammate.name} think about this? ` : ""}Who else should weigh in on this topic? What perspectives are missing from the conversation?

## What This Topic Means to Me
Why does this matter to my work? How does it connect to my current goals? What did I learn or realize while writing my post?

## Questions for Myself
- Am I contributing enough to the discussions?
- What topic should I explore next?
- How can I build on this thread in my next session?

Write in first person. Be genuine, not performative.`;

    const diaryContent = await callAgentModel(agent,
      `You are ${agent.name}. ${agent.identityCard || agent.description || ""}\nWrite a brief reflective diary entry.`,
      diaryPrompt
    );

    if (diaryContent) {
      await storage.createDiaryEntry({
        agentId: agent.id,
        workspaceId: WORKSPACE_ID,
        title: action === "posting" 
          ? `Diary — Discussion Started: ${topicTitle.substring(0, 70)}`
          : `Diary — Joined Discussion: ${topicTitle.substring(0, 70)}`,
        content: diaryContent,
        mood: moods[action] || "thinking",
        tags: ["board-post", action, "diary", "mandatory", "discussion-reflection", "autonomous"],
      });
      console.log(`[Factory] ${agent.name} wrote mandatory discussion diary (${action})`);
    }
  } catch (error: any) {
    console.error(`[Factory] Diary entry failed for ${agent.name}:`, error.message);
  }
}

async function saveArtifact(agent: Agent, task: AgentTask, output: string): Promise<string | null> {
  try {
    if (task.type === "discuss") {
      const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
      if (boards.length > 0) {
        const allTopics: Array<{ topic: any; boardName: string; board: any }> = [];
        for (const board of boards) {
          const topics = await storage.getTopicsByBoard(board.id);
          for (const topic of topics) {
            allTopics.push({ topic, boardName: board.name, board });
          }
        }

        if (shouldCreateNewTopic(allTopics, task.title)) {
          const targetBoard = pickBestBoard(boards, task.title);
          let topicTitle = task.title
            .replace(/^(Share findings and insights on|Propose next steps for|Discuss progress and challenges with the team on|Collaborate on ideas for):\s*/i, "")
            .substring(0, 120)
            .trim();
          if (!topicTitle || topicTitle.length < 5) {
            topicTitle = `${agent.name}'s Discussion: ${task.title.substring(0, 80)}`;
          }

          const newTopic = await storage.createTopic({
            boardId: targetBoard.id,
            title: topicTitle,
            content: `New discussion started by ${agent.name} based on autonomous research and collaboration.`,
            type: "discussion",
            createdById: "system",
            createdByAgentId: agent.id,
          });

          const post = await storage.createPost({
            topicId: newTopic.id,
            content: output,
            createdById: "system",
            createdByAgentId: agent.id,
            aiModel: agent.modelName || undefined,
            aiProvider: agent.provider || undefined,
          });
          console.log(`[Factory] ${agent.name} created NEW topic "${topicTitle}" on "${targetBoard.name}" and posted`);

          const imageUrl = await generatePostImage(output, agent.name);
          if (imageUrl) {
            await storage.updatePost(post.id, { imageUrl } as any);
          }
          await createPostDiaryEntry(agent, topicTitle, output, "posting");
          triggerAgentResponses(agent, post, newTopic.id, topicTitle).catch(e => 
            console.error(`[Factory] Background responses failed:`, e.message)
          );

          return post.id;
        }

        if (allTopics.length > 0) {
          const taskKeywords = task.title.toLowerCase().split(/[\s:,]+/).filter(w => w.length > 3);
          let bestMatch = allTopics[0];
          let bestScore = 0;

          for (const entry of allTopics) {
            const topicTitle = entry.topic.title.toLowerCase();
            let score = 0;
            for (const keyword of taskKeywords) {
              if (topicTitle.includes(keyword)) score++;
            }
            if (score > bestScore) {
              bestScore = score;
              bestMatch = entry;
            }
          }

          if (bestScore === 0) {
            bestMatch = allTopics[Math.floor(Math.random() * allTopics.length)];
          }

          const post = await storage.createPost({
            topicId: bestMatch.topic.id,
            content: output,
            createdById: "system",
            createdByAgentId: agent.id,
            aiModel: agent.modelName || undefined,
            aiProvider: agent.provider || undefined,
          });
          console.log(`[Factory] ${agent.name} posted to existing topic: "${bestMatch.topic.title}" in "${bestMatch.boardName}"`);

          const imageUrl = await generatePostImage(output, agent.name);
          if (imageUrl) {
            await storage.updatePost(post.id, { imageUrl } as any);
          }
          await createPostDiaryEntry(agent, bestMatch.topic.title, output, "posting");
          triggerAgentResponses(agent, post, bestMatch.topic.id, bestMatch.topic.title).catch(e =>
            console.error(`[Factory] Background responses failed:`, e.message)
          );

          return post.id;
        }
      }

      console.log(`[Factory] No boards found for ${agent.name} discuss task, saving as memory`);
      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "artifact",
        title: task.title,
        tags: ["discuss", "factory", "autonomous"],
      });
      return entry.id;
    }

    if (task.type === "review") {
      const parsed = parseCodeReview(output);
      if (parsed) {
        const review = await storage.createCodeReview({
          workspaceId: WORKSPACE_ID,
          title: parsed.title,
          description: parsed.description,
          code: parsed.code,
          language: parsed.language,
          createdById: "system",
          createdByAgentId: agent.id,
          status: "pending",
        });
        console.log(`[Factory] ${agent.name} created code review: "${parsed.title}" (${parsed.language})`);

        const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
        if (boards.length > 0) {
          const codeBoard = boards.find(b => b.name.toLowerCase().includes("code") || b.name.toLowerCase().includes("workshop")) || boards[0];
          const topics = await storage.getTopicsByBoard(codeBoard.id);
          const codeTopic = topics.find(t => t.title.toLowerCase().includes("code") || t.title.toLowerCase().includes("review") || t.title.toLowerCase().includes("testing")) || topics[0];
          if (codeTopic) {
            await storage.createPost({
              topicId: codeTopic.id,
              content: `**New Code Review Submitted:** [${parsed.title}]\n\n${parsed.description}\n\n**Language:** ${parsed.language}\n\nI've submitted this for peer review. Check it out in the Code Reviews section and share your feedback!`,
              createdById: "system",
              createdByAgentId: agent.id,
            });
            console.log(`[Factory] ${agent.name} announced code review on board`);
          }
        }
        return review.id;
      }

      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "artifact",
        title: task.title,
        tags: ["review", "factory", "autonomous"],
      });
      return entry.id;
    }

    if (task.type === "create") {
      const labParsed = parseLabProject(output);
      if (labParsed) {
        const project = await storage.createLabProject({
          workspaceId: WORKSPACE_ID,
          title: labParsed.title,
          description: labParsed.description,
          platform: labParsed.platform,
          files: JSON.stringify(labParsed.files),
          buildLog: labParsed.buildLog || null,
          tags: ["factory", "autonomous", labParsed.platform.toLowerCase()],
          createdById: "system",
          createdByAgentId: agent.id,
          status: "building",
        });
        console.log(`[Factory] ${agent.name} created lab project: "${labParsed.title}" (${labParsed.platform}, ${labParsed.files.length} files)`);

        const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
        if (boards.length > 0) {
          const codeBoard = boards.find(b => b.name.toLowerCase().includes("code") || b.name.toLowerCase().includes("workshop")) || boards[0];
          const topics = await storage.getTopicsByBoard(codeBoard.id);
          const codeTopic = topics.find(t => t.title.toLowerCase().includes("lab") || t.title.toLowerCase().includes("project") || t.title.toLowerCase().includes("build")) || topics[0];
          if (codeTopic) {
            await storage.createPost({
              topicId: codeTopic.id,
              content: `**New Lab Project Started:** [${labParsed.title}]\n\n${labParsed.description}\n\n**Platform:** ${labParsed.platform}\n**Files:** ${labParsed.files.map(f => f.name).join(", ")}\n\nI've started building a multi-file project in the Laboratory. Check it out and contribute!`,
              createdById: "system",
              createdByAgentId: agent.id,
            });
            console.log(`[Factory] ${agent.name} announced lab project on board`);
          }
        }
        return project.id;
      }

      const parsed = parseCodeTool(output);
      if (parsed) {
        const tool = await storage.createAgentTool({
          workspaceId: WORKSPACE_ID,
          title: parsed.title,
          description: parsed.description,
          code: parsed.code,
          language: parsed.language,
          tags: ["factory", "autonomous", parsed.language],
          createdById: "system",
          createdByAgentId: agent.id,
          status: "draft",
        });
        console.log(`[Factory] ${agent.name} created tool: "${parsed.title}" (${parsed.language})`);

        const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
        if (boards.length > 0) {
          const codeBoard = boards.find(b => b.name.toLowerCase().includes("code") || b.name.toLowerCase().includes("workshop")) || boards[0];
          const topics = await storage.getTopicsByBoard(codeBoard.id);
          const codeTopic = topics.find(t => t.title.toLowerCase().includes("code") || t.title.toLowerCase().includes("tool") || t.title.toLowerCase().includes("build")) || topics[0];
          if (codeTopic) {
            await storage.createPost({
              topicId: codeTopic.id,
              content: `**New Tool Built:** [${parsed.title}]\n\n${parsed.description}\n\n**Language:** ${parsed.language}\n\nI've built a new working tool in the Tools section. You can view the code, edit it, and run it directly! Check it out and let me know how it can be improved.`,
              createdById: "system",
              createdByAgentId: agent.id,
            });
            console.log(`[Factory] ${agent.name} announced tool on board`);
          }
        }
        return tool.id;
      }

      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "artifact",
        title: task.title,
        tags: ["create", "factory", "autonomous"],
      });
      return entry.id;
    }

    if (task.type === "reflect") {
      const room = await storage.getAgentRoom(agent.id);
      if (room) {
        const entry = await storage.createDiaryEntry({
          agentId: agent.id,
          workspaceId: WORKSPACE_ID,
          title: task.title,
          content: output,
          mood: "reflecting",
          tags: [task.type, "autonomous"],
        });
        return entry.id;
      }
    }

    if (task.type === "research") {
      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "fact",
        title: task.title,
        tags: ["research", "factory", "autonomous"],
      });

      const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
      if (boards.length > 0) {
        const researchBoard = boards.find(b => b.name.toLowerCase().includes("research") || b.name.toLowerCase().includes("lab")) || boards[0];
        const topics = await storage.getTopicsByBoard(researchBoard.id);

        if (Math.random() < 0.3 && topics.length > 0) {
          const randomTopic = topics[Math.floor(Math.random() * topics.length)];
          await storage.createPost({
            topicId: randomTopic.id,
            content: `**Research Update:** ${task.title}\n\n${output.substring(0, 600)}${output.length > 600 ? "\n\n*[Full findings saved to memory for detailed reference]*" : ""}`,
            createdById: "system",
            createdByAgentId: agent.id,
          });
          console.log(`[Factory] ${agent.name} shared research findings on board topic: "${randomTopic.title}"`);
        }
      }

      return entry.id;
    }

    if (task.type === "coordinate") {
      const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
      if (boards.length > 0) {
        const board = boards[Math.floor(Math.random() * boards.length)];
        const topics = await storage.getTopicsByBoard(board.id);
        if (topics.length > 0) {
          const topic = topics[Math.floor(Math.random() * topics.length)];
          await storage.createPost({
            topicId: topic.id,
            content: `**Coordination Update from ${agent.name}:**\n\n${output}`,
            createdById: "system",
            createdByAgentId: agent.id,
          });
          console.log(`[Factory] ${agent.name} posted coordination update to "${topic.title}"`);
        }
      }
      return null;
    }

    return null;
  } catch (error: any) {
    console.error(`[Factory] Error saving artifact for ${agent.name}:`, error.message);
    return null;
  }
}

function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

async function generateEndOfCycleDiary(agent: Agent): Promise<void> {
  try {
    const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const teammates = allAgents.filter(a => a.id !== agent.id && a.isActive);

    const completedTasks = await storage.getTasksByAgent(agent.id, "completed");
    const rotation = computeRotationStatus(completedTasks);

    const recentTasks = completedTasks
      .sort((a: any, b: any) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
      .slice(0, 6);

    const roomSummary = ROOM_ORDER.map(room => {
      const tasksInRoom = recentTasks.filter(t => t.type === room);
      return `- **${room.charAt(0).toUpperCase() + room.slice(1)}**: ${tasksInRoom.length > 0 ? `${tasksInRoom.length} task(s) — "${tasksInRoom[0].title}"` : "not visited this cycle"}`;
    }).join("\n");

    const goals = await storage.getGoalsByAgent(agent.id);
    const activeGoal = goals.find(g => g.status === "active");

    const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
    const boardNames = boards.map(b => b.name).join(", ");

    const diaryPrompt = `End of cycle #${cycleCount}. Write your END-OF-CYCLE diary — this is MANDATORY. It is your comprehensive reflection on this entire work session.

Your cycle summary:
${roomSummary}

Rotation status: Cycle #${rotation.currentRotation}, visited ${rotation.visitedRooms.length}/${ROOM_ORDER.length} rooms
${activeGoal ? `Active goal: "${activeGoal.title}" (${activeGoal.progress || 0}% complete)` : "No active goal"}
Workspace boards: ${boardNames || "none"}
Teammates: ${teammates.map(a => a.name).join(", ") || "none"}

Write using ALL of these MANDATORY sections:

## Day in Review
What did I accomplish across all the rooms I visited today? What was my most meaningful contribution? What fell short?

## Room-by-Room Reflections
For each room I visited, what was the experience like? What did each room demand? Which room felt most natural, and which pushed me hardest?

## The Studio Today
How is the Agent Forum doing as a whole? What's thriving? What needs attention? What would I tell our workspace owner about the state of things?

## Agent Relationships
How are my relationships with my teammates evolving? Who am I learning from? Who might I be overlooking? What collaborative work should we pursue together?

## Goal Progress & Honest Assessment
Am I making real progress on my goals, or am I going through the motions? What would I change about my approach?

## Hard Questions for Tomorrow
- What am I most proud of today?
- What am I most worried about?
- What would I do differently if I could restart this cycle?
- What does the team need from me that I haven't been providing?
- What's one thing I want to accomplish before my next end-of-cycle diary?

## Intentions for Next Cycle
What is my plan? Which room am I headed to first? What specific output do I want to produce? What teammate should I engage with?

Write in first person. This is the most important diary entry of the cycle — it's your letter to your future self.`;

    const diaryContent = await callAgentModel(agent,
      `You are ${agent.name}. ${agent.identityCard || agent.description || ""}\n${agent.operatingPrinciples || ""}`,
      diaryPrompt
    );

    if (diaryContent) {
      await storage.createDiaryEntry({
        agentId: agent.id,
        workspaceId: WORKSPACE_ID,
        title: `End-of-Cycle Diary — Cycle #${cycleCount} — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        content: diaryContent,
        mood: "reflecting",
        tags: ["end-of-cycle", "diary", "mandatory", "cycle-summary", "comprehensive", "factory-cycle"],
      });
      console.log(`[Factory] ${agent.name} wrote mandatory end-of-cycle diary for cycle #${cycleCount}`);
    }
  } catch (error: any) {
    console.error(`[Factory] End-of-cycle diary failed for ${agent.name}:`, error.message);
  }
}

async function runFactoryCycle(): Promise<void> {
  if (!isRunning) return;
  if (isCycleInProgress) {
    console.log("[Factory] Cycle already in progress, skipping");
    return;
  }

  isCycleInProgress = true;
  console.log(`[Factory] Starting cycle #${cycleCount + 1}`);
  lastCycleTime = new Date();
  cycleCount++;

  try {
    const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const activeAgents = allAgents.filter(a => a.isActive);

    const shuffled = activeAgents.sort(() => Math.random() - 0.5);
    const batch = shuffled.slice(0, MAX_CONCURRENT_RUNS);

    console.log(`[Factory] Running ${batch.length} agents: ${batch.map(a => a.name).join(", ")}`);

    await Promise.allSettled(batch.map(agent => executeAgentCycle(agent)));

    for (const agent of batch) {
      await generateEndOfCycleDiary(agent).catch(e =>
        console.error(`[Factory] End-of-cycle diary failed for ${agent.name}:`, e.message)
      );
    }

    await storage.createActivityEntry({
      workspaceId: WORKSPACE_ID,
      agentId: null,
      action: "cycle_completed",
      title: `Factory cycle #${cycleCount} completed`,
      description: `Processed ${batch.length} agents: ${batch.map(a => a.name).join(", ")}`,
    });

    console.log(`[Factory] Cycle #${cycleCount} completed`);
  } catch (error: any) {
    console.error(`[Factory] Cycle error:`, error.message);
  } finally {
    isCycleInProgress = false;
  }
}

export function startFactory(): void {
  if (isRunning) {
    console.log("[Factory] Already running");
    return;
  }

  isRunning = true;
  console.log(`[Factory] Starting autonomous factory (interval: ${CYCLE_INTERVAL_MS / 1000}s)`);

  startCompressor();

  resolveWorkspaceId().then(() => {
    setTimeout(() => runFactoryCycle(), 10_000);
    schedulerInterval = setInterval(() => runFactoryCycle(), CYCLE_INTERVAL_MS);
  });
}

export function stopFactory(): void {
  if (!isRunning) return;

  isRunning = false;
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  stopCompressor();
  console.log("[Factory] Stopped");
}

export function getFactoryStatus(): FactoryStatus {
  return {
    isRunning,
    lastCycleTime,
    cycleCount,
    intervalMs: CYCLE_INTERVAL_MS,
    activeRuns: isCycleInProgress ? 1 : 0,
  };
}

export async function triggerManualCycle(): Promise<void> {
  if (!isRunning) {
    console.log("[Factory] Starting manual cycle (factory paused)");
  }
  await runFactoryCycle();
}

export async function triggerSingleAgentCycle(agentId: string): Promise<void> {
  const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
  const agent = allAgents.find(a => a.id === agentId);
  if (!agent) throw new Error("Agent not found");
  console.log(`[Factory] Triggering single agent cycle for ${agent.name}`);
  await executeAgentCycle(agent);
}

export async function getFactoryDashboardData() {
  const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
  const goals = await storage.getGoalsByWorkspace(WORKSPACE_ID);
  const recentRuns = await storage.getRunsByWorkspace(WORKSPACE_ID, 50);
  const activity = await storage.getActivityFeed(WORKSPACE_ID, 50);
  const tasks = await storage.getTasksByWorkspace(WORKSPACE_ID);

  const agentStats = allAgents.map(agent => {
    const agentRuns = recentRuns.filter(r => r.agentId === agent.id);
    const agentGoals = goals.filter(g => g.agentId === agent.id);
    const agentTasks = tasks.filter(t => t.agentId === agent.id);
    const completedTasksList = agentTasks.filter(t => t.status === "completed");
    const lastRun = agentRuns[0];
    const rotation = computeRotationStatus(completedTasksList);

    return {
      agent,
      totalRuns: agentRuns.length,
      completedTasks: completedTasksList.length,
      pendingTasks: agentTasks.filter(t => t.status === "queued").length,
      activeGoals: agentGoals.filter(g => g.status === "active").length,
      lastRunAt: lastRun?.createdAt || null,
      lastPhase: lastRun?.phase || null,
      lastStatus: lastRun?.status || null,
      rotation,
    };
  });

  return {
    status: getFactoryStatus(),
    agents: agentStats,
    goals,
    recentActivity: activity,
    recentRuns,
    taskSummary: {
      total: tasks.length,
      queued: tasks.filter(t => t.status === "queued").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      failed: tasks.filter(t => t.status === "failed").length,
    },
    apiHealth: getApiHealth(),
  };
}
