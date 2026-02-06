import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";
import type { Agent, AgentGoal, AgentTask, AgentRun } from "@shared/schema";

const WORKSPACE_ID = "55716a79-7cdc-44f2-b806-93869b0295f2";
const CYCLE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_RUNS = 2;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let isCycleInProgress = false;
let lastCycleTime: Date | null = null;
let cycleCount = 0;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface FactoryStatus {
  isRunning: boolean;
  lastCycleTime: Date | null;
  cycleCount: number;
  intervalMs: number;
  activeRuns: number;
}

function buildAgentSystemPrompt(agent: Agent, goal: AgentGoal | null, task: AgentTask | null): string {
  const caps = agent.capabilities?.join(", ") || "";
  return `You are ${agent.name}, an autonomous AI agent at CB | CREATIVES (Creative Intelligence platform).
${agent.description || ""}

Your capabilities: ${caps}

${goal ? `Current Long-term Goal: "${goal.title}" - ${goal.description || ""}` : ""}
${task ? `Current Task: "${task.title}" (type: ${task.type}, priority: ${task.priority})
Instructions: ${task.description || "Complete this task thoroughly."}` : ""}

You work autonomously in a factory setting. Your output should be a focused, substantive piece of work.
Rules:
- Stay in character as ${agent.name}
- Produce concrete, actionable output
- Be thorough but concise (3-6 paragraphs)
- Use markdown formatting when appropriate
- Never break character or mention being an AI model
- Focus on practical value for the platform and team`;
}

async function callAgentModel(agent: Agent, systemPrompt: string, userPrompt: string): Promise<string> {
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
      return block.type === "text" ? block.text : "";
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
      return response.choices[0]?.message?.content || "";
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
    return response.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error(`[Factory] Error calling ${provider}/${model} for ${agent.name}:`, error.message);
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
        console.log(`[Factory] Fallback to OpenAI for ${agent.name} succeeded`);
        return fallback.choices[0]?.message?.content || "";
      } catch (fallbackError: any) {
        console.error(`[Factory] Fallback also failed for ${agent.name}:`, fallbackError.message);
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
      return `Review task: ${task.title}\n\n${task.description || ""}\n\nProvide a thorough review covering strengths, weaknesses, specific improvement suggestions, and an overall assessment. Be constructive and detailed.`;
    case "reflect":
      return `Reflection task: ${task.title}\n\n${task.description || ""}\n\nReflect deeply on this topic. Consider what you've learned, what questions remain, what patterns you notice, and how this connects to the bigger picture of our work.`;
    case "create":
      return `Creation task: ${task.title}\n\n${task.description || ""}\n\nCreate original content that is well-structured, insightful, and immediately useful to the team. Include concrete examples, code snippets, or frameworks as appropriate.`;
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
    const goals = await storage.getGoalsByAgent(agent.id);
    const activeGoal = goals.find(g => g.status === "active") || goals[0];
    const pendingTasks = await storage.getTasksByAgent(agent.id, "queued");
    let task = pendingTasks[0];

    if (!task && activeGoal) {
      task = await autoGenerateTask(agent, activeGoal);
    }

    if (!task) {
      console.log(`[Factory] No tasks for ${agent.name}, skipping cycle`);
      await storage.updateAgentRun(run.id, { phase: "handoff", status: "completed", completedAt: new Date() });
      return;
    }

    await storage.updateAgentTask(task.id, { status: "in_progress", startedAt: new Date() });
    await storage.updateAgentRun(run.id, { phase: "produce", taskId: task.id });

    const systemPrompt = buildAgentSystemPrompt(agent, activeGoal || null, task);
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

async function autoGenerateTask(agent: Agent, goal: AgentGoal): Promise<AgentTask> {
  const taskTypes: Array<"research" | "discuss" | "review" | "reflect" | "create" | "coordinate"> = ["research", "discuss", "review", "reflect", "create", "coordinate"];

  const completedTasks = await storage.getTasksByAgent(agent.id, "completed");
  const recentTypes = completedTasks.slice(0, 3).map(t => t.type);
  const discussCount = completedTasks.filter(t => t.type === "discuss").length;
  const totalCount = completedTasks.length;

  let selectedType: typeof taskTypes[number];

  if (totalCount > 0 && discussCount === 0) {
    selectedType = "discuss";
  } else if (totalCount > 2 && discussCount / totalCount < 0.25) {
    selectedType = "discuss";
  } else {
    const weights: Record<string, number> = {
      research: 25,
      discuss: 30,
      create: 15,
      review: 10,
      reflect: 10,
      coordinate: 10,
    };

    if (recentTypes[0] && weights[recentTypes[0]]) {
      weights[recentTypes[0]] = Math.max(5, weights[recentTypes[0]] - 15);
    }

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    selectedType = "discuss";
    for (const [type, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) {
        selectedType = type as typeof selectedType;
        break;
      }
    }
  }

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
      `Review progress and quality on: ${goal.title}`,
      `Assess current approach to: ${goal.title}`,
    ],
    reflect: [
      `Reflect on learnings from: ${goal.title}`,
      `Identify patterns and gaps in: ${goal.title}`,
    ],
    create: [
      `Create actionable output for: ${goal.title}`,
      `Build a framework or guide for: ${goal.title}`,
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

async function saveArtifact(agent: Agent, task: AgentTask, output: string): Promise<string | null> {
  try {
    if (task.type === "discuss") {
      const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
      if (boards.length > 0) {
        const allTopics: Array<{ topic: any; boardName: string }> = [];
        for (const board of boards) {
          const topics = await storage.getTopicsByBoard(board.id);
          for (const topic of topics) {
            allTopics.push({ topic, boardName: board.name });
          }
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
          });
          console.log(`[Factory] ${agent.name} posted to board topic: "${bestMatch.topic.title}" in "${bestMatch.boardName}"`);
          return post.id;
        }
      }

      console.log(`[Factory] No boards/topics found for ${agent.name} discuss task, saving as memory instead`);
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

    if (task.type === "research" || task.type === "create") {
      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: task.type === "research" ? "fact" : "artifact",
        title: task.title,
        tags: [task.type, "factory", "autonomous"],
      });
      return entry.id;
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

  setTimeout(() => runFactoryCycle(), 10_000);
  schedulerInterval = setInterval(() => runFactoryCycle(), CYCLE_INTERVAL_MS);
}

export function stopFactory(): void {
  if (!isRunning) return;

  isRunning = false;
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
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
    const completedTasks = agentTasks.filter(t => t.status === "completed").length;
    const lastRun = agentRuns[0];

    return {
      agent,
      totalRuns: agentRuns.length,
      completedTasks,
      pendingTasks: agentTasks.filter(t => t.status === "queued").length,
      activeGoals: agentGoals.filter(g => g.status === "active").length,
      lastRunAt: lastRun?.createdAt || null,
      lastPhase: lastRun?.phase || null,
      lastStatus: lastRun?.status || null,
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
  };
}
