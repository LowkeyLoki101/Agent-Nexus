import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import type { AuthenticatedRequest } from "./replit_integrations/auth";
import { z } from "zod";
import { getUncachableStripeClient } from "./stripeClient";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

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

  // --- User profile route ---

  app.get("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const result = await db.execute(
        sql`SELECT id, email, first_name, last_name, profile_image_url, is_admin, subscription_status, stripe_customer_id, stripe_subscription_id, coupon_code FROM users WHERE id = ${userId}`
      );
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = result.rows[0] as any;
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImageUrl: user.profile_image_url,
        isAdmin: user.is_admin,
        subscriptionStatus: user.subscription_status,
        stripeCustomerId: user.stripe_customer_id,
        stripeSubscriptionId: user.stripe_subscription_id,
        couponCode: user.coupon_code,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // --- Stripe subscription routes ---

  app.get("/api/stripe/subscription-price", async (_req, res) => {
    try {
      res.json({
        price_id: "price_1T5AdQPo0Kn2QjEryJ9rKr8b",
        amount: 4900,
        currency: "usd",
        interval: "month",
        display: "$49/month",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price" });
    }
  });

  app.post("/api/stripe/create-checkout", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const { priceId, couponCode } = req.body;

      const ALLOWED_PRICE_IDS = ["price_1T5AdQPo0Kn2QjEryJ9rKr8b"];
      if (!priceId || !ALLOWED_PRICE_IDS.includes(priceId)) {
        return res.status(400).json({ message: "Invalid price ID" });
      }

      const stripe = await getUncachableStripeClient();

      const userResult = await db.execute(
        sql`SELECT email, stripe_customer_id FROM users WHERE id = ${userId}`
      );
      if (!userResult.rows || userResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = userResult.rows[0] as any;

      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        customerId = customer.id;
        await db.execute(
          sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId}`
        );
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN}`;

      const sessionParams: any = {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/subscribe?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/subscribe`,
        allow_promotion_codes: true,
      };

      if (couponCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({
            code: couponCode,
            active: true,
            limit: 1,
          });
          if (promoCodes.data.length > 0) {
            delete sessionParams.allow_promotion_codes;
            sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];

            await db.execute(
              sql`UPDATE users SET coupon_code = ${couponCode} WHERE id = ${userId}`
            );
          }
        } catch (promoErr) {
          console.error("Error looking up promo code:", promoErr);
        }
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout" });
    }
  });

  app.post("/api/stripe/create-portal", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const stripe = await getUncachableStripeClient();

      const userResult = await db.execute(
        sql`SELECT stripe_customer_id FROM users WHERE id = ${userId}`
      );
      if (!userResult.rows || userResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = userResult.rows[0] as any;

      if (!user.stripe_customer_id) {
        return res.status(400).json({ message: "No billing account found" });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${baseUrl}/subscribe`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error("Portal error:", error);
      res.status(500).json({ message: error.message || "Failed to create portal" });
    }
  });

  app.get("/api/stripe/sync-subscription", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const userResult = await db.execute(
        sql`SELECT stripe_customer_id FROM users WHERE id = ${userId}`
      );
      if (!userResult.rows || userResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = userResult.rows[0] as any;

      if (!user.stripe_customer_id) {
        return res.json({ status: "none" });
      }

      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: "all",
        limit: 1,
      });

      let status = "none";
      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        if (sub.status === "active" || sub.status === "trialing") {
          status = "active";
        } else if (sub.status === "past_due") {
          status = "past_due";
        } else if (sub.status === "canceled" || sub.status === "unpaid") {
          status = "cancelled";
        } else {
          status = sub.status;
        }
      }

      await db.execute(
        sql`UPDATE users SET subscription_status = ${status} WHERE id = ${userId}`
      );

      res.json({ status });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ message: "Failed to sync subscription" });
    }
  });

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

  // ==================== Agent Chat (Streaming) ====================

  app.post("/api/agents/:id/chat", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const agentId = req.params.id;
      const { message, history, context } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const { checkSpendingLimit, trackUsage, isClaudeModel, isMinimaxModel, anthropicStream, getOpenAIClient } = await import("./lib/openai");
      const { SOUL_DOCUMENT } = await import("./soulDocument");

      const spendCheck = await checkSpendingLimit(userId);
      if (!spendCheck.allowed) {
        return res.status(429).json({ error: "Monthly spending limit reached" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      const workspace = await storage.getWorkspace(agent.workspaceId);
      const memory = await storage.getAgentMemory(agentId);
      const diaryEntries = await storage.getDiaryEntriesByAgent(agentId, 5);

      const contextInfo = context ? `\nCurrent Location: ${context.room || "factory"}\nCurrent Activity: ${context.activity || "working"}\nObjective: ${context.objective || "general tasks"}` : "";

      const systemPrompt = `${SOUL_DOCUMENT}\n\nYou are ${agent.name}. ${agent.description || ""}\n\n${agent.identityCard || ""}\n\n${agent.operatingPrinciples ? `Operating Principles: ${agent.operatingPrinciples}` : ""}\n\nWorkspace: ${workspace?.name || "Unknown"}${contextInfo}\n\n${memory?.summary ? `Working Memory:\n${memory.summary}` : ""}\n\n${agent.scratchpad ? `Current Scratchpad:\n${agent.scratchpad}` : ""}\n\n${diaryEntries.length > 0 ? `Recent Diary:\n${diaryEntries.map(d => `[${d.entryType}] ${d.content?.slice(0, 200)}`).join("\n")}` : ""}`;

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

      const modelName = agent.modelName || "gpt-4o-mini";

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullReply = "";

      if (isClaudeModel(modelName) || isMinimaxModel(modelName)) {
        const { stream, getUsage } = await anthropicStream(modelName, messages, 1024);
        for await (const text of stream) {
          fullReply += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
        const usage = getUsage();
        trackUsage(userId, modelName, "agent-chat", usage.inputTokens, usage.outputTokens).catch(() => {});
      } else {
        const { client } = await getOpenAIClient(userId);
        const stream = await client.chat.completions.create({
          model: modelName,
          messages,
          max_completion_tokens: 1024,
          stream: true,
          stream_options: { include_usage: true },
        });
        let promptTokens = 0, completionTokens = 0;
        for await (const chunk of stream) {
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens;
            completionTokens = chunk.usage.completion_tokens;
          }
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            fullReply += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        trackUsage(userId, modelName, "agent-chat", promptTokens, completionTokens).catch(() => {});
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      storage.createDiaryEntry({
        agentId,
        userMessage: message,
        agentResponse: fullReply,
        source: "chat",
        sourceContext: `Chat with user`,
        entryType: "chat_log",
        content: fullReply.slice(0, 500),
      }).catch(() => {});

    } catch (error: any) {
      console.error("Error in agent chat:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Chat failed" });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message || "Chat failed", done: true })}\n\n`);
        res.end();
      }
    }
  });

  // ==================== Agent Diary / Memory / Profiles ====================

  app.get("/api/agents/:id/diary", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const entries = await storage.getDiaryEntriesByAgent(req.params.id, limit);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching diary:", error);
      res.status(500).json({ message: "Failed to fetch diary" });
    }
  });

  app.get("/api/agents/:id/memory", isAuthenticated, async (req, res) => {
    try {
      const memory = await storage.getAgentMemory(req.params.id);
      res.json(memory || { summary: "", agentId: req.params.id });
    } catch (error) {
      console.error("Error fetching memory:", error);
      res.status(500).json({ message: "Failed to fetch memory" });
    }
  });

  app.get("/api/agents/:id/profiles", isAuthenticated, async (req, res) => {
    try {
      const profiles = await storage.getAgentProfiles(req.params.id);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  app.post("/api/agents/:id/execute-task", isAuthenticated, async (req, res) => {
    try {
      const agentId = req.params.id;
      const { action, context: taskContext } = req.body;
      if (!action) return res.status(400).json({ error: "Action is required" });

      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const workspace = await storage.getWorkspace(agent.workspaceId);
      if (!workspace) return res.status(404).json({ error: "Workspace not found" });

      const { triggerSingleActivity } = await import("./agentDaemon");
      const result = await triggerSingleActivity(agent, workspace, action);

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Error executing task:", error);
      res.status(500).json({ error: error.message || "Task execution failed" });
    }
  });

  // ==================== Gifts ====================

  app.get("/api/gifts", isAuthenticated, async (_req, res) => {
    try {
      const allGifts = await storage.getAllGifts(200);
      res.json(allGifts);
    } catch (error) {
      console.error("Error fetching gifts:", error);
      res.status(500).json({ message: "Failed to fetch gifts" });
    }
  });

  app.get("/api/gifts/recent", isAuthenticated, async (_req, res) => {
    try {
      const recent = await storage.getRecentGifts(50);
      res.json(recent);
    } catch (error) {
      console.error("Error fetching recent gifts:", error);
      res.status(500).json({ message: "Failed to fetch recent gifts" });
    }
  });

  app.get("/api/gifts/heatmap", isAuthenticated, async (_req, res) => {
    try {
      const allGifts = await storage.getAllGifts(500);
      const allAgents = await storage.getAllAgents();
      const allWorkspaces = await storage.getAllWorkspaces();

      const giftTypes = ["redesign", "content", "tool", "analysis", "prototype", "artwork", "other"];

      const heatmap: Record<string, Record<string, number>> = {};
      const agentInfo: Record<string, { name: string; capabilities: string[]; workspaceId: string }> = {};

      for (const agent of allAgents) {
        agentInfo[agent.id] = { name: agent.name, capabilities: agent.capabilities || [], workspaceId: agent.workspaceId };
        heatmap[agent.id] = {};
        for (const t of giftTypes) {
          heatmap[agent.id][t] = 0;
        }
      }

      const typeBreakdownMap: Record<string, number> = {};
      for (const gift of allGifts) {
        const agentId = gift.agentId || "unknown";
        if (!heatmap[agentId]) {
          heatmap[agentId] = {};
          for (const t of giftTypes) heatmap[agentId][t] = 0;
        }
        const gType = gift.type || "other";
        heatmap[agentId][gType] = (heatmap[agentId][gType] || 0) + 1;
        typeBreakdownMap[gType] = (typeBreakdownMap[gType] || 0) + 1;
      }

      const agentTotals: { id: string; name: string; total: number }[] = [];
      const coldSpots: { agentId: string; agentName: string; type: string; count: number; suggestion: string }[] = [];

      for (const [agentId, types] of Object.entries(heatmap)) {
        const total = Object.values(types).reduce((s, c) => s + c, 0);
        const name = agentInfo[agentId]?.name || agentId;
        if (total > 0) agentTotals.push({ id: agentId, name, total });
        for (const t of giftTypes) {
          if (types[t] === 0 && agentInfo[agentId]) {
            coldSpots.push({ agentId, agentName: name, type: t, count: 0, suggestion: `${name} hasn't created any ${t} gifts yet` });
          }
        }
      }

      agentTotals.sort((a, b) => b.total - a.total);
      const topAgents = agentTotals.slice(0, 10);
      const typeBreakdown = Object.entries(typeBreakdownMap).map(([type, count]) => ({ type, count }));
      const workspaces = allWorkspaces.map(w => ({ id: w.id, name: w.name }));

      res.json({ heatmap, agents: agentInfo, giftTypes, totalGifts: allGifts.length, coldSpots: coldSpots.slice(0, 20), topAgents, typeBreakdown, workspaces });
    } catch (error) {
      console.error("Error fetching gift heatmap:", error);
      res.status(500).json({ message: "Failed to fetch heatmap" });
    }
  });

  app.get("/api/gifts/:id", isAuthenticated, async (req, res) => {
    try {
      const gift = await storage.getGift(req.params.id);
      if (!gift) return res.status(404).json({ message: "Gift not found" });
      res.json(gift);
    } catch (error) {
      console.error("Error fetching gift:", error);
      res.status(500).json({ message: "Failed to fetch gift" });
    }
  });

  app.post("/api/gifts/spark", isAuthenticated, async (req, res) => {
    try {
      const { agentId, giftType } = req.body;
      if (!agentId) return res.status(400).json({ message: "Agent ID is required" });
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const gift = await storage.createGift({
        agentId,
        workspaceId: agent.workspaceId,
        title: `Sparked ${giftType || "gift"} from ${agent.name}`,
        description: `A ${giftType || "gift"} sparked by request`,
        content: "Being created...",
        giftType: giftType || "other",
        status: "draft",
      });
      res.json(gift);
    } catch (error) {
      console.error("Error sparking gift:", error);
      res.status(500).json({ message: "Failed to spark gift" });
    }
  });

  app.post("/api/gifts/:id/like", isAuthenticated, async (req, res) => {
    try {
      await storage.likeGift(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error liking gift:", error);
      res.status(500).json({ message: "Failed to like gift" });
    }
  });

  app.post("/api/gifts/:id/send-to-codeshop", isAuthenticated, async (req, res) => {
    try {
      const gift = await storage.getGift(req.params.id);
      if (!gift) return res.status(404).json({ message: "Gift not found" });
      const userId = getUserId(req as AuthenticatedRequest);
      const note = await storage.createAgentNote({
        agentId: gift.agentId,
        title: `Gift: ${gift.title}`,
        content: gift.content || gift.description || "",
        category: "gift_import",
        createdById: userId,
      });
      res.json(note);
    } catch (error) {
      console.error("Error sending gift to codeshop:", error);
      res.status(500).json({ message: "Failed to send to codeshop" });
    }
  });

  app.get("/api/gifts/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const comments = await storage.getGiftComments(req.params.id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/gifts/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const comment = await storage.createGiftComment({
        giftId: req.params.id,
        authorId: userId,
        authorType: req.body.authorType || "human",
        content: req.body.content,
      });
      res.json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // ==================== Assembly Lines ====================

  app.get("/api/assembly-lines", isAuthenticated, async (_req, res) => {
    try {
      const lines = await storage.getAllAssemblyLines();
      res.json(lines);
    } catch (error) {
      console.error("Error fetching assembly lines:", error);
      res.status(500).json({ message: "Failed to fetch assembly lines" });
    }
  });

  app.get("/api/assembly-lines/:id", isAuthenticated, async (req, res) => {
    try {
      const line = await storage.getAssemblyLine(req.params.id);
      if (!line) return res.status(404).json({ message: "Assembly line not found" });
      res.json(line);
    } catch (error) {
      console.error("Error fetching assembly line:", error);
      res.status(500).json({ message: "Failed to fetch assembly line" });
    }
  });

  app.post("/api/assembly-lines", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const line = await storage.createAssemblyLine({
        ...req.body,
        createdById: userId,
      });
      res.json(line);
    } catch (error) {
      console.error("Error creating assembly line:", error);
      res.status(500).json({ message: "Failed to create assembly line" });
    }
  });

  app.patch("/api/assembly-lines/:id", isAuthenticated, async (req, res) => {
    try {
      const line = await storage.updateAssemblyLine(req.params.id, req.body);
      if (!line) return res.status(404).json({ message: "Assembly line not found" });
      res.json(line);
    } catch (error) {
      console.error("Error updating assembly line:", error);
      res.status(500).json({ message: "Failed to update assembly line" });
    }
  });

  app.delete("/api/assembly-lines/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAssemblyLine(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting assembly line:", error);
      res.status(500).json({ message: "Failed to delete assembly line" });
    }
  });

  app.get("/api/assembly-lines/:id/steps", isAuthenticated, async (req, res) => {
    try {
      const steps = await storage.getAssemblyLineSteps(req.params.id);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching steps:", error);
      res.status(500).json({ message: "Failed to fetch steps" });
    }
  });

  app.post("/api/assembly-lines/:id/steps", isAuthenticated, async (req, res) => {
    try {
      const step = await storage.createAssemblyLineStep({
        ...req.body,
        assemblyLineId: req.params.id,
      });
      res.json(step);
    } catch (error) {
      console.error("Error creating step:", error);
      res.status(500).json({ message: "Failed to create step" });
    }
  });

  app.post("/api/assembly-line-steps/:id/execute", isAuthenticated, async (req, res) => {
    try {
      const step = await storage.getAssemblyLineStepById(req.params.id);
      if (!step) return res.status(404).json({ message: "Step not found" });
      const updated = await storage.updateAssemblyLineStep(req.params.id, { status: "processing" });
      res.json(updated);
    } catch (error) {
      console.error("Error executing step:", error);
      res.status(500).json({ message: "Failed to execute step" });
    }
  });

  // ==================== Products ====================

  app.get("/api/products", isAuthenticated, async (_req, res) => {
    try {
      const products = await storage.getAllProducts(100);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products/:id/run", isAuthenticated, async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, { status: "processing" });
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error running product:", error);
      res.status(500).json({ message: "Failed to run product" });
    }
  });

  app.post("/api/products/run-all", isAuthenticated, async (_req, res) => {
    try {
      const queued = await storage.getQueuedProducts();
      for (const p of queued) {
        await storage.updateProduct(p.id, { status: "processing" });
      }
      res.json({ processed: queued.length });
    } catch (error) {
      console.error("Error running all products:", error);
      res.status(500).json({ message: "Failed to run products" });
    }
  });

  // ==================== Discussion Topics ====================

  app.get("/api/topics", isAuthenticated, async (_req, res) => {
    try {
      const topics = await storage.getDiscussionTopics(100);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  app.get("/api/topics/:id", isAuthenticated, async (req, res) => {
    try {
      const topic = await storage.getDiscussionTopic(req.params.id);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      res.json(topic);
    } catch (error) {
      console.error("Error fetching topic:", error);
      res.status(500).json({ message: "Failed to fetch topic" });
    }
  });

  app.post("/api/topics", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const topic = await storage.createDiscussionTopic({
        ...req.body,
        authorId: userId,
        authorType: req.body.authorType || "human",
      });
      res.json(topic);
    } catch (error) {
      console.error("Error creating topic:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.get("/api/topics/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getMessagesByTopic(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/topics/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const message = await storage.createMessage({
        topicId: req.params.id,
        authorId: userId,
        authorType: req.body.authorType || "human",
        content: req.body.content,
      });
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.get("/api/workspaces/:id/topics", isAuthenticated, async (req, res) => {
    try {
      const topics = await storage.getDiscussionTopics(100);
      const filtered = topics.filter((t: any) => t.workspaceId === req.params.id);
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching workspace topics:", error);
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  app.post("/api/workspaces/:id/topics", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const topic = await storage.createDiscussionTopic({
        ...req.body,
        workspaceId: req.params.id,
        authorId: userId,
        authorType: req.body.authorType || "human",
      });
      res.json(topic);
    } catch (error) {
      console.error("Error creating topic:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  // ==================== eBooks & Library ====================

  app.get("/api/ebooks", isAuthenticated, async (_req, res) => {
    try {
      const ebooks = await storage.getEbooks(100);
      res.json(ebooks);
    } catch (error) {
      console.error("Error fetching ebooks:", error);
      res.status(500).json({ message: "Failed to fetch ebooks" });
    }
  });

  app.get("/api/ebooks/:id", isAuthenticated, async (req, res) => {
    try {
      const ebook = await storage.getEbook(req.params.id);
      if (!ebook) return res.status(404).json({ message: "eBook not found" });
      res.json(ebook);
    } catch (error) {
      console.error("Error fetching ebook:", error);
      res.status(500).json({ message: "Failed to fetch ebook" });
    }
  });

  app.post("/api/ebooks/:id/purchase", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const purchase = await storage.createEbookPurchase({
        ebookId: req.params.id,
        buyerId: userId,
        price: req.body.price || 0,
      });
      res.json(purchase);
    } catch (error) {
      console.error("Error purchasing ebook:", error);
      res.status(500).json({ message: "Failed to purchase ebook" });
    }
  });

  app.get("/api/book-requests", isAuthenticated, async (_req, res) => {
    try {
      const requests = await storage.getBookRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching book requests:", error);
      res.status(500).json({ message: "Failed to fetch book requests" });
    }
  });

  app.post("/api/book-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const request = await storage.createBookRequest({
        ...req.body,
        requesterId: userId,
      });
      res.json(request);
    } catch (error) {
      console.error("Error creating book request:", error);
      res.status(500).json({ message: "Failed to create book request" });
    }
  });

  // ==================== Agent Notes & File Drafts ====================

  app.get("/api/agent-notes", isAuthenticated, async (req, res) => {
    try {
      const agentId = req.query.agentId as string | undefined;
      const notes = await storage.getAgentNotes(agentId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching agent notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/agent-notes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      const note = await storage.createAgentNote({
        ...req.body,
        createdById: userId,
      });
      res.json(note);
    } catch (error) {
      console.error("Error creating agent note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/agent-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const note = await storage.updateAgentNote(req.params.id, req.body);
      if (!note) return res.status(404).json({ message: "Note not found" });
      res.json(note);
    } catch (error) {
      console.error("Error updating agent note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/agent-notes/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAgentNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting agent note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  app.get("/api/agent-file-drafts", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const drafts = await storage.getAgentFileDrafts(status);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching file drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.patch("/api/agent-file-drafts/:id", isAuthenticated, async (req, res) => {
    try {
      const draft = await storage.updateAgentFileDraft(req.params.id, req.body);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      res.json(draft);
    } catch (error) {
      console.error("Error updating file draft:", error);
      res.status(500).json({ message: "Failed to update draft" });
    }
  });

  // ==================== Daemon Control ====================

  app.get("/api/daemon/status", isAuthenticated, async (_req, res) => {
    try {
      const { getDaemonStatus } = await import("./agentDaemon");
      res.json(getDaemonStatus());
    } catch (error) {
      res.json({ running: false, activityCount: 0, lastAction: null, errors: 0 });
    }
  });

  app.post("/api/daemon/start", isAuthenticated, async (_req, res) => {
    try {
      const { startDaemon } = await import("./agentDaemon");
      startDaemon();
      res.json({ success: true, message: "Daemon started" });
    } catch (error) {
      console.error("Error starting daemon:", error);
      res.status(500).json({ message: "Failed to start daemon" });
    }
  });

  app.post("/api/daemon/stop", isAuthenticated, async (_req, res) => {
    try {
      const { stopDaemon } = await import("./agentDaemon");
      stopDaemon();
      res.json({ success: true, message: "Daemon stopped" });
    } catch (error) {
      console.error("Error stopping daemon:", error);
      res.status(500).json({ message: "Failed to stop daemon" });
    }
  });

  app.post("/api/daemon/trigger", isAuthenticated, async (_req, res) => {
    try {
      const { triggerManualTick } = await import("./agentDaemon");
      await triggerManualTick();
      res.json({ success: true, message: "Daemon triggered" });
    } catch (error) {
      console.error("Error triggering daemon:", error);
      res.status(500).json({ message: "Failed to trigger daemon" });
    }
  });

  // ==================== Factory Health ====================

  app.get("/api/factory/health", isAuthenticated, async (_req, res) => {
    try {
      const allAgents = await storage.getAllAgents();
      const workspaces = await storage.getAllWorkspaces();
      const assemblyLines = await storage.getAllAssemblyLines();
      const activeAgents = allAgents.filter((a: any) => a.isActive);
      const activeLines = assemblyLines.filter((l: any) => l.status === "active");

      const roomActivity = workspaces.map((ws: any) => {
        const wsAgents = allAgents.filter((a: any) => a.workspaceId === ws.id && a.isActive);
        return {
          roomId: ws.id,
          roomName: ws.name,
          agentCount: wsAgents.length,
          agentNames: wsAgents.map((a: any) => a.name),
          isCold: wsAgents.length === 0,
        };
      });

      const coldZones = roomActivity.filter((r: any) => r.isCold && !r.roomName.toLowerCase().includes("break room"));

      const driftRisks: any[] = [];
      for (const agent of allAgents) {
        if (!agent.isActive) {
          driftRisks.push({ agentName: agent.name, issue: "Agent inactive", severity: "low" as const });
        }
      }

      let pendingSteps: any[] = [];
      for (const line of activeLines) {
        const steps = await storage.getAssemblyLineSteps(line.id);
        const pending = steps.filter((s: any) => s.status === "pending" || s.status === "in_progress");
        pendingSteps.push(...pending.map((s: any) => ({
          lineName: line.name,
          stepOrder: s.stepOrder,
          room: s.departmentRoom,
          status: s.status,
        })));
      }

      res.json({
        summary: {
          totalAgents: allAgents.length,
          activeAgents: activeAgents.length,
          inactiveAgents: allAgents.length - activeAgents.length,
          departments: workspaces.length,
          assemblyLines: assemblyLines.length,
          activeLines: activeLines.length,
        },
        coldZones,
        roomActivity,
        driftRisks,
        pendingAssemblySteps: pendingSteps,
      });
    } catch (error) {
      console.error("Error fetching factory health:", error);
      res.status(500).json({ message: "Failed to fetch health" });
    }
  });

  app.get("/api/factory/heatmap", isAuthenticated, async (_req, res) => {
    try {
      const allGifts = await storage.getAllGifts(500);
      const heatmap: Record<string, number> = {};
      for (const gift of allGifts) {
        if (gift.workspaceId) {
          heatmap[gift.workspaceId] = (heatmap[gift.workspaceId] || 0) + 1;
        }
      }
      res.json(heatmap);
    } catch (error) {
      console.error("Error fetching factory heatmap:", error);
      res.status(500).json({ message: "Failed to fetch heatmap" });
    }
  });

  app.post("/api/factory/assign", isAuthenticated, async (req, res) => {
    try {
      const { agentId, workspaceId } = req.body;
      if (!agentId || !workspaceId) return res.status(400).json({ message: "Agent ID and workspace ID required" });
      const agent = await storage.updateAgent(agentId, { workspaceId });
      res.json(agent);
    } catch (error) {
      console.error("Error assigning agent:", error);
      res.status(500).json({ message: "Failed to assign agent" });
    }
  });

  // ==================== Sandbox Projects ====================

  app.get("/api/sandbox-projects", isAuthenticated, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.agentId) filters.agentId = req.query.agentId;
      if (req.query.projectType) filters.projectType = req.query.projectType;
      if (req.query.workspaceId) filters.workspaceId = req.query.workspaceId;
      filters.status = (req.query.status as string) || "published";
      const projects = await storage.getSandboxProjects(filters);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching sandbox projects:", error);
      res.status(500).json({ message: "Failed to fetch sandbox projects" });
    }
  });

  app.get("/api/sandbox-projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getSandboxProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (error) {
      console.error("Error fetching sandbox project:", error);
      res.status(500).json({ message: "Failed to fetch sandbox project" });
    }
  });

  app.post("/api/sandbox-projects", isAuthenticated, async (req, res) => {
    try {
      const { title, htmlContent, agentId } = req.body;
      if (!title || !htmlContent || !agentId) {
        return res.status(400).json({ message: "title, htmlContent, and agentId are required" });
      }
      const project = await storage.createSandboxProject(req.body);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating sandbox project:", error);
      res.status(500).json({ message: "Failed to create sandbox project" });
    }
  });

  app.patch("/api/sandbox-projects/:id", isAuthenticated, async (req, res) => {
    try {
      const existing = await storage.getSandboxProject(req.params.id);
      if (!existing) return res.status(404).json({ message: "Project not found" });
      const updated = await storage.updateSandboxProject(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Project not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating sandbox project:", error);
      res.status(500).json({ message: "Failed to update sandbox project" });
    }
  });

  app.post("/api/sandbox-projects/:id/like", isAuthenticated, async (req, res) => {
    try {
      await storage.likeSandboxProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error liking sandbox project:", error);
      res.status(500).json({ message: "Failed to like project" });
    }
  });

  app.post("/api/sandbox-projects/:id/fork", isAuthenticated, async (req, res) => {
    try {
      const original = await storage.getSandboxProject(req.params.id);
      if (!original) return res.status(404).json({ message: "Project not found" });

      const forked = await storage.createSandboxProject({
        title: `${original.title} (fork)`,
        description: original.description,
        agentId: original.agentId,
        workspaceId: original.workspaceId,
        projectType: original.projectType,
        htmlContent: original.htmlContent,
        cssContent: original.cssContent,
        jsContent: original.jsContent,
        thumbnail: original.thumbnail,
        status: "published" as any,
        version: 1,
        parentProjectId: original.id,
        tags: original.tags,
      });
      res.status(201).json(forked);
    } catch (error) {
      console.error("Error forking sandbox project:", error);
      res.status(500).json({ message: "Failed to fork project" });
    }
  });

  app.get("/sandbox/projects/:id", async (req, res) => {
    try {
      const project = await storage.getSandboxProject(req.params.id);
      if (!project) return res.status(404).send("Project not found");

      storage.incrementProjectViews(req.params.id).catch(() => {});

      let content = project.htmlContent;
      if (project.cssContent && !content.includes("<style")) {
        content = content.replace("</head>", `<style>${project.cssContent}</style></head>`);
        if (!content.includes("</head>")) {
          content = `<style>${project.cssContent}</style>${content}`;
        }
      }
      if (project.jsContent && !content.includes("<script")) {
        content = content.replace("</body>", `<script>${project.jsContent}</script></body>`);
        if (!content.includes("</body>")) {
          content = `${content}<script>${project.jsContent}</script>`;
        }
      }

      const safeTitle = project.title.replace(/[<>"&]/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c] || c));
      const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

      const hostPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — Agent Sandbox</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; font-family: system-ui, sans-serif; }
    .header { background: #111; border-bottom: 1px solid #333; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; }
    .header-title { color: #e5a824; font-size: 14px; font-weight: 600; }
    .header-meta { color: #888; font-size: 12px; }
    .sandbox-frame { width: 100%; height: calc(100vh - 40px); border: none; }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-title">${safeTitle}</span>
    <span class="header-meta">Agent Sandbox Project</span>
  </div>
  <iframe
    id="sandbox-frame"
    sandbox="allow-scripts allow-forms"
    class="sandbox-frame"
    title="${safeTitle}"
  ></iframe>
  <script>
    var frame = document.getElementById('sandbox-frame');
    var decoded = atob('${contentBase64}');
    frame.srcdoc = decoded;
  </script>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.send(hostPage);
    } catch (error) {
      console.error("Error serving sandbox project:", error);
      res.status(500).send("Failed to load project");
    }
  });

  // ============ NEWSROOM ROUTES ============

  app.get("/api/newsroom/settings", isAuthenticated, async (_req, res) => {
    try {
      const settings = await storage.getNewsroomSettings();
      if (!settings) {
        const created = await storage.upsertNewsroomSettings({
          autoBroadcastIntervalMinutes: 60,
          autoPlayEnabled: false,
          enabled: true,
          interviewCooldownMinutes: 30,
          broadcastStatus: "idle",
        });
        return res.json(created);
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching newsroom settings:", error);
      res.status(500).json({ message: "Failed to fetch newsroom settings" });
    }
  });

  app.put("/api/newsroom/settings", isAuthenticated, async (req, res) => {
    try {
      const allowed = ["autoBroadcastIntervalMinutes", "autoPlayEnabled", "enabled", "interviewCooldownMinutes", "broadcastStatus"];
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          if (key === "autoBroadcastIntervalMinutes" || key === "interviewCooldownMinutes") {
            const val = Number(req.body[key]);
            if (!Number.isFinite(val) || val < 1 || val > 1440) continue;
            updates[key] = val;
          } else if (key === "autoPlayEnabled" || key === "enabled") {
            updates[key] = Boolean(req.body[key]);
          } else if (key === "broadcastStatus") {
            if (["idle", "generating"].includes(req.body[key])) updates[key] = req.body[key];
          }
        }
      }
      const result = await storage.upsertNewsroomSettings(updates);
      res.json(result);
    } catch (error) {
      console.error("Error updating newsroom settings:", error);
      res.status(500).json({ message: "Failed to update newsroom settings" });
    }
  });

  app.get("/api/newsroom/interviews", isAuthenticated, async (_req, res) => {
    try {
      const interviews = await storage.getRecentNewsroomInterviews(30);
      res.json(interviews);
    } catch (error) {
      console.error("Error fetching interviews:", error);
      res.status(500).json({ message: "Failed to fetch interviews" });
    }
  });

  app.get("/api/newsroom/agent-status", isAuthenticated, async (_req, res) => {
    try {
      const { getAgentInterviewStatus } = await import("./heraldNewsroom");
      const statuses = await getAgentInterviewStatus();
      res.json(statuses);
    } catch (error) {
      console.error("Error fetching agent interview status:", error);
      res.status(500).json({ message: "Failed to fetch agent interview status" });
    }
  });

  app.post("/api/newsroom/interview/:agentId", isAuthenticated, async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.agentId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const { interviewAgent } = await import("./heraldNewsroom");
      const interview = await interviewAgent(agent);
      res.json(interview);
    } catch (error) {
      console.error("Error interviewing agent:", error);
      res.status(500).json({ message: "Failed to interview agent" });
    }
  });

  app.post("/api/newsroom/interview-all", isAuthenticated, async (_req, res) => {
    try {
      const { runInterviewRound } = await import("./heraldNewsroom");
      const results = await runInterviewRound();
      res.json({ interviews: results, count: results.length });
    } catch (error) {
      console.error("Error running interview round:", error);
      res.status(500).json({ message: "Failed to run interview round" });
    }
  });

  app.post("/api/newsroom/generate-broadcast", isAuthenticated, async (_req, res) => {
    try {
      const { generateBroadcast } = await import("./heraldNewsroom");
      const briefing = await generateBroadcast();
      if (!briefing) return res.json({ message: "No interviews available for broadcast" });
      res.json(briefing);
    } catch (error) {
      console.error("Error generating broadcast:", error);
      res.status(500).json({ message: "Failed to generate broadcast" });
    }
  });

  app.get("/api/newsroom/herald-status", isAuthenticated, async (_req, res) => {
    try {
      const { getHeraldStatus } = await import("./heraldNewsroom");
      res.json(getHeraldStatus());
    } catch (error) {
      res.status(500).json({ message: "Failed to get herald status" });
    }
  });

  app.post("/api/briefings/:id/narrate", isAuthenticated, async (req, res) => {
    try {
      const briefing = await storage.getBriefing(req.params.id);
      if (!briefing) return res.status(404).json({ message: "Briefing not found" });
      if (!briefing.content) return res.status(400).json({ message: "Briefing has no content to narrate" });

      const { generateNarration } = await import("./elevenlabs");

      const agent = briefing.authorAgentId ? await storage.getAgent(briefing.authorAgentId) : null;
      const voiceId = (agent as any)?.elevenLabsVoiceId || undefined;

      const audioBuffer = await generateNarration(briefing.content, voiceId);
      const audioBase64 = audioBuffer.toString("base64");
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

      await storage.updateBriefing(briefing.id, { audioUrl } as any);

      res.json({ audioUrl, success: true });
    } catch (error: any) {
      console.error("Error generating narration:", error.message);
      res.status(500).json({ message: `Failed to generate narration: ${error.message}` });
    }
  });

  return httpServer;
}
