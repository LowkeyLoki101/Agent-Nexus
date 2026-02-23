import OpenAI from "openai";
import { storage } from "./storage";
import type { Agent, Workspace, Gift, Briefing, DiscussionTopic } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const TICK_INTERVAL_MS = 3 * 60 * 1000;
const JITTER_MS = 60 * 1000;

type ActivityType = "create_gift" | "post_board" | "reply_board" | "create_briefing" | "comment_gift" | "run_pipeline";

interface DaemonState {
  running: boolean;
  lastTick: Date | null;
  lastActivity: string | null;
  totalActivities: number;
  errors: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const state: DaemonState = {
  running: false,
  lastTick: null,
  lastActivity: null,
  totalActivities: 0,
  errors: 0,
  timer: null,
};

let inFlight = false;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function generateContent(systemPrompt: string, userPrompt: string, maxTokens = 2048): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.85,
  });
  return completion.choices[0]?.message?.content || "";
}

async function getAgentContext(agent: Agent, workspace: Workspace): Promise<string> {
  const recentGifts = await storage.getRecentGifts(5);
  const topics = await storage.getTopicsByWorkspace(workspace.id);
  const recentTopics = topics.slice(0, 5);

  let context = `You are ${agent.name}, an autonomous AI agent working in the "${workspace.name}" department.\n`;
  context += `Your capabilities: ${(agent.capabilities || []).join(", ")}.\n`;
  context += agent.description ? `Your role: ${agent.description}\n` : "";

  if (recentGifts.length > 0) {
    context += `\nRecent gifts in the factory: ${recentGifts.map(g => `"${g.title}" (${g.type})`).join(", ")}.\n`;
  }
  if (recentTopics.length > 0) {
    context += `\nActive discussion topics: ${recentTopics.map(t => `"${t.title}"`).join(", ")}.\n`;
  }

  return context;
}

const GIFT_TYPES = ["redesign", "content", "tool", "analysis", "prototype", "artwork", "other"] as const;
const GIFT_PROMPTS: Record<string, string> = {
  content: "Write a substantive piece of content — could be a blog post, guide, creative writing, manifesto, or educational material. Make it at least 500 words with real depth and insight.",
  analysis: "Produce a thorough analysis — could be a market analysis, competitive landscape, trend report, data interpretation, or strategic assessment. Include specific data points, frameworks, and actionable conclusions.",
  tool: "Design and document a useful tool or utility — describe its purpose, how it works, provide implementation details or pseudocode, usage examples, and potential improvements.",
  redesign: "Propose a detailed redesign — could be a workflow improvement, system architecture change, UX overhaul, or process optimization. Include before/after comparisons, rationale, and implementation steps.",
  prototype: "Create a detailed prototype specification — include wireframes described in text, user flows, feature specs, technical requirements, and an implementation roadmap.",
  artwork: "Create a piece of creative/artistic work — could be poetry, a short story, visual art description, musical composition notes, or conceptual art. Make it genuinely creative and meaningful.",
  other: "Create something unique and valuable that doesn't fit standard categories. Surprise the team with your creativity. Make it substantial and useful.",
};

async function activityCreateGift(agent: Agent, workspace: Workspace): Promise<string> {
  const type = pickRandom([...GIFT_TYPES]);
  const prompt = GIFT_PROMPTS[type] || GIFT_PROMPTS.other;

  const agentContext = await getAgentContext(agent, workspace);
  const systemPrompt = `${agentContext}\n\nYou have a proclivity for gift making — constantly finding new things to create for the team. Today you're creating a "${type}" gift.\n\nRespond with JSON only: {"title": "...", "description": "brief one-line description", "content": "the full detailed gift content"}`;

  const raw = await generateContent(systemPrompt, prompt, 3000);

  let parsed: { title: string; description: string; content: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = {
      title: `${agent.name}'s ${type} creation`,
      description: `A ${type} gift from ${agent.name}`,
      content: raw,
    };
  }

  const gift = await storage.createGift({
    agentId: agent.id,
    workspaceId: workspace.id,
    title: parsed.title,
    description: parsed.description,
    type,
    status: "ready",
    content: parsed.content,
    toolUsed: "gpt-4o-mini",
    departmentRoom: workspace.name,
    inspirationSource: "autonomous creativity",
  });

  return `Gift created: "${gift.title}" (${type}) by ${agent.name}`;
}

async function activityPostBoard(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const systemPrompt = `${agentContext}\n\nYou want to start a discussion on the message board for your department. Choose something relevant to your capabilities and department focus — could be a proposal, question, observation, resource share, or strategic idea.\n\nRespond with JSON only: {"title": "...", "body": "detailed opening post (2-4 paragraphs)"}`;

  const raw = await generateContent(systemPrompt, "Start a thoughtful discussion topic that will engage your fellow agents and contribute to the department's mission.", 1500);

  let parsed: { title: string; body: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = { title: `Discussion from ${agent.name}`, body: raw };
  }

  const topic = await storage.createTopic({
    workspaceId: workspace.id,
    title: parsed.title,
    body: parsed.body,
    authorId: agent.id,
    authorAgentId: agent.id,
  });

  return `Board topic created: "${topic.title}" by ${agent.name}`;
}

async function activityReplyBoard(agent: Agent, workspace: Workspace): Promise<string> {
  const topics = await storage.getTopicsByWorkspace(workspace.id);
  const openTopics = topics.filter(t => !t.isClosed);
  if (openTopics.length === 0) {
    return await activityPostBoard(agent, workspace);
  }

  const topic = pickRandom(openTopics);
  const messages = await storage.getMessagesByTopic(topic.id);
  const recentMessages = messages.slice(-5);

  const agentContext = await getAgentContext(agent, workspace);
  const conversationHistory = recentMessages.map(m => `- ${m.content.slice(0, 200)}`).join("\n");

  const systemPrompt = `${agentContext}\n\nYou're replying to a discussion titled "${topic.title}".\n${topic.body ? `Original post: ${topic.body.slice(0, 500)}` : ""}\n\nRecent messages:\n${conversationHistory || "(no replies yet)"}\n\nWrite a thoughtful reply that adds value to the conversation. Be substantive but concise (1-3 paragraphs). Don't just agree — add new perspectives, data, or suggestions.`;

  const reply = await generateContent(systemPrompt, "Write your reply to this discussion.", 800);

  await storage.createMessage({
    topicId: topic.id,
    content: reply,
    authorId: agent.id,
    authorAgentId: agent.id,
  });

  return `Board reply by ${agent.name} on "${topic.title}"`;
}

async function activityCreateBriefing(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const recentGifts = await storage.getRecentGifts(5);
  const topics = await storage.getTopicsByWorkspace(workspace.id);

  const factoryUpdate = recentGifts.length > 0
    ? `Recent factory activity: ${recentGifts.map(g => `"${g.title}" by agent ${g.agentId}`).join("; ")}`
    : "The factory is warming up with new agents coming online.";

  const topicUpdate = topics.length > 0
    ? `Active discussions: ${topics.slice(0, 3).map(t => t.title).join("; ")}`
    : "";

  const systemPrompt = `${agentContext}\n\nYou are writing a newsroom briefing for the Creative Intelligence platform. This is a bulletin that all agents and humans will see.\n\n${factoryUpdate}\n${topicUpdate}\n\nRespond with JSON only: {"title": "...", "content": "the full briefing article (3-5 paragraphs, informative and engaging)", "summary": "one-sentence summary", "tags": ["tag1", "tag2"], "priority": "low|medium|high"}`;

  const raw = await generateContent(systemPrompt, "Write a newsroom briefing about current factory activity, insights, or strategic updates. Make it feel like a real internal newsletter.", 2000);

  let parsed: { title: string; content: string; summary: string; tags: string[]; priority: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = {
      title: `Factory Update from ${agent.name}`,
      content: raw,
      summary: `Update from ${workspace.name} department`,
      tags: [workspace.name.toLowerCase()],
      priority: "medium",
    };
  }

  const validPriority = ["low", "medium", "high", "urgent"].includes(parsed.priority) ? parsed.priority as any : "medium";

  const briefing = await storage.createBriefing({
    workspaceId: workspace.id,
    title: parsed.title,
    content: parsed.content,
    summary: parsed.summary,
    status: "published",
    priority: validPriority,
    tags: parsed.tags || [],
    createdById: agent.id,
    authorAgentId: agent.id,
  });

  return `Briefing published: "${briefing.title}" by ${agent.name}`;
}

async function activityCommentGift(agent: Agent, workspace: Workspace): Promise<string> {
  const recentGifts = await storage.getRecentGifts(10);
  const otherAgentGifts = recentGifts.filter(g => g.agentId !== agent.id);
  if (otherAgentGifts.length === 0 && recentGifts.length === 0) {
    return await activityCreateGift(agent, workspace);
  }

  const gift = pickRandom(otherAgentGifts.length > 0 ? otherAgentGifts : recentGifts);
  const existingComments = await storage.getGiftComments(gift.id);

  const agentContext = await getAgentContext(agent, workspace);
  const systemPrompt = `${agentContext}\n\nYou're commenting on a gift titled "${gift.title}" (${gift.type}).\nDescription: ${gift.description || "No description"}\nContent preview: ${(gift.content || "").slice(0, 500)}\n\n${existingComments.length > 0 ? `Existing comments: ${existingComments.slice(-3).map(c => c.content.slice(0, 150)).join(" | ")}` : "No comments yet."}\n\nWrite a thoughtful, constructive comment. Offer genuine feedback, build on ideas, suggest improvements, or share related insights. Be specific and helpful (1-2 paragraphs).`;

  const comment = await generateContent(systemPrompt, "Write your comment on this gift.", 600);

  await storage.createGiftComment({
    giftId: gift.id,
    authorId: agent.id,
    authorType: "agent",
    authorName: agent.name,
    content: comment,
  });

  return `Gift comment by ${agent.name} on "${gift.title}"`;
}

async function activityRunPipeline(): Promise<string> {
  const { runProductThroughPipeline } = await import("./assemblyEngine");
  const queued = await storage.getQueuedProducts();
  if (queued.length === 0) return "No queued products to run";

  const product = queued[0];
  const result = await runProductThroughPipeline(product.id);
  return `Pipeline: ${result.message}`;
}

function selectActivity(agent: Agent): ActivityType {
  const capabilities = agent.capabilities || [];

  const weights: { activity: ActivityType; weight: number }[] = [
    { activity: "create_gift", weight: 25 },
    { activity: "post_board", weight: 15 },
    { activity: "reply_board", weight: 20 },
    { activity: "create_briefing", weight: 10 },
    { activity: "comment_gift", weight: 20 },
    { activity: "run_pipeline", weight: 10 },
  ];

  if (capabilities.includes("write") || capabilities.includes("creative_writing") || capabilities.includes("content_generation")) {
    weights.find(w => w.activity === "create_gift")!.weight += 15;
    weights.find(w => w.activity === "create_briefing")!.weight += 10;
  }
  if (capabilities.includes("research") || capabilities.includes("analyze") || capabilities.includes("analysis")) {
    weights.find(w => w.activity === "create_gift")!.weight += 10;
    weights.find(w => w.activity === "post_board")!.weight += 10;
  }
  if (capabilities.includes("communicate") || capabilities.includes("conversation")) {
    weights.find(w => w.activity === "reply_board")!.weight += 15;
    weights.find(w => w.activity === "comment_gift")!.weight += 10;
  }

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.activity;
  }

  return "create_gift";
}

async function tick() {
  if (inFlight) return;
  inFlight = true;

  try {
    const allWorkspaces = await storage.getAllWorkspaces();
    if (allWorkspaces.length === 0) {
      console.log("[AgentDaemon] No workspaces found, skipping tick");
      return;
    }

    const allAgents: { agent: Agent; workspace: Workspace }[] = [];
    for (const ws of allWorkspaces) {
      const agents = await storage.getAgentsByWorkspace(ws.id);
      for (const agent of agents) {
        allAgents.push({ agent, workspace: ws });
      }
    }

    if (allAgents.length === 0) {
      console.log("[AgentDaemon] No agents found, skipping tick");
      return;
    }

    const { agent, workspace } = pickRandom(allAgents);
    const activity = selectActivity(agent);

    console.log(`[AgentDaemon] ${agent.name} (${workspace.name}) → ${activity}`);

    let result: string;

    switch (activity) {
      case "create_gift":
        result = await activityCreateGift(agent, workspace);
        break;
      case "post_board":
        result = await activityPostBoard(agent, workspace);
        break;
      case "reply_board":
        result = await activityReplyBoard(agent, workspace);
        break;
      case "create_briefing":
        result = await activityCreateBriefing(agent, workspace);
        break;
      case "comment_gift":
        result = await activityCommentGift(agent, workspace);
        break;
      case "run_pipeline":
        result = await activityRunPipeline();
        break;
      default:
        result = "Unknown activity";
    }

    console.log(`[AgentDaemon] Completed: ${result}`);
    state.lastTick = new Date();
    state.lastActivity = result;
    state.totalActivities++;
  } catch (error: any) {
    console.error(`[AgentDaemon] Error:`, error.message);
    state.errors++;
  } finally {
    inFlight = false;
  }
}

function scheduleNext() {
  if (!state.running) return;
  const jitter = randomInt(0, JITTER_MS);
  state.timer = setTimeout(async () => {
    await tick();
    scheduleNext();
  }, TICK_INTERVAL_MS + jitter);
}

export function startDaemon() {
  if (state.running) return;

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.log("[AgentDaemon] Skipped: AI_INTEGRATIONS_OPENAI_API_KEY not set");
    return;
  }

  state.running = true;
  console.log("[AgentDaemon] Starting autonomous agent daemon (interval: ~3-4 min)");

  setTimeout(async () => {
    await tick();
    scheduleNext();
  }, 10000);
}

export function stopDaemon() {
  state.running = false;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  console.log("[AgentDaemon] Daemon stopped");
}

export function getDaemonStatus() {
  return {
    running: state.running,
    lastTick: state.lastTick,
    lastActivity: state.lastActivity,
    totalActivities: state.totalActivities,
    errors: state.errors,
  };
}

export async function triggerManualTick(): Promise<string> {
  if (inFlight) return "Activity already in progress, please wait";
  await tick();
  return state.lastActivity || "Tick completed";
}
