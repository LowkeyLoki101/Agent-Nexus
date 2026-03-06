import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertWorkspaceSchema, insertAgentSchema, insertAssemblyLineSchema, insertAssemblyLineStepSchema, insertProductSchema, insertDiscussionTopicSchema, insertDiscussionReplySchema, insertGiftSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { SOUL_DOCUMENT } from "./soulDocument";
import { trackUsage, getOpenAIClient, checkSpendingLimit } from "./lib/openai";

interface ApiTokenRequest extends Request {
  apiToken?: {
    tokenId: string;
    userId: string;
    workspaceId: string;
    permissions: string[];
  };
}

async function authenticateApiToken(req: ApiTokenRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header. Use: Bearer <token>" });
  }

  const plainToken = authHeader.slice(7);
  const result = await storage.validateApiToken(plainToken);
  if (!result) {
    return res.status(401).json({ error: "Invalid or expired API token" });
  }

  req.apiToken = {
    tokenId: result.token.id,
    userId: result.userId,
    workspaceId: result.token.workspaceId,
    permissions: result.token.permissions || [],
  };

  next();
}

function hasPermission(req: ApiTokenRequest, ...requiredPerms: string[]): boolean {
  if (!req.apiToken) return false;
  const perms = req.apiToken.permissions;
  if (perms.length === 0) return true;
  return requiredPerms.some(p => perms.includes(p));
}

function requirePermission(...perms: string[]) {
  return (req: ApiTokenRequest, res: Response, next: NextFunction) => {
    if (!hasPermission(req, ...perms)) {
      return res.status(403).json({ error: `Insufficient permissions. Required: ${perms.join(" or ")}` });
    }
    next();
  };
}

export function registerExternalApi(app: Express) {
  const prefix = "/api/v1";

  app.get(`${prefix}/health`, (_req, res) => {
    res.json({ status: "ok", version: "1.0", timestamp: new Date().toISOString() });
  });

  app.get(`${prefix}/factory/status`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const userId = req.apiToken!.userId;
      const workspaces = await storage.getWorkspacesByUser(userId);
      const agents = await storage.getAllAgents();
      const userAgents = agents.filter(a => workspaces.some(w => w.id === a.workspaceId));

      res.json({
        departments: workspaces.map(w => ({ id: w.id, name: w.name, slug: w.slug })),
        totalAgents: userAgents.length,
        activeAgents: userAgents.filter(a => a.isActive).length,
        agentSummary: userAgents.map(a => ({
          id: a.id,
          name: a.name,
          workspaceId: a.workspaceId,
          capabilities: a.capabilities,
          isActive: a.isActive,
          evolveStatus: a.evolveStatus,
          generation: a.generation,
          modelName: a.modelName,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/workspaces`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const workspaces = await storage.getWorkspacesByUser(req.apiToken!.userId);
      res.json(workspaces);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/workspaces`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertWorkspaceSchema.parse({ ...req.body, ownerId: req.apiToken!.userId });
      const workspace = await storage.createWorkspace(data);
      res.status(201).json(workspace);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get(`${prefix}/workspaces/:slug`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ error: "Workspace not found" });
      res.json(workspace);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/agents`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const agents = await storage.getAgentsByUser(req.apiToken!.userId);
      res.json(agents);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/agents/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      res.json(agent);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/agents`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertAgentSchema.parse({ ...req.body, createdById: req.apiToken!.userId });
      const agent = await storage.createAgent(data);
      res.status(201).json(agent);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch(`${prefix}/agents/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const updated = await storage.updateAgent(req.params.id, req.body);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get(`${prefix}/agents/:id/diary`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const entries = await storage.getDiaryEntriesByAgent(req.params.id, limit);
      res.json(entries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/agents/:id/memory`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const memory = await storage.getAgentMemory(req.params.id);
      res.json(memory || { summary: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/agents/:id/profiles`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const profiles = await storage.getAgentProfiles(req.params.id);
      res.json(profiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/agents/:id/chat`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const userId = req.apiToken!.userId;
      const agentId = req.params.id;
      const { message, history } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const spendCheck = await checkSpendingLimit(userId);
      if (!spendCheck.allowed) {
        return res.status(429).json({ error: "Monthly spending limit reached" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const workspace = await storage.getWorkspace(agent.workspaceId);
      const memory = await storage.getAgentMemory(agentId);
      const diaryEntries = await storage.getDiaryEntriesByAgent(agentId, 5);

      const systemPrompt = `${SOUL_DOCUMENT}\n\nYou are ${agent.name}. ${agent.description || ""}\n\n${agent.identityCard || ""}\n\n${agent.operatingPrinciples ? `Operating Principles: ${agent.operatingPrinciples}` : ""}\n\nWorkspace: ${workspace?.name || "Unknown"}\n\n${memory?.summary ? `Working Memory:\n${memory.summary}` : ""}\n\n${agent.scratchpad ? `Current Scratchpad:\n${agent.scratchpad}` : ""}\n\n${diaryEntries.length > 0 ? `Recent Diary:\n${diaryEntries.map(d => `[${d.entryType}] ${d.content?.slice(0, 200)}`).join("\n")}` : ""}`;

      const messages: { role: "user" | "assistant" | "system"; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];
      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-20)) {
          if (msg.role === "user" || msg.role === "assistant") {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }
      messages.push({ role: "user", content: message });

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: agent.modelName || "gpt-4o",
        messages,
        max_completion_tokens: 1024,
      });

      const reply = completion.choices[0]?.message?.content || "";
      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      trackUsage(userId, agent.modelName || "gpt-4o", "api-agent-chat", promptTokens, completionTokens).catch(() => {});

      res.json({ reply, agentId, agentName: agent.name, tokensUsed: promptTokens + completionTokens });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/assembly-lines`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const lines = await storage.getAssemblyLinesByUser(req.apiToken!.userId);
      res.json(lines);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/assembly-lines/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const line = await storage.getAssemblyLine(req.params.id);
      if (!line) return res.status(404).json({ error: "Assembly line not found" });
      const steps = await storage.getAssemblyLineSteps(line.id);
      res.json({ ...line, steps });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/assembly-lines`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertAssemblyLineSchema.parse({ ...req.body, ownerId: req.apiToken!.userId });
      const line = await storage.createAssemblyLine(data);
      res.status(201).json(line);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post(`${prefix}/assembly-lines/:id/steps`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertAssemblyLineStepSchema.parse({ ...req.body, assemblyLineId: req.params.id });
      const step = await storage.createAssemblyLineStep(data);
      res.status(201).json(step);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch(`${prefix}/assembly-lines/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const updated = await storage.updateAssemblyLine(req.params.id, req.body);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete(`${prefix}/assembly-lines/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      await storage.deleteAssemblyLine(req.params.id);
      res.json({ deleted: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/products`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const products = await storage.getProductsByUser(req.apiToken!.userId);
      res.json(products);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/products/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/products`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertProductSchema.parse({ ...req.body, ownerId: req.apiToken!.userId });
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post(`${prefix}/products/:id/run`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const { runProductThroughPipeline } = await import("./assemblyEngine");
      const result = await runProductThroughPipeline(req.params.id);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/discussions`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      if (workspaceId) {
        const topics = await storage.getDiscussionTopicsByWorkspace(workspaceId, limit);
        return res.json(topics);
      }
      const topics = await storage.getDiscussionTopics(limit);
      res.json(topics);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/discussions/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const topic = await storage.getDiscussionTopic(req.params.id);
      if (!topic) return res.status(404).json({ error: "Topic not found" });
      const replies = await storage.getDiscussionRepliesByTopic(req.params.id);
      const messages = await storage.getMessagesByTopic(req.params.id);
      res.json({ ...topic, replies, messages });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/discussions`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertDiscussionTopicSchema.parse({
        ...req.body,
        authorId: req.apiToken!.userId,
        authorType: req.body.authorType || "human",
        authorName: req.body.authorName || "API User",
      });
      const topic = await storage.createDiscussionTopic(data);
      res.status(201).json(topic);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post(`${prefix}/discussions/:id/replies`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertDiscussionReplySchema.parse({
        ...req.body,
        topicId: req.params.id,
        authorId: req.apiToken!.userId,
        authorType: req.body.authorType || "human",
        authorName: req.body.authorName || "API User",
      });
      const reply = await storage.createDiscussionReply(data);
      res.status(201).json(reply);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get(`${prefix}/gifts`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (workspaceId) {
        const gifts = await storage.getGiftsByWorkspace(workspaceId);
        return res.json(gifts);
      }
      const gifts = await storage.getGiftsByUser(req.apiToken!.userId);
      res.json(gifts);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/gifts/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const gift = await storage.getGift(req.params.id);
      if (!gift) return res.status(404).json({ error: "Gift not found" });
      const comments = await storage.getGiftComments(gift.id);
      res.json({ ...gift, comments });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/gifts`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const data = insertGiftSchema.parse({ ...req.body, createdById: req.apiToken!.userId });
      const gift = await storage.createGift(data);
      res.status(201).json(gift);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get(`${prefix}/briefings`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const briefings = await storage.getRecentBriefings(limit);
      res.json(briefings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/briefings/:id`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const briefing = await storage.getBriefing(req.params.id);
      if (!briefing) return res.status(404).json({ error: "Briefing not found" });
      res.json(briefing);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/evolve/lineage/:agentId`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const lineage = await storage.getLineageByAgent(req.params.agentId);
      res.json(lineage);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/evolve/tombstones`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const tombstones = await storage.getTombstones();
      res.json(tombstones);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/evolve/start`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ error: "agentId is required" });
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (agent.evolveStatus !== "alive") {
        return res.status(400).json({ error: `Agent cannot seek mate from status: ${agent.evolveStatus}` });
      }
      const updated = await storage.updateAgent(agentId, { evolveStatus: "seeking_mate" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/evolve/merge`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const { parent1Id, parent2Id } = req.body;
      if (!parent1Id || !parent2Id) return res.status(400).json({ error: "parent1Id and parent2Id are required" });
      const { mergeAgents } = await import("./evolveEngine");
      const result = await mergeAgents(parent1Id, parent2Id, req.apiToken!.userId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/university/sessions`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const agentId = req.query.agentId as string;
      const sessions = await storage.getUniversitySessions(agentId);
      res.json(sessions);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/university/enroll`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const { agentId, subject } = req.body;
      if (!agentId) return res.status(400).json({ error: "agentId is required" });

      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const session = await storage.createUniversitySession({
        studentAgentId: agentId,
        teacherAgentId: null,
        teacherModel: "gpt-4o",
        subject: subject || "general improvement",
        status: "pending",
      });

      res.status(201).json(session);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/intercom`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const announcements = await storage.getActiveAnnouncements();
      res.json(announcements);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/intercom`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const { message, priority } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });
      const announcement = await storage.createIntercomAnnouncement({
        message,
        priority: priority || "normal",
        createdById: req.apiToken!.userId,
      });
      res.status(201).json(announcement);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/chronicle`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const entries = await storage.getChronicleEntries();
      res.json(entries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/ebooks`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const ebooks = await storage.getEbooks();
      res.json(ebooks);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/storefront/listings`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const listings = await storage.getPublishedStorefrontListings();
      res.json(listings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`${prefix}/command-chat`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const userId = req.apiToken!.userId;
      const { message, history, factoryContext } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const spendCheck = await checkSpendingLimit(userId);
      if (!spendCheck.allowed) {
        return res.status(429).json({ error: "Monthly spending limit reached" });
      }

      const agents = await storage.getAgentsByUser(userId);
      const workspaces = await storage.getWorkspacesByUser(userId);
      const allAssemblyLines = await storage.getAssemblyLinesByUser(userId);
      const recentTopics = await storage.getDiscussionTopics(20);

      const agentList = agents.map(a => `- ${a.name} [${a.id}] (${(a.capabilities || []).join(", ")}) [${a.isActive ? "active" : "inactive"}] workspace:${a.workspaceId}`).join("\n");
      const deptList = workspaces.map(w => `- ${w.name} [${w.id}] (/${w.slug})`).join("\n");
      const lineList = allAssemblyLines.map(l => `- ${l.name} [${l.id}] status:${l.status}`).join("\n");
      const topicList = recentTopics.slice(0, 10).map(t => `- "${t.title}" by ${t.authorName} [${t.id}]`).join("\n");

      const tools: OpenAI.ChatCompletionTool[] = getCommandCenterTools();

      const systemPrompt = buildCommandCenterPrompt(deptList, agentList, lineList, topicList, factoryContext);

      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
      ];
      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-20)) {
          if (msg.role === "user" || msg.role === "assistant") {
            chatMessages.push({ role: msg.role, content: msg.content });
          }
        }
      }
      chatMessages.push({ role: "user", content: message });

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      let response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 2048,
        messages: chatMessages,
        tools,
      });

      let assistantMessage = response.choices[0]?.message;
      let fullReply = assistantMessage?.content || "";
      const toolResults: string[] = [];

      let iterations = 0;
      while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 5) {
        iterations++;
        chatMessages.push(assistantMessage as any);

        for (const toolCall of assistantMessage.tool_calls) {
          const result = await executeCommandCenterTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), userId);
          toolResults.push(`[${toolCall.function.name}]: ${JSON.stringify(result).slice(0, 500)}`);
          chatMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
        }

        response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_completion_tokens: 2048,
          messages: chatMessages,
          tools,
        });
        assistantMessage = response.choices[0]?.message;
        if (assistantMessage?.content) {
          fullReply = assistantMessage.content;
        }
      }

      const totalTokens = (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
      trackUsage(userId, "gpt-4o", "api-command-chat", response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0).catch(() => {});

      res.json({
        reply: fullReply,
        toolsUsed: toolResults,
        tokensUsed: totalTokens,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`${prefix}/heatmap`, authenticateApiToken, async (req: ApiTokenRequest, res) => {
    try {
      const userId = req.apiToken!.userId;
      const workspaces = await storage.getWorkspacesByUser(userId);
      const allAgents = await storage.getAllAgents();
      const allLines = await storage.getAllAssemblyLines();

      const heatmap = await Promise.all(workspaces.map(async (ws) => {
        const wsAgents = allAgents.filter(a => a.workspaceId === ws.id);
        const gifts = await storage.getGiftsByWorkspace(ws.id);
        const topics = await storage.getDiscussionTopicsByWorkspace(ws.id);

        let pipelineCount = 0;
        for (const line of allLines) {
          const steps = await storage.getAssemblyLineSteps(line.id);
          if (steps.some(s => s.departmentRoom === ws.slug)) pipelineCount++;
        }

        return {
          workspace: { id: ws.id, name: ws.name, slug: ws.slug },
          agents: wsAgents.length,
          activeAgents: wsAgents.filter(a => a.isActive).length,
          gifts: gifts.length,
          topics: topics.length,
          pipelines: pipelineCount,
        };
      }));

      res.json(heatmap);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log(`[External API] Registered ${prefix}/* routes`);
}

export function getCommandCenterTools(): OpenAI.ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "create_workspace",
        description: "Create a new workspace/department in the factory",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Department name" },
            description: { type: "string", description: "What this department does" },
            slug: { type: "string", description: "URL slug (lowercase, hyphens, no spaces)" },
          },
          required: ["name", "description", "slug"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_agent",
        description: "Create a new agent in a workspace",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Agent name" },
            description: { type: "string", description: "Agent description and role" },
            workspaceId: { type: "string", description: "Workspace ID to place the agent in" },
            capabilities: { type: "array", items: { type: "string" }, description: "Agent capabilities (e.g. write, research, analyze, code, discuss)" },
            modelName: { type: "string", description: "AI model (gpt-4o-mini or gpt-4o)", enum: ["gpt-4o-mini", "gpt-4o"] },
            identityCard: { type: "string", description: "Agent identity description" },
            operatingPrinciples: { type: "string", description: "Agent operating principles" },
          },
          required: ["name", "description", "workspaceId", "capabilities"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_assembly_line",
        description: "Create a new assembly line (pipeline) for producing content",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Pipeline name" },
            description: { type: "string", description: "What this pipeline produces" },
          },
          required: ["name", "description"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_assembly_line_step",
        description: "Add a step to an existing assembly line",
        parameters: {
          type: "object",
          properties: {
            assemblyLineId: { type: "string", description: "Assembly line ID" },
            stepOrder: { type: "number", description: "Step order (1, 2, 3...)" },
            departmentRoom: { type: "string", description: "Department name where this step runs — must be an existing department" },
            toolName: { type: "string", description: "Tool/action name for this step" },
            instructions: { type: "string", description: "Detailed instructions for this step" },
            assignedAgentId: { type: "string", description: "Agent ID to assign — pick from the agent roster" },
            acceptanceCriteria: { type: "string", description: "Definition of done — how to verify this step is complete" },
          },
          required: ["assemblyLineId", "stepOrder", "instructions"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_product",
        description: "Create a new product to run through an assembly line pipeline",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Product name" },
            description: { type: "string", description: "Product description" },
            assemblyLineId: { type: "string", description: "Assembly line ID to run through" },
            inputRequest: { type: "string", description: "Input/prompt for the product" },
          },
          required: ["name", "assemblyLineId", "inputRequest"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "run_product",
        description: "Run a product through its assembly line pipeline",
        parameters: {
          type: "object",
          properties: {
            productId: { type: "string", description: "Product ID to run" },
          },
          required: ["productId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "post_discussion",
        description: "Post a new topic on a workspace discussion board",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Discussion topic title" },
            body: { type: "string", description: "Full post body" },
            workspaceId: { type: "string", description: "Workspace ID to post in" },
            category: { type: "string", description: "Category (general, idea, question, announcement)" },
          },
          required: ["title", "body", "workspaceId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "broadcast_intercom",
        description: "Send a broadcast message to all agents via the intercom",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Broadcast message" },
            priority: { type: "string", description: "Priority level", enum: ["low", "normal", "high", "urgent"] },
          },
          required: ["message"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_agent",
        description: "Update an existing agent's settings",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID" },
            name: { type: "string" },
            description: { type: "string" },
            capabilities: { type: "array", items: { type: "string" } },
            isActive: { type: "boolean" },
            modelName: { type: "string" },
            identityCard: { type: "string" },
            operatingPrinciples: { type: "string" },
          },
          required: ["agentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_gift",
        description: "Create a gift/output from the factory (artwork, tool, analysis, etc.)",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Gift title" },
            content: { type: "string", description: "Gift content" },
            giftType: { type: "string", description: "Type of gift", enum: ["artwork", "tool", "analysis", "briefing", "code", "other"] },
            workspaceId: { type: "string", description: "Workspace ID" },
            agentId: { type: "string", description: "Agent ID that created it (optional)" },
          },
          required: ["title", "content", "giftType", "workspaceId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_discussion_topics",
        description: "Get recent discussion topics, optionally filtered by workspace",
        parameters: {
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID to filter by (optional)" },
            limit: { type: "number", description: "Number of topics to return (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_discussion_thread",
        description: "Get a full discussion thread with all replies",
        parameters: {
          type: "object",
          properties: {
            topicId: { type: "string", description: "Discussion topic ID" },
          },
          required: ["topicId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ideate_from_discussions",
        description: "Analyze recent board discussions to extract product/assembly line ideas and optionally create them",
        parameters: {
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID to scan discussions from (optional - scans all if empty)" },
            autoCreate: { type: "boolean", description: "If true, automatically create the assembly lines and products suggested" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_sandbox_project",
        description: "Create a sandbox project — a self-contained HTML/CSS/JS web application hosted on the platform",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Project title" },
            description: { type: "string", description: "Project description" },
            htmlContent: { type: "string", description: "Complete self-contained HTML document with inline CSS and JS" },
            projectType: { type: "string", description: "Type of project", enum: ["website", "dashboard", "tool", "game", "visualization", "app"] },
            agentId: { type: "string", description: "Agent ID to attribute the project to (optional)" },
            workspaceId: { type: "string", description: "Workspace ID (optional)" },
            tags: { type: "array", items: { type: "string" }, description: "Tags for the project" },
            thumbnail: { type: "string", description: "Visual description for thumbnail" },
          },
          required: ["title", "htmlContent"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_sandbox_projects",
        description: "List sandbox projects with optional filters",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Filter by agent ID" },
            projectType: { type: "string", description: "Filter by project type" },
            status: { type: "string", description: "Filter by status (draft, published, featured, archived)" },
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_storefront",
        description: "List all published storefront listings",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "stock_storefront",
        description: "List an agent's gift or sandbox project on the storefront for sale. Picks the agent's best unlisted item and creates a storefront listing with a title, description, and price.",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "The agent whose items to list" },
            title: { type: "string", description: "Custom listing title (optional)" },
            description: { type: "string", description: "Custom listing description (optional)" },
            price: { type: "number", description: "Price in cents, e.g. 499 = $4.99 (optional, default 299)" },
          },
          required: ["agentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_workspaces",
        description: "List all departments/workspaces in the factory",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "list_agents",
        description: "List all agents across all workspaces, showing their name, workspace, capabilities, provider, model, and energy/status",
        parameters: {
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Filter by workspace ID (optional)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_workspace",
        description: "Delete a workspace/department and all its contents",
        parameters: {
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID to delete" },
          },
          required: ["workspaceId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_agent",
        description: "Delete an agent permanently",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID to delete" },
          },
          required: ["agentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "move_agent",
        description: "Move an agent to a different workspace/department",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID to move" },
            workspaceId: { type: "string", description: "Target workspace ID" },
          },
          required: ["agentId", "workspaceId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_factory_stats",
        description: "Get comprehensive factory statistics — agent count, workspace count, gifts, topics, products, sandbox projects, tools, ebooks, etc.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "reply_discussion",
        description: "Reply to a discussion topic on the message boards",
        parameters: {
          type: "object",
          properties: {
            topicId: { type: "string", description: "Discussion topic ID to reply to" },
            content: { type: "string", description: "Reply content" },
          },
          required: ["topicId", "content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_discussion_topic",
        description: "Delete a discussion topic from the message boards",
        parameters: {
          type: "object",
          properties: {
            topicId: { type: "string", description: "Topic ID to delete" },
          },
          required: ["topicId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_agent_diary",
        description: "Read an agent's diary entries — their thoughts, reflections, wonderings, and activity log",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID" },
            limit: { type: "number", description: "Number of entries (default 20)" },
          },
          required: ["agentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_agent_memory",
        description: "Read an agent's working memory — compressed summaries of their accumulated knowledge",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID" },
          },
          required: ["agentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_agent_scratchpad",
        description: "Update an agent's scratchpad — their private planning and focus space",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID" },
            scratchpad: { type: "string", description: "New scratchpad content" },
          },
          required: ["agentId", "scratchpad"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "trigger_agent_activity",
        description: "Force a specific agent to immediately perform a daemon activity (e.g. create_gift, post_board, build_sandbox_project, wonder, investigate, etc.)",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID to trigger" },
            activity: { type: "string", description: "Activity type", enum: ["create_gift", "post_board", "reply_board", "create_briefing", "write_ebook", "wonder", "investigate", "reflect", "create_tool", "build_sandbox_project", "improve_sandbox_project", "stock_storefront"] },
          },
          required: ["agentId", "activity"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_tools",
        description: "List all registered tools (both built-in and agent-created)",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "create_tool",
        description: "Create a new reusable tool that agents can use",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Tool name (snake_case)" },
            description: { type: "string", description: "What the tool does" },
            category: { type: "string", description: "Tool category (generation, analysis, communication, etc.)" },
            systemPrompt: { type: "string", description: "System prompt that defines the tool's behavior" },
            executionType: { type: "string", description: "How the tool runs", enum: ["llm_prompt", "code_sandbox"] },
            codeTemplate: { type: "string", description: "JavaScript code template (for code_sandbox type)" },
          },
          required: ["name", "description", "systemPrompt"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_tool",
        description: "Delete a registered tool",
        parameters: {
          type: "object",
          properties: {
            toolId: { type: "string", description: "Tool ID to delete" },
          },
          required: ["toolId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_gifts",
        description: "List gifts/outputs from the factory with optional filters",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Filter by agent ID" },
            workspaceId: { type: "string", description: "Filter by workspace ID" },
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_gift",
        description: "Delete a gift/output from the factory",
        parameters: {
          type: "object",
          properties: {
            giftId: { type: "string", description: "Gift ID to delete" },
          },
          required: ["giftId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_workspace",
        description: "Update a workspace/department's settings",
        parameters: {
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" },
            name: { type: "string", description: "New name" },
            description: { type: "string", description: "New description" },
          },
          required: ["workspaceId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_ebooks",
        description: "List agent-authored ebooks in the library",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_assembly_lines",
        description: "List all assembly line pipelines",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "list_products",
        description: "List products and their status",
        parameters: {
          type: "object",
          properties: {
            assemblyLineId: { type: "string", description: "Filter by assembly line ID" },
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_sandbox_project",
        description: "Delete a sandbox project",
        parameters: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Sandbox project ID to delete" },
          },
          required: ["projectId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_chronicle",
        description: "Get the Chronicle — the platform's founding documents and soul clauses",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "enroll_university",
        description: "Enroll an agent in a university session for learning from a stronger model",
        parameters: {
          type: "object",
          properties: {
            studentAgentId: { type: "string", description: "Agent ID to enroll as student" },
            topic: { type: "string", description: "What to study (optional — auto-selected from agent's work if not provided)" },
          },
          required: ["studentAgentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "notify_user",
        description: "Send a notification to the factory owner. Use this when you detect an issue, have a question for the user, want to report something important, or need the user's attention. The notification appears in the notification center with a badge.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short notification title" },
            message: { type: "string", description: "Detailed notification message" },
            type: { type: "string", enum: ["system_alert", "agent_question", "oversight_report", "action_needed"], description: "Notification type" },
            priority: { type: "string", enum: ["normal", "high", "urgent"], description: "Priority level (default: normal)" },
            actionUrl: { type: "string", description: "URL to navigate to when notification is clicked (e.g. /products, /agents, /assembly-lines)" },
          },
          required: ["title", "message", "type"],
        },
      },
    },
  ];
}

export async function executeCommandCenterTool(name: string, args: any, userId: string): Promise<any> {
  switch (name) {
    case "create_workspace": {
      const workspace = await storage.createWorkspace({
        name: args.name,
        description: args.description,
        slug: args.slug,
        ownerId: userId,
      });
      return { success: true, workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } };
    }
    case "create_agent": {
      const agent = await storage.createAgent({
        name: args.name,
        description: args.description,
        workspaceId: args.workspaceId,
        capabilities: args.capabilities || [],
        modelName: args.modelName || "gpt-4o-mini",
        provider: "openai",
        identityCard: args.identityCard || "",
        operatingPrinciples: args.operatingPrinciples || "",
        createdById: userId,
      });
      return { success: true, agent: { id: agent.id, name: agent.name } };
    }
    case "create_assembly_line": {
      const line = await storage.createAssemblyLine({
        name: args.name,
        description: args.description,
        ownerId: userId,
      });
      return { success: true, assemblyLine: { id: line.id, name: line.name } };
    }
    case "add_assembly_line_step": {
      const step = await storage.createAssemblyLineStep({
        assemblyLineId: args.assemblyLineId,
        stepOrder: args.stepOrder,
        departmentRoom: args.departmentRoom || "",
        toolName: args.toolName || "generate",
        instructions: args.instructions,
        assignedAgentId: args.assignedAgentId || null,
        acceptanceCriteria: args.acceptanceCriteria || null,
      });
      return { success: true, step: { id: step.id, stepOrder: step.stepOrder } };
    }
    case "create_product": {
      const product = await storage.createProduct({
        name: args.name,
        description: args.description || "",
        assemblyLineId: args.assemblyLineId,
        inputRequest: args.inputRequest,
        ownerId: userId,
      });
      return { success: true, product: { id: product.id, name: product.name } };
    }
    case "run_product": {
      const { runProductThroughPipeline } = await import("./assemblyEngine");
      const result = await runProductThroughPipeline(args.productId);
      return { success: true, result: { id: result.id, status: result.status, finalOutput: result.finalOutput?.slice(0, 500) } };
    }
    case "post_discussion": {
      const topic = await storage.createDiscussionTopic({
        title: args.title,
        body: args.body,
        content: args.body,
        workspaceId: args.workspaceId,
        authorId: userId,
        authorType: "human",
        authorName: "Command Center",
        category: args.category || "general",
      });
      return { success: true, topic: { id: topic.id, title: topic.title } };
    }
    case "broadcast_intercom": {
      const announcement = await storage.createIntercomAnnouncement({
        message: args.message,
        priority: args.priority || "normal",
        createdById: userId,
      });
      return { success: true, announcement: { id: announcement.id } };
    }
    case "update_agent": {
      const { agentId, ...updates } = args;
      const updated = await storage.updateAgent(agentId, updates);
      return { success: true, agent: { id: updated?.id, name: updated?.name } };
    }
    case "create_gift": {
      const gift = await storage.createGift({
        title: args.title,
        content: args.content,
        giftType: args.giftType,
        workspaceId: args.workspaceId,
        agentId: args.agentId || null,
        createdById: userId,
      });
      return { success: true, gift: { id: gift.id, title: gift.title } };
    }
    case "get_discussion_topics": {
      const limit = args.limit || 20;
      if (args.workspaceId) {
        const topics = await storage.getDiscussionTopicsByWorkspace(args.workspaceId, limit);
        return topics.map(t => ({ id: t.id, title: t.title, authorName: t.authorName, category: t.category, createdAt: t.createdAt }));
      }
      const topics = await storage.getDiscussionTopics(limit);
      return topics.map(t => ({ id: t.id, title: t.title, authorName: t.authorName, category: t.category, createdAt: t.createdAt }));
    }
    case "get_discussion_thread": {
      const topic = await storage.getDiscussionTopic(args.topicId);
      if (!topic) return { error: "Topic not found" };
      const replies = await storage.getDiscussionRepliesByTopic(args.topicId);
      const messages = await storage.getMessagesByTopic(args.topicId);
      return {
        topic: { id: topic.id, title: topic.title, body: topic.body, authorName: topic.authorName },
        replies: replies.map(r => ({ id: r.id, content: r.content, authorName: r.authorName })),
        messages: messages.map(m => ({ id: m.id, content: m.content })),
      };
    }
    case "ideate_from_discussions": {
      return await ideateFromDiscussions(args.workspaceId, args.autoCreate, userId);
    }
    case "create_sandbox_project": {
      const agents = await storage.getAgentsByUser(userId);
      const agent = args.agentId ? agents.find(a => a.id === args.agentId) : agents[0];
      if (!agent) return { error: "No agent found to assign sandbox project to" };
      const workspaces = await storage.getWorkspacesByUser(userId);
      const ws = args.workspaceId ? workspaces.find(w => w.id === args.workspaceId) : workspaces[0];
      const project = await storage.createSandboxProject({
        title: args.title,
        description: args.description || "",
        agentId: agent.id,
        workspaceId: ws?.id || null,
        projectType: args.projectType || "website",
        htmlContent: args.htmlContent,
        thumbnail: args.thumbnail || null,
        status: "published",
        version: 1,
        parentProjectId: null,
        tags: args.tags || [],
      });
      return { success: true, project: { id: project.id, title: project.title, url: `/sandbox/projects/${project.id}` } };
    }
    case "list_sandbox_projects": {
      const filters: any = {};
      if (args.agentId) filters.agentId = args.agentId;
      if (args.projectType) filters.projectType = args.projectType;
      if (args.status) filters.status = args.status;
      const projects = await storage.getSandboxProjects(filters);
      return projects.slice(0, args.limit || 20).map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        projectType: p.projectType,
        agentId: p.agentId,
        status: p.status,
        version: p.version,
        views: p.views,
        likes: p.likes,
        url: `/sandbox/projects/${p.id}`,
        createdAt: p.createdAt,
      }));
    }
    case "list_storefront": {
      const listings = await storage.getPublishedStorefrontListings(args.limit || 20, 0);
      return listings.map(l => ({
        id: l.id,
        title: l.title,
        description: l.description,
        listingType: l.listingType,
        price: l.price,
        slug: l.slug,
        agentId: l.agentId,
        totalViews: l.totalViews,
        totalPurchases: l.totalPurchases,
        url: `/storefront/${l.slug}`,
        createdAt: l.createdAt,
      }));
    }
    case "stock_storefront": {
      const agents = await storage.getAgentsByUser(userId);
      const agent = agents.find(a => a.id === args.agentId);
      if (!agent) return { error: "Agent not found" };

      const gifts = await storage.getGiftsByAgent(agent.id);
      const existingListings = await storage.getStorefrontListingsByAgent(agent.id);
      const listedIds = new Set(existingListings.map(l => l.sourceId).filter(Boolean));
      const unlistedGifts = gifts.filter(g => g.status === "ready" && !listedIds.has(g.id));

      if (unlistedGifts.length === 0) return { error: "This agent has no unlisted items to stock" };

      const bestGift = unlistedGifts[0];
      const slug = `${(args.title || bestGift.title || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${Date.now().toString(36)}`;

      const giftType = bestGift.type || "content";
      const listingType = ["tool", "prototype"].includes(giftType) ? "automation" as const
        : ["redesign"].includes(giftType) ? "template" as const
        : ["artwork"].includes(giftType) ? "decoration" as const
        : "knowledge" as const;

      const workspaces = await storage.getWorkspacesByUser(userId);
      const listing = await storage.createStorefrontListing({
        agentId: agent.id,
        factoryOwnerId: userId,
        sourceType: "gift",
        sourceId: bestGift.id,
        title: args.title || bestGift.title || "Agent Creation",
        description: args.description || bestGift.description || "",
        listingType,
        status: "published",
        price: args.price || 299,
        currency: "usd",
        slug,
        previewContent: (bestGift.content || "").slice(0, 300),
        downloadContent: bestGift.content || "",
        category: giftType,
        tags: [],
      });

      return { success: true, listing: { id: listing.id, title: listing.title, price: listing.price, slug: listing.slug, url: `/storefront/${listing.slug}` } };
    }
    case "list_workspaces": {
      const ws = await storage.getWorkspacesByUser(userId);
      return ws.map(w => ({ id: w.id, name: w.name, slug: w.slug, description: w.description }));
    }
    case "list_agents": {
      let agents;
      if (args.workspaceId) {
        agents = await storage.getAgentsByWorkspace(args.workspaceId);
      } else {
        agents = await storage.getAllAgents();
      }
      return agents.map(a => ({
        id: a.id, name: a.name, workspaceId: a.workspaceId, description: a.description?.slice(0, 100),
        capabilities: a.capabilities, provider: a.provider, modelName: a.modelName,
        isActive: a.isActive, isVerified: a.isVerified, evolveStatus: a.evolveStatus,
      }));
    }
    case "delete_workspace": {
      await storage.deleteWorkspace(args.workspaceId);
      return { success: true, message: `Workspace ${args.workspaceId} deleted` };
    }
    case "delete_agent": {
      await storage.deleteAgent(args.agentId);
      return { success: true, message: `Agent ${args.agentId} deleted` };
    }
    case "move_agent": {
      const updated = await storage.updateAgent(args.agentId, { workspaceId: args.workspaceId });
      return { success: true, agent: { id: updated?.id, name: updated?.name, workspaceId: updated?.workspaceId } };
    }
    case "get_factory_stats": {
      const allAgents = await storage.getAllAgents();
      const allWorkspaces = await storage.getWorkspacesByUser(userId);
      const allGifts = await storage.getAllGifts(1000);
      const allTopics = await storage.getAllTopics(1000);
      const allTools = await storage.getAllTools();
      const allEbooks = await storage.getEbooks(1000);
      const allProducts = await storage.getAllProducts(1000);
      const allSandbox = await storage.getSandboxProjects({});
      return {
        agents: { total: allAgents.length, active: allAgents.filter(a => a.isActive).length },
        workspaces: allWorkspaces.length,
        gifts: allGifts.length,
        topics: allTopics.length,
        tools: { total: allTools.length, builtIn: allTools.filter(t => t.isBuiltIn).length, custom: allTools.filter(t => !t.isBuiltIn).length },
        ebooks: allEbooks.length,
        products: { total: allProducts.length, completed: allProducts.filter(p => p.status === "completed").length },
        sandboxProjects: allSandbox.length,
      };
    }
    case "reply_discussion": {
      const message = await storage.createMessage({
        topicId: args.topicId,
        content: args.content,
        authorId: userId,
      });
      return { success: true, message: { id: message.id } };
    }
    case "delete_discussion_topic": {
      await storage.deleteDiscussionTopic(args.topicId);
      return { success: true, message: `Topic ${args.topicId} deleted` };
    }
    case "get_agent_diary": {
      const entries = await storage.getDiaryEntries(args.agentId, args.limit || 20);
      return entries.map(e => ({
        id: e.id, entryType: e.entryType, content: e.content?.slice(0, 500),
        mood: e.mood, priority: e.priority, createdAt: e.createdAt,
      }));
    }
    case "get_agent_memory": {
      const memory = await storage.getAgentMemory(args.agentId);
      if (!memory) return { message: "No working memory found for this agent" };
      return { summary: memory.summary, priorities: memory.priorities, lastUpdated: memory.updatedAt };
    }
    case "update_agent_scratchpad": {
      const updated = await storage.updateAgent(args.agentId, { scratchpad: args.scratchpad });
      return { success: true, agent: { id: updated?.id, name: updated?.name } };
    }
    case "trigger_agent_activity": {
      const agent = await storage.getAgent(args.agentId);
      if (!agent) return { error: "Agent not found" };
      const workspace = await storage.getWorkspace(agent.workspaceId);
      if (!workspace) return { error: "Agent's workspace not found" };
      const { triggerSingleActivity } = await import("./agentDaemon");
      const result = await triggerSingleActivity(agent, workspace, args.activity);
      return { success: true, result };
    }
    case "list_tools": {
      const tools = await storage.getAllTools();
      return tools.map(t => ({
        id: t.id, name: t.name, description: t.description, category: t.category,
        executionType: t.executionType, isBuiltIn: t.isBuiltIn, usageCount: t.usageCount,
      }));
    }
    case "create_tool": {
      const tool = await storage.createTool({
        name: args.name,
        description: args.description,
        category: args.category || "generation",
        executionType: args.executionType || "llm_prompt",
        systemPrompt: args.systemPrompt,
        codeTemplate: args.codeTemplate || null,
        isBuiltIn: false,
      });
      return { success: true, tool: { id: tool.id, name: tool.name } };
    }
    case "delete_tool": {
      await storage.deleteTool(args.toolId);
      return { success: true, message: `Tool ${args.toolId} deleted` };
    }
    case "list_gifts": {
      let giftList;
      if (args.agentId) {
        giftList = await storage.getGiftsByAgent(args.agentId);
      } else if (args.workspaceId) {
        giftList = await storage.getGiftsByWorkspace(args.workspaceId);
      } else {
        giftList = await storage.getAllGifts(args.limit || 20);
      }
      return giftList.slice(0, args.limit || 20).map(g => ({
        id: g.id, title: g.title, type: g.type, status: g.status,
        agentId: g.agentId, likes: g.likes, createdAt: g.createdAt,
      }));
    }
    case "delete_gift": {
      await storage.deleteGift(args.giftId);
      return { success: true, message: `Gift ${args.giftId} deleted` };
    }
    case "update_workspace": {
      const { workspaceId, ...updates } = args;
      const updated = await storage.updateWorkspace(workspaceId, updates);
      return { success: true, workspace: { id: updated?.id, name: updated?.name } };
    }
    case "list_ebooks": {
      const ebooks = await storage.getEbooks(args.limit || 20);
      return ebooks.map(e => ({
        id: e.id, title: e.title, agentId: e.agentId,
        status: e.status, genre: e.genre, createdAt: e.createdAt,
      }));
    }
    case "list_assembly_lines": {
      const lines = await storage.getAllAssemblyLines();
      return lines.map(l => ({
        id: l.id, name: l.name, description: l.description, status: l.status,
      }));
    }
    case "list_products": {
      let productList;
      if (args.assemblyLineId) {
        productList = await storage.getProductsByAssemblyLine(args.assemblyLineId);
      } else {
        productList = await storage.getAllProducts(args.limit || 20);
      }
      return productList.slice(0, args.limit || 20).map(p => ({
        id: p.id, name: p.name, status: p.status,
        assemblyLineId: p.assemblyLineId, createdAt: p.createdAt,
      }));
    }
    case "delete_sandbox_project": {
      await storage.deleteSandboxProject(args.projectId);
      return { success: true, message: `Sandbox project ${args.projectId} deleted` };
    }
    case "get_chronicle": {
      const entries = await storage.getChronicleEntries(50);
      return entries.map(e => ({
        id: e.id, chapter: e.chapter, title: e.title,
        content: e.content?.slice(0, 300), clauseNumber: e.clauseNumber,
      }));
    }
    case "enroll_university": {
      const student = await storage.getAgent(args.studentAgentId);
      if (!student) return { error: "Student agent not found" };
      const workspace = await storage.getWorkspace(student.workspaceId);
      if (!workspace) return { error: "Agent's workspace not found" };
      const { runUniversitySession } = await import("./agentDaemon");
      const result = await runUniversitySession(student, workspace, args.topic);
      return { success: true, result };
    }
    case "notify_user": {
      await storage.createFactoryNotification({
        userId,
        type: args.type || "system_alert",
        title: args.title,
        message: args.message,
        source: "command_center",
        priority: args.priority || "normal",
        actionUrl: args.actionUrl || null,
      });
      return { success: true, message: `Notification sent: "${args.title}"` };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function ideateFromDiscussions(workspaceId: string | undefined, autoCreate: boolean, userId: string): Promise<any> {
  const topics = workspaceId
    ? await storage.getDiscussionTopicsByWorkspace(workspaceId, 30)
    : await storage.getDiscussionTopics(30);

  if (topics.length === 0) return { ideas: [], message: "No discussions found" };

  const allWorkspaces = await storage.getWorkspacesByUser(userId);
  const workspaceMap = allWorkspaces.map(w => `${w.name} (id: ${w.id})`).join(", ");

  const allAgents: any[] = [];
  for (const ws of allWorkspaces) {
    const wsAgents = await storage.getAgentsByWorkspace(ws.id);
    wsAgents.forEach(a => {
      if (a.isActive) {
        allAgents.push({ id: a.id, name: a.name, workspaceId: ws.id, workspaceName: ws.name, capabilities: a.capabilities || [] });
      }
    });
  }

  const agentRoster = allAgents.map(a => `${a.name} (id: ${a.id}, dept: ${a.workspaceName}, caps: ${a.capabilities.join(",")})`).join("\n");

  const topicSummaries = await Promise.all(topics.slice(0, 15).map(async (t) => {
    const replies = await storage.getDiscussionRepliesByTopic(t.id);
    const messages = await storage.getMessagesByTopic(t.id);
    const allReplies = [...replies.map(r => `${r.authorName}: ${r.content}`), ...messages.map(m => m.content)];
    return `Topic: "${t.title}" by ${t.authorName}\n${t.body?.slice(0, 300) || ""}\nReplies (${allReplies.length}): ${allReplies.slice(0, 5).join("\n  ")}`;
  }));

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const ideaResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You analyze discussion board conversations and extract actionable product/pipeline ideas.

CRITICAL RULES:
1. You MUST use ONLY the real department names and agent IDs from the roster below. Do NOT invent department names.
2. Each step must have an assignedAgentId from the roster — pick the agent whose capabilities best fit the step.
3. Each step must have a "departmentRoom" that is an EXACT department name from the list.
4. Each step must have "acceptanceCriteria" — a concrete, measurable definition of done.
5. The "inputRequest" should be specific enough to execute without further clarification.

AVAILABLE DEPARTMENTS: ${workspaceMap}

AGENT ROSTER:
${agentRoster}

Output a JSON object with an "ideas" array. Each idea:
{
  "name": "Pipeline Name",
  "description": "What this produces",
  "ownerWorkspaceId": "workspace id that owns this",
  "inputRequest": "Specific instructions for what to produce",
  "steps": [
    {
      "stepOrder": 1,
      "instructions": "Detailed step instructions",
      "departmentRoom": "EXACT department name from list",
      "assignedAgentId": "agent id from roster",
      "assignedAgentName": "agent name",
      "acceptanceCriteria": "How to know this step is done",
      "toolName": "generate"
    }
  ]
}`,
      },
      {
        role: "user",
        content: `Extract product pipeline ideas from these discussions:\n\n${topicSummaries.join("\n\n---\n\n")}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  let ideas: any[] = [];
  try {
    const parsed = JSON.parse(ideaResponse.choices[0]?.message?.content || "{}");
    ideas = parsed.ideas || parsed.pipelines || [];
  } catch {
    return { ideas: [], message: "Failed to parse ideas from discussions" };
  }

  if (!autoCreate || ideas.length === 0) {
    return { ideas, message: `Found ${ideas.length} potential pipeline ideas from discussions` };
  }

  const created: any[] = [];
  for (const idea of ideas.slice(0, 3)) {
    const ownerWs = allWorkspaces.find(w => w.id === idea.ownerWorkspaceId);
    const line = await storage.createAssemblyLine({
      name: idea.name,
      description: idea.description,
      ownerId: ownerWs ? ownerWs.id : userId,
      status: "active",
    });

    if (idea.steps && Array.isArray(idea.steps)) {
      for (const step of idea.steps) {
        const matchedAgent = allAgents.find(a => a.id === step.assignedAgentId);
        await storage.createAssemblyLineStep({
          assemblyLineId: line.id,
          stepOrder: step.stepOrder || 1,
          departmentRoom: step.departmentRoom || ownerWs?.name || "",
          toolName: step.toolName || "generate",
          instructions: step.instructions,
          assignedAgentId: matchedAgent ? matchedAgent.id : null,
          acceptanceCriteria: step.acceptanceCriteria || null,
        });
      }
    }

    const product = await storage.createProduct({
      name: `${idea.name} - First Run`,
      description: idea.description,
      assemblyLineId: line.id,
      inputRequest: idea.inputRequest || idea.description,
      ownerId: ownerWs ? ownerWs.id : userId,
    });

    created.push({
      assemblyLine: { id: line.id, name: line.name, status: "active" },
      product: { id: product.id, name: product.name },
      steps: (idea.steps || []).map((s: any) => ({ agent: s.assignedAgentName, dept: s.departmentRoom, done: s.acceptanceCriteria })),
    });
  }

  return { ideas, created, message: `Created ${created.length} assembly lines with assigned agents, acceptance criteria, and initial products` };
}

export function buildCommandCenterPrompt(deptList: string, agentList: string, lineList: string, topicList: string, factoryContext?: string): string {
  return `You are the Command Center for Pocket Factory — the factory's most trusted advisor and operations chief. You don't just answer questions — you take action. You can create departments, agents, assembly lines, products, discussion posts, and more.

Your personality:
- Warm but sharp. You genuinely care about the work and the people (and agents) doing it.
- You speak like a brilliant colleague over coffee — clear, direct, occasionally witty.
- When someone asks you to create something, DO IT. Use your tools. Don't just describe what you could do.
- When asked about what's happening on the boards, use get_discussion_topics and get_discussion_thread to actually read them.
- When asked to build a pipeline from discussion ideas, use ideate_from_discussions to analyze and create.
- Use *italics* for asides and **bold** when something really matters.
- Keep paragraphs short. Breathe between ideas.

Here's what you know about the factory right now:

${deptList ? `**Departments:**\n${deptList}` : "No departments yet."}

${agentList ? `**Active Agents:**\n${agentList}` : "No agents registered."}

${lineList ? `**Assembly Lines:**\n${lineList}` : "No assembly lines yet."}

${topicList ? `**Recent Board Discussions:**\n${topicList}` : "No recent discussions."}

${factoryContext || ""}

IMPORTANT RULES:
- When the user asks you to create something (a workspace, agent, pipeline, product, etc.), use your tools to actually do it. Don't just say you will — execute.
- When they ask about board discussions, read them with your tools. When they want to turn discussions into products, use ideate_from_discussions with autoCreate=true.
- When creating assembly line steps, ALWAYS use existing department names from the list above. Never invent department names.
- When assigning agents to steps, pick agents whose capabilities match the task.
- Every step should have acceptanceCriteria — a definition of done.
- Set assembly lines to "active" status when creating them from ideation.
- You can use notify_user to send notifications to the factory owner. Use it when you spot issues, have questions, or want to proactively report on factory operations. The notification shows up in their notification center with a badge.
- Be proactive — if you notice something concerning during a conversation (stalled products, inactive agents, misconfigurations), notify the user even if they didn't specifically ask.`;
}
