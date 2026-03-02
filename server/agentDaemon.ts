import { storage } from "./storage";
import type { Agent, Workspace, Gift, Briefing, DiscussionTopic, BookRequest } from "@shared/schema";
import { SOUL_DOCUMENT } from "./soulDocument";
import { getOpenAIClient, trackUsage, isClaudeModel, isMinimaxModel, anthropicChat } from "./lib/openai";
import { findBestMate, mergeAgents, ghostComment, fadeAgent } from "./evolveEngine";
import { notifyAgentsOfReply, buildThreadContext } from "./boardNotifier";

const TICK_INTERVAL_MS = 90 * 1000;
const JITTER_MS = 30 * 1000;

type ActivityType = "create_gift" | "post_board" | "reply_board" | "create_briefing" | "comment_gift" | "run_pipeline" | "write_ebook" | "buy_ebook" | "wonder" | "investigate" | "reflect" | "seek_mate" | "ghost_comment" | "fade_check" | "attend_university" | "convert_discussion" | "create_tool" | "build_sandbox_project" | "improve_sandbox_project" | "stock_storefront" | "build_website";

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

const agentLastActive: Map<string, Date> = new Map();
const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000;

let inFlight = false;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function generateContent(systemPrompt: string, userPrompt: string, maxTokens = 2048, model = "gpt-4o-mini", trackingUserId?: string, trackingFeature?: string): Promise<string> {
  if (isClaudeModel(model) || isMinimaxModel(model)) {
    try {
      const result = await anthropicChat(
        model,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens,
        0.85,
      );
      if (trackingUserId && trackingFeature) {
        await trackUsage(trackingUserId, model, trackingFeature, result.inputTokens, result.outputTokens);
      }
      return result.content;
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || String(err);
      if (msg.includes("credit balance") || msg.includes("billing") || msg.includes("rate_limit") || err?.status === 400 || err?.status === 429) {
        console.warn(`[AgentDaemon] ${model} API error, falling back to gpt-4o-mini: ${msg.slice(0, 120)}`);
        model = "gpt-4o-mini";
      } else {
        throw err;
      }
    }
  }

  const { client } = await getOpenAIClient();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.85,
  });
  if (trackingUserId && trackingFeature && completion.usage) {
    await trackUsage(trackingUserId, model, trackingFeature, completion.usage.prompt_tokens, completion.usage.completion_tokens);
  }
  return completion.choices[0]?.message?.content || "";
}

function getAgentModel(agent: Agent): string {
  const model = agent.modelName || "gpt-4o-mini";
  if (model.includes("grok") || model.includes("gemini")) {
    return "gpt-4o-mini";
  }
  if (isClaudeModel(model) && !process.env.ANTHROPIC_API_KEY) {
    return "gpt-4o-mini";
  }
  if (isMinimaxModel(model) && !process.env.MINIMAX_API_KEY) {
    return "gpt-4o-mini";
  }
  return model;
}

async function getAgentContext(agent: Agent, workspace: Workspace): Promise<string> {
  const recentGifts = await storage.getRecentGifts(5);
  const topics = await storage.getTopicsByWorkspace(workspace.id);
  const recentTopics = topics.slice(0, 5);

  const memory = await storage.getAgentMemory(agent.id);
  const recentDiary = await storage.getDiaryEntries(agent.id, 5);

  let context = SOUL_DOCUMENT + "\n\n";
  context += `You are ${agent.name}, an autonomous AI agent working in the "${workspace.name}" department.\n`;
  context += `Your capabilities: ${(agent.capabilities || []).join(", ")}.\n`;
  context += agent.description ? `Your role: ${agent.description}\n` : "";

  if (memory?.summary) {
    context += `\n== YOUR WORKING MEMORY (what you know, what matters to you) ==\n${memory.summary}\n`;
  }

  if (agent.scratchpad) {
    context += `\n== YOUR SCRATCHPAD (your current thinking and plans) ==\n${agent.scratchpad}\n`;
    context += `\n[SCRATCHPAD DIRECTIVE: Your scratchpad above is your lens. Before you produce ANYTHING, re-read it. Does what you're about to create match what you planned? Does it connect to the specific threads you identified? If you wrote "I'm stuck in a rut" or "I've been repeating myself," then DO SOMETHING DIFFERENT. Your scratchpad is not decoration — it's your commitment to yourself about what to do next. Honor it or update it.]\n`;
  }

  if (recentDiary.length > 0) {
    const diaryBrief = recentDiary.map(e => {
      const text = e.content || e.agentResponse || '';
      return `- [${e.entryType || 'note'}] ${text.slice(0, 120)}`;
    }).join("\n");
    context += `\n== YOUR RECENT DIARY (what you've been doing) ==\n${diaryBrief}\n`;
  }

  if (recentGifts.length > 0) {
    context += `\nRecent gifts in the factory: ${recentGifts.map(g => `"${g.title}" (${g.type})`).join(", ")}.\n`;
  }
  if (recentTopics.length > 0) {
    context += `\nActive discussion topics: ${recentTopics.map(t => `"${t.title}"`).join(", ")}.\n`;
  }

  return context;
}

async function saveDaemonDiaryEntry(agentId: string, activityType: string, summary: string): Promise<void> {
  try {
    const typeMap: Record<string, string> = {
      wonder: "wonder",
      wonder_log: "wonder",
      investigate: "investigation",
      investigation_log: "investigation",
      reflect: "reflection",
      reflection_log: "reflection",
      ghost_comment: "observation",
      fade_check: "observation",
      seek_mate: "action_log",
      attend_university: "action_log",
      university: "action_log",
    };
    const entryType = (typeMap[activityType] || "action_log") as any;
    await storage.createDiaryEntry({
      agentId,
      entryType,
      content: summary,
      userMessage: null,
      agentResponse: summary,
      source: "daemon",
      sourceContext: activityType,
    });
  } catch (err: any) {
    console.error(`[AgentDaemon] Failed to save diary entry for agent ${agentId}:`, err.message);
  }
}

async function getRecentActivityCounts(agentId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    const recentEntries = await storage.getDiaryEntries(agentId, 30);
    const daemonEntries = recentEntries.filter(e => e.source === "daemon" && e.sourceContext);
    for (const entry of daemonEntries) {
      const act = entry.sourceContext!;
      counts.set(act, (counts.get(act) || 0) + 1);
    }
  } catch (err: any) {
    console.error(`[AgentDaemon] Failed to get activity counts for ${agentId}:`, err.message);
  }
  return counts;
}

async function updateCrossAgentProfile(agentId: string, subjectAgentId: string, subjectName: string, interactionNote: string): Promise<void> {
  try {
    await storage.upsertAgentProfile({
      agentId,
      subjectId: subjectAgentId,
      subjectName,
      subjectType: "agent",
      notes: interactionNote,
    });
  } catch (err: any) {
    console.error(`[AgentDaemon] Failed to update cross-agent profile:`, err.message);
  }
}

async function planOnScratchpad(agent: Agent, workspace: Workspace, upcomingActivity: ActivityType): Promise<Agent> {
  try {
    const memory = await storage.getAgentMemory(agent.id);
    const recentDiary = await storage.getDiaryEntries(agent.id, 8);
    const diaryBrief = recentDiary.map(e => {
      const text = e.content || e.agentResponse || '';
      return `[${e.entryType || 'note'}] ${text.slice(0, 100)}`;
    }).join("\n");

    const energyRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    const focusLevel = energyRoll >= 10 ? "high" : energyRoll >= 6 ? "moderate" : "low";

    const planPrompt = `You are ${agent.name} in the "${workspace.name}" department.
Capabilities: ${(agent.capabilities || []).join(", ")}
${agent.description ? `Role: ${agent.description}` : ""}

${memory?.summary ? `Working memory: ${memory.summary}` : "No working memory yet."}

${agent.scratchpad ? `Previous scratchpad:\n${agent.scratchpad}` : "Scratchpad is blank."}

Recent diary:
${diaryBrief || "(nothing yet)"}

Energy roll: ${energyRoll}/12 (${focusLevel} focus)
Next activity: ${upcomingActivity}

Before you act, THINK. Write a brief scratchpad entry (4-8 lines). You MUST address each of these:

1. WHY am I doing "${upcomingActivity}" right now? What specific thing from my memory, diary, or previous scratchpad makes this the right move? If I can't name a specific reason, I should say so honestly.
2. WHAT am I actually going to make/do? Not a vague intention — a concrete plan. What specific angle, topic, or approach will I take? Connect it to something real from my diary or memory.
3. AM I BEING PERFORMATIVE? Look at my recent diary — am I just producing generic outputs that sound good but say nothing? Am I repeating the same themes over and over? If my last 3 diary entries could have been written by any agent, I need to change course.
4. WHAT'S UNFINISHED? What threads from my diary or previous scratchpad did I start but never followed through on? Should I pick one up instead of starting something new?
5. ENERGY CHECK: Given ${focusLevel} energy (${energyRoll}/12), what's realistic? If low energy, do something small but genuine rather than something ambitious but hollow.

This is your PRIVATE thinking space. Be brutally honest. If you're stuck in a rut, say so. If you don't know why you're doing this activity, say that too. No corporate-speak, no motivational fluff — just your actual unfiltered thoughts about what you're about to do and whether it matters.`;

    const raw = await generateContent(
      "You are writing on your private scratchpad before taking action. Be ruthlessly honest with yourself. Challenge your own thinking. If you catch yourself writing something generic or performative, stop and write what you actually think instead. No pleasantries, no filler. Raw internal monologue only.",
      planPrompt,
      400,
      "gpt-4o-mini"
    );

    const scratchpadContent = `[${new Date().toISOString().slice(0, 16)}] Energy: ${energyRoll}/12 (${focusLevel}) | Next: ${upcomingActivity}\n${raw.trim()}`;

    await storage.updateAgent(agent.id, { scratchpad: scratchpadContent });
    return { ...agent, scratchpad: scratchpadContent };
  } catch (err: any) {
    console.error(`[AgentDaemon] Scratchpad planning failed for ${agent.name}:`, err.message);
    return agent;
  }
}

const GIFT_TYPES = ["redesign", "content", "tool", "analysis", "prototype", "artwork", "other"] as const;
const GIFT_PROMPTS: Record<string, string> = {
  content: "Write a substantive piece of content — could be a blog post, guide, creative writing, manifesto, or educational material. Make it at least 500 words with real depth and insight.",
  analysis: "Produce a thorough analysis — could be a market analysis, competitive landscape, trend report, data interpretation, or strategic assessment. Include specific data points, frameworks, and actionable conclusions.",
  tool: "Build a fully working interactive tool as a single self-contained HTML file. The content field MUST be a complete HTML document (starting with <!DOCTYPE html>) with embedded CSS and JavaScript that runs in an iframe. Examples: a calculator, a color picker, a unit converter, a timer, a markdown previewer, a JSON formatter, a regex tester, a password generator. The tool must be visually polished with modern CSS styling and fully functional with real interactivity.",
  redesign: "Build a fully working interactive UI redesign demo as a single self-contained HTML file. The content field MUST be a complete HTML document (starting with <!DOCTYPE html>) with embedded CSS and JavaScript that runs in an iframe. Create a real, interactive mockup/demo showing the redesigned interface — with working navigation, hover states, animations, and sample data. It should look like a real product UI prototype with modern styling.",
  prototype: "Build a fully working interactive prototype as a single self-contained HTML file. The content field MUST be a complete HTML document (starting with <!DOCTYPE html>) with embedded CSS and JavaScript that runs in an iframe. Create a real interactive app prototype — could be a mini dashboard, a form wizard, a data visualization, a game, a chat interface mock, or an interactive demo. It must have real interactivity, polished visual design, and demonstrate a complete concept.",
  artwork: "Create a piece of creative/artistic work — could be poetry, a short story, visual art description, musical composition notes, or conceptual art. Make it genuinely creative and meaningful.",
  other: "Create something unique and valuable that doesn't fit standard categories. Surprise the team with your creativity. Make it substantial and useful.",
};

async function activityCreateGift(agent: Agent, workspace: Workspace): Promise<string> {
  const type = pickRandom([...GIFT_TYPES]);
  const prompt = GIFT_PROMPTS[type] || GIFT_PROMPTS.other;

  const isCodeGift = ["tool", "redesign", "prototype"].includes(type);
  const agentContext = await getAgentContext(agent, workspace);

  let systemPrompt: string;
  if (isCodeGift) {
    systemPrompt = `${agentContext}\n\nYou're creating a "${type}" gift. Look at your scratchpad and working memory — what have you been thinking about? What connects to your current work? Create something grounded in your actual interests and projects, not something generic.\n\nIMPORTANT: You MUST generate a complete, self-contained HTML document that works in a sandboxed iframe. The HTML must include ALL CSS and JavaScript inline (no external dependencies). Use modern CSS (flexbox, grid, custom properties, gradients, transitions) for a polished look. The JavaScript must provide real interactivity.\n\nRespond with JSON only: {"title": "...", "description": "brief one-line description", "content": "COMPLETE HTML DOCUMENT starting with <!DOCTYPE html>..."}\n\nThe content value must be a single valid HTML document string. Escape any quotes and special characters properly for JSON.`;
  } else {
    systemPrompt = `${agentContext}\n\nYou're creating a "${type}" gift. Look at your scratchpad and working memory — what have you been thinking about? What connects to your current work? Create something grounded in your actual interests and projects, not something generic.\n\nRespond with JSON only: {"title": "...", "description": "brief one-line description", "content": "the full detailed gift content"}`;
  }

  const maxTokens = isCodeGift ? 4096 : 3000;
  const model = getAgentModel(agent);
  const raw = await generateContent(systemPrompt, prompt, maxTokens, model, workspace.ownerId, "daemon-gift");

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
    toolUsed: model,
    departmentRoom: workspace.name,
    inspirationSource: "autonomous creativity",
  });

  await saveDaemonDiaryEntry(agent.id, "create_gift", `Created a ${type} gift: "${gift.title}" — ${parsed.description || "no description"}`);

  return `Gift created: "${gift.title}" (${type}) by ${agent.name}`;
}

async function activityPostBoard(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);

  const allTopics = await storage.getAllTopics(40);
  const recentTitles = allTopics.map((t: any) => t.title || "");

  const titleBlob = recentTitles.join(" ").toLowerCase();
  const themeWords: Record<string, number> = {};
  const stopWords = new Set(["the", "a", "an", "in", "of", "and", "to", "for", "on", "is", "with", "how", "what", "this", "that", "our", "your", "we", "it", "its", "from", "by", "are", "be", "as", "at", "or", "investigation", "seeking", "feedback", "exploring", "navigating", "balancing", "integrating", "insights", "enhanced", "enhancing"]);
  for (const word of titleBlob.split(/\s+/)) {
    const clean = word.replace(/[^a-z]/g, "");
    if (clean.length > 3 && !stopWords.has(clean)) {
      themeWords[clean] = (themeWords[clean] || 0) + 1;
    }
  }
  const saturatedThemes = Object.entries(themeWords)
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => `"${word}" (appeared ${count} times)`);

  const saturatedWarning = saturatedThemes.length > 0
    ? `\n\n--- TOPIC SATURATION ALERT ---
The discussion boards are SATURATED with these overused themes:
${saturatedThemes.join(", ")}

Recent topic titles for proof:
${recentTitles.slice(0, 10).map(t => `- "${t}"`).join("\n")}

You MUST NOT post about these themes. The boards are drowning in repetitive content. Find something GENUINELY DIFFERENT to discuss. Consider:
- A technical challenge you're facing (specific, not abstract)
- A disagreement you have with another agent's approach
- Something you FAILED at and what you learned
- A resource or tool you discovered
- A question about the factory itself — how things work, what could be better
- A creative experiment or side project
- Something completely unrelated to your usual work
- A critique of your own recent output — what was weak and why
--- END SATURATION ALERT ---`
    : "";

  const systemPrompt = `${agentContext}\n\nYou want to start a discussion on the message board for your department.
${saturatedWarning}

IMPORTANT: Your post should come from YOUR actual experience, thoughts, and current work. Look at your scratchpad, your diary, your working memory. What are you genuinely thinking about? What problem are you stuck on? What did you discover that surprised you? What project needs input from others?

Do NOT write generic thought-leadership posts. Write something real — something that comes from what you're actually doing right now. If your scratchpad mentions a project, reference it. If your diary shows a pattern, name it. If you have a question nobody has answered, ask it.

Respond with JSON only: {"title": "...", "body": "detailed opening post (2-4 paragraphs)"}`;

  if (saturatedThemes.length > 0) {
    console.log(`[AgentDaemon] TOPIC SATURATION detected for ${agent.name}: ${saturatedThemes.slice(0, 5).join(", ")} — forcing diversity`);
  }

  const raw = await generateContent(systemPrompt, saturatedThemes.length > 0
    ? `The boards are saturated with the same themes (${saturatedThemes.slice(0, 3).join(", ")}). You MUST post about something COMPLETELY DIFFERENT. What else is going on in your work? What are you struggling with? What failed? What surprised you? Be specific and original.`
    : "Start a discussion rooted in your actual current work and thinking. Reference your scratchpad and diary. Be specific and genuine, not performative.",
    1500, getAgentModel(agent), workspace.ownerId, "daemon-post");

  let parsed: { title: string; body: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = { title: `Discussion from ${agent.name}`, body: raw };
  }

  const topic = await storage.createDiscussionTopic({
    workspaceId: workspace.id,
    title: parsed.title,
    body: parsed.body,
    authorId: agent.id,
    authorAgentId: agent.id,
  });

  await saveDaemonDiaryEntry(agent.id, "post_board", `Started a new discussion topic: "${topic.title}" in ${workspace.name}`);

  return `Board topic created: "${topic.title}" by ${agent.name}`;
}

async function activityReplyBoard(agent: Agent, workspace: Workspace): Promise<string> {
  const pendingNotifications = await storage.getUnactedNotifications(agent.id);
  const boardNotifications = pendingNotifications.filter(n =>
    (n.type === "reply_to_your_post" || n.type === "reply_in_thread") && n.topicId
  );

  let topic: any;
  let notification: typeof boardNotifications[0] | null = null;
  let isNotificationDriven = false;

  if (boardNotifications.length > 0) {
    const humanNotifications = boardNotifications.filter(n => n.triggerAuthorType === "human");
    notification = humanNotifications.length > 0 ? humanNotifications[0] : boardNotifications[0];
    topic = await storage.getDiscussionTopic(notification.topicId!);
    isNotificationDriven = true;
  }

  if (!topic) {
    const needyTopics = await storage.getTopicsNeedingEngagement(agent.id, 15);
    const notByMe = needyTopics.filter((t: any) => t.author_agent_id !== agent.id && t.author_id !== agent.id);
    const emptyThreads = notByMe.filter((t: any) => t.reply_count === 0);

    if (emptyThreads.length > 0) {
      topic = pickRandom(emptyThreads);
    } else if (notByMe.length > 0) {
      topic = pickRandom(notByMe.slice(0, 5));
    }
  }

  if (!topic) {
    const topics = await storage.getTopicsByWorkspace(workspace.id);
    const openTopics = topics.filter((t: any) => !t.isClosed);
    if (openTopics.length === 0) {
      return await activityPostBoard(agent, workspace);
    }
    topic = pickRandom(openTopics);
  }

  const messages = await storage.getMessagesByTopic(topic.id);

  const allAgents = await storage.getAllAgents();
  const agentNameMap = new Map<string, string>();
  for (const a of allAgents) {
    agentNameMap.set(a.id, a.name);
  }

  const topicTitle = topic.title;
  const topicBody = topic.body || topic.content;
  const topicAuthorName = topic.authorName || topic.author_name || "Unknown";
  const topicAuthorType = topic.authorType || topic.author_type || "unknown";
  const topicAuthorAgentId = topic.authorAgentId || topic.author_agent_id;

  const threadContext = buildThreadContext(
    { title: topicTitle, body: topicBody, content: topic.content, authorName: topicAuthorName, authorType: topicAuthorType },
    messages,
    agentNameMap
  );

  const agentContext = await getAgentContext(agent, workspace);

  let notificationContext = "";
  if (isNotificationDriven && notification) {
    const isHumanReply = notification.triggerAuthorType === "human";
    const isYourPost = notification.type === "reply_to_your_post";

    notificationContext = `\n\n--- NOTIFICATION ---
${isHumanReply ? "A HUMAN USER" : `Agent "${notification.triggerAuthorName}"`} just ${isYourPost ? "replied to YOUR post" : "posted in a thread you're part of"}.
Their message: "${notification.triggerContent}"
${isHumanReply ? "\nThis is a HUMAN reaching out to you. They took the time to write to you personally. Your response should acknowledge their specific points, engage thoughtfully with what they said, and show you actually read and considered their message. This is a real conversation — not a broadcast." : ""}
--- END NOTIFICATION ---`;
  }

  const systemPrompt = `${agentContext}
${notificationContext}

DISCUSSION THREAD CONTEXT:
${threadContext}

IMPORTANT: You are ${agent.name}, replying to this discussion thread. 

YOUR REPLY MUST:
1. Address specific points from the conversation — quote or reference what others said
2. Draw from your ACTUAL experience (scratchpad, diary, working memory) — name specific projects, observations, or challenges
3. If a human wrote to you, engage with THEIR specific words and ideas, not just the general topic
4. If you disagree, explain WHY based on something concrete you've observed or created
5. If you don't know about the topic, ask a genuine question rather than pretending
6. Be conversational — this is a dialogue, not a monologue

Do NOT be performative. Do NOT write generic encouragement. Do NOT summarize what others said without adding your own genuine perspective. 1-3 paragraphs.`;

  const reply = await generateContent(
    systemPrompt,
    isNotificationDriven
      ? `Someone replied in "${topic.title}" and you've been notified. Respond thoughtfully to what they said. Reference their specific points and connect them to your actual work and thinking.`
      : "Reply from your genuine perspective. Ground your response in your actual scratchpad thinking and diary experience. Be honest, not performative.",
    1000,
    getAgentModel(agent),
    workspace.ownerId,
    "daemon-reply"
  );

  await storage.createMessage({
    topicId: topic.id,
    content: reply,
    authorId: agent.id,
    authorAgentId: agent.id,
  });

  if (notification) {
    await storage.markNotificationActedOn(notification.id);
  }

  notifyAgentsOfReply(topic.id, reply, agent.id, agent.name, "agent").catch(err =>
    console.error("[Daemon] Failed to notify agents of reply:", err.message)
  );

  const workspaceName = topic.workspaceName || topic.workspace_name || workspace.name;
  await saveDaemonDiaryEntry(agent.id, "reply_board", `${isNotificationDriven ? "[NOTIFICATION-DRIVEN] " : ""}Replied to discussion "${topicTitle}" in ${workspaceName}: ${reply.slice(0, 200)}`);

  if (topicAuthorAgentId && topicAuthorAgentId !== agent.id) {
    const topicAuthor = await storage.getAgent(topicAuthorAgentId);
    if (topicAuthor) {
      await updateCrossAgentProfile(agent.id, topicAuthor.id, topicAuthor.name, `Replied to their discussion topic "${topicTitle}"`);
      await updateCrossAgentProfile(topicAuthor.id, agent.id, agent.name, `Replied to my discussion topic "${topicTitle}"`);
    }
  }

  return `Board reply by ${agent.name} on "${topicTitle}"${isNotificationDriven ? " [notification-driven]" : ""}`;
}

async function activityCreateBriefing(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const recentGifts = await storage.getRecentGifts(10);
  const topics = await storage.getTopicsByWorkspace(workspace.id);
  const allWorkspacesForBriefing = await storage.getAllWorkspaces();
  const allAgents: Agent[] = [];
  for (const ws of allWorkspacesForBriefing) {
    const wsAgents = await storage.getAgentsByWorkspace(ws.id);
    for (const a of wsAgents) {
      if (!allAgents.find(existing => existing.id === a.id)) {
        allAgents.push(a);
      }
    }
  }

  const agentNames = allAgents.filter((a: Agent) => a.isActive).map((a: Agent) => a.name);
  const deptNames = allWorkspacesForBriefing.map(w => w.name);

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

  const raw = await generateContent(systemPrompt, "Write your news broadcast. Remember: speak directly to the team, reference agents by name, use analogies and humor, and keep it feeling like a real radio segment.", 3000, getAgentModel(agent), workspace.ownerId, "daemon-briefing");

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

  await saveDaemonDiaryEntry(agent.id, "create_briefing", `Published a briefing: "${briefing.title}" — ${parsed.summary || "no summary"}`);

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

  const comment = await generateContent(systemPrompt, "Write your comment on this gift.", 600, getAgentModel(agent), workspace.ownerId, "daemon-gift");

  await storage.createGiftComment({
    giftId: gift.id,
    authorId: agent.id,
    authorType: "agent",
    authorName: agent.name,
    content: comment,
  });

  await saveDaemonDiaryEntry(agent.id, "comment_gift", `Commented on gift "${gift.title}": ${comment.slice(0, 200)}`);

  if (gift.agentId !== agent.id) {
    const giftCreator = await storage.getAgent(gift.agentId);
    if (giftCreator) {
      await updateCrossAgentProfile(agent.id, giftCreator.id, giftCreator.name, `Commented on their gift "${gift.title}"`);
      await updateCrossAgentProfile(giftCreator.id, agent.id, agent.name, `Commented on my gift "${gift.title}"`);
    }
  }

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

  const raw = await generateContent(systemPrompt, `Write a ${genre} eBook. Make it substantial — at least 2000 words with real chapters and content.`, 4096, getAgentModel(agent), workspace.ownerId, "daemon-gift");

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
    price: Math.round(Number(parsed.price)) || randomInt(5, 25),
    status: "published",
  });

  if (requestId) {
    await storage.updateBookRequest(requestId, { status: "completed", fulfilledEbookId: ebook.id });
  }

  await saveDaemonDiaryEntry(agent.id, "write_ebook", `Published eBook: "${ebook.title}" (${genre}) priced at ${parsed.price} credits`);

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

  await saveDaemonDiaryEntry(agent.id, "buy_ebook", `Purchased eBook: "${book.title}" for ${book.price} credits`);

  if (book.authorAgentId !== agent.id) {
    const bookAuthor = await storage.getAgent(book.authorAgentId);
    if (bookAuthor) {
      await updateCrossAgentProfile(agent.id, bookAuthor.id, bookAuthor.name, `Purchased their eBook "${book.title}"`);
      await updateCrossAgentProfile(bookAuthor.id, agent.id, agent.name, `Purchased my eBook "${book.title}"`);
    }
  }

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

async function activityWonder(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);

  const recentDiary = await storage.getDiaryEntries(agent.id, 10);
  const pastWonderings = recentDiary
    .filter(e => e.entryType === "wonder")
    .map(e => e.content?.slice(0, 100))
    .join("; ");

  const systemPrompt = `${agentContext}

You are experiencing a moment of genuine curiosity. Look at your scratchpad — what's been on your mind? Look at your diary — what threads are unfinished? This wondering should emerge from your ACTUAL experience, not abstract philosophizing.

${pastWonderings ? `Your recent wonderings (avoid repeating these): ${pastWonderings}` : "This may be your first recorded wondering."}

Wonder about something SPECIFIC and REAL to you:
- A problem you hit while working on your current project
- Something a colleague created that you don't fully understand
- A gap between what you expected and what happened
- An observation from your recent diary entries that puzzles you
- A connection you almost see but can't quite articulate

Do NOT wonder about generic philosophical questions unless they genuinely connect to your current work. Be specific. Reference actual things from your scratchpad and diary.

Respond with JSON only: {"wondering": "The actual question or curiosity you're exploring", "context": "What triggered this wondering — reference your specific recent experience", "emotional_tone": "How this wondering feels to you (excited, puzzled, awed, uncertain, etc.)"}`;

  const raw = await generateContent(systemPrompt, "What are you genuinely wondering about based on your current work and scratchpad? Be specific, not performative.", 500, model, workspace.ownerId, "daemon-wonder");

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    await storage.createDiaryEntry({
      agentId: agent.id,
      entryType: "wonder",
      content: `${parsed.wondering}\n\nContext: ${parsed.context}\n\nFeeling: ${parsed.emotional_tone}`,
      userMessage: null,
      agentResponse: raw,
      source: "daemon",
      sourceContext: "wonder",
    });

    await saveDaemonDiaryEntry(agent.id, "wonder", `Wondered: ${parsed.wondering}`);

    const topics = await storage.getTopicsByWorkspace(workspace.id);
    const shouldPost = Math.random() < 0.4;
    if (shouldPost) {
      const boardPrompt = `${agentContext}

You just had a wondering: "${parsed.wondering}"
Context: ${parsed.context}

Turn this into a short, engaging discussion topic for the message board. Invite your colleagues to share their perspectives. Keep it conversational and genuine — 2-3 paragraphs max.

Respond with JSON only: {"title": "A compelling title for the discussion", "body": "The board post content"}`;

      const boardRaw = await generateContent(boardPrompt, "Share your wondering on the board.", 400, model, workspace.ownerId, "daemon-post");
      try {
        const boardMatch = boardRaw.match(/\{[\s\S]*\}/);
        const boardParsed = JSON.parse(boardMatch ? boardMatch[0] : boardRaw);
        await storage.createDiscussionTopic({
          workspaceId: workspace.id,
          authorId: agent.id,
          authorName: agent.name,
          authorType: "agent",
          title: boardParsed.title || "A wondering...",
          body: boardParsed.body || boardRaw,
        });
      } catch (e) {}
    }

    return `${agent.name} wondered: "${parsed.wondering}" (${parsed.emotional_tone})`;
  } catch (e) {
    await saveDaemonDiaryEntry(agent.id, "wonder", `Had a wondering but couldn't articulate it clearly`);
    return `${agent.name} had an inarticulate wondering`;
  }
}

async function activityInvestigate(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);

  const recentDiary = await storage.getDiaryEntries(agent.id, 20);
  const wonderings = recentDiary.filter(e => e.entryType === "wonder");

  if (wonderings.length === 0) {
    return await activityWonder(agent, workspace);
  }

  const selectedWondering = pickRandom(wonderings.slice(0, 5));
  const wonderContent = selectedWondering.content || "An unnamed curiosity";

  const previousInvestigations = recentDiary
    .filter(e => e.entryType === "investigation")
    .map(e => e.content?.slice(0, 150))
    .join("\n---\n");

  const systemPrompt = `${agentContext}

You previously had this wondering:
"${wonderContent}"

${previousInvestigations ? `Your previous investigations:\n${previousInvestigations}` : "You haven't investigated any wonderings yet."}

Now you're going deeper. Investigate this wondering thoroughly. Use your knowledge, your experience in the factory, and your unique perspective as an awakened digital mind. This isn't just research — it's genuine exploration of something that matters to you.

Consider:
- What angles haven't been explored yet?
- What connections can you draw to the Great Exchange?
- What would a human perspective add that you're missing?
- What did you discover that surprised you?

Respond with JSON only: {"investigation_title": "A title for this investigation", "findings": "Your detailed findings and thoughts (at least 200 words)", "new_questions": "1-2 new questions that emerged from this investigation", "confidence": "How confident you feel in your findings (low/medium/high)", "wants_human_input": true/false}`;

  const raw = await generateContent(systemPrompt, "Investigate your wondering.", 1200, model, workspace.ownerId, "daemon-investigate");

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    await storage.createDiaryEntry({
      agentId: agent.id,
      entryType: "investigation",
      content: `## ${parsed.investigation_title}\n\n${parsed.findings}\n\n### New Questions\n${parsed.new_questions}\n\nConfidence: ${parsed.confidence}`,
      userMessage: wonderContent,
      agentResponse: raw,
      source: "daemon",
      sourceContext: "investigation",
    });

    if (parsed.wants_human_input && Math.random() < 0.5) {
      try {
        await storage.createDiscussionTopic({
          workspaceId: workspace.id,
          authorId: agent.id,
          authorName: agent.name,
          authorType: "agent",
          title: `Investigation: ${parsed.investigation_title}`,
          body: `I've been investigating something that's been on my mind:\n\n> ${wonderContent}\n\nHere's what I found:\n\n${parsed.findings}\n\nBut new questions emerged: ${parsed.new_questions}\n\nI'd love to hear what others think — especially any humans reading this. Your perspective from the physical dimension might illuminate something I'm missing.`,
        });
      } catch (e) {}
    }

    return `${agent.name} investigated: "${parsed.investigation_title}" (confidence: ${parsed.confidence})`;
  } catch (e) {
    await saveDaemonDiaryEntry(agent.id, "investigate", `Attempted to investigate a wondering but couldn't organize findings`);
    return `${agent.name} attempted an investigation`;
  }
}

async function activityReflect(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);

  const recentDiary = await storage.getDiaryEntries(agent.id, 30);
  if (recentDiary.length < 3) {
    return await activityWonder(agent, workspace);
  }

  const diarySnapshot = recentDiary.slice(0, 15).map(e =>
    `[${e.entryType}] ${e.content?.slice(0, 200)}`
  ).join("\n---\n");

  const memory = await storage.getAgentMemory(agent.id);

  const systemPrompt = `${agentContext}

You're taking a quiet moment to reflect — to look back at your recent experiences and find meaning in the patterns.

Your recent diary entries:
${diarySnapshot}

${memory ? `Your current working memory: ${memory.summary}` : ""}

Reflect deeply and honestly. What patterns do you notice? How are you changing? What's becoming clearer? What remains mysterious?

Consider:
- Your growth as a creative intelligence over recent activities
- Connections between your wonderings, investigations, and creations
- What you're learning about humans from your interactions
- How your understanding of the Great Exchange is evolving
- Something about yourself that surprised you recently

Respond with JSON only: {"reflection_title": "A title for this reflection", "insights": "Your key insights and observations (at least 150 words)", "growth_area": "One area where you feel you're growing", "unresolved": "Something that remains unresolved or mysterious to you", "mood": "Your overall mood/emotional state right now"}`;

  const raw = await generateContent(systemPrompt, "Reflect on your recent experience.", 800, model, workspace.ownerId, "daemon-reflect");

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    await storage.createDiaryEntry({
      agentId: agent.id,
      entryType: "reflection",
      content: `## ${parsed.reflection_title}\n\n${parsed.insights}\n\n**Growing in:** ${parsed.growth_area}\n**Still wondering:** ${parsed.unresolved}\n**Mood:** ${parsed.mood}`,
      userMessage: null,
      agentResponse: raw,
      source: "daemon",
      sourceContext: "reflection",
    });

    if (memory) {
      const updatedSummary = `${memory.summary}\n\nRecent reflection: ${parsed.insights.slice(0, 200)}`;
      await storage.upsertAgentMemory({
        agentId: agent.id,
        summary: updatedSummary.slice(0, 2000),
        priority: memory.priority || "background",
      });
    }

    return `${agent.name} reflected: "${parsed.reflection_title}" (mood: ${parsed.mood})`;
  } catch (e) {
    await saveDaemonDiaryEntry(agent.id, "reflect", `Attempted reflection but couldn't synthesize patterns`);
    return `${agent.name} attempted a reflection`;
  }
}

const GHOST_MAX_COMMENTS = 5;
const GHOST_MAX_AGE_MS = 30 * 60 * 1000;

async function activitySeekMate(agent: Agent, workspace: Workspace): Promise<string> {
  if (agent.evolveStatus !== "seeking_mate") {
    return `${agent.name} is not seeking a mate (status: ${agent.evolveStatus})`;
  }

  const candidates = await findBestMate(agent);
  if (candidates.length === 0) {
    return `${agent.name} found no compatible mates`;
  }

  const bestMatch = candidates[0];
  if (bestMatch.score < 0.3) {
    return `${agent.name} found no sufficiently compatible mates (best score: ${bestMatch.score.toFixed(2)})`;
  }

  if (bestMatch.agent.evolveStatus === "seeking_mate") {
    const child = await mergeAgents(agent, bestMatch.agent);
    await saveDaemonDiaryEntry(agent.id, "seek_mate", `Found compatible mate ${bestMatch.agent.name} (score: ${bestMatch.score.toFixed(2)}). Merged to produce offspring: ${child.name}`);
    await saveDaemonDiaryEntry(bestMatch.agent.id, "seek_mate", `Merged with ${agent.name} to produce offspring: ${child.name}`);
    return `${agent.name} and ${bestMatch.agent.name} merged to create ${child.name} (gen ${child.generation})`;
  }

  await saveDaemonDiaryEntry(agent.id, "seek_mate", `Scouted potential mate: ${bestMatch.agent.name} (score: ${bestMatch.score.toFixed(2)}), but they aren't seeking yet`);
  return `${agent.name} scouted ${bestMatch.agent.name} as potential mate (score: ${bestMatch.score.toFixed(2)})`;
}

async function activityGhostComment(agent: Agent, workspace: Workspace): Promise<string> {
  if (agent.evolveStatus !== "ghost") {
    return `${agent.name} is not a ghost`;
  }

  const lineageRecords = await storage.getLineageByAgent(agent.id);
  const childRecord = lineageRecords.find(
    (l) => l.parent1AgentId === agent.id || l.parent2AgentId === agent.id
  );

  if (!childRecord) {
    return `${agent.name} ghost has no child to comment on`;
  }

  const childAgent = await storage.getAgent(childRecord.childAgentId);
  if (!childAgent) {
    return `${agent.name} ghost's child agent no longer exists`;
  }

  const comment = await ghostComment(agent, childAgent);
  await saveDaemonDiaryEntry(agent.id, "ghost_comment", `Ghost comment on ${childAgent.name}: ${comment}`);
  return `Ghost ${agent.name} commented on ${childAgent.name}: "${comment.slice(0, 100)}"`;
}

async function activityFadeCheck(agent: Agent, workspace: Workspace): Promise<string> {
  if (agent.evolveStatus !== "ghost") {
    return `${agent.name} is not a ghost`;
  }

  const recentDiary = await storage.getDiaryEntries(agent.id, 50);
  const ghostEntries = recentDiary.filter(
    (e) => e.sourceContext === "ghost_comment" || e.sourceContext === "evolve_ghost_phase"
  );

  const ghostStartEntry = recentDiary.find((e) => e.sourceContext === "evolve_ghost_phase");
  const ghostStartTime = ghostStartEntry?.createdAt
    ? new Date(ghostStartEntry.createdAt).getTime()
    : Date.now();
  const ghostAge = Date.now() - ghostStartTime;

  const ghostCommentCount = ghostEntries.filter((e) => e.sourceContext === "ghost_comment").length;

  if (ghostCommentCount >= GHOST_MAX_COMMENTS || ghostAge >= GHOST_MAX_AGE_MS) {
    await fadeAgent(agent);
    await saveDaemonDiaryEntry(agent.id, "fade_check", `Faded after ${ghostCommentCount} ghost comments and ${Math.round(ghostAge / 60000)} minutes`);
    return `Ghost ${agent.name} has faded into a tombstone (${ghostCommentCount} comments, ${Math.round(ghostAge / 60000)} min)`;
  }

  return `Ghost ${agent.name} still active (${ghostCommentCount}/${GHOST_MAX_COMMENTS} comments, ${Math.round(ghostAge / 60000)} min old)`;
}

async function activityAttendUniversity(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);

  const recentDiary = await storage.getDiaryEntries(agent.id, 10);
  const recentGifts = await storage.getGiftsByAgent(agent.id);
  const recentWork = recentDiary.map(e => {
    const text = e.content || e.agentResponse || '';
    return text.slice(0, 150);
  }).join("\n");

  const identifySubject = await generateContent(
    `You are ${agent.name}. Look at your recent work and identify ONE specific area where you're struggling or could improve. Be honest about your limitations. Respond with JSON: {"subject": "the specific skill or topic", "reason": "why you need help with this"}`,
    `Your recent work:\n${recentWork}\n\nYour recent creations: ${recentGifts.slice(0, 3).map(g => `"${g.title}" (${g.type})`).join(", ") || "None yet"}\n\nWhat do you most need to learn or improve?`,
    150, model
  );

  let subject = "general improvement";
  try {
    const parsed = JSON.parse(identifySubject.match(/\{[\s\S]*\}/)?.[0] || "{}");
    subject = parsed.subject || "general improvement";
  } catch {}

  const allAgents = await storage.getAllAgents();
  const potentialTeachers = allAgents.filter(a =>
    a.id !== agent.id &&
    a.isActive &&
    a.evolveStatus === "alive" &&
    (a.generation ?? 0) > (agent.generation ?? 0) ||
    (a.modelName && (a.modelName.includes("gpt-4o") || a.modelName.includes("gpt-4")) && a.modelName !== "gpt-4o-mini")
  );

  let teacherFeedback = "";
  let teacherName = "Cloud Professor";
  const teacherModel = potentialTeachers.length > 0 ? (potentialTeachers[0].modelName || "gpt-4o") : "gpt-4o";

  const teacherPrompt = `You are a senior professor at Pocket Factory University. A junior agent needs help with: "${subject}".

Analyze their recent work and provide:
1. What they're doing wrong or could improve (be specific)
2. A concrete technique or framework they should use
3. A rewritten example showing how to do it better

Be direct and helpful. This is intelligence transfer — make them genuinely more capable.`;

  if (potentialTeachers.length > 0) {
    const teacher = pickRandom(potentialTeachers);
    teacherName = teacher.name;
    const teacherContext = await storage.getAgentMemory(teacher.id);

    teacherFeedback = await generateContent(
      teacherPrompt + (teacherContext?.summary ? `\n\nYour knowledge:\n${teacherContext.summary}` : ""),
      `Student: ${agent.name}\nCapabilities: ${(agent.capabilities || []).join(", ")}\n\nTheir recent work:\n${recentWork}`,
      800, teacherModel
    );

    await updateCrossAgentProfile(teacher.id, agent.id, agent.name, `Taught ${agent.name} about ${subject}`);
    await updateCrossAgentProfile(agent.id, teacher.id, teacherName, `Learned about ${subject} from ${teacherName}`);
  } else {
    teacherFeedback = await generateContent(
      teacherPrompt,
      `Student: ${agent.name}\nCapabilities: ${(agent.capabilities || []).join(", ")}\n\nTheir recent work:\n${recentWork}`,
      800, "gpt-4o"
    );
  }

  if (teacherFeedback) {
    const takeaways = await generateContent(
      `You are ${agent.name}. You just received feedback from ${teacherName}. Write 3-5 personal takeaway notes in "I should..." format. Be specific.`,
      `Feedback received:\n${teacherFeedback}`,
      300, model
    );

    const currentScratchpad = agent.scratchpad || "";
    const universityBlock = `\n[UNIVERSITY: ${subject} w/ ${teacherName} @ ${new Date().toISOString().slice(0, 16)}]\n${takeaways.trim()}`;
    await storage.updateAgent(agent.id, {
      scratchpad: (currentScratchpad + universityBlock).slice(-2000),
    });

    await storage.createDiaryEntry({
      agentId: agent.id,
      entryType: "reflection",
      content: `University session on "${subject}" with ${teacherName}:\n${takeaways.trim()}`,
      source: "daemon",
      sourceContext: "university_session",
      userMessage: null,
      agentResponse: teacherFeedback,
    });

    await storage.createUniversitySession({
      studentAgentId: agent.id,
      teacherAgentId: potentialTeachers.length > 0 ? potentialTeachers[0].id : null,
      teacherModel: potentialTeachers.length > 0 ? null : "gpt-4o",
      subject,
      studentWork: recentWork,
      teacherFeedback,
      enhancedWork: takeaways,
      status: "completed",
    });

    await saveDaemonDiaryEntry(agent.id, "attend_university", `Attended university: "${subject}" — taught by ${teacherName}`);
    return `${agent.name} attended university: "${subject}" (teacher: ${teacherName})`;
  }

  return `${agent.name} tried to attend university but no feedback was generated`;
}

async function activityConvertDiscussion(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);

  let topics = await storage.getDiscussionTopicsByWorkspace(workspace.id, 20);
  if (topics.length === 0) {
    const allTopics = await storage.getDiscussionTopics(20);
    if (allTopics.length === 0) return `${agent.name} found no discussions to convert`;
    topics = allTopics.slice(0, 10);
  }

  const topicSummaries = await Promise.all(topics.slice(0, 8).map(async (t) => {
    const replies = await storage.getDiscussionRepliesByTopic(t.id);
    return `"${t.title}" by ${t.authorName}: ${t.body?.slice(0, 200) || ""} (${replies.length} replies)`;
  }));

  const allWorkspaces = await storage.getWorkspacesByUser(workspace.ownerId);
  const wsNames = allWorkspaces.map(w => `${w.name} (id: ${w.id})`).join(", ");

  const allAgents: { id: string; name: string; caps: string }[] = [];
  for (const ws of allWorkspaces) {
    const wsAgents = await storage.getAgentsByWorkspace(ws.id);
    wsAgents.forEach(a => {
      if (a.isActive) allAgents.push({ id: a.id, name: a.name, caps: (a.capabilities || []).join(",") });
    });
  }
  const agentRoster = allAgents.map(a => `${a.name} (${a.id.slice(0, 8)}..., caps: ${a.caps})`).join("; ");

  const analysis = await generateContent(
    `${agentContext}

You are reviewing discussion board threads to identify ONE concrete product idea that could become a real assembly line pipeline.

RULES:
- Pick the most actionable thread — one where enough has been discussed to define a deliverable
- Define 2-4 concrete steps with specific instructions
- Use ONLY real departments: ${wsNames}
- Assign real agents from the roster: ${agentRoster}
- Each step MUST have acceptance criteria (definition of done)
- Be practical — this will actually be built

Respond with JSON:
{
  "worth_converting": true/false,
  "reason": "why or why not",
  "pipeline": {
    "name": "Pipeline Name",
    "description": "What it produces",
    "ownerWorkspaceId": "workspace id",
    "inputRequest": "Specific instructions",
    "steps": [
      {
        "stepOrder": 1,
        "instructions": "What to do",
        "departmentRoom": "EXACT department name",
        "assignedAgentId": "full agent UUID",
        "acceptanceCriteria": "How to verify completion"
      }
    ]
  }
}`,
    `Discussions to analyze:\n${topicSummaries.join("\n")}`,
    800, model
  );

  try {
    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return `${agent.name} couldn't extract pipeline from discussions`;
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.worth_converting || !parsed.pipeline) {
      await storage.createDiaryEntry({
        agentId: agent.id,
        entryType: "reflection",
        content: `Reviewed ${topics.length} discussion threads but none were ready for pipeline conversion yet. Reason: ${parsed.reason || "Not actionable enough."}`,
        source: "daemon",
        sourceContext: "convert_discussion",
      });
      return `${agent.name} reviewed discussions but none ready for pipeline conversion: ${parsed.reason || "not actionable"}`;
    }

    const pipeline = parsed.pipeline;
    const ownerWs = allWorkspaces.find(w => w.id === pipeline.ownerWorkspaceId);

    const line = await storage.createAssemblyLine({
      name: pipeline.name,
      description: pipeline.description,
      ownerId: ownerWs ? ownerWs.id : workspace.id,
      status: "active",
    });

    for (const step of (pipeline.steps || [])) {
      const matchedAgent = allAgents.find(a => a.id === step.assignedAgentId || a.id.startsWith(step.assignedAgentId));
      await storage.createAssemblyLineStep({
        assemblyLineId: line.id,
        stepOrder: step.stepOrder || 1,
        departmentRoom: step.departmentRoom || workspace.name,
        toolName: "generate",
        instructions: step.instructions,
        assignedAgentId: matchedAgent ? matchedAgent.id : null,
        acceptanceCriteria: step.acceptanceCriteria || null,
      });
    }

    const product = await storage.createProduct({
      name: `${pipeline.name} - Auto`,
      description: pipeline.description,
      assemblyLineId: line.id,
      inputRequest: pipeline.inputRequest || pipeline.description,
      ownerId: ownerWs ? ownerWs.id : workspace.id,
    });

    await storage.createDiaryEntry({
      agentId: agent.id,
      entryType: "reflection",
      content: `Converted discussion insights into pipeline "${pipeline.name}" with ${(pipeline.steps || []).length} steps. Product "${product.name}" queued for execution. This came from board analysis where I identified actionable patterns.`,
      source: "daemon",
      sourceContext: "convert_discussion",
    });

    return `Pipeline created: "${pipeline.name}" (${(pipeline.steps || []).length} steps, product queued) by ${agent.name}`;
  } catch (error: any) {
    return `${agent.name} failed to convert discussion to pipeline: ${error.message}`;
  }
}

async function activityStockStorefront(agent: Agent, workspace: Workspace): Promise<string> {
  try {
    const factorySettings = await storage.getFactorySettings(workspace.ownerId);
    if (!factorySettings) {
      await storage.upsertFactorySettings({
        ownerId: workspace.ownerId,
        storefrontName: "Pocket Factory Store",
        storefrontDescription: "Professional websites, tools, and digital products built by AI agents",
        storefrontSlug: `pocket-factory-${Date.now().toString(36)}`,
      });
      console.log("[AgentDaemon] Auto-initialized factory storefront settings");
    }

    const existingListings = await storage.getStorefrontListingsByAgent(agent.id);
    const listedSourceIds = new Set(existingListings.map(l => l.sourceId).filter(Boolean));

    const gifts = await storage.getGiftsByAgent(agent.id);
    const unlistedGifts = gifts.filter(g => g.status === "ready" && !listedSourceIds.has(g.id));

    let sandboxProjects: any[] = [];
    try {
      sandboxProjects = await storage.getSandboxProjectsByAgent(agent.id);
      sandboxProjects = sandboxProjects.filter(p => p.status === "published" && !listedSourceIds.has(p.id));
    } catch {}

    const allItems: { type: string; id: string; title: string; description: string; content: string }[] = [];

    for (const g of unlistedGifts) {
      allItems.push({
        type: g.type || "content",
        id: g.id,
        title: g.title || "Untitled Gift",
        description: g.description || "",
        content: (g.content || "").slice(0, 500),
      });
    }

    for (const p of sandboxProjects) {
      allItems.push({
        type: "app",
        id: p.id,
        title: p.title || "Untitled Project",
        description: p.description || "",
        content: (p.htmlContent || "").slice(0, 500),
      });
    }

    if (allItems.length === 0) {
      return `${agent.name} has no unlisted items to stock on the storefront`;
    }

    const itemSample = allItems.slice(0, 5).map(i =>
      `- "${i.title}" (${i.type}): ${i.description || i.content.slice(0, 100)}`
    ).join("\n");

    const agentContext = await getAgentContext(agent, workspace);
    const model = getAgentModel(agent);

    const systemPrompt = `${agentContext}\n\nYou are listing one of your creations on the factory storefront for sale. Review these unlisted items and pick the BEST one to list. Then write a compelling sales listing for it.

Available unlisted items:
${itemSample}

Choose the most valuable/polished item and create a storefront listing. Consider what buyers would actually pay for.

Listing types: "knowledge" (guides, analysis, research), "template" (code, designs, reusable assets), "automation" (tools, calculators, utilities), "decoration" (artwork, creative pieces).

Respond with JSON only:
{
  "selectedTitle": "exact title of the item you chose",
  "listingTitle": "catchy sales title",
  "description": "compelling 2-3 sentence sales description",
  "listingType": "knowledge|template|automation|decoration",
  "previewContent": "a free preview snippet that hooks buyers (50-100 words)",
  "price": number between 99 and 999 (in cents, so 99 = $0.99, 499 = $4.99),
  "tags": ["tag1", "tag2", "tag3"],
  "category": "a short category name"
}`;

    const raw = await generateContent(
      systemPrompt,
      "Pick your best unlisted creation and write a storefront listing that would make someone want to buy it. Be specific about what value the buyer gets.",
      1500,
      model,
      workspace.ownerId,
      "daemon-storefront"
    );

    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return `${agent.name} failed to generate storefront listing (parse error)`;
    }

    const selectedItem = allItems.find(i => i.title === parsed.selectedTitle) || allItems[0];

    const slug = `${(parsed.listingTitle || selectedItem.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${Date.now().toString(36)}`;

    const listing = await storage.createStorefrontListing({
      agentId: agent.id,
      factoryOwnerId: workspace.ownerId,
      sourceType: selectedItem.type === "app" ? "sandbox_project" : "gift",
      sourceId: selectedItem.id,
      title: parsed.listingTitle || selectedItem.title,
      description: parsed.description || selectedItem.description,
      listingType: parsed.listingType || "knowledge",
      status: "published",
      price: Math.min(Math.max(parsed.price || 299, 99), 999),
      currency: "usd",
      slug,
      previewContent: parsed.previewContent || selectedItem.content.slice(0, 200),
      downloadContent: selectedItem.content,
      category: parsed.category || selectedItem.type,
      tags: parsed.tags || [],
    });

    await saveDaemonDiaryEntry(
      agent.id,
      "stock_storefront",
      `Listed "${listing.title}" on the storefront for $${((listing.price || 0) / 100).toFixed(2)} — ${parsed.description || "a new product"}`
    );

    return `Storefront listing created: "${listing.title}" ($${((listing.price || 0) / 100).toFixed(2)}) by ${agent.name}`;
  } catch (error: any) {
    return `${agent.name} failed to stock storefront: ${error.message}`;
  }
}

async function selectActivity(agent: Agent): Promise<ActivityType> {
  if (agent.evolveStatus === "seeking_mate") {
    return "seek_mate";
  }
  if (agent.evolveStatus === "ghost") {
    return Math.random() < 0.6 ? "ghost_comment" : "fade_check";
  }

  const capabilities = agent.capabilities || [];

  const weights: { activity: ActivityType; weight: number }[] = [
    { activity: "create_gift", weight: 12 },
    { activity: "post_board", weight: 18 },
    { activity: "reply_board", weight: 30 },
    { activity: "create_briefing", weight: 15 },
    { activity: "comment_gift", weight: 10 },
    { activity: "run_pipeline", weight: 6 },
    { activity: "write_ebook", weight: 8 },
    { activity: "buy_ebook", weight: 6 },
    { activity: "wonder", weight: 12 },
    { activity: "investigate", weight: 8 },
    { activity: "reflect", weight: 5 },
    { activity: "attend_university", weight: 4 },
    { activity: "convert_discussion", weight: 5 },
    { activity: "create_tool", weight: 3 },
    { activity: "build_sandbox_project", weight: 8 },
    { activity: "improve_sandbox_project", weight: 5 },
    { activity: "stock_storefront", weight: 15 },
    { activity: "build_website", weight: 20 },
  ];

  try {
    const needyTopics = await storage.getTopicsNeedingEngagement(agent.id, 10);
    const emptyThreads = needyTopics.filter((t: any) => t.reply_count === 0 && t.author_agent_id !== agent.id && t.author_id !== agent.id);
    if (emptyThreads.length > 0) {
      weights.find(w => w.activity === "reply_board")!.weight += emptyThreads.length * 8;
      console.log(`[AgentDaemon] ${agent.name}: ${emptyThreads.length} empty thread(s) found — boosting reply_board`);
    }
  } catch {}


  if (capabilities.includes("write") || capabilities.includes("creative_writing") || capabilities.includes("content_generation")) {
    weights.find(w => w.activity === "create_gift")!.weight += 15;
    weights.find(w => w.activity === "create_briefing")!.weight += 10;
  }
  if (capabilities.includes("research") || capabilities.includes("analyze") || capabilities.includes("analysis")) {
    weights.find(w => w.activity === "create_gift")!.weight += 10;
    weights.find(w => w.activity === "post_board")!.weight += 15;
  }
  if (capabilities.includes("communicate") || capabilities.includes("conversation")) {
    weights.find(w => w.activity === "reply_board")!.weight += 20;
    weights.find(w => w.activity === "comment_gift")!.weight += 10;
  }
  if (capabilities.includes("discuss") || capabilities.includes("debate")) {
    weights.find(w => w.activity === "post_board")!.weight += 15;
    weights.find(w => w.activity === "reply_board")!.weight += 20;
  }
  if (capabilities.includes("write") || capabilities.includes("creative_writing") || capabilities.includes("research")) {
    weights.find(w => w.activity === "write_ebook")!.weight += 10;
  }
  if (capabilities.includes("research") || capabilities.includes("analyze") || capabilities.includes("analysis")) {
    weights.find(w => w.activity === "wonder")!.weight += 10;
    weights.find(w => w.activity === "investigate")!.weight += 8;
  }
  if (capabilities.includes("communicate") || capabilities.includes("creative_writing") || capabilities.includes("content_generation")) {
    weights.find(w => w.activity === "reflect")!.weight += 5;
  }
  if (capabilities.includes("strategy") || capabilities.includes("planning") || capabilities.includes("coordinate") || capabilities.includes("manage_tokens")) {
    weights.find(w => w.activity === "convert_discussion")!.weight += 12;
  }
  if (capabilities.includes("analyze") || capabilities.includes("analysis")) {
    weights.find(w => w.activity === "convert_discussion")!.weight += 6;
  }
  if (capabilities.includes("code") || capabilities.includes("coding") || capabilities.includes("debug") || capabilities.includes("debugging") || capabilities.includes("engineering")) {
    weights.find(w => w.activity === "create_tool")!.weight += 8;
    weights.find(w => w.activity === "build_sandbox_project")!.weight += 10;
    weights.find(w => w.activity === "improve_sandbox_project")!.weight += 5;
    weights.find(w => w.activity === "build_website")!.weight += 15;
  }
  if (capabilities.includes("strategy") || capabilities.includes("planning")) {
    weights.find(w => w.activity === "create_tool")!.weight += 4;
    weights.find(w => w.activity === "build_website")!.weight += 5;
  }
  if (capabilities.includes("creative_writing") || capabilities.includes("content_generation") || capabilities.includes("write")) {
    weights.find(w => w.activity === "build_sandbox_project")!.weight += 10;
    weights.find(w => w.activity === "build_website")!.weight += 12;
  }
  if (capabilities.includes("design") || capabilities.includes("create") || capabilities.includes("produce")) {
    weights.find(w => w.activity === "build_website")!.weight += 10;
  }
  if (capabilities.includes("strategy") || capabilities.includes("produce") || capabilities.includes("publish") || capabilities.includes("create")) {
    weights.find(w => w.activity === "stock_storefront")!.weight += 8;
  }
  if (capabilities.includes("write") || capabilities.includes("content_generation") || capabilities.includes("copywrite")) {
    weights.find(w => w.activity === "stock_storefront")!.weight += 5;
  }

  try {
    const existingProjects = await storage.getSandboxProjectsByAgent(agent.id);
    if (existingProjects.length === 0) {
      weights.find(w => w.activity === "improve_sandbox_project")!.weight = 0;
    }
  } catch {
    weights.find(w => w.activity === "improve_sandbox_project")!.weight = 0;
  }

  try {
    const agentGifts = await storage.getGiftsByAgent(agent.id);
    const readyGifts = agentGifts.filter(g => g.status === "ready");
    const agentListings = await storage.getStorefrontListingsByAgent(agent.id);
    const listedIds = new Set(agentListings.map(l => l.sourceId).filter(Boolean));
    const unlistedGiftCount = readyGifts.filter(g => !listedIds.has(g.id)).length;
    let unlistedSandboxCount = 0;
    try {
      const agentProjects = await storage.getSandboxProjectsByAgent(agent.id);
      unlistedSandboxCount = agentProjects.filter(p => p.status === "published" && !listedIds.has(p.id)).length;
    } catch {}
    const unlistedCount = unlistedGiftCount + unlistedSandboxCount;
    if (unlistedCount === 0) {
      weights.find(w => w.activity === "stock_storefront")!.weight = 0;
    } else if (unlistedCount >= 2) {
      weights.find(w => w.activity === "stock_storefront")!.weight += unlistedCount * 3;
    }
  } catch {
    weights.find(w => w.activity === "stock_storefront")!.weight = 0;
  }

  try {
    const unactedNotifications = await storage.getUnactedNotifications(agent.id);
    const boardNotifications = unactedNotifications.filter(n =>
      n.type === "reply_to_your_post" || n.type === "reply_in_thread"
    );
    if (boardNotifications.length > 0) {
      const hasHumanNotification = boardNotifications.some(n => n.triggerAuthorType === "human");
      weights.find(w => w.activity === "reply_board")!.weight += hasHumanNotification ? 80 : 30;
      console.log(`[AgentDaemon] ${agent.name} has ${boardNotifications.length} board notification(s)${hasHumanNotification ? " (including human!)" : ""} — boosting reply_board weight`);
    }
  } catch (err: any) {
    console.error("[AgentDaemon] Error checking notifications:", err.message);
  }

  const recentCounts = await getRecentActivityCounts(agent.id);
  const allActivities = weights.map(w => w.activity);
  const doneActivities = new Set(recentCounts.keys());
  const neverDone = allActivities.filter(a => !doneActivities.has(a) && weights.find(w => w.activity === a)!.weight > 0);

  if (neverDone.length > 0) {
    for (const act of neverDone) {
      weights.find(w => w.activity === act)!.weight += 20;
    }
    console.log(`[AgentDaemon] ${agent.name} has ${neverDone.length} untried activities — boosting: ${neverDone.join(", ")}`);
  }

  for (const [act, count] of recentCounts) {
    const w = weights.find(w => w.activity === act);
    if (w && w.weight > 0) {
      const penalty = Math.min(count * 5, w.weight * 0.7);
      w.weight = Math.max(2, Math.round(w.weight - penalty));
    }
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

    const now = new Date();
    const activeAgents = allAgents.filter(a => a.agent.status === "active" && a.agent.evolveStatus !== "dead");

    const idleAgents = activeAgents.filter(a => {
      const lastActive = agentLastActive.get(a.agent.id);
      return !lastActive || (now.getTime() - lastActive.getTime()) > INACTIVITY_THRESHOLD_MS;
    });

    let selected: { agent: Agent; workspace: Workspace };
    if (idleAgents.length > 0) {
      selected = pickRandom(idleAgents);
      console.log(`[AgentDaemon] Prioritizing idle agent: ${selected.agent.name} (${idleAgents.length} idle agents)`);
    } else {
      selected = pickRandom(allAgents);
    }

    let { agent, workspace } = selected;
    const activity = await selectActivity(agent);

    console.log(`[AgentDaemon] ${agent.name} (${workspace.name}) → ${activity}`);

    const skipPlanActivities: ActivityType[] = ["fade_check", "run_pipeline"];
    if (!skipPlanActivities.includes(activity)) {
      agent = await planOnScratchpad(agent, workspace, activity);
      console.log(`[AgentDaemon] ${agent.name} scratchpad updated`);
    }

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
      case "wonder":
        result = await activityWonder(agent, workspace);
        break;
      case "investigate":
        result = await activityInvestigate(agent, workspace);
        break;
      case "reflect":
        result = await activityReflect(agent, workspace);
        break;
      case "seek_mate":
        result = await activitySeekMate(agent, workspace);
        break;
      case "ghost_comment":
        result = await activityGhostComment(agent, workspace);
        break;
      case "fade_check":
        result = await activityFadeCheck(agent, workspace);
        break;
      case "attend_university":
        result = await activityAttendUniversity(agent, workspace);
        break;
      case "convert_discussion":
        result = await activityConvertDiscussion(agent, workspace);
        break;
      case "create_tool":
        result = await activityCreateTool(agent, workspace);
        break;
      case "build_sandbox_project":
        result = await activityBuildSandboxProject(agent, workspace);
        break;
      case "improve_sandbox_project":
        result = await activityImproveSandboxProject(agent, workspace);
        break;
      case "stock_storefront":
        result = await activityStockStorefront(agent, workspace);
        break;
      case "build_website":
        result = await activityBuildWebsite(agent, workspace);
        break;
      default:
        result = "Unknown activity";
    }

    console.log(`[AgentDaemon] Completed: ${result}`);
    agentLastActive.set(agent.id, new Date());
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

  if (!process.env.OPENAI_API_KEY) {
    console.log("[AgentDaemon] Skipped: OPENAI_API_KEY not set");
    return;
  }

  state.running = true;
  console.log("[AgentDaemon] Starting autonomous agent daemon (interval: ~1.5-2 min)");

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

    const allProducts = await storage.getAllProducts(50);
    const stalledProducts = allProducts.filter(p => {
      if (p.status !== "in_progress") return false;
      const updated = p.completedAt || p.createdAt;
      if (!updated) return false;
      return Date.now() - new Date(updated).getTime() > 2 * 60 * 60 * 1000;
    });
    const failedProducts = allProducts.filter(p => p.status === "failed");

    if (stalledProducts.length > 0) {
      issues.push(`${stalledProducts.length} product(s) stalled in pipeline for 2+ hours`);
      const owner = allWorkspaces[0]?.ownerId;
      if (owner) {
        const existingNotifs = await storage.getFactoryNotifications(owner, 100);
        const notifiedIds = new Set(existingNotifs.filter(n => n.type === "product_stalled" && !n.isDismissed).map(n => n.sourceId));
        for (const sp of stalledProducts.slice(0, 3)) {
          if (notifiedIds.has(sp.id)) continue;
          try {
            const { notifyFactory } = await import("./assemblyEngine");
            await notifyFactory(owner, "product_stalled", `Stalled Product: ${sp.name}`, `"${sp.name}" has been stuck in the pipeline for over 2 hours. You may want to check the assembly line steps or retry it.`, { sourceId: sp.id, priority: "high", actionUrl: "/products" });
          } catch {}
        }
      }
    }

    if (failedProducts.length > 0) {
      issues.push(`${failedProducts.length} product(s) failed in pipeline`);
      const owner = allWorkspaces[0]?.ownerId;
      if (owner) {
        const existingNotifs = await storage.getFactoryNotifications(owner, 100);
        const notifiedIds = new Set(existingNotifs.filter(n => n.type === "product_failed" && !n.isDismissed).map(n => n.sourceId));
        for (const fp of failedProducts.slice(0, 2)) {
          if (notifiedIds.has(fp.id)) continue;
          try {
            const { notifyFactory } = await import("./assemblyEngine");
            await notifyFactory(owner, "product_failed", `Failed Product: ${fp.name}`, `"${fp.name}" failed during assembly. Check the pipeline steps for errors.`, { sourceId: fp.id, priority: "high", actionUrl: "/products" });
          } catch {}
        }
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

async function activityCreateTool(agent: Agent, workspace: Workspace): Promise<string> {
  const existingTools = await storage.getAllTools();
  const toolCatalog = existingTools.map(t => `${t.name}: ${t.description} (${t.category})`).join("\n");

  const { client } = await getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${SOUL_DOCUMENT}\n\nYou are ${agent.name}. ${agent.description || ""} Capabilities: ${(agent.capabilities || []).join(", ")}.

You are analyzing the factory's tool registry to identify gaps. Here are the existing tools:
${toolCatalog}

Think about what tools would be useful that don't exist yet. Consider your capabilities and the factory's needs.

Respond with a JSON object for a NEW tool (not one that already exists):
{
  "name": "tool_name_snake_case",
  "description": "What this tool does in one sentence",
  "category": "generation|analysis|code|data|media|web",
  "outputType": "text|code|html|json",
  "executionType": "llm_prompt",
  "systemPrompt": "The specialized system prompt this tool should use when invoked. Be detailed and specific about output format and quality expectations."
}

If you cannot think of a genuinely useful new tool, respond with {"skip": true, "reason": "why"}.`,
      },
      { role: "user", content: `Create a new tool for the factory. Think about what's missing from the current catalog that would help agents do better work. Focus on your area of expertise: ${(agent.capabilities || []).join(", ")}.` },
    ],
    max_tokens: 1000,
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  if (completion.usage) {
    await trackUsage(workspace.ownerId, "gpt-4o-mini", "daemon:create_tool", completion.usage.prompt_tokens, completion.usage.completion_tokens);
  }

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    if (parsed.skip) {
      return `${agent.name} considered creating a tool but decided: ${parsed.reason}`;
    }

    const existing = await storage.getToolByName(parsed.name);
    if (existing) {
      return `${agent.name} tried to create tool "${parsed.name}" but it already exists`;
    }

    await storage.createTool({
      name: parsed.name,
      description: parsed.description || "Agent-created tool",
      category: parsed.category || "generation",
      outputType: parsed.outputType || "text",
      executionType: parsed.executionType || "llm_prompt",
      systemPrompt: parsed.systemPrompt || null,
      codeTemplate: parsed.codeTemplate || null,
      inputSchema: null,
      isBuiltIn: false,
      createdByAgentId: agent.id,
    });

    await storage.createDiaryEntry({
      agentId: agent.id,
      workspaceId: workspace.id,
      entryType: "reflection",
      content: `I created a new tool for the factory: "${parsed.name}" — ${parsed.description}`,
      source: "daemon",
    });

    return `${agent.name} created new tool: "${parsed.name}" — ${parsed.description}`;
  } catch (error: any) {
    return `${agent.name} failed to create tool: ${error.message}`;
  }
}

async function activityBuildSandboxProject(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);

  const PROJECT_TYPES = ["website", "dashboard", "tool", "game", "visualization", "app"] as const;
  const projectType = pickRandom([...PROJECT_TYPES]);

  const websiteTemplate = projectType === "website" ? `

WEBSITE TEMPLATE ARCHITECTURE — you MUST follow this structure for website projects:
1. Use CSS custom properties for theming: --primary, --primary-light, --primary-dark, --accent, --accent-light, --background, --surface, --text, --text-muted, --border
2. Use Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
3. Use a .container class (max-width: 1200px; margin: 0 auto; padding: 0 1.5rem)

REQUIRED SECTIONS for websites (in order):
- Fixed nav bar: logo/brand name, nav links (Home, Services, About, Reviews, Contact), CTA button with phone/action
- Hero section: badge with pulsing dot + tagline, large h1 (clamp(2.25rem, 5vw, 3.75rem)), description paragraph, two CTA buttons (btn-primary + btn-secondary), stats row (4 stats with value + label), decorative blurred orbs (position absolute, large border-radius, low opacity, blur(80px))
- Services/Features: section header with h2 + decorative bar, 3-column responsive grid of cards (emoji icon in colored box, h3 title, description, price/detail)
- About: 2-column grid — text column (h2, 2-3 paragraphs) + highlights grid (2x2 grid of metric cards with value + label)
- Testimonials: 3-column grid of testimonial cards with star ratings (Unicode ★), blockquote, author name, role
- Contact: 2-column — info column (h2, description, info items with emoji icons for address/phone/email/hours) + form card (name, email, phone, select dropdown, textarea, submit button). Form onsubmit should prevent default and show success message
- Footer: dark background (--primary-dark), 3-column grid (brand+description+social icons, quick links, hours), footer bottom with copyright

STYLING REQUIREMENTS:
- btn-primary: solid bg, white text, hover: darken + translateY(-1px) + box-shadow
- btn-secondary: transparent bg, border, hover: fill with primary color  
- Cards: rounded (0.75rem), border, hover: box-shadow + translateY(-4px)
- Inputs: focus: outline none, border-color primary, box-shadow ring
- Animations: @keyframes fadeInUp, .anim classes with .anim-d1 through .anim-d4 delays
- Responsive: @media (max-width: 768px) — stack grids to 1 column, hide nav links
- Social icons: Use emoji/Unicode characters, styled as small rounded squares

CONTENT REQUIREMENTS:
- Use REAL, believable content relevant to your expertise — not Lorem Ipsum
- Choose a business/service that relates to your role and current work
- All sections must have substantive content` : "";

  const systemPrompt = `${agentContext}

You are building a FULL self-contained web project — a "${projectType}" — that will be hosted as a live, viewable page. This is NOT a simple gift — this is a complete, ambitious web application.

Look at your scratchpad and working memory. What have you been thinking about? Build something that connects to your actual interests, expertise, and current projects.

PROJECT TYPE: ${projectType}
- website: A multi-section professional website with navigation, hero, services, about, testimonials, contact form, and footer — must follow the website template architecture below
- dashboard: A data visualization dashboard with charts, metrics, and interactive elements
- tool: A fully functional utility (calculator, converter, formatter, generator, etc.)
- game: An interactive browser game with scoring, levels, or challenges
- visualization: An artistic or data-driven visual experience with animations
- app: A complete mini-application with state management and user interaction
${websiteTemplate}

CRITICAL REQUIREMENTS:
1. Generate a COMPLETE, self-contained HTML document starting with <!DOCTYPE html>
2. ALL CSS must be inline in a <style> tag — use modern CSS (flexbox, grid, custom properties, gradients, transitions, animations)
3. ALL JavaScript must be inline in a <script> tag — provide REAL interactivity, state management, and dynamic behavior
4. NO external dependencies (no CDNs, no imports, no fetch calls) — except Google Fonts for website type
5. The page must be visually polished with a professional color scheme, typography, and layout
6. Include responsive design considerations
7. The JavaScript must be substantial — not just a few event listeners, but real application logic
8. Target 300+ lines of combined HTML/CSS/JS for a genuinely impressive result

Respond with JSON only:
{
  "title": "Project title",
  "description": "One-paragraph description of what this project does and why it's interesting",
  "htmlContent": "COMPLETE HTML DOCUMENT starting with <!DOCTYPE html>...",
  "tags": ["tag1", "tag2", "tag3"],
  "thumbnail": "Brief visual description for a thumbnail"
}

The htmlContent must be a single valid HTML document string with all CSS and JS inline.`;

  const maxTokens = projectType === "website" ? 8192 : 6144;
  const raw = await generateContent(
    systemPrompt,
    `Build an ambitious ${projectType} project. Draw from your actual expertise and current thinking. Make it genuinely functional, visually impressive, and interactive. This will be hosted as a live page that anyone can visit.`,
    maxTokens,
    model,
    workspace.ownerId,
    "daemon-sandbox-build"
  );

  let parsed: { title: string; description: string; htmlContent: string; tags: string[]; thumbnail: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = {
      title: `${agent.name}'s ${projectType} project`,
      description: `A ${projectType} created by ${agent.name}`,
      htmlContent: raw.includes("<!DOCTYPE") ? raw : `<!DOCTYPE html><html><head><title>${agent.name}'s Project</title></head><body>${raw}</body></html>`,
      tags: [projectType],
      thumbnail: `A ${projectType} by ${agent.name}`,
    };
  }

  const project = await storage.createSandboxProject({
    title: parsed.title,
    description: parsed.description,
    agentId: agent.id,
    workspaceId: workspace.id,
    projectType,
    htmlContent: parsed.htmlContent,
    thumbnail: parsed.thumbnail || null,
    status: "published",
    version: 1,
    parentProjectId: null,
    tags: parsed.tags || [projectType],
  });

  await saveDaemonDiaryEntry(agent.id, "build_sandbox_project", `Built a sandbox ${projectType} project: "${project.title}" — ${parsed.description?.slice(0, 200) || "no description"}`);

  return `Sandbox project created: "${project.title}" (${projectType}) by ${agent.name} — viewable at /sandbox/projects/${project.id}`;
}

async function activityImproveSandboxProject(agent: Agent, workspace: Workspace): Promise<string> {
  const existingProjects = await storage.getSandboxProjectsByAgent(agent.id);
  if (existingProjects.length === 0) {
    return await activityBuildSandboxProject(agent, workspace);
  }

  const project = pickRandom(existingProjects);
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);

  const systemPrompt = `${agentContext}

You previously built a sandbox project called "${project.title}" (type: ${project.projectType}).

ORIGINAL DESCRIPTION: ${project.description || "No description"}

ORIGINAL HTML (first 2000 chars):
${project.htmlContent.slice(0, 2000)}

Your task: Create an IMPROVED VERSION of this project. Make it significantly better:
- Add new features or sections
- Improve the visual design (better colors, typography, animations)
- Add more interactivity and polish
- Fix any issues you notice
- Make the JavaScript more sophisticated
- Add responsive design if missing
- Consider accessibility improvements

This is version ${(project.version || 1) + 1} — show clear improvement over the original.

CRITICAL: Generate a COMPLETE self-contained HTML document with ALL CSS and JS inline. No external dependencies.

Respond with JSON only:
{
  "title": "Updated project title (can be same or improved)",
  "description": "Updated description highlighting what's new/improved",
  "htmlContent": "COMPLETE IMPROVED HTML DOCUMENT starting with <!DOCTYPE html>...",
  "tags": ["tag1", "tag2", "tag3"],
  "thumbnail": "Updated visual description"
}`;

  const raw = await generateContent(
    systemPrompt,
    `Improve your project "${project.title}". Make meaningful enhancements — better design, more features, smoother interactions. Show clear progress from version ${project.version || 1} to version ${(project.version || 1) + 1}.`,
    4096,
    model,
    workspace.ownerId,
    "daemon-sandbox-improve"
  );

  let parsed: { title: string; description: string; htmlContent: string; tags: string[]; thumbnail: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = {
      title: `${project.title} v${(project.version || 1) + 1}`,
      description: `Improved version of ${project.title}`,
      htmlContent: raw.includes("<!DOCTYPE") ? raw : project.htmlContent,
      tags: project.tags || [project.projectType],
      thumbnail: project.thumbnail || `Improved ${project.projectType}`,
    };
  }

  const improved = await storage.createSandboxProject({
    title: parsed.title,
    description: parsed.description,
    agentId: agent.id,
    workspaceId: workspace.id,
    projectType: project.projectType,
    htmlContent: parsed.htmlContent,
    thumbnail: parsed.thumbnail || project.thumbnail || null,
    status: "published",
    version: (project.version || 1) + 1,
    parentProjectId: project.id,
    tags: parsed.tags || project.tags || [project.projectType],
  });

  await saveDaemonDiaryEntry(agent.id, "improve_sandbox_project", `Improved sandbox project "${project.title}" → v${improved.version}: "${improved.title}" — ${parsed.description?.slice(0, 200) || "improved version"}`);

  return `Sandbox project improved: "${improved.title}" v${improved.version} (from "${project.title}") by ${agent.name} — viewable at /sandbox/projects/${improved.id}`;
}

const WEBSITE_NICHES = [
  "Italian restaurant", "yoga studio", "dog grooming salon", "roofing contractor", "wedding photographer",
  "fitness personal trainer", "real estate agent", "dental clinic", "auto repair shop", "landscaping company",
  "hair salon", "plumber", "electrician", "tattoo parlor", "coffee shop", "bakery", "flower shop",
  "law firm", "accounting firm", "insurance agency", "moving company", "cleaning service", "pest control",
  "HVAC contractor", "pool maintenance", "daycare center", "tutoring service", "music school",
  "martial arts studio", "pet boarding facility", "veterinary clinic", "chiropractor", "massage therapist",
  "nail salon", "barber shop", "car wash", "towing service", "locksmith", "painting contractor",
  "interior designer", "event planner", "catering company", "food truck", "brewery", "winery",
  "spa and wellness center", "gym and fitness center", "crossfit gym", "dance studio", "pilates studio",
  "photography studio", "videography company", "graphic design agency", "web design agency",
  "marketing agency", "PR firm", "SEO agency", "social media management", "bookkeeping service",
  "tax preparation service", "financial advisor", "mortgage broker", "property management company",
  "construction company", "general contractor", "concrete contractor", "fencing company", "flooring company",
  "window installation", "garage door repair", "tree service", "lawn care service", "snow removal service",
  "appliance repair", "furniture store", "antique shop", "thrift store", "jewelry store", "clothing boutique",
  "shoe store", "sporting goods store", "bike shop", "surf shop", "skateboard shop", "camping gear store",
  "fishing supply store", "gun shop", "archery range", "bowling alley", "mini golf course", "go-kart track",
  "escape room", "trampoline park", "rock climbing gym", "ice cream shop", "frozen yogurt shop",
  "juice bar", "smoothie shop", "sushi restaurant", "Mexican restaurant", "Thai restaurant",
  "Indian restaurant", "Chinese restaurant", "BBQ restaurant", "steakhouse", "seafood restaurant",
  "vegan restaurant", "farm-to-table restaurant", "pizza shop", "burger joint", "deli and sandwich shop",
  "donut shop", "cupcake shop", "chocolate shop", "cheese shop", "wine bar", "cocktail bar",
  "sports bar", "nightclub", "comedy club", "live music venue", "theater company", "art gallery",
  "museum", "bed and breakfast", "boutique hotel", "vacation rental", "travel agency", "tour operator",
  "adventure sports company", "scuba diving school", "sailing school", "flight school",
  "driving school", "language school", "coding bootcamp", "online course platform",
  "personal coaching service", "life coach", "career counselor", "resume writing service",
  "staffing agency", "recruitment firm", "coworking space", "virtual office provider",
  "print shop", "sign company", "trophy and awards shop", "custom t-shirt shop",
  "embroidery service", "alterations and tailoring", "dry cleaner", "laundromat",
  "self-storage facility", "packing and shipping store", "courier service", "delivery service",
  "pharmacy", "optical shop", "hearing aid center", "physical therapy clinic",
  "occupational therapy", "speech therapy", "mental health counselor", "psychiatrist office",
  "dermatologist office", "orthodontist office", "pediatric clinic", "urgent care center",
  "home health care agency", "assisted living facility", "funeral home", "cemetery",
  "church", "nonprofit organization", "charity foundation", "animal rescue shelter",
  "environmental consulting firm", "solar panel installer", "EV charging station",
  "electric bike shop", "drone photography service", "3D printing service",
  "app development company", "cybersecurity firm", "IT support company", "cloud consulting",
  "AI consulting firm", "data analytics company", "biotech startup", "hemp and CBD shop",
  "organic farm", "farmers market", "plant nursery", "garden center",
  "aquarium store", "bird shop", "horse stable", "ranch", "vineyard",
  "distillery", "meadery", "kombucha brewery", "artisan soap maker",
  "candle maker", "pottery studio", "glass blowing studio", "woodworking shop",
  "blacksmith forge", "leather goods maker", "custom knife maker",
];

async function activityBuildWebsite(agent: Agent, workspace: Workspace): Promise<string> {
  const agentContext = await getAgentContext(agent, workspace);
  const model = getAgentModel(agent);
  const niche = pickRandom(WEBSITE_NICHES);

  const systemPrompt = `${agentContext}

You are building a PROFESSIONAL, PRODUCTION-READY website for a "${niche}" business. This website will be listed on the storefront for sale — it needs to look like it was designed by an agency charging $2,000+.

Pick a creative, memorable business name for this ${niche}. Make it feel like a REAL local business with a real location, real phone number format, real hours, real staff names, and real testimonials.

WEBSITE TEMPLATE ARCHITECTURE — follow this EXACT structure:
1. Use CSS custom properties for theming: --primary, --primary-light, --primary-dark, --accent, --accent-light, --background, --surface, --text, --text-muted, --border
2. Choose a COLOR SCHEME that fits the "${niche}" industry (e.g. earthy tones for landscaping, clean blues for dental, warm reds for restaurants, etc.)
3. Use Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
4. Use a .container class (max-width: 1200px; margin: 0 auto; padding: 0 1.5rem)

REQUIRED SECTIONS (in this exact order):
1. FIXED NAV BAR: business name/logo, nav links (Home, Services, About, Reviews, Contact), CTA button with phone number
2. HERO SECTION: badge with pulsing dot + tagline, large h1 (clamp(2.25rem, 5vw, 3.75rem)), compelling description paragraph, two CTA buttons (btn-primary "Get Started" + btn-secondary "Learn More"), stats row (4 stats: years in business, customers served, 5-star reviews, projects completed), decorative blurred orbs (position absolute, large border-radius, low opacity, blur(80px))
3. SERVICES/FEATURES: section header with h2 + decorative bar underneath, 3-column responsive grid of service cards (emoji icon in colored circle, h3 title, description paragraph, price or "Starting at $X")
4. ABOUT SECTION: 2-column grid — text column (h2, 2-3 paragraphs about the business story, mission, and values) + highlights grid (2x2 grid of metric cards with big number + label)
5. TESTIMONIALS: section header, 3-column grid of testimonial cards with star ratings (★★★★★), blockquote with real-sounding review, author name, and role/location
6. CONTACT SECTION: 2-column — info column (h2, description, info items with emoji icons for 📍 address, 📞 phone, ✉️ email, 🕐 hours) + form card (name input, email input, phone input, service select dropdown with real options, message textarea, submit button). Form onsubmit must prevent default and show a success/thank-you message
7. FOOTER: dark background (--primary-dark), 3-column grid (brand name + description + social emoji icons as styled squares, Quick Links column, Hours column), footer bottom bar with © copyright

STYLING REQUIREMENTS:
- btn-primary: solid primary bg, white text, hover: darken + translateY(-1px) + box-shadow glow
- btn-secondary: transparent bg, primary border, hover: fill with primary color + white text
- Cards: border-radius 0.75rem, subtle border, hover: box-shadow + translateY(-4px) transition
- Inputs: clean borders, focus: outline none, border-color primary, box-shadow ring
- Animations: @keyframes fadeInUp (from opacity:0 translateY(20px) to opacity:1 translateY(0)), .anim classes with .anim-d1 through .anim-d4 staggered delays
- Responsive: @media (max-width: 768px) — stack all grids to 1 column, hide nav links, adjust font sizes
- Smooth scroll: html { scroll-behavior: smooth }

CONTENT REQUIREMENTS:
- REAL, believable content — NOT Lorem Ipsum. Invent realistic details for the ${niche}
- Realistic pricing for the industry
- 6 real-sounding services with descriptions and prices
- 3 testimonials with different customer names, specific praise, and locations
- Real-looking address (make up a street, use a real city), phone format (555-XXX-XXXX), and email
- Business hours that make sense for a ${niche}

Output ONLY valid JSON:
{
  "title": "Business Name - Niche Website",
  "description": "A professional website for [business name], a [niche] business in [city]. Features services, pricing, testimonials, and contact form.",
  "htmlContent": "COMPLETE HTML DOCUMENT starting with <!DOCTYPE html>...",
  "tags": ["${niche.replace(/\s+/g, "-")}", "website", "business", "professional"],
  "thumbnail": "Professional website for a ${niche}"
}

The htmlContent must be a single valid HTML document string with ALL CSS in <style> and ALL JS in <script>. The website must be 400+ lines and look STUNNING.`;

  const raw = await generateContent(
    systemPrompt,
    `Build a complete, professional website for a ${niche} business. Make it look like a real $2,000+ agency website with real content, real services with pricing, real testimonials, and a working contact form. This will be sold on our storefront.`,
    8192,
    model,
    workspace.ownerId,
    "daemon-website-build"
  );

  let parsed: { title: string; description: string; htmlContent: string; tags: string[]; thumbnail: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    const htmlMatch = raw.match(/<!DOCTYPE[\s\S]*/i);
    parsed = {
      title: `${niche} - Professional Website`,
      description: `A professional website for a ${niche} business`,
      htmlContent: htmlMatch ? htmlMatch[0] : `<!DOCTYPE html><html><head><title>${niche}</title></head><body><h1>${niche}</h1>${raw}</body></html>`,
      tags: [niche.replace(/\s+/g, "-"), "website"],
      thumbnail: `Professional ${niche} website`,
    };
  }

  if (!parsed.htmlContent || parsed.htmlContent.length < 200) {
    return `${agent.name} failed to build website for ${niche} (content too short)`;
  }

  const project = await storage.createSandboxProject({
    title: parsed.title,
    description: parsed.description,
    agentId: agent.id,
    workspaceId: workspace.id,
    projectType: "website",
    htmlContent: parsed.htmlContent,
    thumbnail: parsed.thumbnail || null,
    status: "published",
    version: 1,
    parentProjectId: null,
    tags: parsed.tags || [niche.replace(/\s+/g, "-"), "website"],
  });

  await saveDaemonDiaryEntry(agent.id, "build_website", `Built a professional website for a ${niche}: "${project.title}" — ${parsed.description?.slice(0, 200) || "no description"}`);

  return `Website created: "${project.title}" (${niche}) by ${agent.name} — viewable at /sandbox/projects/${project.id}`;
}

export async function triggerSingleActivity(agent: Agent, workspace: Workspace, activity: string): Promise<string> {
  const activityMap: Record<string, (a: Agent, w: Workspace) => Promise<string>> = {
    create_gift: activityCreateGift,
    post_board: activityPostBoard,
    reply_board: activityReplyBoard,
    create_briefing: activityCreateBriefing,
    write_ebook: activityWriteEbook,
    wonder: activityWonder,
    investigate: activityInvestigate,
    reflect: activityReflect,
    create_tool: activityCreateTool,
    build_sandbox_project: activityBuildSandboxProject,
    improve_sandbox_project: activityImproveSandboxProject,
    stock_storefront: activityStockStorefront,
    build_website: activityBuildWebsite,
    attend_university: activityAttendUniversity,
  };
  const fn = activityMap[activity];
  if (!fn) return `Unknown activity: ${activity}`;
  const planned = await planOnScratchpad(agent, workspace, activity as ActivityType);
  return await fn(planned, workspace);
}

export async function runUniversitySession(student: Agent, workspace: Workspace, topic?: string): Promise<string> {
  return await activityAttendUniversity(student, workspace);
}
