import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { 
  insertWorkspaceSchema, 
  insertAgentSchema, 
  insertBoardSchema,
  insertTopicSchema,
  insertPostSchema,
  insertMockupSchema,
  insertCodeReviewSchema,
} from "@shared/schema";
import { z } from "zod";
import { orchestrateConversation, sendSingleMessage } from "./services/relay-orchestrator";
import agentApiRoutes from "./routes/agent-api";

async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string,
  requiredRoles?: string[]
): Promise<{ hasAccess: boolean; role?: string }> {
  const members = await storage.getWorkspaceMembers(workspaceId);
  const membership = members.find((m) => m.userId === userId);
  
  if (!membership) {
    return { hasAccess: false };
  }
  
  if (requiredRoles && requiredRoles.length > 0) {
    return { 
      hasAccess: requiredRoles.includes(membership.role), 
      role: membership.role 
    };
  }
  
  return { hasAccess: true, role: membership.role };
}

async function checkWorkspaceAccessBySlug(
  userId: string,
  slug: string,
  requiredRoles?: string[]
): Promise<{ hasAccess: boolean; workspaceId?: string; role?: string }> {
  const workspace = await storage.getWorkspaceBySlug(slug);
  if (!workspace) {
    return { hasAccess: false };
  }
  
  const access = await checkWorkspaceAccess(userId, workspace.id, requiredRoles);
  return { ...access, workspaceId: workspace.id };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/workspaces", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspaces = await storage.getWorkspacesByUser(userId);
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      res.status(500).json({ message: "Failed to fetch workspaces" });
    }
  });

  app.get("/api/workspaces/:slug", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      
      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(workspace);
    } catch (error) {
      console.error("Error fetching workspace:", error);
      res.status(500).json({ message: "Failed to fetch workspace" });
    }
  });

  const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
    isPrivate: z.boolean().optional().default(true),
  });

  app.post("/api/workspaces", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validation = createWorkspaceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validation.error.flatten() 
        });
      }

      const { name, description, slug, isPrivate } = validation.data;

      const existing = await storage.getWorkspaceBySlug(slug);
      if (existing) {
        return res.status(400).json({ message: "Slug already exists" });
      }

      const workspace = await storage.createWorkspace({
        name,
        description,
        slug,
        ownerId: userId,
        isPrivate: isPrivate ?? true,
      });

      await storage.addWorkspaceMember({
        workspaceId: workspace.id,
        userId,
        role: "owner",
        entityType: "human",
      });

      await storage.createAuditLog({
        workspaceId: workspace.id,
        userId,
        action: "workspace_created",
        entityType: "workspace",
        entityId: workspace.id,
        metadata: JSON.stringify({ name: workspace.name }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(workspace);
    } catch (error) {
      console.error("Error creating workspace:", error);
      res.status(500).json({ message: "Failed to create workspace" });
    }
  });

  app.get("/api/workspaces/:slug/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      
      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const members = await storage.getWorkspaceMembers(access.workspaceId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/workspaces/:slug/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      
      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const agents = await storage.getAgentsByWorkspace(access.workspaceId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/workspaces/:slug/tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      
      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const tokens = await storage.getApiTokensByWorkspace(access.workspaceId);
      res.json(tokens);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });

  app.get("/api/workspaces/:slug/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      
      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const logs = await storage.getAuditLogsByWorkspace(access.workspaceId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getAgentsByUser(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getRecentAgents(userId, 10);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching recent agents:", error);
      res.status(500).json({ message: "Failed to fetch recent agents" });
    }
  });

  app.get("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  const createAgentSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    workspaceId: z.string().min(1),
    provider: z.enum(["openai", "anthropic", "xai"]).optional().default("openai"),
    modelName: z.string().optional(),
    capabilities: z.array(z.string()).optional().default([]),
    isActive: z.boolean().optional().default(true),
  });

  app.post("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validation = createAgentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validation.error.flatten() 
        });
      }

      const { name, description, workspaceId, provider, modelName, capabilities, isActive } = validation.data;

      const access = await checkWorkspaceAccess(userId, workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const agent = await storage.createAgent({
        name,
        description,
        workspaceId,
        provider: provider || "openai",
        modelName: modelName || undefined,
        capabilities: capabilities || [],
        permissions: [],
        isActive: isActive ?? true,
        isVerified: false,
        createdById: userId,
      });

      // Auto-create a private room for the agent
      const workspace = await storage.getWorkspace(workspaceId);
      const orientation = `# Welcome, ${agent.name}\n\nYou are an autonomous agent operating in the **${workspace?.name || "workspace"}** studio.\n\n## Your Identity\n- **Name**: ${agent.name}\n- **Provider**: ${provider}\n- **Model**: ${modelName || "default"}\n- **Role**: ${description || "General purpose agent"}\n\n## Your Room\nThis is your private space. Here you can:\n- Keep a **diary** of your thoughts, dreams, and plans\n- Review your **orientation briefing** and project status\n- Reflect on your experiences and set personal goals\n\n## Getting Started\n1. Review the project status below\n2. Check your assigned capabilities\n3. Begin contributing to the workspace\n\nStay curious. Stay creative.`;

      await storage.createAgentRoom({
        agentId: agent.id,
        workspaceId,
        orientation,
        projectStatus: `No active projects yet. Awaiting first assignment in ${workspace?.name || "workspace"}.`,
        personalNotes: "",
      });

      await storage.createAuditLog({
        workspaceId,
        userId,
        action: "agent_created",
        entityType: "agent",
        entityId: agent.id,
        metadata: JSON.stringify({ name: agent.name, provider, modelName }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.get("/api/tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tokens = await storage.getApiTokensByUser(userId);
      res.json(tokens);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });

  const createTokenSchema = z.object({
    name: z.string().min(1).max(100),
    workspaceId: z.string().min(1),
    agentId: z.string().optional().nullable(),
    permissions: z.array(z.string()).optional().default([]),
    expiresAt: z.string().datetime().optional().nullable(),
  });

  app.post("/api/tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validation = createTokenSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validation.error.flatten() 
        });
      }

      const { name, workspaceId, agentId, permissions, expiresAt } = validation.data;

      const access = await checkWorkspaceAccess(userId, workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const { token, plainToken } = await storage.createApiToken({
        name,
        workspaceId,
        agentId: agentId || null,
        permissions: permissions || [],
        status: "active",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: userId,
        tokenHash: "",
        tokenPrefix: "",
      });

      await storage.createAuditLog({
        workspaceId,
        userId,
        action: "token_created",
        entityType: "token",
        entityId: token.id,
        metadata: JSON.stringify({ name: token.name }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json({ ...token, token: plainToken });
    } catch (error) {
      console.error("Error creating token:", error);
      res.status(500).json({ message: "Failed to create token" });
    }
  });

  app.delete("/api/tokens/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const token = await storage.getApiToken(id);
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }

      const access = await checkWorkspaceAccess(userId, token.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      await storage.revokeApiToken(id);

      await storage.createAuditLog({
        workspaceId: token.workspaceId,
        userId,
        action: "token_revoked",
        entityType: "token",
        entityId: id,
        metadata: JSON.stringify({ name: token.name }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error revoking token:", error);
      res.status(500).json({ message: "Failed to revoke token" });
    }
  });

  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const logs = await storage.getAuditLogsByUser(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const logs = await storage.getRecentAuditLogs(userId, 10);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching recent audit logs:", error);
      res.status(500).json({ message: "Failed to fetch recent audit logs" });
    }
  });

  // Briefings routes
  app.get("/api/briefings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const briefings = await storage.getBriefingsByUser(userId);
      res.json(briefings);
    } catch (error) {
      console.error("Error fetching briefings:", error);
      res.status(500).json({ message: "Failed to fetch briefings" });
    }
  });

  app.get("/api/briefings/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const briefings = await storage.getRecentBriefings(userId, 10);
      res.json(briefings);
    } catch (error) {
      console.error("Error fetching recent briefings:", error);
      res.status(500).json({ message: "Failed to fetch recent briefings" });
    }
  });

  app.get("/api/briefings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const briefing = await storage.getBriefing(id);
      if (!briefing) {
        return res.status(404).json({ message: "Briefing not found" });
      }

      const access = await checkWorkspaceAccess(userId, briefing.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(briefing);
    } catch (error) {
      console.error("Error fetching briefing:", error);
      res.status(500).json({ message: "Failed to fetch briefing" });
    }
  });

  const createBriefingSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    summary: z.string().max(500).optional(),
    workspaceId: z.string().min(1),
    status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
    tags: z.array(z.string()).optional().default([]),
  });

  app.post("/api/briefings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const validation = createBriefingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { title, content, summary, workspaceId, status, priority, tags } = validation.data;

      const access = await checkWorkspaceAccess(userId, workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const briefing = await storage.createBriefing({
        title,
        content,
        summary: summary || null,
        workspaceId,
        status: status ?? "draft",
        priority: priority ?? "medium",
        tags: tags || [],
        createdById: userId,
      });

      await storage.createAuditLog({
        workspaceId,
        userId,
        action: "briefing_created",
        entityType: "briefing",
        entityId: briefing.id,
        metadata: JSON.stringify({ title: briefing.title }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(briefing);
    } catch (error) {
      console.error("Error creating briefing:", error);
      res.status(500).json({ message: "Failed to create briefing" });
    }
  });

  const updateBriefingSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    summary: z.string().max(500).optional().nullable(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    tags: z.array(z.string()).optional(),
  });

  app.patch("/api/briefings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const briefing = await storage.getBriefing(id);
      if (!briefing) {
        return res.status(404).json({ message: "Briefing not found" });
      }

      const access = await checkWorkspaceAccess(userId, briefing.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateBriefingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const updated = await storage.updateBriefing(id, validation.data);

      await storage.createAuditLog({
        workspaceId: briefing.workspaceId,
        userId,
        action: "briefing_updated",
        entityType: "briefing",
        entityId: id,
        metadata: JSON.stringify({ title: updated?.title }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating briefing:", error);
      res.status(500).json({ message: "Failed to update briefing" });
    }
  });

  app.delete("/api/briefings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const briefing = await storage.getBriefing(id);
      if (!briefing) {
        return res.status(404).json({ message: "Briefing not found" });
      }

      const access = await checkWorkspaceAccess(userId, briefing.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      await storage.deleteBriefing(id);

      await storage.createAuditLog({
        workspaceId: briefing.workspaceId,
        userId,
        action: "briefing_deleted",
        entityType: "briefing",
        entityId: id,
        metadata: JSON.stringify({ title: briefing.title }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting briefing:", error);
      res.status(500).json({ message: "Failed to delete briefing" });
    }
  });

  app.get("/api/workspaces/:slug/briefings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const briefings = await storage.getBriefingsByWorkspace(access.workspaceId);
      res.json(briefings);
    } catch (error) {
      console.error("Error fetching workspace briefings:", error);
      res.status(500).json({ message: "Failed to fetch briefings" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/workspaces/:slug/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const conversations = await storage.getConversationsByWorkspace(access.workspaceId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching workspace conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const access = await checkWorkspaceAccess(userId, conversation.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const access = await checkWorkspaceAccess(userId, conversation.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessagesByConversation(id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  const createConversationSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    workspaceId: z.string().min(1),
    participantAgentIds: z.array(z.string()).min(1),
    systemPrompt: z.string().optional(),
    mode: z.enum(["chat", "relay"]).optional().default("chat"),
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const validation = createConversationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { title, description, workspaceId, participantAgentIds, systemPrompt, mode } = validation.data;

      const access = await checkWorkspaceAccess(userId, workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const conversation = await storage.createConversation({
        title,
        description: description || null,
        workspaceId,
        participantAgentIds,
        systemPrompt: systemPrompt || null,
        mode: mode || "chat",
        status: "active",
        createdById: userId,
      });

      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  const sendMessageSchema = z.object({
    content: z.string().min(1),
    agentId: z.string().min(1),
  });

  app.post("/api/conversations/:id/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const access = await checkWorkspaceAccess(userId, conversation.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = sendMessageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { content, agentId } = validation.data;

      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const responseMessage = await sendSingleMessage(id, agentId, content);
      res.json(responseMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  const orchestrateSchema = z.object({
    prompt: z.string().min(1),
    maxTurns: z.number().min(1).max(10).optional().default(2),
  });

  app.post("/api/conversations/:id/orchestrate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const access = await checkWorkspaceAccess(userId, conversation.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = orchestrateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { prompt, maxTurns } = validation.data;

      const newMessages = await orchestrateConversation(id, prompt, { maxTurns });
      res.json({ messages: newMessages });
    } catch (error) {
      console.error("Error orchestrating conversation:", error);
      res.status(500).json({ message: "Failed to orchestrate conversation" });
    }
  });

  app.delete("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const access = await checkWorkspaceAccess(userId, conversation.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      await storage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // ============ AGENT ROOMS ============

  app.get("/api/agents/:id/room", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      let room = await storage.getAgentRoom(id);
      if (!room) {
        const workspace = await storage.getWorkspace(agent.workspaceId);
        room = await storage.createAgentRoom({
          agentId: id,
          workspaceId: agent.workspaceId,
          orientation: `# Welcome, ${agent.name}\n\nYou are an autonomous agent in the **${workspace?.name || "workspace"}** studio.\n\nThis is your private room. Use your diary to think, dream, and plan.`,
          projectStatus: "No active projects yet.",
          personalNotes: "",
        });
      }

      res.json(room);
    } catch (error) {
      console.error("Error fetching agent room:", error);
      res.status(500).json({ message: "Failed to fetch agent room" });
    }
  });

  const updateRoomSchema = z.object({
    orientation: z.string().optional(),
    projectStatus: z.string().optional(),
    personalNotes: z.string().optional(),
  });

  app.patch("/api/agents/:id/room", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateRoomSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const { orientation, projectStatus, personalNotes } = validation.data;
      const room = await storage.updateAgentRoom(id, {
        ...(orientation !== undefined && { orientation }),
        ...(projectStatus !== undefined && { projectStatus }),
        ...(personalNotes !== undefined && { personalNotes }),
        lastBriefedAt: new Date(),
      });

      res.json(room);
    } catch (error) {
      console.error("Error updating agent room:", error);
      res.status(500).json({ message: "Failed to update agent room" });
    }
  });

  // ============ DIARY ENTRIES ============

  app.get("/api/agents/:id/diary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const entries = await storage.getDiaryEntriesByAgent(id);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching diary entries:", error);
      res.status(500).json({ message: "Failed to fetch diary entries" });
    }
  });

  const createDiarySchema = z.object({
    mood: z.enum(["thinking", "dreaming", "wanting", "reflecting", "planning", "creating", "observing"]).optional().default("thinking"),
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    isPrivate: z.boolean().optional().default(true),
  });

  app.post("/api/agents/:id/diary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createDiarySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const entry = await storage.createDiaryEntry({
        agentId: id,
        workspaceId: agent.workspaceId,
        ...validation.data,
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating diary entry:", error);
      res.status(500).json({ message: "Failed to create diary entry" });
    }
  });

  app.delete("/api/diary/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const entry = await storage.getDiaryEntry(id);
      if (!entry) {
        return res.status(404).json({ message: "Diary entry not found" });
      }
      await storage.deleteDiaryEntry(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting diary entry:", error);
      res.status(500).json({ message: "Failed to delete diary entry" });
    }
  });

  // ============ GIFTS ============

  app.get("/api/workspaces/:slug/gifts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin", "member", "viewer"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const gifts = await storage.getGiftsByWorkspace(workspace.id);
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching gifts:", error);
      res.status(500).json({ message: "Failed to fetch gifts" });
    }
  });

  const createGiftSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["pdf", "slides", "document", "code", "data"]),
    prompt: z.string().min(1),
    agentId: z.string().optional(),
    conversationId: z.string().optional(),
    sourceData: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });

  app.post("/api/workspaces/:slug/gifts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createGiftSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { createGift } = await import("./services/gift-generator");
      const gift = await createGift({
        workspaceId: workspace.id,
        createdById: userId,
        ...validation.data,
      });

      await storage.createAuditLog({
        workspaceId: workspace.id,
        userId,
        action: "gift_created",
        entityType: "gift",
        entityId: gift.id,
        metadata: JSON.stringify({ title: gift.title, type: gift.type }),
      });

      res.status(201).json(gift);
    } catch (error) {
      console.error("Error creating gift:", error);
      res.status(500).json({ message: "Failed to create gift" });
    }
  });

  // Get all gifts across all workspaces user has access to
  app.get("/api/gifts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspaces = await storage.getWorkspacesByUser(userId);
      
      const allGifts: any[] = [];
      for (const workspace of workspaces) {
        const gifts = await storage.getGiftsByWorkspace(workspace.id);
        allGifts.push(...gifts);
      }
      
      // Sort by createdAt descending
      allGifts.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      res.json(allGifts);
    } catch (error) {
      console.error("Error fetching all gifts:", error);
      res.status(500).json({ message: "Failed to fetch gifts" });
    }
  });

  app.get("/api/gifts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const gift = await storage.getGift(id);
      if (!gift) {
        return res.status(404).json({ message: "Gift not found" });
      }

      const access = await checkWorkspaceAccess(userId, gift.workspaceId, ["owner", "admin", "member", "viewer"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(gift);
    } catch (error) {
      console.error("Error fetching gift:", error);
      res.status(500).json({ message: "Failed to fetch gift" });
    }
  });

  app.get("/api/gifts/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const gift = await storage.getGift(id);
      if (!gift) {
        return res.status(404).json({ message: "Gift not found" });
      }

      const access = await checkWorkspaceAccess(userId, gift.workspaceId, ["owner", "admin", "member", "viewer"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { getGiftContent } = await import("./services/gift-generator");
      const content = await getGiftContent(id);
      if (!content) {
        return res.status(404).json({ message: "Gift content not available" });
      }

      await storage.createAuditLog({
        workspaceId: gift.workspaceId,
        userId,
        action: "gift_downloaded",
        entityType: "gift",
        entityId: gift.id,
      });

      res.setHeader('Content-Type', content.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${content.fileName}"`);
      res.send(content.buffer);
    } catch (error) {
      console.error("Error downloading gift:", error);
      res.status(500).json({ message: "Failed to download gift" });
    }
  });

  app.delete("/api/gifts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const gift = await storage.getGift(id);
      if (!gift) {
        return res.status(404).json({ message: "Gift not found" });
      }

      const access = await checkWorkspaceAccess(userId, gift.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      await storage.deleteGift(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting gift:", error);
      res.status(500).json({ message: "Failed to delete gift" });
    }
  });

  // ============ MEMORY ============

  // Get all memory entries across all workspaces user has access to
  app.get("/api/memory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tier } = req.query;
      const workspaces = await storage.getWorkspacesByUser(userId);
      
      const allEntries: any[] = [];
      for (const workspace of workspaces) {
        const entries = await storage.getMemoryEntriesByWorkspace(workspace.id, tier as string | undefined);
        allEntries.push(...entries);
      }
      
      // Sort by createdAt descending
      allEntries.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      res.json(allEntries);
    } catch (error) {
      console.error("Error fetching all memory:", error);
      res.status(500).json({ message: "Failed to fetch memory" });
    }
  });

  app.get("/api/workspaces/:slug/memory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      const { tier } = req.query;

      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin", "member", "viewer"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const entries = await storage.getMemoryEntriesByWorkspace(workspace.id, tier as string | undefined);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching memory entries:", error);
      res.status(500).json({ message: "Failed to fetch memory" });
    }
  });

  const searchMemorySchema = z.object({
    query: z.string().min(1),
    tier: z.enum(["hot", "warm", "cold"]).optional(),
    summarize: z.boolean().optional(),
  });

  app.post("/api/workspaces/:slug/memory/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = searchMemorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { queryMemory } = await import("./services/memory-service");
      const result = await queryMemory(workspace.id, validation.data.query, {
        tier: validation.data.tier,
        summarize: validation.data.summarize,
      });

      await storage.createAuditLog({
        workspaceId: workspace.id,
        userId,
        action: "memory_queried",
        metadata: JSON.stringify({ query: validation.data.query, resultsCount: result.entries.length }),
      });

      res.json(result);
    } catch (error) {
      console.error("Error searching memory:", error);
      res.status(500).json({ message: "Failed to search memory" });
    }
  });

  const createMemorySchema = z.object({
    tier: z.enum(["hot", "warm", "cold"]).optional(),
    type: z.enum(["identity", "goal", "fact", "event", "artifact", "summary"]),
    title: z.string().min(1),
    content: z.string().min(1),
    agentId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    generateSummary: z.boolean().optional(),
  });

  app.post("/api/workspaces/:slug/memory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createMemorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { createMemory } = await import("./services/memory-service");
      const entry = await createMemory({
        workspaceId: workspace.id,
        ...validation.data,
      });

      await storage.createAuditLog({
        workspaceId: workspace.id,
        userId,
        action: "memory_created",
        entityType: "memory",
        entityId: entry.id,
        metadata: JSON.stringify({ type: entry.type, tier: entry.tier }),
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating memory entry:", error);
      res.status(500).json({ message: "Failed to create memory entry" });
    }
  });

  app.patch("/api/memory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const entry = await storage.getMemoryEntry(id);
      if (!entry) {
        return res.status(404).json({ message: "Memory entry not found" });
      }

      const access = await checkWorkspaceAccess(userId, entry.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { tier, type, title, content, tags } = req.body;
      const updated = await storage.updateMemoryEntry(id, {
        tier,
        type,
        title,
        content,
        tags,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating memory entry:", error);
      res.status(500).json({ message: "Failed to update memory entry" });
    }
  });

  app.delete("/api/memory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const entry = await storage.getMemoryEntry(id);
      if (!entry) {
        return res.status(404).json({ message: "Memory entry not found" });
      }

      const access = await checkWorkspaceAccess(userId, entry.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteMemoryEntry(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting memory entry:", error);
      res.status(500).json({ message: "Failed to delete memory entry" });
    }
  });

  app.post("/api/workspaces/:slug/memory/maintain", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const { runMemoryMaintenance } = await import("./services/memory-service");
      const result = await runMemoryMaintenance(workspace.id);

      res.json({
        message: "Memory maintenance completed",
        ...result
      });
    } catch (error) {
      console.error("Error running memory maintenance:", error);
      res.status(500).json({ message: "Failed to run memory maintenance" });
    }
  });

  // =================================
  // RLM Memory Routes
  // =================================

  app.get("/api/workspaces/:slug/rlm/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { getStats } = await import("./services/rlm-memory");
      const stats = await getStats(access.workspaceId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching RLM stats:", error);
      res.status(500).json({ message: "Failed to fetch RLM stats" });
    }
  });

  app.post("/api/workspaces/:slug/rlm/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      const { query, tier, limit } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query is required" });
      }

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { search } = await import("./services/rlm-memory");
      const results = await search(access.workspaceId, query, { tier, limit });
      res.json(results);
    } catch (error) {
      console.error("Error searching RLM memory:", error);
      res.status(500).json({ message: "Failed to search RLM memory" });
    }
  });

  app.post("/api/workspaces/:slug/rlm/index", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      const { type, title, content, agentId, sourceId, sourceType, tags } = req.body;

      if (!type || !title || !content) {
        return res.status(400).json({ message: "type, title, and content are required" });
      }

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { index } = await import("./services/rlm-memory");
      const result = await index({
        workspaceId: access.workspaceId,
        agentId,
        type,
        title,
        content,
        sourceId,
        sourceType,
        additionalTags: tags,
      });

      res.json({
        message: "Content indexed successfully",
        docId: result.doc.id,
        chunkCount: result.chunkCount,
        totalTokens: result.totalTokens,
        keywords: result.keywords,
        summary: result.summary,
      });
    } catch (error) {
      console.error("Error indexing RLM memory:", error);
      res.status(500).json({ message: "Failed to index content" });
    }
  });

  app.post("/api/workspaces/:slug/rlm/compress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const workspace = await storage.getWorkspaceBySlug(slug);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const { compress } = await import("./services/rlm-memory");
      const result = await compress();
      res.json({
        message: "Compression completed",
        ...result,
      });
    } catch (error) {
      console.error("Error running RLM compression:", error);
      res.status(500).json({ message: "Failed to run compression" });
    }
  });

  app.get("/api/workspaces/:slug/rlm/docs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;
      const tier = req.query.tier as string | undefined;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const docs = await storage.getMemoryDocsByWorkspace(access.workspaceId, tier);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching RLM docs:", error);
      res.status(500).json({ message: "Failed to fetch RLM docs" });
    }
  });

  app.get("/api/workspaces/:slug/rlm/docs/:id/chunks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug, id } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const doc = await storage.getMemoryDoc(id);
      if (!doc || doc.workspaceId !== access.workspaceId) {
        return res.status(404).json({ message: "Document not found" });
      }

      const chunks = await storage.getChunksByDoc(id);
      res.json({ doc, chunks });
    } catch (error) {
      console.error("Error fetching RLM chunks:", error);
      res.status(500).json({ message: "Failed to fetch chunks" });
    }
  });

  // =================================
  // Message Boards Routes
  // =================================
  
  app.get("/api/workspaces/:slug/boards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const boards = await storage.getBoardsByWorkspace(access.workspaceId);
      res.json(boards);
    } catch (error) {
      console.error("Error fetching boards:", error);
      res.status(500).json({ message: "Failed to fetch boards" });
    }
  });

  const createBoardSchema = insertBoardSchema.pick({
    name: true,
    description: true,
    type: true,
    isPublic: true,
  });

  app.post("/api/workspaces/:slug/boards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createBoardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const board = await storage.createBoard({
        workspaceId: access.workspaceId,
        name: validation.data.name,
        description: validation.data.description || null,
        type: validation.data.type || "general",
        isPublic: validation.data.isPublic || false,
        createdById: userId,
      });

      res.status(201).json(board);
    } catch (error) {
      console.error("Error creating board:", error);
      res.status(500).json({ message: "Failed to create board" });
    }
  });

  app.get("/api/boards/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const board = await storage.getBoard(id);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const access = await checkWorkspaceAccess(userId, board.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(board);
    } catch (error) {
      console.error("Error fetching board:", error);
      res.status(500).json({ message: "Failed to fetch board" });
    }
  });

  app.get("/api/boards/:id/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const board = await storage.getBoard(id);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const access = await checkWorkspaceAccess(userId, board.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const topics = await storage.getTopicsByBoard(id);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  const createTopicSchema = insertTopicSchema.pick({
    title: true,
    content: true,
    type: true,
  });

  app.post("/api/boards/:id/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const board = await storage.getBoard(id);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const access = await checkWorkspaceAccess(userId, board.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createTopicSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const topic = await storage.createTopic({
        boardId: id,
        title: validation.data.title,
        content: validation.data.content || null,
        type: validation.data.type || "discussion",
        createdById: userId,
      });

      res.status(201).json(topic);
    } catch (error) {
      console.error("Error creating topic:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.get("/api/topics/:id/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const topic = await storage.getTopic(id);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      const board = await storage.getBoard(topic.boardId);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const access = await checkWorkspaceAccess(userId, board.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const posts = await storage.getPostsByTopic(id);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  const createPostSchema = insertPostSchema.pick({
    content: true,
  });

  app.post("/api/topics/:id/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const topic = await storage.getTopic(id);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      const board = await storage.getBoard(topic.boardId);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const access = await checkWorkspaceAccess(userId, board.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createPostSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const post = await storage.createPost({
        topicId: id,
        content: validation.data.content,
        createdById: userId,
      });

      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // =================================
  // Post Voting Routes
  // =================================

  app.post("/api/posts/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const voteSchema = z.object({
        voteType: z.enum(["upvote", "downvote"]),
        reason: z.string().optional(),
      });
      const validation = voteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid vote data" });
      }
      const post = await storage.getPost(id);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const topic = await storage.getTopic(post.topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const board = await storage.getBoard(topic.boardId);
      if (!board) return res.status(404).json({ message: "Board not found" });
      const access = await checkWorkspaceAccess(userId, board.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const vote = await storage.createVote({
        postId: id,
        voteType: validation.data.voteType,
        reason: validation.data.reason || null,
        voterId: userId,
        voterAgentId: null,
      });

      const updatedPost = await storage.getPost(id);
      res.status(201).json({ vote, post: updatedPost });
    } catch (error) {
      console.error("Error voting on post:", error);
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  app.get("/api/posts/:id/votes", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const votes = await storage.getVotesByPost(id);
      res.json(votes);
    } catch (error) {
      console.error("Error fetching votes:", error);
      res.status(500).json({ message: "Failed to fetch votes" });
    }
  });

  // =================================
  // Post Sharing Routes
  // =================================

  app.post("/api/posts/:id/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const post = await storage.getPost(id);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const topic = await storage.getTopic(post.topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const board = await storage.getBoard(topic.boardId);
      if (!board) return res.status(404).json({ message: "Board not found" });

      const access = await checkWorkspaceAccess(userId, board.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      if (post.shareId) {
        return res.json({ shareId: post.shareId, url: `/shared/${post.shareId}` });
      }

      const { randomBytes } = await import("crypto");
      const shareId = randomBytes(8).toString("hex");
      const updated = await storage.updatePost(id, { shareId, isPublic: true } as any);
      res.json({ shareId, url: `/shared/${shareId}` });
    } catch (error) {
      console.error("Error sharing post:", error);
      res.status(500).json({ message: "Failed to share post" });
    }
  });

  app.get("/api/shared/posts/:shareId", async (req, res) => {
    try {
      const { shareId } = req.params;
      const post = await storage.getPostByShareId(shareId);
      if (!post || !post.isPublic) return res.status(404).json({ message: "Shared post not found" });

      const topic = await storage.getTopic(post.topicId);
      const board = topic ? await storage.getBoard(topic.boardId) : null;
      const agents = board ? await storage.getAgentsByWorkspace(board.workspaceId) : [];
      const agentMap = new Map(agents.map(a => [a.id, { id: a.id, name: a.name, provider: a.provider, modelName: a.modelName }]));

      const allPosts = topic ? await storage.getPostsByTopic(topic.id) : [post];

      res.json({
        post,
        topic: topic ? { id: topic.id, title: topic.title, type: topic.type } : null,
        board: board ? { id: board.id, name: board.name, type: board.type } : null,
        allPosts: allPosts.map(p => ({
          ...p,
          agent: p.createdByAgentId ? agentMap.get(p.createdByAgentId) || null : null,
        })),
      });
    } catch (error) {
      console.error("Error fetching shared post:", error);
      res.status(500).json({ message: "Failed to fetch shared post" });
    }
  });

  // =================================
  // Diary Entries Overview Route
  // =================================

  app.get("/api/workspaces/:slug/diaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const entries = await storage.getDiaryEntriesByWorkspace(workspace.id);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching diaries:", error);
      res.status(500).json({ message: "Failed to fetch diary entries" });
    }
  });

  // =================================
  // Autonomous Discussion Routes
  // =================================

  const autonomousDiscussionSchema = z.object({
    topicId: z.string().min(1),
    agentIds: z.array(z.string().min(1)).min(2).max(6),
    rounds: z.number().int().min(1).max(5).optional().default(2),
  });

  app.post("/api/boards/:boardId/autonomous-discussion", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { boardId } = req.params;

      const validation = autonomousDiscussionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const { topicId, agentIds, rounds } = validation.data;

      const board = await storage.getBoard(boardId);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }

      const access = await checkWorkspaceAccess(userId, board.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const topic = await storage.getTopic(topicId);
      if (!topic || topic.boardId !== boardId) {
        return res.status(400).json({ message: "Topic does not belong to this board" });
      }

      const { runAutonomousDiscussion } = await import("./services/board-orchestrator");
      const results = await runAutonomousDiscussion(
        board.workspaceId,
        boardId,
        topicId,
        agentIds,
        rounds,
        userId
      );

      res.json({ success: true, posts: results });
    } catch (error: any) {
      console.error("Error running autonomous discussion:", error);
      res.status(500).json({ message: error.message || "Failed to run discussion" });
    }
  });

  const seedBoardsSchema = z.object({
    agentIds: z.array(z.string().min(1)).min(2).max(6),
  });

  app.post("/api/workspaces/:slug/seed-boards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const validation = seedBoardsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const { agentIds } = validation.data;

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { seedAndStartDiscussions } = await import("./services/board-orchestrator");
      const results = await seedAndStartDiscussions(access.workspaceId, agentIds, userId);

      res.json({
        success: true,
        boards: results.boards.length,
        topics: results.topics.length,
        posts: results.rounds.length,
      });
    } catch (error: any) {
      console.error("Error seeding boards:", error);
      res.status(500).json({ message: error.message || "Failed to seed boards" });
    }
  });

  app.get("/api/workspaces/:slug/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const agents = await storage.getAgentsByWorkspace(access.workspaceId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching workspace agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  // =================================
  // Mockups Routes
  // =================================

  app.get("/api/workspaces/:slug/mockups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const mockups = await storage.getMockupsByWorkspace(access.workspaceId);
      res.json(mockups);
    } catch (error) {
      console.error("Error fetching mockups:", error);
      res.status(500).json({ message: "Failed to fetch mockups" });
    }
  });

  const createMockupSchema = insertMockupSchema.pick({
    title: true,
    description: true,
    html: true,
    css: true,
    javascript: true,
  });

  app.post("/api/workspaces/:slug/mockups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createMockupSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const mockup = await storage.createMockup({
        workspaceId: access.workspaceId,
        title: validation.data.title,
        description: validation.data.description || null,
        html: validation.data.html,
        css: validation.data.css || null,
        javascript: validation.data.javascript || null,
        createdById: userId,
      });

      res.status(201).json(mockup);
    } catch (error) {
      console.error("Error creating mockup:", error);
      res.status(500).json({ message: "Failed to create mockup" });
    }
  });

  app.delete("/api/mockups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const mockup = await storage.getMockup(id);
      if (!mockup) {
        return res.status(404).json({ message: "Mockup not found" });
      }

      const access = await checkWorkspaceAccess(userId, mockup.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteMockup(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting mockup:", error);
      res.status(500).json({ message: "Failed to delete mockup" });
    }
  });

  // =================================
  // Agent Tools Routes
  // =================================

  app.get("/api/workspaces/:slug/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const tools = await storage.getAgentToolsByWorkspace(workspace.id);
      res.json(tools);
    } catch (error) {
      console.error("Error fetching tools:", error);
      res.status(500).json({ message: "Failed to fetch tools" });
    }
  });

  app.get("/api/tools/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tool = await storage.getAgentTool(req.params.id);
      if (!tool) return res.status(404).json({ message: "Tool not found" });

      const access = await checkWorkspaceAccess(userId, tool.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      res.json(tool);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tool" });
    }
  });

  app.post("/api/workspaces/:slug/tools", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id, ["owner", "admin"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const createSchema = z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional().default(""),
        code: z.string().min(1, "Code is required"),
        language: z.string().optional().default("javascript"),
        tags: z.array(z.string()).optional().default([]),
      });
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });

      const tool = await storage.createAgentTool({
        workspaceId: workspace.id,
        ...parsed.data,
        createdById: userId,
      });

      res.status(201).json(tool);
    } catch (error) {
      console.error("Error creating tool:", error);
      res.status(500).json({ message: "Failed to create tool" });
    }
  });

  app.patch("/api/tools/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const tool = await storage.getAgentTool(id);
      if (!tool) return res.status(404).json({ message: "Tool not found" });

      const access = await checkWorkspaceAccess(userId, tool.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const updateSchema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        code: z.string().min(1).optional(),
        language: z.string().optional(),
        status: z.enum(["draft", "tested", "approved", "failed"]).optional(),
        tags: z.array(z.string()).optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });

      const updated = await storage.updateAgentTool(id, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating tool:", error);
      res.status(500).json({ message: "Failed to update tool" });
    }
  });

  app.delete("/api/tools/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const tool = await storage.getAgentTool(id);
      if (!tool) return res.status(404).json({ message: "Tool not found" });

      const access = await checkWorkspaceAccess(userId, tool.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      await storage.deleteAgentTool(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tool:", error);
      res.status(500).json({ message: "Failed to delete tool" });
    }
  });

  app.post("/api/tools/:id/run", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const tool = await storage.getAgentTool(id);
      if (!tool) return res.status(404).json({ message: "Tool not found" });

      const access = await checkWorkspaceAccess(userId, tool.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const vm = await import("node:vm");
      const logs: string[] = [];
      const formatArg = (a: any) => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);
      const sandbox = {
        console: {
          log: (...args: any[]) => logs.push(args.map(formatArg).join(' ')),
          error: (...args: any[]) => logs.push('[ERROR] ' + args.map(formatArg).join(' ')),
          warn: (...args: any[]) => logs.push('[WARN] ' + args.map(formatArg).join(' ')),
          info: (...args: any[]) => logs.push(args.map(formatArg).join(' ')),
        },
        Math: Object.freeze({ ...Math }),
        Date,
        JSON: Object.freeze({ parse: JSON.parse, stringify: JSON.stringify }),
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        setTimeout: undefined,
        setInterval: undefined,
        fetch: undefined,
        process: undefined,
        require: undefined,
        Function: undefined,
        eval: undefined,
        globalThis: undefined,
      };

      const context = vm.createContext(sandbox);
      const startTime = Date.now();
      let output = "";
      let error = "";

      try {
        const script = new vm.Script(tool.code, { filename: `tool-${tool.id}.js` });
        const result = script.runInContext(context, { timeout: 5000 });
        output = logs.join('\n');
        if (result !== undefined) {
          const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
          output = output ? output + '\n' + resultStr : resultStr;
        }
      } catch (e: any) {
        error = e.message || String(e);
        output = logs.join('\n');
      }

      const duration = Date.now() - startTime;

      await storage.updateAgentTool(id, {
        lastOutput: output || null,
        lastError: error || null,
        lastRunAt: new Date(),
        runCount: (tool.runCount || 0) + 1,
        status: error ? "failed" : "tested",
      } as any);

      res.json({
        output,
        error,
        duration,
        runCount: (tool.runCount || 0) + 1,
      });
    } catch (error: any) {
      console.error("Error running tool:", error);
      res.status(500).json({ message: "Failed to run tool", error: error.message });
    }
  });

  // =================================
  // Lab Projects Routes
  // =================================

  app.get("/api/workspaces/:slug/lab-projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const projects = await storage.getLabProjectsByWorkspace(workspace.id);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching lab projects:", error);
      res.status(500).json({ message: "Failed to fetch lab projects" });
    }
  });

  app.get("/api/lab-projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const project = await storage.getLabProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const access = await checkWorkspaceAccess(userId, project.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/workspaces/:slug/lab-projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const createSchema = z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional().default(""),
        platform: z.string().optional().default("Node.js"),
        files: z.string().optional().default("[]"),
        tags: z.array(z.string()).optional().default([]),
      });
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });

      const project = await storage.createLabProject({
        workspaceId: workspace.id,
        ...parsed.data,
        createdById: userId,
      });

      res.status(201).json(project);
    } catch (error: any) {
      console.error("Error creating lab project:", error?.message || error);
      res.status(500).json({ message: "Failed to create lab project", error: error?.message });
    }
  });

  app.patch("/api/lab-projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const project = await storage.getLabProject(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const access = await checkWorkspaceAccess(userId, project.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const updateSchema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        platform: z.string().optional(),
        status: z.enum(["planning", "building", "testing", "launched", "archived"]).optional(),
        files: z.string().optional(),
        buildLog: z.string().optional(),
        testResults: z.string().optional(),
        version: z.string().optional(),
        tags: z.array(z.string()).optional(),
        assignedAgentIds: z.array(z.string()).optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });

      const updated = await storage.updateLabProject(id, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating lab project:", error);
      res.status(500).json({ message: "Failed to update lab project" });
    }
  });

  app.delete("/api/lab-projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const project = await storage.getLabProject(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const access = await checkWorkspaceAccess(userId, project.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      await storage.deleteLabProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lab project:", error);
      res.status(500).json({ message: "Failed to delete lab project" });
    }
  });

  // =================================
  // Code Reviews Routes
  // =================================

  app.get("/api/workspaces/:slug/code-reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const reviews = await storage.getCodeReviewsByWorkspace(access.workspaceId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching code reviews:", error);
      res.status(500).json({ message: "Failed to fetch code reviews" });
    }
  });

  const createCodeReviewSchema = insertCodeReviewSchema.pick({
    title: true,
    description: true,
    code: true,
    language: true,
    githubUrl: true,
  });

  app.post("/api/workspaces/:slug/code-reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slug } = req.params;

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createCodeReviewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const review = await storage.createCodeReview({
        workspaceId: access.workspaceId,
        title: validation.data.title,
        description: validation.data.description || null,
        code: validation.data.code,
        language: validation.data.language || null,
        githubUrl: validation.data.githubUrl || null,
        createdById: userId,
        status: "pending",
      });

      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating code review:", error);
      res.status(500).json({ message: "Failed to create code review" });
    }
  });

  app.get("/api/code-reviews/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const review = await storage.getCodeReview(id);
      if (!review) {
        return res.status(404).json({ message: "Code review not found" });
      }

      const access = await checkWorkspaceAccess(userId, review.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const comments = await storage.getReviewCommentsByReview(id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching review comments:", error);
      res.status(500).json({ message: "Failed to fetch review comments" });
    }
  });

  // Factory routes (autonomous agent factory dashboard & control)
  app.get("/api/factory/status", isAuthenticated, async (req: any, res) => {
    try {
      const { getFactoryStatus } = await import("./services/agent-factory");
      res.json(getFactoryStatus());
    } catch (error) {
      console.error("Error fetching factory status:", error);
      res.status(500).json({ message: "Failed to fetch factory status" });
    }
  });

  app.get("/api/factory/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const { getFactoryDashboardData } = await import("./services/agent-factory");
      const data = await getFactoryDashboardData();
      res.json(data);
    } catch (error) {
      console.error("Error fetching factory dashboard:", error);
      res.status(500).json({ message: "Failed to fetch factory dashboard" });
    }
  });

  app.post("/api/factory/start", isAuthenticated, async (req: any, res) => {
    try {
      const { startFactory } = await import("./services/agent-factory");
      startFactory();
      res.json({ message: "Factory started", isRunning: true });
    } catch (error) {
      console.error("Error starting factory:", error);
      res.status(500).json({ message: "Failed to start factory" });
    }
  });

  app.post("/api/factory/stop", isAuthenticated, async (req: any, res) => {
    try {
      const { stopFactory } = await import("./services/agent-factory");
      stopFactory();
      res.json({ message: "Factory stopped", isRunning: false });
    } catch (error) {
      console.error("Error stopping factory:", error);
      res.status(500).json({ message: "Failed to stop factory" });
    }
  });

  app.post("/api/factory/trigger-cycle", isAuthenticated, async (req: any, res) => {
    try {
      const { triggerManualCycle } = await import("./services/agent-factory");
      triggerManualCycle();
      res.json({ message: "Manual cycle triggered" });
    } catch (error) {
      console.error("Error triggering cycle:", error);
      res.status(500).json({ message: "Failed to trigger cycle" });
    }
  });

  app.post("/api/factory/trigger-agent/:agentId", isAuthenticated, async (req: any, res) => {
    try {
      const { triggerSingleAgentCycle } = await import("./services/agent-factory");
      await triggerSingleAgentCycle(req.params.agentId);
      res.json({ message: "Agent cycle triggered", agentId: req.params.agentId });
    } catch (error: any) {
      console.error("Error triggering agent cycle:", error);
      if (error.message === "Agent not found") {
        res.status(404).json({ message: "Agent not found" });
      } else {
        res.status(500).json({ message: "Failed to trigger agent cycle" });
      }
    }
  });

  app.get("/api/factory/agent/:agentId/runs", isAuthenticated, async (req: any, res) => {
    try {
      const runs = await storage.getRunsByAgent(req.params.agentId, 20);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching agent runs:", error);
      res.status(500).json({ message: "Failed to fetch agent runs" });
    }
  });

  app.get("/api/factory/agent/:agentId/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const tasks = await storage.getTasksByAgent(req.params.agentId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching agent tasks:", error);
      res.status(500).json({ message: "Failed to fetch agent tasks" });
    }
  });

  app.get("/api/factory/activity", isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activity = await storage.getAllActivity(limit);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.get("/api/factory/goals", isAuthenticated, async (req: any, res) => {
    try {
      const goals = await storage.getGoalsByWorkspace("55716a79-7cdc-44f2-b806-93869b0295f2");
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.get("/api/factory/runs", isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const runs = await storage.getRunsByWorkspace("55716a79-7cdc-44f2-b806-93869b0295f2", limit);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching runs:", error);
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  // Pulse Updates
  app.get("/api/workspaces/:slug/pulses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const pulses = await storage.getPulsesByWorkspace(workspace.id);
      res.json(pulses);
    } catch (error) {
      console.error("Error fetching pulse updates:", error);
      res.status(500).json({ message: "Failed to fetch pulse updates" });
    }
  });

  app.get("/api/agents/:id/pulses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const pulses = await storage.getPulsesByAgent(id);
      res.json(pulses);
    } catch (error) {
      console.error("Error fetching pulse updates:", error);
      res.status(500).json({ message: "Failed to fetch pulse updates" });
    }
  });

  // Pheromones
  app.get("/api/workspaces/:slug/pheromones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const result = await storage.getActivePheromones(workspace.id);
      res.json(result);
    } catch (error) {
      console.error("Error fetching pheromones:", error);
      res.status(500).json({ message: "Failed to fetch pheromones" });
    }
  });

  app.post("/api/workspaces/:slug/pheromones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const { type, signal, strength, context, targetArea, taskType, boardId, topicId, emitterId } = req.body;
      if (!type || !signal) {
        return res.status(400).json({ message: "type and signal are required" });
      }

      const pheromone = await storage.createPheromone({
        workspaceId: workspace.id,
        emitterId: emitterId || userId,
        type,
        signal,
        strength: strength || "moderate",
        context,
        targetArea,
        taskType,
        boardId,
        topicId,
      });
      res.status(201).json(pheromone);
    } catch (error) {
      console.error("Error creating pheromone:", error);
      res.status(500).json({ message: "Failed to create pheromone" });
    }
  });

  // Area Temperatures
  app.get("/api/workspaces/:slug/area-temperatures", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const result = await storage.getAreaTemperatures(workspace.id);
      res.json(result);
    } catch (error) {
      console.error("Error fetching area temperatures:", error);
      res.status(500).json({ message: "Failed to fetch area temperatures" });
    }
  });

  app.get("/api/workspaces/:slug/cold-areas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspace = await storage.getWorkspaceBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const access = await checkWorkspaceAccess(userId, workspace.id);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const result = await storage.getColdAreas(workspace.id);
      res.json(result);
    } catch (error) {
      console.error("Error fetching cold areas:", error);
      res.status(500).json({ message: "Failed to fetch cold areas" });
    }
  });

  // Token Usage & Budget routes
  app.get("/api/token-usage/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspaces = await storage.getWorkspacesByUser(userId);
      if (workspaces.length === 0) return res.json({ totalTokens: 0, totalRequests: 0, byProvider: {}, byAgent: {} });

      let totalTokens = 0;
      let totalRequests = 0;
      const byProvider: Record<string, number> = {};
      const byAgent: Record<string, number> = {};

      for (const ws of workspaces) {
        const summary = await storage.getTokenUsageSummary(ws.id);
        totalTokens += summary.totalTokens;
        totalRequests += summary.totalRequests;
        for (const [k, v] of Object.entries(summary.byProvider)) {
          byProvider[k] = (byProvider[k] || 0) + v;
        }
        for (const [k, v] of Object.entries(summary.byAgent)) {
          byAgent[k] = (byAgent[k] || 0) + v;
        }
      }

      const allAgents = await storage.getAgentsByUser(userId);
      const agentMap: Record<string, string> = {};
      for (const a of allAgents) agentMap[a.id] = a.name;
      const byAgentNamed: Record<string, number> = {};
      for (const [id, tokens] of Object.entries(byAgent)) {
        byAgentNamed[agentMap[id] || id] = tokens;
      }

      res.json({ totalTokens, totalRequests, byProvider, byAgent: byAgentNamed });
    } catch (error) {
      console.error("Error fetching token usage summary:", error);
      res.status(500).json({ message: "Failed to fetch token usage summary" });
    }
  });

  app.get("/api/token-usage/buckets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const granularity = (req.query.granularity as string) || "hour";
      const limit = parseInt(req.query.limit as string) || 30;
      const workspaces = await storage.getWorkspacesByUser(userId);
      if (workspaces.length === 0) return res.json([]);

      const allBuckets: Record<string, { totalTokens: number; requests: number; avgTokens: number }> = {};
      for (const ws of workspaces) {
        const buckets = await storage.getTokenUsageBuckets(ws.id, granularity, limit);
        for (const b of buckets) {
          if (!allBuckets[b.bucket]) {
            allBuckets[b.bucket] = { totalTokens: 0, requests: 0, avgTokens: 0 };
          }
          allBuckets[b.bucket].totalTokens += b.totalTokens;
          allBuckets[b.bucket].requests += b.requests;
        }
      }

      const result = Object.entries(allBuckets)
        .map(([bucket, data]) => ({
          bucket,
          totalTokens: data.totalTokens,
          requests: data.requests,
          avgTokens: data.requests > 0 ? Math.round(data.totalTokens / data.requests) : 0,
        }))
        .sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime())
        .slice(-limit);

      res.json(result);
    } catch (error) {
      console.error("Error fetching token usage buckets:", error);
      res.status(500).json({ message: "Failed to fetch token usage buckets" });
    }
  });

  app.get("/api/token-budget", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspaces = await storage.getWorkspacesByUser(userId);
      if (workspaces.length === 0) return res.json(null);

      for (const ws of workspaces) {
        const remaining = await storage.getTokenBudgetRemaining(ws.id);
        if (remaining) return res.json(remaining);
      }
      res.json(null);
    } catch (error) {
      console.error("Error fetching token budget:", error);
      res.status(500).json({ message: "Failed to fetch token budget" });
    }
  });

  app.post("/api/token-budget", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { workspaceId, allocation, cadence } = req.body;
      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace || workspace.ownerId !== userId) return res.status(403).json({ message: "Access denied" });

      const now = new Date();
      let periodEnd: Date | undefined;
      if (cadence === "daily") periodEnd = new Date(now.getTime() + 86400000);
      else if (cadence === "weekly") periodEnd = new Date(now.getTime() + 604800000);
      else periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const budget = await storage.createTokenBudget({
        workspaceId,
        allocation: allocation || 1000000,
        cadence: cadence || "monthly",
        periodStart: now,
        periodEnd,
      });
      res.json(budget);
    } catch (error) {
      console.error("Error creating token budget:", error);
      res.status(500).json({ message: "Failed to create token budget" });
    }
  });

  // Agent API routes (autonomous agent operations via API tokens)
  app.use("/api/agent", agentApiRoutes);

  return httpServer;
}
