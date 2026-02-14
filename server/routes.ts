import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import type { AuthenticatedRequest } from "./replit_integrations/auth";
import { z } from "zod";
import {
  calculateSparkReward,
  calculatePathSwitch,
  calculateForgeAccess,
  analyzeStagnation,
  projectCycleEarnings,
  getAvailableTaskRooms,
  canCompleteTask,
  FORGE_COSTS,
  FORGE_BUILD_LIMITS,
} from "./game-engine";

function getUserId(req: AuthenticatedRequest): string {
  return req.user.claims.sub;
}

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? "";
}

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

  // --- Workspace routes ---

  app.get("/api/workspaces", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const workspaces = await storage.getWorkspacesByUser(userId);
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      res.status(500).json({ message: "Failed to fetch workspaces" });
    }
  });

  app.get("/api/workspaces/:slug", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

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

  app.post("/api/workspaces", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);

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

  // --- Workspace member routes ---

  app.get("/api/workspaces/:slug/members", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

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

  const addMemberSchema = z.object({
    userId: z.string().min(1),
    role: z.enum(["admin", "member", "viewer"]),
    entityType: z.enum(["human", "agent"]).optional().default("human"),
  });

  app.post("/api/workspaces/:slug/members", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const validation = addMemberSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const { userId: newUserId, role, entityType } = validation.data;

      const existingMembers = await storage.getWorkspaceMembers(access.workspaceId);
      if (existingMembers.some((m) => m.userId === newUserId)) {
        return res.status(400).json({ message: "User is already a member" });
      }

      const member = await storage.addWorkspaceMember({
        workspaceId: access.workspaceId,
        userId: newUserId,
        role,
        entityType,
      });

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "member_added",
        entityType: "workspace",
        entityId: access.workspaceId,
        metadata: JSON.stringify({ addedUserId: newUserId, role }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  const updateMemberRoleSchema = z.object({
    role: z.enum(["admin", "member", "viewer"]),
  });

  app.patch("/api/workspaces/:slug/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);
      const memberId = param(req.params.memberId);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const validation = updateMemberRoleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const updated = await storage.updateMemberRole(memberId, validation.data.role);
      if (!updated) {
        return res.status(404).json({ message: "Member not found" });
      }

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "member_role_changed",
        entityType: "workspace",
        entityId: access.workspaceId,
        metadata: JSON.stringify({ memberId, newRole: validation.data.role }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating member role:", error);
      res.status(500).json({ message: "Failed to update member role" });
    }
  });

  app.delete("/api/workspaces/:slug/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);
      const memberId = param(req.params.memberId);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const members = await storage.getWorkspaceMembers(access.workspaceId);
      const target = members.find((m) => m.id === memberId);
      if (!target) {
        return res.status(404).json({ message: "Member not found" });
      }
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot remove workspace owner" });
      }

      await storage.removeWorkspaceMember(memberId);

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "member_removed",
        entityType: "workspace",
        entityId: access.workspaceId,
        metadata: JSON.stringify({ removedUserId: target.userId }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // --- Agent routes ---

  app.get("/api/workspaces/:slug/agents", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

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

  app.get("/api/agents", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const agents = await storage.getAgentsByUser(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/recent", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
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
  });

  app.post("/api/agents", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);

      const validation = createAgentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten()
        });
      }

      const { name, description, workspaceId, capabilities, isActive } = validation.data;

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

  const updateAgentSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    capabilities: z.array(z.string()).optional(),
    permissions: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  });

  app.patch("/api/agents/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateAgentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const updated = await storage.updateAgent(id, validation.data);

      await storage.createAuditLog({
        workspaceId: agent.workspaceId,
        userId,
        action: "agent_updated",
        entityType: "agent",
        entityId: id,
        metadata: JSON.stringify({ name: updated?.name }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId, ["owner", "admin"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      await storage.deleteAgent(id);

      await storage.createAuditLog({
        workspaceId: agent.workspaceId,
        userId,
        action: "agent_deleted",
        entityType: "agent",
        entityId: id,
        metadata: JSON.stringify({ name: agent.name }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // --- Token routes ---

  app.get("/api/workspaces/:slug/tokens", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

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

  app.get("/api/tokens", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
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

  app.post("/api/tokens", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);

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

  app.delete("/api/tokens/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

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

  // --- Audit log routes ---

  app.get("/api/workspaces/:slug/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

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

  app.get("/api/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const logs = await storage.getAuditLogsByUser(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/recent", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const logs = await storage.getRecentAuditLogs(userId, 10);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching recent audit logs:", error);
      res.status(500).json({ message: "Failed to fetch recent audit logs" });
    }
  });

  app.get("/api/audit-logs/export", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const logs = await storage.getAuditLogsByUser(userId);

      const csvHeader = "ID,Timestamp,Action,Entity Type,Entity ID,User ID,IP Address,Metadata\n";
      const csvRows = logs.map((log) => {
        const timestamp = log.createdAt ? new Date(log.createdAt).toISOString() : "";
        const metadata = log.metadata ? `"${log.metadata.replace(/"/g, '""')}"` : "";
        return [
          log.id,
          timestamp,
          log.action,
          log.entityType ?? "",
          log.entityId ?? "",
          log.userId ?? "",
          log.ipAddress ?? "",
          metadata,
        ].join(",");
      });

      const csv = csvHeader + csvRows.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  });

  // --- Briefing routes ---

  app.get("/api/briefings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const briefings = await storage.getBriefingsByUser(userId);
      res.json(briefings);
    } catch (error) {
      console.error("Error fetching briefings:", error);
      res.status(500).json({ message: "Failed to fetch briefings" });
    }
  });

  app.get("/api/briefings/recent", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const briefings = await storage.getRecentBriefings(userId, 10);
      res.json(briefings);
    } catch (error) {
      console.error("Error fetching recent briefings:", error);
      res.status(500).json({ message: "Failed to fetch recent briefings" });
    }
  });

  app.get("/api/briefings/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

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

  app.post("/api/briefings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);

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

  app.patch("/api/briefings/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

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

  app.delete("/api/briefings/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

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

  app.get("/api/workspaces/:slug/briefings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

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

  // ===========================================
  // === NEXUS PROTOCOL: Game System Routes ===
  // ===========================================

  // Get or initialize game profile
  app.get("/api/game/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      let profile = await storage.getGameProfile(userId);

      if (!profile) {
        profile = await storage.createGameProfile({
          userId,
          sparkBalance: 0,
          totalSparkEarned: 0,
          totalSparkSpent: 0,
          currentPath: null,
          pathMomentum: 0,
          currentCycleNumber: 1,
          versatilityPoints: 0,
          stagnationLevel: 0,
          totalForgeEntries: 0,
          totalTasksCompleted: 0,
        });
      }

      const currentCycle = await storage.getCurrentGameCycle(userId);
      const rooms = getAvailableTaskRooms(profile);
      const projection = projectCycleEarnings(profile);
      const stagnation = analyzeStagnation(profile, currentCycle ? {
        archiveTasksCompleted: currentCycle.archiveTasksCompleted,
        agoraTasksCompleted: currentCycle.agoraTasksCompleted,
        totalTasksCompleted: currentCycle.tasksCompleted,
      } : null);

      res.json({
        profile,
        currentCycle,
        rooms,
        projection,
        stagnation,
        forgeCosts: FORGE_COSTS,
      });
    } catch (error) {
      console.error("Error fetching game profile:", error);
      res.status(500).json({ message: "Failed to fetch game profile" });
    }
  });

  // Choose or switch path
  const choosePathSchema = z.object({
    path: z.enum(["scholar", "diplomat", "generalist"]),
  });

  app.post("/api/game/choose-path", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const validation = choosePathSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid path", errors: validation.error.flatten() });
      }

      const { path } = validation.data;
      let profile = await storage.getGameProfile(userId);

      if (!profile) {
        profile = await storage.createGameProfile({
          userId,
          sparkBalance: 0,
          totalSparkEarned: 0,
          totalSparkSpent: 0,
          currentPath: null,
          pathMomentum: 0,
          currentCycleNumber: 1,
          versatilityPoints: 0,
          stagnationLevel: 0,
          totalForgeEntries: 0,
          totalTasksCompleted: 0,
        });
      }

      const switchResult = calculatePathSwitch(profile, path);

      // Apply switch
      const newMomentum = switchResult.momentumReset ? 0 : profile.pathMomentum + 1;

      const updated = await storage.updateGameProfile(userId, {
        currentPath: path,
        sparkBalance: switchResult.newBalance,
        totalSparkSpent: profile.totalSparkSpent + switchResult.sparkPenalty,
        pathMomentum: newMomentum,
        versatilityPoints: profile.versatilityPoints + switchResult.versatilityGained,
      });

      // Create or update cycle for this path
      let currentCycle = await storage.getCurrentGameCycle(userId);
      if (!currentCycle) {
        currentCycle = await storage.createGameCycle({
          userId,
          cycleNumber: profile.currentCycleNumber,
          pathChosen: path,
          tasksCompleted: 0,
          archiveTasksCompleted: 0,
          agoraTasksCompleted: 0,
          sparkEarned: 0,
          sparkSpent: switchResult.sparkPenalty,
          stagnationHits: 0,
        });
      }

      res.json({
        profile: updated,
        switchResult,
        currentCycle,
      });
    } catch (error) {
      console.error("Error choosing path:", error);
      res.status(500).json({ message: "Failed to choose path" });
    }
  });

  // Get available tasks
  app.get("/api/game/tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const room = req.query.room as string | undefined;

      const profile = await storage.getGameProfile(userId);
      const tasks = await storage.getGameTasks(room);

      // Annotate each task with availability and projected reward
      const currentCycle = await storage.getCurrentGameCycle(userId);
      const cycleStats = currentCycle ? {
        archiveTasksCompleted: currentCycle.archiveTasksCompleted,
        agoraTasksCompleted: currentCycle.agoraTasksCompleted,
        totalTasksCompleted: currentCycle.tasksCompleted,
      } : { archiveTasksCompleted: 0, agoraTasksCompleted: 0, totalTasksCompleted: 0 };

      const annotated = tasks.map((task) => {
        const availability = profile ? canCompleteTask(task, profile) : { allowed: false, reason: "No profile" };
        const sparkCalc = profile ? calculateSparkReward(task, profile, cycleStats) : null;

        return {
          ...task,
          availability,
          sparkProjection: sparkCalc,
        };
      });

      res.json(annotated);
    } catch (error) {
      console.error("Error fetching game tasks:", error);
      res.status(500).json({ message: "Failed to fetch game tasks" });
    }
  });

  // Complete a task
  const completeTaskSchema = z.object({
    taskId: z.string().min(1),
  });

  app.post("/api/game/complete-task", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const validation = completeTaskSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid task", errors: validation.error.flatten() });
      }

      const { taskId } = validation.data;
      const profile = await storage.getGameProfile(userId);
      if (!profile) {
        return res.status(400).json({ message: "No game profile. Choose a path first." });
      }

      const task = await storage.getGameTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const availability = canCompleteTask(task, profile);
      if (!availability.allowed) {
        return res.status(403).json({ message: availability.reason });
      }

      // Get current cycle
      let currentCycle = await storage.getCurrentGameCycle(userId);
      if (!currentCycle) {
        return res.status(400).json({ message: "No active cycle. Choose a path first." });
      }

      const cycleStats = {
        archiveTasksCompleted: currentCycle.archiveTasksCompleted,
        agoraTasksCompleted: currentCycle.agoraTasksCompleted,
        totalTasksCompleted: currentCycle.tasksCompleted,
      };

      // Calculate reward
      const sparkCalc = calculateSparkReward(task, profile, cycleStats);

      // Record completion
      const completion = await storage.createTaskCompletion({
        userId,
        taskId,
        cycleNumber: profile.currentCycleNumber,
        sparkEarned: sparkCalc.finalReward,
        pathAtCompletion: profile.currentPath,
        momentumMultiplier: 1 + sparkCalc.momentumBonus,
        stagnationPenalty: sparkCalc.stagnationPenalty,
      });

      // Update profile
      await storage.updateGameProfile(userId, {
        sparkBalance: profile.sparkBalance + sparkCalc.finalReward,
        totalSparkEarned: profile.totalSparkEarned + sparkCalc.finalReward,
        totalTasksCompleted: profile.totalTasksCompleted + 1,
        stagnationLevel: sparkCalc.stagnationPenalty,
      });

      // Update cycle
      const cycleUpdates: any = {
        tasksCompleted: currentCycle.tasksCompleted + 1,
        sparkEarned: currentCycle.sparkEarned + sparkCalc.finalReward,
      };
      if (task.room === "archive") {
        cycleUpdates.archiveTasksCompleted = currentCycle.archiveTasksCompleted + 1;
      } else if (task.room === "agora") {
        cycleUpdates.agoraTasksCompleted = currentCycle.agoraTasksCompleted + 1;
      }
      if (sparkCalc.wasStagnated) {
        cycleUpdates.stagnationHits = currentCycle.stagnationHits + 1;
      }

      await storage.updateGameCycle(currentCycle.id, cycleUpdates);

      const updatedProfile = await storage.getGameProfile(userId);
      const updatedCycle = await storage.getCurrentGameCycle(userId);

      res.json({
        completion,
        sparkCalculation: sparkCalc,
        profile: updatedProfile,
        currentCycle: updatedCycle,
      });
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Enter the Forge
  const enterForgeSchema = z.object({
    tier: z.enum(["basic", "extended", "master"]),
  });

  app.post("/api/game/enter-forge", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const validation = enterForgeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid tier", errors: validation.error.flatten() });
      }

      const { tier } = validation.data;
      const profile = await storage.getGameProfile(userId);
      if (!profile) {
        return res.status(400).json({ message: "No game profile." });
      }

      const accessCalc = calculateForgeAccess(profile, tier);
      if (!accessCalc.canAccess) {
        return res.status(403).json({
          message: `Not enough Spark. You need ${accessCalc.cost} but have ${profile.sparkBalance}. Short by ${accessCalc.shortfall}.`,
          accessCalc,
        });
      }

      // Deduct Spark
      await storage.updateGameProfile(userId, {
        sparkBalance: profile.sparkBalance - accessCalc.cost,
        totalSparkSpent: profile.totalSparkSpent + accessCalc.cost,
        totalForgeEntries: profile.totalForgeEntries + 1,
      });

      // Create forge session
      const forgeSession = await storage.createForgeAccess({
        userId,
        cycleNumber: profile.currentCycleNumber,
        sessionTier: tier,
        sparkCost: accessCalc.cost,
        buildsUsed: 0,
        buildsAllowed: accessCalc.buildsAllowed,
      });

      // Update cycle
      const currentCycle = await storage.getCurrentGameCycle(userId);
      if (currentCycle) {
        await storage.updateGameCycle(currentCycle.id, {
          sparkSpent: currentCycle.sparkSpent + accessCalc.cost,
        });
      }

      const updatedProfile = await storage.getGameProfile(userId);

      res.json({
        forgeSession,
        profile: updatedProfile,
        accessCalc,
      });
    } catch (error) {
      console.error("Error entering forge:", error);
      res.status(500).json({ message: "Failed to enter forge" });
    }
  });

  // Use a build in the Forge
  app.post("/api/game/forge-build", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const activeSession = await storage.getActiveForgeAccess(userId);

      if (!activeSession) {
        return res.status(403).json({ message: "No active Forge session. Enter the Forge first." });
      }

      if (activeSession.buildsUsed >= activeSession.buildsAllowed) {
        return res.status(403).json({
          message: `Build limit reached for this ${activeSession.sessionTier} session (${activeSession.buildsUsed}/${activeSession.buildsAllowed}).`,
        });
      }

      const updated = await storage.updateForgeAccess(activeSession.id, {
        buildsUsed: activeSession.buildsUsed + 1,
      });

      res.json({
        forgeSession: updated,
        buildsRemaining: activeSession.buildsAllowed - activeSession.buildsUsed - 1,
      });
    } catch (error) {
      console.error("Error using forge build:", error);
      res.status(500).json({ message: "Failed to use forge build" });
    }
  });

  // Advance to next cycle
  app.post("/api/game/advance-cycle", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const profile = await storage.getGameProfile(userId);
      if (!profile) {
        return res.status(400).json({ message: "No game profile." });
      }

      // Close current cycle
      const currentCycle = await storage.getCurrentGameCycle(userId);
      if (currentCycle) {
        await storage.updateGameCycle(currentCycle.id, {
          endedAt: new Date(),
        } as any);
      }

      const newCycleNumber = profile.currentCycleNumber + 1;

      // Increment momentum if staying on same path
      const newMomentum = profile.currentPath ? profile.pathMomentum + 1 : 0;

      await storage.updateGameProfile(userId, {
        currentCycleNumber: newCycleNumber,
        pathMomentum: newMomentum,
        stagnationLevel: 0, // reset stagnation for new cycle
      });

      // Auto-create the new cycle with the same path
      let newCycle = null;
      if (profile.currentPath) {
        newCycle = await storage.createGameCycle({
          userId,
          cycleNumber: newCycleNumber,
          pathChosen: profile.currentPath,
          tasksCompleted: 0,
          archiveTasksCompleted: 0,
          agoraTasksCompleted: 0,
          sparkEarned: 0,
          sparkSpent: 0,
          stagnationHits: 0,
        });
      }

      const updatedProfile = await storage.getGameProfile(userId);

      res.json({
        profile: updatedProfile,
        newCycle,
        previousCycle: currentCycle,
      });
    } catch (error) {
      console.error("Error advancing cycle:", error);
      res.status(500).json({ message: "Failed to advance cycle" });
    }
  });

  // Get stagnation analysis
  app.get("/api/game/stagnation", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const profile = await storage.getGameProfile(userId);
      if (!profile) {
        return res.status(400).json({ message: "No game profile." });
      }

      const currentCycle = await storage.getCurrentGameCycle(userId);
      const stagnation = analyzeStagnation(profile, currentCycle ? {
        archiveTasksCompleted: currentCycle.archiveTasksCompleted,
        agoraTasksCompleted: currentCycle.agoraTasksCompleted,
        totalTasksCompleted: currentCycle.tasksCompleted,
      } : null);

      const cycleHistory = await storage.getGameCycleHistory(userId, 10);

      res.json({
        stagnation,
        cycleHistory,
        profile,
      });
    } catch (error) {
      console.error("Error fetching stagnation:", error);
      res.status(500).json({ message: "Failed to fetch stagnation analysis" });
    }
  });

  // Get cycle history with completions
  app.get("/api/game/history", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const cycles = await storage.getGameCycleHistory(userId, 20);
      const forgeHistory = await storage.getForgeAccessHistory(userId, 20);

      res.json({ cycles, forgeHistory });
    } catch (error) {
      console.error("Error fetching game history:", error);
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  // Get forge status
  app.get("/api/game/forge", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const profile = await storage.getGameProfile(userId);
      if (!profile) {
        return res.status(400).json({ message: "No game profile." });
      }

      const activeSession = await storage.getActiveForgeAccess(userId);
      const history = await storage.getForgeAccessHistory(userId, 10);

      const tiers = (["basic", "extended", "master"] as const).map((t) => ({
        ...calculateForgeAccess(profile, t),
      }));

      res.json({
        activeSession,
        history,
        tiers,
        profile,
      });
    } catch (error) {
      console.error("Error fetching forge status:", error);
      res.status(500).json({ message: "Failed to fetch forge status" });
    }
  });

  return httpServer;
}
