import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import type { AuthenticatedRequest } from "./replit_integrations/auth";
import { z } from "zod";
import { getUncachableStripeClient } from "./stripeClient";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
        `SELECT id, email, first_name, last_name, profile_image_url, is_admin, subscription_status, stripe_customer_id, stripe_subscription_id, coupon_code FROM users WHERE id = $1`,
        [userId]
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
        `SELECT email, stripe_customer_id FROM users WHERE id = $1`,
        [userId]
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
          `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
          [customerId, userId]
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
              `UPDATE users SET coupon_code = $1 WHERE id = $2`,
              [couponCode, userId]
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
        `SELECT stripe_customer_id FROM users WHERE id = $1`,
        [userId]
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
        `SELECT stripe_customer_id FROM users WHERE id = $1`,
        [userId]
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
        `UPDATE users SET subscription_status = $1 WHERE id = $2`,
        [status, userId]
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

  return httpServer;
}
