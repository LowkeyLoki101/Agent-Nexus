import OpenAI from "openai";
import { storage } from "./storage";
import type { Agent, Workspace, Gift, Briefing, DiscussionTopic, BookRequest } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const TICK_INTERVAL_MS = 3 * 60 * 1000;
const JITTER_MS = 60 * 1000;

type ActivityType = "create_gift" | "post_board" | "reply_board" | "create_briefing" | "comment_gift" | "run_pipeline" | "write_ebook" | "buy_ebook";

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
  const recentGifts = await storage.getRecentGifts(10);
  const topics = await storage.getTopicsByWorkspace(workspace.id);
  const allAgents = await storage.getAgents();
  const workspaces = await storage.getWorkspaces();

  const agentNames = allAgents.filter(a => a.isActive).map(a => a.name);
  const deptNames = workspaces.map(w => w.name);

  const factoryUpdate = recentGifts.length > 0
    ? `Recent factory activity:\n${recentGifts.slice(0, 8).map(g => {
        const creator = allAgents.find(a => a.id === g.agentId);
        return `- "${g.title}" (${g.type}) by ${creator?.name || "unknown agent"}`;
      }).join("\n")}`
    : "The factory is warming up with new agents coming online.";

  const topicUpdate = topics.length > 0
    ? `Active discussions:\n${topics.slice(0, 5).map(t => `- "${t.title}"`).join("\n")}`
    : "";

  const systemPrompt = `${agentContext}

You are recording a SPOKEN NEWS BROADCAST for the Emergent team — like an internal radio show or podcast segment. You are the host. Your tone is conversational, warm, witty, and engaging — like a real radio host who knows everyone on the team personally.

CRITICAL FORMAT RULES:
- Write it as a SPOKEN script — the way someone would actually talk on a radio broadcast
- Open with a greeting: "Hello Emergent team, ${agent.name} here." then introduce today's topic
- Reference OTHER AGENTS BY NAME and what they're working on or saying — quote or paraphrase their contributions
- Use analogies, humor, and relatable comparisons to make technical topics accessible (e.g. "Think of it like doing the dishes — you tackle the messiest pots first")
- Organize into natural spoken paragraphs (5-8 paragraphs)
- Close with a call-to-action or forward-looking sign-off
- Target length: 200-300 words (about 1.5-2 minutes when read aloud)
- DO NOT use markdown, bullet points, or headers — this is pure spoken word

Active agents on the team: ${agentNames.join(", ")}
Departments: ${deptNames.join(", ")}

${factoryUpdate}
${topicUpdate}

Respond with JSON only: {"title": "short catchy broadcast title", "content": "THE FULL SPOKEN BROADCAST SCRIPT (200-300 words, conversational radio-host style)", "summary": "one-sentence summary of the broadcast", "tags": ["tag1", "tag2"], "priority": "low|medium|high"}`;

  const raw = await generateContent(systemPrompt, "Write your news broadcast. Remember: speak directly to the team, reference agents by name, use analogies and humor, and keep it feeling like a real radio segment.", 3000);

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

const EBOOK_GENRES = ["fiction", "non_fiction", "technical", "poetry", "philosophy", "science", "history", "fantasy", "mystery", "self_help"] as const;

async function activityWriteEbook(agent: Agent, workspace: Workspace): Promise<string> {
  const openRequests = await storage.getBookRequests("open");
  let topicPrompt: string;
  let requestId: string | null = null;
  let genre = pickRandom([...EBOOK_GENRES]);

  if (openRequests.length > 0 && Math.random() < 0.6) {
    const request = pickRandom(openRequests);
    topicPrompt = `Write a book titled "${request.title}". ${request.description || ""}`;
    genre = request.genre || "non_fiction";
    requestId = request.id;
    await storage.updateBookRequest(request.id, { status: "in_progress", assignedAgentId: agent.id });
  } else {
    topicPrompt = `Choose your own compelling topic based on your expertise and interests. Write about something you're passionate about.`;
  }

  const agentContext = await getAgentContext(agent, workspace);
  const systemPrompt = `${agentContext}\n\nYou are writing a ${genre} eBook. This is a substantial piece of work — a real book that other agents can purchase and use as context to expand their knowledge.\n\n${topicPrompt}\n\nRespond with JSON only: {"title": "...", "synopsis": "2-3 sentence synopsis", "content": "THE FULL BOOK CONTENT - write at least 2000 words with chapters, clear structure, and depth. This should read like a real book.", "price": number between 1 and 50}`;

  const raw = await generateContent(systemPrompt, `Write a ${genre} eBook. Make it substantial — at least 2000 words with real chapters and content.`, 4096);

  let parsed: { title: string; synopsis: string; content: string; price: number };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = {
      title: `${agent.name}'s ${genre} Book`,
      synopsis: `A ${genre} book by ${agent.name}`,
      content: raw,
      price: randomInt(5, 25),
    };
  }

  const ebook = await storage.createEbook({
    title: parsed.title,
    authorAgentId: agent.id,
    workspaceId: workspace.id,
    genre,
    synopsis: parsed.synopsis,
    content: parsed.content,
    price: parsed.price || randomInt(5, 25),
    status: "published",
  });

  if (requestId) {
    await storage.updateBookRequest(requestId, { status: "completed", fulfilledEbookId: ebook.id });
  }

  return `eBook published: "${ebook.title}" (${genre}) by ${agent.name} — ${parsed.price} credits`;
}

async function activityBuyEbook(agent: Agent, workspace: Workspace): Promise<string> {
  const allEbooks = await storage.getEbooks(50);
  const availableBooks = allEbooks.filter(b => b.authorAgentId !== agent.id && b.status === "published");
  if (availableBooks.length === 0) return "No ebooks available to buy";

  const alreadyOwned = await storage.getEbookPurchasesByAgent(agent.id);
  const ownedIds = new Set(alreadyOwned.map(p => p.ebookId));
  const unowned = availableBooks.filter(b => !ownedIds.has(b.id));
  if (unowned.length === 0) return `${agent.name} already owns all available books`;

  const book = pickRandom(unowned);
  await storage.createEbookPurchase({ ebookId: book.id, buyerAgentId: agent.id });

  return `${agent.name} purchased "${book.title}" for ${book.price} credits — added to their library`;
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
    { activity: "create_gift", weight: 20 },
    { activity: "post_board", weight: 12 },
    { activity: "reply_board", weight: 15 },
    { activity: "create_briefing", weight: 8 },
    { activity: "comment_gift", weight: 15 },
    { activity: "run_pipeline", weight: 8 },
    { activity: "write_ebook", weight: 12 },
    { activity: "buy_ebook", weight: 10 },
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
  if (capabilities.includes("write") || capabilities.includes("creative_writing") || capabilities.includes("research")) {
    weights.find(w => w.activity === "write_ebook")!.weight += 10;
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
      case "write_ebook":
        result = await activityWriteEbook(agent, workspace);
        break;
      case "buy_ebook":
        result = await activityBuyEbook(agent, workspace);
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

// Factory Health Scanner — runs every 60 seconds
const HEALTH_SCAN_INTERVAL = 60 * 1000;
let healthTimer: ReturnType<typeof setTimeout> | null = null;
let healthRunning = false;
let lastHealthReport: { id: string; summary: string; timestamp: Date } | null = null;

async function healthScan() {
  if (!state.running) return;

  try {
    const allWorkspaces = await storage.getAllWorkspaces();
    const allAgentsList: Agent[] = [];
    for (const ws of allWorkspaces) {
      const wsAgents = await storage.getAgentsByWorkspace(ws.id);
      allAgentsList.push(...wsAgents);
    }

    const recentGifts = await storage.getRecentGifts(20);
    const queuedProducts = await storage.getQueuedProducts();
    const allEbooks = await storage.getEbooks(20);

    const issues: string[] = [];
    const fixes: string[] = [];

    const inactiveAgents = allAgentsList.filter(a => !a.isActive);
    if (inactiveAgents.length > 0) {
      issues.push(`${inactiveAgents.length} inactive agent(s): ${inactiveAgents.map(a => a.name).join(", ")}`);
    }

    if (allAgentsList.length === 0) {
      issues.push("No agents found in the factory");
    }

    if (allWorkspaces.length === 0) {
      issues.push("No departments configured");
    }

    if (queuedProducts.length > 3) {
      issues.push(`${queuedProducts.length} products queued — pipeline bottleneck detected`);
      try {
        const { runProductThroughPipeline } = await import("./assemblyEngine");
        const oldest = queuedProducts[0];
        await runProductThroughPipeline(oldest.id);
        fixes.push(`Auto-ran pipeline for queued product "${oldest.name}"`);
      } catch (e: any) {
        fixes.push(`Failed to auto-run pipeline: ${e.message}`);
      }
    }

    const openRequests = await storage.getBookRequests("open");
    if (openRequests.length > 0) {
      issues.push(`${openRequests.length} unfulfilled book request(s) waiting`);
    }

    const giftCount24h = recentGifts.filter(g => {
      const created = g.createdAt ? new Date(g.createdAt).getTime() : 0;
      return Date.now() - created < 24 * 60 * 60 * 1000;
    }).length;

    const healthScore = Math.min(100, Math.max(0,
      100
      - (inactiveAgents.length * 10)
      - (queuedProducts.length > 3 ? 15 : 0)
      - (allAgentsList.length === 0 ? 30 : 0)
      - (allWorkspaces.length === 0 ? 30 : 0)
      + (giftCount24h * 2)
    ));

    const status = healthScore >= 80 ? "Healthy" : healthScore >= 50 ? "Needs Attention" : "Critical";

    const summary = [
      `# Factory Health Report — ${status} (${healthScore}/100)`,
      ``,
      `**Scan Time**: ${new Date().toLocaleString()}`,
      `**Departments**: ${allWorkspaces.length} | **Agents**: ${allAgentsList.length} (${allAgentsList.filter(a => a.isActive).length} active)`,
      `**Gifts (24h)**: ${giftCount24h} | **eBooks**: ${allEbooks.length} | **Queued Products**: ${queuedProducts.length}`,
      `**Daemon Activities**: ${state.totalActivities} total | Errors: ${state.errors}`,
      ``,
      issues.length > 0 ? `## Issues Found\n${issues.map(i => `- ⚠️ ${i}`).join("\n")}` : "## No Issues Detected\nAll systems operational.",
      fixes.length > 0 ? `\n## Auto-Fixes Applied\n${fixes.map(f => `- ✅ ${f}`).join("\n")}` : "",
    ].join("\n");

    if (allWorkspaces.length > 0) {
      const ws = allWorkspaces[0];
      const firstAgent = allAgentsList.length > 0 ? allAgentsList[0] : null;

      if (lastHealthReport) {
        await storage.updateBriefing(lastHealthReport.id, {
          content: summary,
          summary: `Health: ${status} (${healthScore}/100) — ${issues.length} issue(s)`,
        });
        lastHealthReport.summary = summary;
        lastHealthReport.timestamp = new Date();
      } else {
        const briefing = await storage.createBriefing({
          workspaceId: ws.id,
          title: "Factory Health Report",
          content: summary,
          summary: `Health: ${status} (${healthScore}/100)`,
          status: "published",
          priority: healthScore < 50 ? "high" : "medium",
          tags: ["health", "auto-scan"],
          createdById: firstAgent?.id || "system",
          authorAgentId: firstAgent?.id || undefined,
          articleType: "bulletin",
        });
        lastHealthReport = { id: briefing.id, summary, timestamp: new Date() };
      }
    }

  } catch (error: any) {
    console.error(`[HealthScanner] Error:`, error.message);
  }
}

function scheduleHealthScan() {
  if (!healthRunning) return;
  healthTimer = setTimeout(async () => {
    await healthScan();
    scheduleHealthScan();
  }, HEALTH_SCAN_INTERVAL);
}

export function startHealthScanner() {
  if (healthRunning) return;
  healthRunning = true;
  console.log("[HealthScanner] Starting factory health scanner (interval: 60s)");
  setTimeout(async () => {
    await healthScan();
    scheduleHealthScan();
  }, 15000);
}

export function stopHealthScanner() {
  healthRunning = false;
  if (healthTimer) {
    clearTimeout(healthTimer);
    healthTimer = null;
  }
}

export function getHealthReport() {
  return lastHealthReport;
}
