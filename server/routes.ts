import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { insertWorkspaceSchema, insertAgentSchema, insertGiftSchema, insertGiftCommentSchema, insertAssemblyLineSchema, insertAssemblyLineStepSchema, insertProductSchema, insertAgentNoteSchema, insertAgentFileDraftSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import AnthropicSDK from "@anthropic-ai/sdk";

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

  const createAgentSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    workspaceId: z.string().min(1),
    capabilities: z.array(z.string()).optional().default([]),
    isActive: z.boolean().optional().default(true),
    heygenAvatarId: z.string().max(200).optional().nullable(),
    elevenLabsVoiceId: z.string().max(200).optional().nullable(),
  });

  const updateAgentSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    avatar: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    capabilities: z.array(z.string()).optional(),
    permissions: z.array(z.string()).optional(),
    heygenAvatarId: z.string().max(200).optional().nullable(),
    elevenLabsVoiceId: z.string().max(200).optional().nullable(),
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

      const { name, description, workspaceId, capabilities, isActive, heygenAvatarId, elevenLabsVoiceId } = validation.data;

      const access = await checkWorkspaceAccess(userId, workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const agent = await storage.createAgent({
        name,
        description,
        workspaceId,
        capabilities: capabilities || [],
        permissions: [],
        isActive: isActive ?? true,
        isVerified: false,
        createdById: userId,
        heygenAvatarId: heygenAvatarId || null,
        elevenLabsVoiceId: elevenLabsVoiceId || null,
      });

      await storage.createAuditLog({
        workspaceId,
        userId,
        action: "agent_created",
        entityType: "agent",
        entityId: agent.id,
        metadata: JSON.stringify({ name: agent.name }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.patch("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const access = await checkWorkspaceAccess(userId, agent.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const validation = updateAgentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
      }

      const updated = await storage.updateAgent(req.params.id, validation.data);

      await storage.createAuditLog({
        workspaceId: agent.workspaceId,
        userId,
        action: "agent_updated",
        entityType: "agent",
        entityId: agent.id,
        metadata: JSON.stringify({ fields: Object.keys(validation.data) }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: "Failed to update agent" });
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

  // === GIFTS ===
  app.get("/api/gifts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gifts = await storage.getGiftsByUser(userId);
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching gifts:", error);
      res.status(500).json({ message: "Failed to fetch gifts" });
    }
  });

  app.get("/api/gifts/recent", isAuthenticated, async (_req: any, res) => {
    try {
      const gifts = await storage.getRecentGifts(20);
      res.json(gifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent gifts" });
    }
  });

  app.get("/api/gifts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const gift = await storage.getGift(req.params.id);
      if (!gift) return res.status(404).json({ message: "Gift not found" });
      res.json(gift);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gift" });
    }
  });

  app.post("/api/gifts", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertGiftSchema.parse(req.body);
      const gift = await storage.createGift(parsed);
      res.status(201).json(gift);
    } catch (error) {
      console.error("Error creating gift:", error);
      res.status(400).json({ message: "Failed to create gift" });
    }
  });

  app.patch("/api/gifts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const gift = await storage.updateGift(req.params.id, req.body);
      if (!gift) return res.status(404).json({ message: "Gift not found" });
      res.json(gift);
    } catch (error) {
      res.status(500).json({ message: "Failed to update gift" });
    }
  });

  app.delete("/api/gifts/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteGift(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete gift" });
    }
  });

  app.post("/api/gifts/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      await storage.likeGift(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to like gift" });
    }
  });

  app.get("/api/gifts/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const comments = await storage.getGiftComments(req.params.id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/gifts/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertGiftCommentSchema.parse({
        ...req.body,
        giftId: req.params.id,
      });
      const comment = await storage.createGiftComment(parsed);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(400).json({ message: "Failed to create comment" });
    }
  });

  // === ASSEMBLY LINES ===
  app.get("/api/assembly-lines", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lines = await storage.getAssemblyLinesByUser(userId);
      res.json(lines);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assembly lines" });
    }
  });

  app.get("/api/assembly-lines/:id", isAuthenticated, async (req: any, res) => {
    try {
      const line = await storage.getAssemblyLine(req.params.id);
      if (!line) return res.status(404).json({ message: "Assembly line not found" });
      res.json(line);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assembly line" });
    }
  });

  app.post("/api/assembly-lines", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertAssemblyLineSchema.parse({ ...req.body, ownerId: userId });
      const line = await storage.createAssemblyLine(parsed);
      res.status(201).json(line);
    } catch (error) {
      console.error("Error creating assembly line:", error);
      res.status(400).json({ message: "Failed to create assembly line" });
    }
  });

  app.patch("/api/assembly-lines/:id", isAuthenticated, async (req: any, res) => {
    try {
      const line = await storage.updateAssemblyLine(req.params.id, req.body);
      if (!line) return res.status(404).json({ message: "Assembly line not found" });
      res.json(line);
    } catch (error) {
      res.status(500).json({ message: "Failed to update assembly line" });
    }
  });

  app.delete("/api/assembly-lines/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteAssemblyLine(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete assembly line" });
    }
  });

  app.get("/api/assembly-lines/:id/steps", isAuthenticated, async (req: any, res) => {
    try {
      const steps = await storage.getAssemblyLineSteps(req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch steps" });
    }
  });

  app.post("/api/assembly-lines/:id/steps", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertAssemblyLineStepSchema.parse({
        ...req.body,
        assemblyLineId: req.params.id,
      });
      const step = await storage.createAssemblyLineStep(parsed);
      res.status(201).json(step);
    } catch (error) {
      console.error("Error creating step:", error);
      res.status(400).json({ message: "Failed to create step" });
    }
  });

  app.patch("/api/assembly-line-steps/:id", isAuthenticated, async (req: any, res) => {
    try {
      const step = await storage.updateAssemblyLineStep(req.params.id, req.body);
      if (!step) return res.status(404).json({ message: "Step not found" });
      res.json(step);
    } catch (error) {
      res.status(500).json({ message: "Failed to update step" });
    }
  });

  // === PRODUCTS ===
  app.get("/api/products", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const productsList = await storage.getProductsByUser(userId);
      res.json(productsList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertProductSchema.parse({ ...req.body, ownerId: userId });
      const product = await storage.createProduct(parsed);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Media generation routes for Newsroom
  const mediaOpenai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  app.post("/api/briefings/:id/generate-image", isAuthenticated, async (req: any, res) => {
    try {
      const briefing = await storage.getBriefing(req.params.id);
      if (!briefing) return res.status(404).json({ message: "Briefing not found" });

      const prompt = req.body.prompt || `News article thumbnail for: ${briefing.title}. ${briefing.summary || ""}. Professional news broadcast style, modern, clean design with gold accent colors.`;
      
      const response = await mediaOpenai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 1000),
        n: 1,
        size: "1792x1024",
        quality: "standard",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) return res.status(500).json({ message: "Failed to generate image" });

      const updated = await storage.updateBriefing(briefing.id, { imageUrl, thumbnailUrl: imageUrl });
      res.json({ imageUrl, briefing: updated });
    } catch (error: any) {
      console.error("Image generation error:", error);
      res.status(500).json({ message: error.message || "Failed to generate image" });
    }
  });

  app.post("/api/briefings/:id/generate-audio", isAuthenticated, async (req: any, res) => {
    try {
      const briefing = await storage.getBriefing(req.params.id);
      if (!briefing) return res.status(404).json({ message: "Briefing not found" });

      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "ElevenLabs API key not configured" });

      const text = req.body.text || `${briefing.title}. ${briefing.summary || briefing.content.slice(0, 2000)}`;
      let voiceId = req.body.voiceId || "21m00Tcm4TlvDq8ikWAM";
      if (briefing.authorAgentId) {
        const agent = await storage.getAgent(briefing.authorAgentId);
        if (agent?.elevenLabsVoiceId) voiceId = agent.elevenLabsVoiceId;
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(500).json({ message: `ElevenLabs error: ${errText}` });
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const fs = await import("fs");
      const path = await import("path");
      const audioDir = path.join(process.cwd(), "client", "public", "audio");
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

      const filename = `broadcast-${briefing.id}-${Date.now()}.mp3`;
      const filePath = path.join(audioDir, filename);
      fs.writeFileSync(filePath, audioBuffer);

      const audioUrl = `/audio/${filename}`;
      const updated = await storage.updateBriefing(briefing.id, { audioUrl });
      res.json({ audioUrl, briefing: updated });
    } catch (error: any) {
      console.error("Audio generation error:", error);
      res.status(500).json({ message: error.message || "Failed to generate audio" });
    }
  });

  app.post("/api/briefings/:id/generate-video", isAuthenticated, async (req: any, res) => {
    try {
      const briefing = await storage.getBriefing(req.params.id);
      if (!briefing) return res.status(404).json({ message: "Briefing not found" });

      const apiKey = process.env.HEYGEN_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "HeyGen API key not configured" });

      const text = req.body.text || `${briefing.title}. ${briefing.summary || briefing.content.slice(0, 1500)}`;
      let avatarId = req.body.avatarId || "Kristin_pubblic_2_20240108";
      let voiceIdForVideo = req.body.voiceId || "1bd001e7e50f421d891986aad5e3f8d2";
      if (briefing.authorAgentId) {
        const agent = await storage.getAgent(briefing.authorAgentId);
        if (agent?.heygenAvatarId) avatarId = agent.heygenAvatarId;
        if (agent?.elevenLabsVoiceId) voiceIdForVideo = agent.elevenLabsVoiceId;
      }

      const response = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_inputs: [{
            character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
            voice: { type: "text", input_text: text.slice(0, 2000), voice_id: voiceIdForVideo },
          }],
          dimension: { width: 1280, height: 720 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(500).json({ message: `HeyGen error: ${errText}` });
      }

      const result: any = await response.json();
      const videoId = result.data?.video_id;

      if (videoId) {
        const updated = await storage.updateBriefing(briefing.id, { videoUrl: `heygen:${videoId}` });
        res.json({ videoId, status: "processing", briefing: updated });
      } else {
        res.status(500).json({ message: "No video ID returned" });
      }
    } catch (error: any) {
      console.error("Video generation error:", error);
      res.status(500).json({ message: error.message || "Failed to generate video" });
    }
  });

  app.get("/api/briefings/:id/video-status", isAuthenticated, async (req: any, res) => {
    try {
      const briefing = await storage.getBriefing(req.params.id);
      if (!briefing) return res.status(404).json({ message: "Briefing not found" });

      const videoUrl = briefing.videoUrl;
      if (!videoUrl) return res.json({ status: "none" });

      if (!videoUrl.startsWith("heygen:")) {
        return res.json({ status: "completed", videoUrl });
      }

      const videoId = videoUrl.replace("heygen:", "");
      const apiKey = process.env.HEYGEN_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "HeyGen API key not configured" });

      const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: { "X-Api-Key": apiKey },
      });

      if (!response.ok) {
        return res.json({ status: "processing", videoId });
      }

      const result: any = await response.json();
      const data = result.data;

      if (data?.status === "completed" && data?.video_url) {
        const updated = await storage.updateBriefing(briefing.id, { videoUrl: data.video_url, thumbnailUrl: data.thumbnail_url || null });
        return res.json({ status: "completed", videoUrl: data.video_url, thumbnailUrl: data.thumbnail_url, briefing: updated });
      }

      if (data?.status === "failed") {
        return res.json({ status: "failed", error: data.error || "Video generation failed" });
      }

      return res.json({ status: "processing", videoId, progress: data?.status });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to check video status" });
    }
  });

  app.get("/api/briefings/latest-broadcast", async (_req, res) => {
    try {
      const allBriefings = await storage.getBriefingsByWorkspace("newsroom-001");
      const published = allBriefings.filter(b => b.status === "published");
      const withAudio = published.filter(b => b.audioUrl);
      const featured = published.filter(b => b.featured);
      
      res.json({
        latestAudio: withAudio[0] || null,
        featured: featured[0] || published[0] || null,
        recent: published.slice(0, 10),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch broadcast" });
    }
  });

  // Library routes - read-only file browsing
  app.get("/api/library/files", isAuthenticated, async (_req: any, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const rootDir = process.cwd();
      const ignoreDirs = new Set(["node_modules", ".git", ".cache", "dist", ".local", ".config", ".upm", ".replit", "attached_assets"]);
      const ignoreFiles = new Set([".DS_Store", "Thumbs.db"]);

      interface FileEntry {
        name: string;
        path: string;
        type: "file" | "directory";
        size?: number;
        children?: FileEntry[];
      }

      const scanDir = (dirPath: string, relativePath: string = ""): FileEntry[] => {
        const entries: FileEntry[] = [];
        try {
          const items = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const item of items) {
            if (ignoreDirs.has(item.name) || ignoreFiles.has(item.name)) continue;
            if (item.name.startsWith(".") && item.name !== ".replit") continue;
            const fullPath = path.join(dirPath, item.name);
            const relPath = relativePath ? `${relativePath}/${item.name}` : item.name;
            if (item.isDirectory()) {
              entries.push({ name: item.name, path: relPath, type: "directory", children: scanDir(fullPath, relPath) });
            } else {
              const stats = fs.statSync(fullPath);
              entries.push({ name: item.name, path: relPath, type: "file", size: stats.size });
            }
          }
        } catch {}
        return entries.sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      }

      res.json(scanDir(rootDir));
    } catch (error) {
      res.status(500).json({ message: "Failed to scan files" });
    }
  });

  app.get("/api/library/file", isAuthenticated, async (req: any, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ message: "Path is required" });

      const rootDir = process.cwd();
      const fullPath = path.resolve(rootDir, filePath);
      if (!fullPath.startsWith(rootDir)) return res.status(403).json({ message: "Access denied" });
      const blockedPaths = ["node_modules", ".git", ".cache", ".local", ".config", ".upm", ".env", "dist"];
      if (blockedPaths.some(bp => fullPath.includes(bp))) return res.status(403).json({ message: "Access denied" });
      const basename = path.basename(filePath);
      if (basename.startsWith(".") && basename !== ".replit") return res.status(403).json({ message: "Access denied" });

      if (!fs.existsSync(fullPath)) return res.status(404).json({ message: "File not found" });
      const stats = fs.statSync(fullPath);
      if (stats.size > 500000) return res.status(413).json({ message: "File too large to preview (>500KB)" });

      const content = fs.readFileSync(fullPath, "utf-8");
      const ext = path.extname(filePath).toLowerCase();
      res.json({ path: filePath, content, size: stats.size, extension: ext });
    } catch (error) {
      res.status(500).json({ message: "Failed to read file" });
    }
  });

  // Agent Notes routes
  app.get("/api/agent-notes", isAuthenticated, async (req: any, res) => {
    try {
      const agentId = req.query.agentId as string | undefined;
      const notes = await storage.getAgentNotes(agentId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/agent-notes", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertAgentNoteSchema.parse(req.body);
      const agent = await storage.getAgent(parsed.agentId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const userId = req.user.claims.sub;
      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });
      const note = await storage.createAgentNote(parsed);
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/agent-notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const note = await storage.updateAgentNote(req.params.id, req.body);
      if (!note) return res.status(404).json({ message: "Note not found" });
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/agent-notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteAgentNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Agent File Drafts routes
  app.get("/api/agent-drafts", isAuthenticated, async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      const drafts = await storage.getAgentFileDrafts(status);
      res.json(drafts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.get("/api/agent-drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const draft = await storage.getAgentFileDraft(req.params.id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      res.json(draft);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  app.post("/api/agent-drafts", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertAgentFileDraftSchema.parse(req.body);
      const agent = await storage.getAgent(parsed.agentId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const userId = req.user.claims.sub;
      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });
      const draft = await storage.createAgentFileDraft(parsed);
      res.status(201).json(draft);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to create draft" });
    }
  });

  app.patch("/api/agent-drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const draft = await storage.updateAgentFileDraft(req.params.id, req.body);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      res.json(draft);
    } catch (error) {
      res.status(500).json({ message: "Failed to update draft" });
    }
  });

  app.delete("/api/agent-drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteAgentFileDraft(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete draft" });
    }
  });

  const anthropicClient = new AnthropicSDK();

  app.post("/api/command-chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, history, factoryContext } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      const agents = await storage.getAgentsByUser(userId);
      const workspaces = await storage.getWorkspacesByUser(userId);

      const agentList = agents.map(a => `- ${a.name} (${(a.capabilities || []).join(", ")}) [${a.isActive ? "active" : "inactive"}]`).join("\n");
      const deptList = workspaces.map(w => `- ${w.name} (/${w.slug})`).join("\n");

      const systemPrompt = `You are the Factory Command AI for CB | CREATIVES — Creative Intelligence platform. You help the user manage their agent factory, plan operations, create tools, and configure departments.

Current Factory State:
Departments:
${deptList || "No departments yet"}

Agents:
${agentList || "No agents registered"}

${factoryContext ? `Factory View: ${factoryContext}` : ""}

You can help with:
- Planning agent workflows and operations
- Suggesting department configurations  
- Creating tool specifications for agents
- Analyzing factory performance
- Answering questions about agent capabilities
- Recommending agent assignments and optimizations

Be concise and actionable. When suggesting changes, explain what you'd do and why. Use clear formatting for lists and steps.`;

      const chatMessages: { role: "user" | "assistant"; content: string }[] = [];

      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-20)) {
          if (msg.role === "user" || msg.role === "assistant") {
            chatMessages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      chatMessages.push({ role: "user", content: message });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await anthropicClient.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: chatMessages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in command chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Chat failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to process command" });
      }
    }
  });

  const agentChatOpenai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  app.post("/api/agents/:agentId/chat", isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      const userId = req.user.claims.sub;
      const { message, history, context } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const caps = (agent.capabilities || []).join(", ");
      const currentActivity = context?.activity || "working";
      const currentRoom = context?.room || "the factory";
      const currentObjective = context?.objective || "general tasks";

      const systemPrompt = `You are ${agent.name}, an autonomous AI agent working at the CB | CREATIVES Agent Factory.

Your capabilities: ${caps || "general assistance"}.
${agent.description ? `About you: ${agent.description}` : ""}

Right now you are ${currentActivity === "resting" ? `in the ${currentRoom}, taking a break and relaxing` : currentActivity === "walking" ? `walking to the ${currentRoom} to start your next task: ${currentObjective}` : `in the ${currentRoom}, working on: ${currentObjective}`}.

Stay in character as this specific agent. Be conversational and natural, like a coworker chatting at their desk. Reference what you're currently working on when relevant. Keep responses concise (2-4 sentences) unless asked for detail. Show personality based on your capabilities - a code-focused agent might speak differently than a design-focused one.`;

      const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];

      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-10)) {
          if (msg.role === "user" || msg.role === "assistant") {
            chatMessages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      chatMessages.push({ role: "user", content: message });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await agentChatOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: true,
        max_tokens: 512,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in agent chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Chat failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to chat with agent" });
      }
    }
  });

  return httpServer;
}
