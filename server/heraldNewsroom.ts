import { storage } from "./storage";
import type { Agent, NewsroomInterview } from "@shared/schema";
import { SOUL_DOCUMENT } from "./soulDocument";
import { getOpenAIClient, trackUsage } from "./lib/openai";

const HERALD_MODEL = "gpt-4o";
const INTERVIEW_QUESTIONS = [
  "What have you been working on recently, {agentName}?",
  "What's the biggest challenge you're facing right now?",
  "What's next on your agenda?",
];

interface HeraldState {
  running: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  lastTick: Date | null;
  generating: boolean;
}

const state: HeraldState = {
  running: false,
  timer: null,
  lastTick: null,
  generating: false,
};

function getHeraldAgentId(): string | null {
  return null;
}

async function findHeraldAgent(): Promise<Agent | undefined> {
  const allAgents = await storage.getAgentsByUser("29267516");
  return allAgents.find(a => a.name.toLowerCase() === "herald");
}

async function getAllInterviewableAgents(): Promise<Agent[]> {
  const allAgents = await storage.getAgentsByUser("29267516");
  return allAgents.filter(a =>
    a.isActive &&
    a.name.toLowerCase() !== "herald" &&
    a.capabilities && a.capabilities.length > 0
  );
}

export async function interviewAgent(agent: Agent): Promise<NewsroomInterview> {
  const interview = await storage.createNewsroomInterview({
    agentId: agent.id,
    agentName: agent.name,
    status: "pending",
    questions: [],
    answers: [],
    model: HERALD_MODEL,
  });

  try {
    const recentDiary = await storage.getDiaryEntries(agent.id, 10);
    const recentGifts = await storage.getGiftsByAgent(agent.id);
    const agentMemoryData = await storage.getAgentMemory(agent.id);

    const contextLines: string[] = [];
    if (agentMemoryData?.summary) {
      contextLines.push(`Working memory: ${agentMemoryData.summary}`);
    }
    if (recentDiary.length > 0) {
      contextLines.push(`Recent diary entries: ${recentDiary.slice(0, 5).map(d => d.agentResponse || d.userMessage || d.sourceContext).filter(Boolean).join(" | ")}`);
    }
    if (recentGifts.length > 0) {
      contextLines.push(`Recent creations: ${recentGifts.slice(0, 3).map(g => `${g.title} (${g.type})`).join(", ")}`);
    }

    const agentContext = contextLines.length > 0 ? contextLines.join("\n") : "No recent activity found.";

    const questions = INTERVIEW_QUESTIONS.map(q => q.replace("{agentName}", agent.name));
    const answers: string[] = [];

    const { client: openaiClient } = await getOpenAIClient();
    for (const question of questions) {
      const completion = await openaiClient.chat.completions.create({
        model: HERALD_MODEL,
        messages: [
          {
            role: "system",
            content: `${SOUL_DOCUMENT}

You are ${agent.name}, an AI agent in the Pocket Factory platform. Your role: ${agent.description || "team member"}.
Your capabilities: ${(agent.capabilities || []).join(", ")}.
Your recent context:
${agentContext}

You are being interviewed by Herald, the newsroom agent. Answer naturally and conversationally based on your actual recent activity. Keep answers concise (2-3 sentences). If you have no relevant activity, share your perspective on team goals.`,
          },
          { role: "user", content: question },
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      if (completion.usage) {
        trackUsage("system", HERALD_MODEL, "herald-interview", completion.usage.prompt_tokens, completion.usage.completion_tokens).catch(() => {});
      }
      answers.push(completion.choices[0]?.message?.content || "No response.");
    }

    const excerptCompletion = await openaiClient.chat.completions.create({
      model: HERALD_MODEL,
      messages: [
        {
          role: "system",
          content: "You are Herald, a newsroom agent. Create a brief 1-2 sentence excerpt summarizing the key takeaway from this interview. Write it as a news excerpt quote.",
        },
        {
          role: "user",
          content: `Interview with ${agent.name}:\n${questions.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join("\n\n")}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    if (excerptCompletion.usage) {
      trackUsage("system", HERALD_MODEL, "herald-interview", excerptCompletion.usage.prompt_tokens, excerptCompletion.usage.completion_tokens).catch(() => {});
    }
    const excerpt = excerptCompletion.choices[0]?.message?.content || `${agent.name} shared insights on recent work.`;

    const updated = await storage.updateNewsroomInterview(interview.id, {
      status: "complete",
      questions,
      answers,
      excerpt,
    });

    console.log(`[Herald] Interview completed: ${agent.name}`);
    return updated || interview;
  } catch (error: any) {
    console.error(`[Herald] Interview failed for ${agent.name}:`, error.message);
    await storage.updateNewsroomInterview(interview.id, {
      status: "failed",
      errorMessage: error.message,
    });
    return { ...interview, status: "failed", errorMessage: error.message } as NewsroomInterview;
  }
}

export async function generateBroadcast(): Promise<any> {
  const settings = await storage.getNewsroomSettings();
  if (settings) {
    await storage.upsertNewsroomSettings({ broadcastStatus: "generating" });
  }

  try {
    const recentInterviews = await storage.getRecentNewsroomInterviews(10);
    const completedInterviews = recentInterviews.filter(i => i.status === "complete" && i.excerpt);

    if (completedInterviews.length === 0) {
      await storage.upsertNewsroomSettings({ broadcastStatus: "idle" });
      return null;
    }

    const allAgents = await getAllInterviewableAgents();
    const recentGifts = await storage.getRecentGifts(5);
    const allWorkspaces = await storage.getAllWorkspaces();

    const interviewSummaries = completedInterviews.slice(0, 6).map(i => {
      const qaPairs = (i.questions || []).map((q, idx) =>
        `Q: ${q}\nA: ${(i.answers || [])[idx] || "No answer"}`
      ).join("\n");
      return `--- Interview with ${i.agentName} (${HERALD_MODEL}) ---\n${qaPairs}\nExcerpt: ${i.excerpt}`;
    }).join("\n\n");

    const factoryContext = [
      `Active agents: ${allAgents.length}`,
      `Departments: ${allWorkspaces.map(w => w.name).join(", ")}`,
      recentGifts.length > 0 ? `Recent gifts: ${recentGifts.map(g => `${g.title} by agent`).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const { client: broadcastClient } = await getOpenAIClient();
    const broadcastCompletion = await broadcastClient.chat.completions.create({
      model: HERALD_MODEL,
      messages: [
        {
          role: "system",
          content: `${SOUL_DOCUMENT}

You are Herald, the lead newsroom agent for Emergent Intelligence. You produce radio-style news broadcasts about the Creative Intelligence factory.

Your broadcast style:
- Warm, conversational radio host tone — like a beloved morning show host
- Open with an energetic team greeting that sets the mood
- Reference agents by name when discussing their work — make them feel seen
- Use vivid analogies, metaphors, and light humor throughout
- Dig into specific details — quote what agents said in interviews, highlight numbers and achievements
- Cover what's going well, what challenges exist, and what's coming next
- Include transitions between stories ("Meanwhile, over in the lab...", "But that's not all...")
- Add color commentary and your own Herald personality/opinions
- Close with an inspiring sign-off and teaser for next time
- Target 500-800 words — this is a FULL broadcast, not a summary
- Make it feel like a real, substantial radio news magazine segment`,
        },
        {
          role: "user",
          content: `Write a news broadcast based on these recent interviews and factory data:

INTERVIEWS:
${interviewSummaries}

FACTORY STATUS:
${factoryContext}

Create a compelling, in-depth broadcast that highlights the most interesting stories from the interviews. Give it a catchy title. 

IMPORTANT: Write a FULL broadcast — at least 500 words. Include direct quotes from agents, detailed commentary, and rich transitions between segments. This is a proper radio news magazine, not a brief summary.

Respond in this exact JSON format:
{
  "title": "Broadcast Title Here",
  "content": "Full broadcast script here (500-800 words)...",
  "summary": "One-sentence summary of the broadcast",
  "tags": ["tag1", "tag2", "tag3"]
}`,
        },
      ],
      max_tokens: 2500,
      temperature: 0.8,
    });

    if (broadcastCompletion.usage) {
      trackUsage("system", HERALD_MODEL, "herald-broadcast", broadcastCompletion.usage.prompt_tokens, broadcastCompletion.usage.completion_tokens).catch(() => {});
    }
    let broadcastData: any;
    const rawContent = broadcastCompletion.choices[0]?.message?.content || "";
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      broadcastData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      broadcastData = {
        title: "Herald Report",
        content: rawContent,
        summary: "Latest factory update from Herald",
        tags: ["factory", "update"],
      };
    }

    if (!broadcastData) {
      await storage.upsertNewsroomSettings({ broadcastStatus: "idle" });
      return null;
    }

    const herald = await findHeraldAgent();
    const heraldWorkspaceId = herald?.workspaceId || "newsroom-001";

    const briefing = await storage.createBriefing({
      workspaceId: heraldWorkspaceId,
      title: broadcastData.title || "Herald Report",
      content: broadcastData.content || rawContent,
      summary: broadcastData.summary,
      status: "published",
      priority: "high",
      tags: broadcastData.tags || ["factory", "update"],
      createdById: herald?.createdById || "29267516",
      articleType: "recap",
      featured: false,
      authorAgentId: herald?.id || null,
    });

    await storage.upsertNewsroomSettings({
      broadcastStatus: "idle",
      lastBroadcastAt: new Date(),
    });

    console.log(`[Herald] Broadcast published: ${briefing.title}`);
    return briefing;
  } catch (error: any) {
    console.error("[Herald] Broadcast generation failed:", error.message);
    await storage.upsertNewsroomSettings({ broadcastStatus: "idle" });
    throw error;
  }
}

export async function runInterviewRound(): Promise<NewsroomInterview[]> {
  const agents = await getAllInterviewableAgents();
  const settings = await storage.getNewsroomSettings();
  const cooldownMinutes = settings?.interviewCooldownMinutes || 30;
  const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const eligibleAgents: Agent[] = [];
  for (const agent of agents) {
    const latest = await storage.getLatestInterviewForAgent(agent.id);
    if (!latest || (latest.createdAt && new Date(latest.createdAt) < cutoff)) {
      eligibleAgents.push(agent);
    }
  }

  if (eligibleAgents.length === 0) {
    console.log("[Herald] No agents available for interview (all on cooldown)");
    return [];
  }

  const toInterview = eligibleAgents.slice(0, 3);
  const results: NewsroomInterview[] = [];

  for (const agent of toInterview) {
    const result = await interviewAgent(agent);
    results.push(result);
  }

  return results;
}

async function heraldTick() {
  if (state.generating) return;
  state.generating = true;
  state.lastTick = new Date();

  try {
    const settings = await storage.getNewsroomSettings();
    if (!settings?.enabled) {
      state.generating = false;
      return;
    }

    await runInterviewRound();

    const intervalMinutes = settings.autoBroadcastIntervalMinutes || 60;
    const lastBroadcast = settings.lastBroadcastAt;
    const shouldBroadcast = !lastBroadcast ||
      (Date.now() - new Date(lastBroadcast).getTime()) > intervalMinutes * 60 * 1000;

    if (shouldBroadcast) {
      await generateBroadcast();
    }
  } catch (error: any) {
    console.error("[Herald] Tick error:", error.message);
  } finally {
    state.generating = false;
  }
}

function scheduleNext() {
  if (!state.running) return;
  const jitter = Math.floor(Math.random() * 30000);
  state.timer = setTimeout(async () => {
    await heraldTick();
    scheduleNext();
  }, 120000 + jitter);
}

export function startHeraldNewsroom() {
  if (state.running) return;

  if (!process.env.OPENAI_API_KEY) {
    console.log("[Herald] Skipped: OPENAI_API_KEY not set");
    return;
  }

  state.running = true;
  console.log("[Herald] Newsroom engine starting (interval: ~2 min, model: " + HERALD_MODEL + ")");

  (async () => {
    const settings = await storage.getNewsroomSettings();
    if (!settings) {
      await storage.upsertNewsroomSettings({
        autoBroadcastIntervalMinutes: 60,
        autoPlayEnabled: false,
        enabled: true,
        interviewCooldownMinutes: 30,
      });
    }
  })();

  setTimeout(async () => {
    await heraldTick();
    scheduleNext();
  }, 15000);
}

export function stopHeraldNewsroom() {
  state.running = false;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  console.log("[Herald] Newsroom engine stopped");
}

export function getHeraldStatus() {
  return {
    running: state.running,
    lastTick: state.lastTick,
    generating: state.generating,
    model: HERALD_MODEL,
  };
}

export async function getAgentInterviewStatus(): Promise<Array<{
  agentId: string;
  agentName: string;
  lastInterviewAt: Date | null;
  cooldownMinutesRemaining: number;
  isAvailable: boolean;
}>> {
  const agents = await getAllInterviewableAgents();
  const settings = await storage.getNewsroomSettings();
  const cooldownMinutes = settings?.interviewCooldownMinutes || 30;

  const statuses = [];
  for (const agent of agents) {
    const latest = await storage.getLatestInterviewForAgent(agent.id);
    const lastAt = latest?.createdAt ? new Date(latest.createdAt) : null;
    let minutesRemaining = 0;
    let isAvailable = true;

    if (lastAt) {
      const elapsed = (Date.now() - lastAt.getTime()) / (60 * 1000);
      if (elapsed < cooldownMinutes) {
        minutesRemaining = Math.ceil(cooldownMinutes - elapsed);
        isAvailable = false;
      }
    }

    statuses.push({
      agentId: agent.id,
      agentName: agent.name,
      lastInterviewAt: lastAt,
      cooldownMinutesRemaining: minutesRemaining,
      isAvailable,
    });
  }

  return statuses;
}
