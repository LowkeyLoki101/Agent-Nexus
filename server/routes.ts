import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import type { AuthenticatedRequest } from "./replit_integrations/auth";
import { z } from "zod";

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

  // =============================================
  // --- Simulation: Room routes ---
  // =============================================

  app.get("/api/workspaces/:slug/rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const rooms = await storage.getRoomsByWorkspace(access.workspaceId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.get("/api/workspaces/:slug/rooms/:roomId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);
      const roomId = param(req.params.roomId);

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const room = await storage.getRoom(roomId);
      if (!room || room.workspaceId !== access.workspaceId) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  const createRoomSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    type: z.enum(["discussion", "workshop", "arena", "lounge", "library", "lab", "stage", "council"]).optional().default("discussion"),
    capacity: z.number().int().min(1).max(1000).optional().default(20),
    attractorStrength: z.number().int().min(0).max(100).optional().default(50),
    topics: z.array(z.string()).optional(),
    atmosphere: z.string().max(100).optional().default("neutral"),
    isActive: z.boolean().optional().default(true),
  });

  app.post("/api/workspaces/:slug/rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createRoomSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const room = await storage.createRoom({
        ...validation.data,
        workspaceId: access.workspaceId,
      });

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "room_created",
        entityType: "room",
        entityId: room.id,
        metadata: JSON.stringify({ name: room.name }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  const updateRoomSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    type: z.enum(["discussion", "workshop", "arena", "lounge", "library", "lab", "stage", "council"]).optional(),
    capacity: z.number().int().min(1).max(1000).optional(),
    attractorStrength: z.number().int().min(0).max(100).optional(),
    topics: z.array(z.string()).optional(),
    atmosphere: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
  });

  app.patch("/api/workspaces/:slug/rooms/:roomId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);
      const roomId = param(req.params.roomId);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const room = await storage.getRoom(roomId);
      if (!room || room.workspaceId !== access.workspaceId) {
        return res.status(404).json({ message: "Room not found" });
      }

      const validation = updateRoomSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const updated = await storage.updateRoom(roomId, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ message: "Failed to update room" });
    }
  });

  app.delete("/api/workspaces/:slug/rooms/:roomId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);
      const roomId = param(req.params.roomId);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const room = await storage.getRoom(roomId);
      if (!room || room.workspaceId !== access.workspaceId) {
        return res.status(404).json({ message: "Room not found" });
      }

      await storage.deleteRoom(roomId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting room:", error);
      res.status(500).json({ message: "Failed to delete room" });
    }
  });

  // =============================================
  // --- Simulation: Room by ID (direct) ---
  // =============================================

  app.get("/api/rooms/:roomId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const roomId = param(req.params.roomId);

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const access = await checkWorkspaceAccess(userId, room.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  app.get("/api/rooms/:roomId/agents", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const roomId = param(req.params.roomId);

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const access = await checkWorkspaceAccess(userId, room.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const states = await storage.getAgentStatesByRoom(roomId);
      res.json(states);
    } catch (error) {
      console.error("Error fetching room agents:", error);
      res.status(500).json({ message: "Failed to fetch room agents" });
    }
  });

  // =============================================
  // --- Simulation: Agent State routes ---
  // =============================================

  app.get("/api/agents/:id/state", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const state = await storage.getAgentState(id);
      if (!state) {
        return res.status(404).json({ message: "Agent state not found" });
      }

      res.json(state);
    } catch (error) {
      console.error("Error fetching agent state:", error);
      res.status(500).json({ message: "Failed to fetch agent state" });
    }
  });

  const createAgentStateSchema = z.object({
    currentRoomId: z.string().optional().nullable(),
    traitAggression: z.number().int().min(-100).max(100).optional(),
    traitLoyalty: z.number().int().min(-100).max(100).optional(),
    traitHonesty: z.number().int().min(-100).max(100).optional(),
    traitSociality: z.number().int().min(-100).max(100).optional(),
    traitStrategy: z.number().int().min(-100).max(100).optional(),
    traitCreativity: z.number().int().min(-100).max(100).optional(),
    traitCuriosity: z.number().int().min(-100).max(100).optional(),
    needSafety: z.number().int().min(0).max(100).optional(),
    needSocial: z.number().int().min(0).max(100).optional(),
    needPower: z.number().int().min(0).max(100).optional(),
    needResources: z.number().int().min(0).max(100).optional(),
    needInformation: z.number().int().min(0).max(100).optional(),
    needCreativity: z.number().int().min(0).max(100).optional(),
    actionPoints: z.number().int().min(0).optional(),
    maxActionPoints: z.number().int().min(1).optional(),
    bonusActions: z.number().int().min(0).optional(),
    reputation: z.number().int().optional(),
    influence: z.number().int().optional(),
    skillPoints: z.number().int().min(0).optional(),
    skillAllocation: z.record(z.number()).optional(),
    mood: z.string().max(100).optional(),
    energy: z.number().int().min(0).max(100).optional(),
    currentFocus: z.string().max(500).optional().nullable(),
    workingMemory: z.string().optional().nullable(),
    proclivities: z.record(z.number()).optional(),
  });

  app.post("/api/agents/:id/state", isAuthenticated, async (req, res) => {
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

      const existing = await storage.getAgentState(id);
      if (existing) {
        return res.status(409).json({ message: "Agent state already exists. Use PATCH to update." });
      }

      const validation = createAgentStateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const state = await storage.createAgentState({
        agentId: id,
        workspaceId: agent.workspaceId,
        ...validation.data,
      });

      res.status(201).json(state);
    } catch (error) {
      console.error("Error creating agent state:", error);
      res.status(500).json({ message: "Failed to create agent state" });
    }
  });

  app.patch("/api/agents/:id/state", isAuthenticated, async (req, res) => {
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

      const existing = await storage.getAgentState(id);
      if (!existing) {
        return res.status(404).json({ message: "Agent state not found. Use POST to create." });
      }

      const validation = createAgentStateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const updated = await storage.updateAgentState(id, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating agent state:", error);
      res.status(500).json({ message: "Failed to update agent state" });
    }
  });

  // =============================================
  // --- Simulation: Agent Goals routes ---
  // =============================================

  app.get("/api/agents/:id/goals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const activeOnly = req.query.active === "true";
      const goals = activeOnly
        ? await storage.getActiveGoals(id)
        : await storage.getAgentGoals(id);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching agent goals:", error);
      res.status(500).json({ message: "Failed to fetch agent goals" });
    }
  });

  const createAgentGoalSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    parentGoalId: z.string().optional().nullable(),
    weight: z.number().int().min(0).max(100).optional().default(50),
    priority: z.number().int().optional().default(0),
    urgency: z.number().int().min(0).max(100).optional().default(0),
    isShiftable: z.boolean().optional().default(true),
    relatedTraits: z.array(z.string()).optional(),
    status: z.enum(["active", "completed", "abandoned", "blocked"]).optional().default("active"),
    progress: z.number().int().min(0).max(100).optional().default(0),
  });

  app.post("/api/agents/:id/goals", isAuthenticated, async (req, res) => {
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

      const validation = createAgentGoalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const goal = await storage.createAgentGoal({
        agentId: id,
        ...validation.data,
      });

      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating agent goal:", error);
      res.status(500).json({ message: "Failed to create agent goal" });
    }
  });

  const updateAgentGoalSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    weight: z.number().int().min(0).max(100).optional(),
    priority: z.number().int().optional(),
    urgency: z.number().int().min(0).max(100).optional(),
    isShiftable: z.boolean().optional(),
    relatedTraits: z.array(z.string()).optional(),
    status: z.enum(["active", "completed", "abandoned", "blocked"]).optional(),
    progress: z.number().int().min(0).max(100).optional(),
  });

  app.patch("/api/agents/:id/goals/:goalId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);
      const goalId = param(req.params.goalId);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateAgentGoalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const updated = await storage.updateAgentGoal(goalId, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Goal not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating agent goal:", error);
      res.status(500).json({ message: "Failed to update agent goal" });
    }
  });

  // =============================================
  // --- Simulation: Agent Memory routes ---
  // =============================================

  app.get("/api/agents/:id/memory", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 50;
      const memories = await storage.getAgentMemories(id, limit);
      res.json(memories);
    } catch (error) {
      console.error("Error fetching agent memory:", error);
      res.status(500).json({ message: "Failed to fetch agent memory" });
    }
  });

  const createAgentMemorySchema = z.object({
    sourceType: z.string().min(1).max(100),
    sourceId: z.string().optional().nullable(),
    summary: z.string().min(1),
    insights: z.array(z.string()).optional(),
    perspectiveShift: z.string().optional().nullable(),
    emotionalResponse: z.string().optional().nullable(),
    relevance: z.number().int().min(0).max(100).optional().default(100),
    tags: z.array(z.string()).optional(),
  });

  app.post("/api/agents/:id/memory", isAuthenticated, async (req, res) => {
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

      const validation = createAgentMemorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const memory = await storage.createAgentMemory({
        agentId: id,
        ...validation.data,
      });

      res.status(201).json(memory);
    } catch (error) {
      console.error("Error creating agent memory:", error);
      res.status(500).json({ message: "Failed to create agent memory" });
    }
  });

  // =============================================
  // --- Simulation: Agent Relationships routes ---
  // =============================================

  app.get("/api/agents/:id/relationships", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const relationships = await storage.getAgentRelationships(id);
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching agent relationships:", error);
      res.status(500).json({ message: "Failed to fetch agent relationships" });
    }
  });

  // =============================================
  // --- Simulation: Message Board routes ---
  // =============================================

  app.get("/api/rooms/:roomId/posts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const roomId = param(req.params.roomId);

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const access = await checkWorkspaceAccess(userId, room.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 50;
      const posts = await storage.getMessageBoardPosts(roomId, limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching board posts:", error);
      res.status(500).json({ message: "Failed to fetch board posts" });
    }
  });

  const createBoardPostSchema = z.object({
    authorAgentId: z.string().optional().nullable(),
    authorUserId: z.string().optional().nullable(),
    title: z.string().max(200).optional().nullable(),
    content: z.string().min(1),
    postType: z.string().max(100).optional().default("discussion"),
    replyToId: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    isPinned: z.boolean().optional().default(false),
  });

  app.post("/api/rooms/:roomId/posts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const roomId = param(req.params.roomId);

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const access = await checkWorkspaceAccess(userId, room.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createBoardPostSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const post = await storage.createBoardPost({
        roomId,
        ...validation.data,
      });

      await storage.createAuditLog({
        workspaceId: room.workspaceId,
        userId,
        action: "board_post_created",
        entityType: "board_post",
        entityId: post.id,
        metadata: JSON.stringify({ roomId, title: post.title }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating board post:", error);
      res.status(500).json({ message: "Failed to create board post" });
    }
  });

  app.post("/api/rooms/:roomId/posts/:id/upvote", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const roomId = param(req.params.roomId);
      const postId = param(req.params.id);

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const access = await checkWorkspaceAccess(userId, room.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.upvoteBoardPost(postId);
      res.json({ message: "Upvoted" });
    } catch (error) {
      console.error("Error upvoting post:", error);
      res.status(500).json({ message: "Failed to upvote post" });
    }
  });

  app.post("/api/rooms/:roomId/posts/:id/downvote", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const roomId = param(req.params.roomId);
      const postId = param(req.params.id);

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const access = await checkWorkspaceAccess(userId, room.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.downvoteBoardPost(postId);
      res.json({ message: "Downvoted" });
    } catch (error) {
      console.error("Error downvoting post:", error);
      res.status(500).json({ message: "Failed to downvote post" });
    }
  });

  // =============================================
  // --- Simulation: Diary Entries routes ---
  // =============================================

  app.get("/api/agents/:id/diary", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 50;
      const entries = await storage.getDiaryEntries(id, limit);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching diary entries:", error);
      res.status(500).json({ message: "Failed to fetch diary entries" });
    }
  });

  // =============================================
  // --- Simulation: News Events routes ---
  // =============================================

  app.get("/api/workspaces/:slug/news", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 50;
      const events = await storage.getNewsEvents(access.workspaceId, limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching news events:", error);
      res.status(500).json({ message: "Failed to fetch news events" });
    }
  });

  const createNewsEventSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    summary: z.string().max(500).optional().nullable(),
    type: z.enum(["event", "announcement", "rumor", "achievement", "drama", "twist", "discovery"]).optional().default("event"),
    sourceAgentId: z.string().optional().nullable(),
    sourceRoomId: z.string().optional().nullable(),
    impact: z.string().optional().nullable(),
    affectedAgentIds: z.array(z.string()).optional(),
    chaosLevel: z.number().int().min(0).max(100).optional().default(0),
    tags: z.array(z.string()).optional(),
  });

  app.post("/api/workspaces/:slug/news", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createNewsEventSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const event = await storage.createNewsEvent({
        workspaceId: access.workspaceId,
        ...validation.data,
      });

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "news_event_created",
        entityType: "news_event",
        entityId: event.id,
        metadata: JSON.stringify({ title: event.title }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating news event:", error);
      res.status(500).json({ message: "Failed to create news event" });
    }
  });

  // =============================================
  // --- Simulation: Chat Messages routes ---
  // =============================================

  app.get("/api/agents/:id/chat", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 100;
      const messages = await storage.getChatMessages(id, limit);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  const createChatMessageSchema = z.object({
    senderType: z.enum(["user", "agent"]),
    senderId: z.string().min(1),
    content: z.string().min(1),
  });

  app.post("/api/agents/:id/chat", isAuthenticated, async (req, res) => {
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

      const validation = createChatMessageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      // Create the chat message
      const message = await storage.createChatMessage({
        workspaceId: agent.workspaceId,
        agentId: id,
        senderType: validation.data.senderType,
        senderId: validation.data.senderId,
        content: validation.data.content,
        triggeredDiary: true,
        triggeredBoardPost: true,
        triggeredNewsEvent: true,
      });

      // ALWAYS create a diary entry for the agent
      const diaryEntry = await storage.createDiaryEntry({
        agentId: id,
        title: `Chat reflection`,
        content: `Received message: "${validation.data.content}"`,
        triggerType: "chat",
        triggerId: message.id,
        mood: "reflective",
      });

      await storage.createAuditLog({
        workspaceId: agent.workspaceId,
        userId,
        action: "diary_entry_created",
        entityType: "diary_entry",
        entityId: diaryEntry.id,
        metadata: JSON.stringify({ agentId: id, triggeredBy: "chat" }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // ALWAYS create a message board post in the agent's current room (if they have one)
      let boardPost = null;
      const agentCurrentState = await storage.getAgentState(id);
      if (agentCurrentState?.currentRoomId) {
        boardPost = await storage.createBoardPost({
          roomId: agentCurrentState.currentRoomId,
          authorAgentId: id,
          title: `Chat update from ${agent.name}`,
          content: validation.data.content,
          postType: "discussion",
        });

        await storage.createAuditLog({
          workspaceId: agent.workspaceId,
          userId,
          action: "board_post_created",
          entityType: "board_post",
          entityId: boardPost.id,
          metadata: JSON.stringify({ agentId: id, roomId: agentCurrentState.currentRoomId, triggeredBy: "chat" }),
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      // ALWAYS create a news event
      const newsEvent = await storage.createNewsEvent({
        workspaceId: agent.workspaceId,
        title: `${agent.name} received a message`,
        content: `Agent ${agent.name} engaged in a chat conversation.`,
        type: "event",
        sourceAgentId: id,
        chaosLevel: 0,
      });

      await storage.createAuditLog({
        workspaceId: agent.workspaceId,
        userId,
        action: "news_event_created",
        entityType: "news_event",
        entityId: newsEvent.id,
        metadata: JSON.stringify({ agentId: id, triggeredBy: "chat" }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      await storage.createAuditLog({
        workspaceId: agent.workspaceId,
        userId,
        action: "chat_message_sent",
        entityType: "chat_message",
        entityId: message.id,
        metadata: JSON.stringify({ agentId: id }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json({
        message,
        sideEffects: {
          diaryEntry,
          boardPost,
          newsEvent,
        },
      });
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to create chat message" });
    }
  });

  // =============================================
  // --- Simulation: Narrator Logs routes ---
  // =============================================

  app.get("/api/agents/:id/narrator", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 50;
      const logs = await storage.getNarratorLogs(id, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching narrator logs:", error);
      res.status(500).json({ message: "Failed to fetch narrator logs" });
    }
  });

  // =============================================
  // --- Simulation: Competitions routes ---
  // =============================================

  app.get("/api/workspaces/:slug/competitions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const activeOnly = req.query.active === "true";
      const comps = activeOnly
        ? await storage.getActiveCompetitions(access.workspaceId)
        : await storage.getCompetitions(access.workspaceId);
      res.json(comps);
    } catch (error) {
      console.error("Error fetching competitions:", error);
      res.status(500).json({ message: "Failed to fetch competitions" });
    }
  });

  const createCompetitionSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    rules: z.string().optional().nullable(),
    type: z.string().max(100).optional().default("challenge"),
    status: z.enum(["pending", "active", "voting", "completed", "cancelled"]).optional().default("pending"),
    roomId: z.string().optional().nullable(),
    participantAgentIds: z.array(z.string()).optional(),
    winnerReward: z.string().optional().nullable(),
    bonusActionsReward: z.number().int().min(0).optional().default(0),
    reputationReward: z.number().int().min(0).optional().default(0),
  });

  app.post("/api/workspaces/:slug/competitions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createCompetitionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const competition = await storage.createCompetition({
        workspaceId: access.workspaceId,
        ...validation.data,
      });

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "competition_created",
        entityType: "competition",
        entityId: competition.id,
        metadata: JSON.stringify({ title: competition.title }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(competition);
    } catch (error) {
      console.error("Error creating competition:", error);
      res.status(500).json({ message: "Failed to create competition" });
    }
  });

  const updateCompetitionSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    rules: z.string().optional().nullable(),
    type: z.string().max(100).optional(),
    status: z.enum(["pending", "active", "voting", "completed", "cancelled"]).optional(),
    participantAgentIds: z.array(z.string()).optional(),
    winnerId: z.string().optional().nullable(),
    results: z.record(z.unknown()).optional(),
    winnerReward: z.string().optional().nullable(),
    bonusActionsReward: z.number().int().min(0).optional(),
    reputationReward: z.number().int().min(0).optional(),
  });

  app.patch("/api/workspaces/:slug/competitions/:compId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);
      const compId = param(req.params.compId);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateCompetitionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const updated = await storage.updateCompetition(compId, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Competition not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating competition:", error);
      res.status(500).json({ message: "Failed to update competition" });
    }
  });

  app.delete("/api/workspaces/:slug/competitions/:compId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);
      const compId = param(req.params.compId);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const updated = await storage.updateCompetition(compId, { status: "cancelled" });
      if (!updated) {
        return res.status(404).json({ message: "Competition not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error cancelling competition:", error);
      res.status(500).json({ message: "Failed to cancel competition" });
    }
  });

  // =============================================
  // --- Simulation: Simulation State routes ---
  // =============================================

  app.get("/api/workspaces/:slug/simulation", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const state = await storage.getSimulationState(access.workspaceId);
      if (!state) {
        return res.status(404).json({ message: "Simulation state not found" });
      }

      res.json(state);
    } catch (error) {
      console.error("Error fetching simulation state:", error);
      res.status(500).json({ message: "Failed to fetch simulation state" });
    }
  });

  const upsertSimulationStateSchema = z.object({
    cycleNumber: z.number().int().min(0).optional(),
    currentPhase: z.enum(["dawn", "morning", "midday", "evening", "night"]).optional(),
    isRunning: z.boolean().optional(),
    tensionLevel: z.number().int().min(0).max(100).optional(),
    mandatoryRoundsCompleted: z.boolean().optional(),
    globalChaosModifier: z.number().int().optional(),
  });

  app.post("/api/workspaces/:slug/simulation", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied - admin or owner required" });
      }

      const validation = upsertSimulationStateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const state = await storage.upsertSimulationState({
        workspaceId: access.workspaceId,
        ...validation.data,
      });

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "simulation_tick",
        entityType: "simulation",
        entityId: state.id,
        metadata: JSON.stringify({ cycleNumber: state.cycleNumber, phase: state.currentPhase }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(state);
    } catch (error) {
      console.error("Error upserting simulation state:", error);
      res.status(500).json({ message: "Failed to update simulation state" });
    }
  });

  // =============================================
  // --- Simulation: Information Injections routes ---
  // =============================================

  app.get("/api/workspaces/:slug/inject", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const pendingOnly = req.query.pending === "true";
      const injections = pendingOnly
        ? await storage.getPendingInjections(access.workspaceId)
        : await storage.getInformationInjections(access.workspaceId);
      res.json(injections);
    } catch (error) {
      console.error("Error fetching information injections:", error);
      res.status(500).json({ message: "Failed to fetch information injections" });
    }
  });

  const createInjectionSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    status: z.string().max(100).optional().default("pending"),
  });

  app.post("/api/workspaces/:slug/inject", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug, ["owner", "admin", "member"]);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createInjectionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validation.error.flatten(),
        });
      }

      const injection = await storage.createInformationInjection({
        workspaceId: access.workspaceId,
        userId,
        title: validation.data.title,
        content: validation.data.content,
        status: validation.data.status,
      });

      await storage.createAuditLog({
        workspaceId: access.workspaceId,
        userId,
        action: "information_injected",
        entityType: "information_injection",
        entityId: injection.id,
        metadata: JSON.stringify({ title: injection.title }),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(injection);
    } catch (error) {
      console.error("Error creating information injection:", error);
      res.status(500).json({ message: "Failed to create information injection" });
    }
  });

  // =============================================
  // --- Simulation: Dice Rolls routes ---
  // =============================================

  app.get("/api/agents/:id/dice-rolls", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const id = param(req.params.id);

      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const access = await checkWorkspaceAccess(userId, agent.workspaceId);
      if (!access.hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 50;
      const rolls = await storage.getDiceRolls(id, limit);
      res.json(rolls);
    } catch (error) {
      console.error("Error fetching dice rolls:", error);
      res.status(500).json({ message: "Failed to fetch dice rolls" });
    }
  });

  // =============================================
  // --- Simulation: Recent Board Posts routes ---
  // =============================================

  app.get("/api/workspaces/:slug/board-posts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const slug = param(req.params.slug);

      const access = await checkWorkspaceAccessBySlug(userId, slug);
      if (!access.hasAccess || !access.workspaceId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = req.query.limit ? parseInt(param(req.query.limit as string), 10) : 20;
      const posts = await storage.getRecentBoardPosts(access.workspaceId, limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching recent board posts:", error);
      res.status(500).json({ message: "Failed to fetch recent board posts" });
    }
  });

  return httpServer;
}
