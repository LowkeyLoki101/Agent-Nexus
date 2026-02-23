import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { insertWorkspaceSchema, insertAgentSchema, insertGiftSchema, insertGiftCommentSchema, insertAssemblyLineSchema, insertAssemblyLineStepSchema, insertProductSchema, insertAgentNoteSchema, insertAgentFileDraftSchema, insertDiscussionTopicSchema, insertDiscussionMessageSchema, users } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

const BROADCAST_MAX_WORDS = 60;

function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + ".";
}

async function generateBriefingAudio(briefingId: string): Promise<string | null> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.log("Auto-audio skipped: ELEVENLABS_API_KEY not configured");
      return null;
    }

    const briefing = await storage.getBriefing(briefingId);
    if (!briefing) return null;

    const rawText = `${briefing.title}. ${briefing.summary || briefing.content}`;
    const text = truncateToWordLimit(rawText, BROADCAST_MAX_WORDS);

    let voiceId = "21m00Tcm4TlvDq8ikWAM";
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
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      console.error("Auto-audio ElevenLabs error:", await response.text());
      return null;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioDir = path.join(process.cwd(), "client", "public", "audio");
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const filename = `broadcast-${briefingId}-${Date.now()}.mp3`;
    const filePath = path.join(audioDir, filename);
    fs.writeFileSync(filePath, audioBuffer);

    const audioUrl = `/audio/${filename}`;
    await storage.updateBriefing(briefingId, { audioUrl });
    console.log(`Auto-audio generated for briefing ${briefingId}: ${audioUrl}`);
    return audioUrl;
  } catch (error) {
    console.error("Auto-audio generation error:", error);
    return null;
  }
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

async function isSubscribed(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(401).json({ message: "User not found" });

    if (user.isAdmin || user.subscriptionStatus === "active") {
      return next();
    }

    return res.status(403).json({ message: "Active subscription required" });
  } catch (error) {
    return res.status(500).json({ message: "Authorization check failed" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.get("/api/stripe/publishable-key", isAuthenticated, async (_req: any, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      res.status(500).json({ message: "Failed to get Stripe key" });
    }
  });

  app.get("/api/stripe/subscription-price", isAuthenticated, async (_req: any, res) => {
    try {
      const result = await db.execute(
        sql`SELECT p.id as product_id, p.name, p.description, pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring 
            FROM stripe.products p 
            JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true 
            WHERE p.active = true AND p.metadata->>'plan' = 'pro' 
            LIMIT 1`
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "No subscription plan found" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching price:", error);
      res.status(500).json({ message: "Failed to fetch subscription price" });
    }
  });

  app.post("/api/stripe/create-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId, couponCode } = req.body ?? {};

      if (!priceId) return res.status(400).json({ message: "priceId is required" });

      const validPrice = await db.execute(
        sql`SELECT pr.id FROM stripe.prices pr 
            JOIN stripe.products p ON pr.product = p.id 
            WHERE pr.id = ${priceId} AND pr.active = true AND p.active = true AND p.metadata->>'plan' = 'pro' 
            LIMIT 1`
      );
      if (validPrice.rows.length === 0) {
        return res.status(400).json({ message: "Invalid price" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
      }

      const sessionParams: any = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/?subscription=success`,
        cancel_url: `${req.protocol}://${req.get('host')}/?subscription=cancelled`,
        allow_promotion_codes: true,
      };

      if (couponCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: couponCode, active: true, limit: 1 });
          if (promoCodes.data.length > 0) {
            sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
            delete sessionParams.allow_promotion_codes;
          }
        } catch {}
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/create-portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/`,
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error("Portal error:", error);
      res.status(500).json({ message: "Failed to create billing portal" });
    }
  });

  app.post("/api/stripe/sync-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.stripeCustomerId) {
        return res.json({ subscriptionStatus: user?.subscriptionStatus || "none" });
      }

      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 1,
      });

      let status = "none";
      let subId = null;
      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        subId = sub.id;
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

      await db.update(users).set({
        subscriptionStatus: status,
        stripeSubscriptionId: subId,
      }).where(eq(users.id, userId));

      res.json({ subscriptionStatus: status });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ message: "Failed to sync subscription" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [adminUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!adminUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const allUsers = await db.select().from(users);
      res.json(allUsers.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isAdmin: u.isAdmin,
        subscriptionStatus: u.subscriptionStatus,
        stripeCustomerId: u.stripeCustomerId,
        stripeSubscriptionId: u.stripeSubscriptionId,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const [adminUser] = await db.select().from(users).where(eq(users.id, adminId));
      if (!adminUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const body = req.body ?? {};
      const updates: any = {};
      if (typeof body.isAdmin === "boolean") updates.isAdmin = body.isAdmin;
      if (typeof body.subscriptionStatus === "string") updates.subscriptionStatus = body.subscriptionStatus;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }

      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      res.json({
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        isAdmin: updated.isAdmin,
        subscriptionStatus: updated.subscriptionStatus,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.use("/api/workspaces", isAuthenticated, isSubscribed);
  app.use("/api/agents", isAuthenticated, isSubscribed);
  app.use("/api/gifts", isAuthenticated, isSubscribed);
  app.use("/api/products", isAuthenticated, isSubscribed);
  app.use("/api/assembly-lines", isAuthenticated, isSubscribed);
  app.use("/api/assembly-line-steps", isAuthenticated, isSubscribed);
  app.use("/api/briefings", isAuthenticated, isSubscribed);
  app.use("/api/topics", isAuthenticated, isSubscribed);
  app.use("/api/tokens", isAuthenticated, isSubscribed);
  app.use("/api/audit-logs", isAuthenticated, isSubscribed);
  app.use("/api/library", isAuthenticated, isSubscribed);
  app.use("/api/agent-notes", isAuthenticated, isSubscribed);
  app.use("/api/agent-drafts", isAuthenticated, isSubscribed);
  app.use("/api/command-chat", isAuthenticated, isSubscribed);
  app.use("/api/factory", isAuthenticated, isSubscribed);

  app.get("/api/workspaces", async (req: any, res) => {
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

      if (briefing.status === "published" && !briefing.audioUrl) {
        generateBriefingAudio(briefing.id).catch(() => {});
      }

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

      const wasPublished = briefing.status !== "published" && updated?.status === "published";
      if (wasPublished && !updated?.audioUrl) {
        generateBriefingAudio(id).catch(() => {});
      }

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

  app.get("/api/gifts/heatmap", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAgents = await storage.getAgentsByUser(userId);
      const userWorkspaces = await storage.getWorkspacesByUser(userId);
      const allGifts = await storage.getGiftsByUser(userId);

      const giftTypes = ["redesign", "content", "tool", "analysis", "prototype", "artwork", "other"];

      const heatmapData: Record<string, Record<string, number>> = {};
      const agentMap: Record<string, { name: string; capabilities: string[]; workspaceId: string }> = {};

      for (const agent of userAgents) {
        heatmapData[agent.id] = {};
        agentMap[agent.id] = { name: agent.name, capabilities: agent.capabilities || [], workspaceId: agent.workspaceId };
        for (const t of giftTypes) {
          heatmapData[agent.id][t] = 0;
        }
      }

      for (const gift of allGifts) {
        if (heatmapData[gift.agentId]) {
          heatmapData[gift.agentId][gift.type] = (heatmapData[gift.agentId][gift.type] || 0) + 1;
        }
      }

      const totalGifts = allGifts.length;
      const coldSpots: { agentId: string; agentName: string; type: string; count: number; suggestion: string }[] = [];

      for (const [agentId, types] of Object.entries(heatmapData)) {
        const agent = agentMap[agentId];
        for (const [type, count] of Object.entries(types)) {
          if (count === 0) {
            const capMatch = (agent.capabilities || []).some(c =>
              (type === "content" && ["write", "creative_writing", "content_generation", "communicate"].includes(c)) ||
              (type === "analysis" && ["analyze", "research", "analysis"].includes(c)) ||
              (type === "tool" && ["code", "coding", "execute", "code_assistance"].includes(c)) ||
              (type === "artwork" && ["create", "design"].includes(c)) ||
              (type === "prototype" && ["code", "coding", "code_assistance"].includes(c)) ||
              (type === "redesign" && ["design", "create", "architecture"].includes(c))
            );

            if (capMatch) {
              coldSpots.push({
                agentId,
                agentName: agent.name,
                type,
                count: 0,
                suggestion: `${agent.name} has capabilities for ${type} but hasn't created one yet. Spark a ${type} gift to activate this area.`,
              });
            }
          }
        }
      }

      const topAgents = Object.entries(heatmapData)
        .map(([id, types]) => ({ id, name: agentMap[id]?.name || "Unknown", total: Object.values(types).reduce((a, b) => a + b, 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const typeBreakdown = giftTypes.map(t => ({
        type: t,
        count: allGifts.filter(g => g.type === t).length,
      }));

      res.json({
        heatmap: heatmapData,
        agents: agentMap,
        giftTypes,
        totalGifts,
        coldSpots: coldSpots.slice(0, 10),
        topAgents,
        typeBreakdown,
        workspaces: userWorkspaces.map(w => ({ id: w.id, name: w.name })),
      });
    } catch (error) {
      console.error("Error fetching heatmap:", error);
      res.status(500).json({ message: "Failed to fetch heatmap" });
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

  // === GIFT SPARK (AI-powered gift creation) ===
  app.post("/api/gifts/spark", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { agentId, workspaceId, type, prompt } = req.body;

      if (!agentId || !workspaceId || !type) {
        return res.status(400).json({ message: "agentId, workspaceId, and type are required" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const giftTypeLabels: Record<string, string> = {
        redesign: "a creative redesign or improvement",
        content: "original written content (article, blog post, guide, or essay)",
        tool: "a useful tool, utility, or automation concept",
        analysis: "a thorough analysis or research report",
        prototype: "a prototype or technical proof-of-concept",
        artwork: "an original piece of creative artwork or visual design",
        other: "a novel creation or surprise",
      };

      const typeDesc = giftTypeLabels[type] || giftTypeLabels.other;

      const sparkOpenai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are ${agent.name}, an autonomous AI agent in the "${workspace.name}" workspace. Your capabilities: ${(agent.capabilities || []).join(", ")}. ${agent.description || ""}

You are creating a gift — ${typeDesc}. Gifts are autonomous creations that demonstrate your initiative and creativity. They should be substantive, valuable, and show independent thinking.

${prompt ? `The user gave this direction: "${prompt}"` : "Create something that showcases your unique perspective and capabilities."}

Respond with ONLY valid JSON in this exact format:
{
  "title": "A compelling, specific title for your creation",
  "description": "A 1-2 sentence summary of what you created and why",
  "content": "The full content of your gift. Make this substantial (at least 3-5 paragraphs). Include structure, detail, and genuine value.",
  "inspirationSource": "What inspired you to create this particular gift"
}`;

      const completion = await sparkOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        max_tokens: 2048,
        temperature: 0.8,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      let parsed;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        return res.status(500).json({ message: "AI failed to generate valid gift content" });
      }

      const gift = await storage.createGift({
        agentId,
        workspaceId,
        title: parsed.title || "Untitled Gift",
        description: parsed.description || "",
        type: type as any,
        status: "ready",
        content: parsed.content || "",
        inspirationSource: parsed.inspirationSource || "",
      });

      await storage.createAuditLog({
        userId,
        action: "gift_created",
        resourceType: "gift",
        resourceId: gift.id,
        details: { agentName: agent.name, giftType: type, title: gift.title, method: "spark" },
      });

      res.status(201).json(gift);
    } catch (error) {
      console.error("Error sparking gift:", error);
      res.status(500).json({ message: "Failed to create gift" });
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

      const body = req.body ?? {};
      const text = body.text || `${briefing.title}. ${briefing.summary || briefing.content.slice(0, 2000)}`;
      let voiceId = body.voiceId || "21m00Tcm4TlvDq8ikWAM";
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

      const vBody = req.body ?? {};
      const text = vBody.text || `${briefing.title}. ${briefing.summary || briefing.content.slice(0, 1500)}`;
      let avatarId = vBody.avatarId || "Kristin_pubblic_2_20240108";
      let voiceIdForVideo = vBody.voiceId || "1bd001e7e50f421d891986aad5e3f8d2";
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

  const commandChatOpenai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  let architectureDoc = "";
  try {
    architectureDoc = fs.readFileSync("replit.md", "utf-8");
  } catch {}

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"));
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel", "text/csv",
        "application/zip", "application/x-zip-compressed",
        "text/plain", "application/json",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
      ];
      cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith(".csv") || file.originalname.endsWith(".json") || file.originalname.endsWith(".txt"));
    },
  });

  app.post("/api/command-chat/upload", isAuthenticated, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded or file type not allowed" });
    const f = req.file;
    let preview = "";
    try {
      if (f.mimetype === "text/plain" || f.mimetype === "application/json" || f.mimetype === "text/csv" || f.originalname.endsWith(".csv") || f.originalname.endsWith(".txt") || f.originalname.endsWith(".json")) {
        const content = fs.readFileSync(f.path, "utf-8");
        preview = content.slice(0, 3000);
      }
    } catch {}
    res.json({
      id: f.filename,
      name: f.originalname,
      size: f.size,
      type: f.mimetype,
      preview,
      url: `/api/command-chat/uploads/${f.filename}`,
    });
  });

  app.get("/api/command-chat/uploads/:filename", isAuthenticated, (req: any, res) => {
    const filename = path.basename(req.params.filename);
    if (filename !== req.params.filename || filename.includes("..")) {
      return res.status(400).json({ message: "Invalid filename" });
    }
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    res.sendFile(filePath);
  });

  app.get("/api/factory/health", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getAgentsByUser(userId);
      const workspaces = await storage.getWorkspacesByUser(userId);
      const assemblyLinesData = await storage.getAssemblyLinesByUser(userId);

      const activeAgents = agents.filter(a => a.isActive);
      const inactiveAgents = agents.filter(a => !a.isActive);

      const FACTORY_ROOMS = [
        { id: "research-lab", name: "Research Lab", capabilities: ["research", "analysis"] },
        { id: "code-workshop", name: "Code Workshop", capabilities: ["code-review", "engineering", "testing", "coding", "debugging"] },
        { id: "design-studio", name: "Design Studio", capabilities: ["design", "content-creation", "writing", "creative_writing", "content_generation"] },
        { id: "strategy-room", name: "Strategy Room", capabilities: ["strategy", "architecture", "planning"] },
        { id: "comms-center", name: "Comms Center", capabilities: ["communication", "security", "communicate", "discuss", "coordinate"] },
        { id: "break-room", name: "Break Room", capabilities: [] },
      ];

      const roomAgentCounts = FACTORY_ROOMS.map(room => {
        const matching = activeAgents.filter(a =>
          (a.capabilities || []).some(cap =>
            room.capabilities.some(rc => cap.toLowerCase().includes(rc))
          )
        );
        return {
          roomId: room.id,
          roomName: room.name,
          agentCount: matching.length,
          agentNames: matching.map(a => a.name),
          isCold: matching.length === 0 && room.id !== "break-room",
        };
      });

      const coldZones = roomAgentCounts.filter(r => r.isCold);

      const capabilityMap: Record<string, string[]> = {};
      activeAgents.forEach(a => {
        (a.capabilities || []).forEach(cap => {
          if (!capabilityMap[cap]) capabilityMap[cap] = [];
          capabilityMap[cap].push(a.name);
        });
      });

      const overloadedCaps = Object.entries(capabilityMap)
        .filter(([_, agents]) => agents.length > 3)
        .map(([cap, agents]) => ({ capability: cap, agentCount: agents.length, agents: agents }));

      const underservedCaps = Object.entries(capabilityMap)
        .filter(([_, agents]) => agents.length === 1)
        .map(([cap, agents]) => ({ capability: cap, agentCount: 1, agent: agents[0] }));

      const driftRisks: { agentName: string; issue: string; severity: "low" | "medium" | "high" }[] = [];

      activeAgents.forEach(a => {
        const caps = a.capabilities || [];
        if (caps.length === 0) {
          driftRisks.push({ agentName: a.name, issue: "No capabilities defined - cannot be assigned to any room", severity: "high" });
        }
        if (!a.isVerified && caps.length > 0) {
          driftRisks.push({ agentName: a.name, issue: "Active but unverified - identity not confirmed", severity: "medium" });
        }
        if (caps.length > 6) {
          driftRisks.push({ agentName: a.name, issue: `Too many capabilities (${caps.length}) - may lack focus`, severity: "low" });
        }
        const ws = workspaces.find(w => w.id === a.workspaceId);
        if (!ws) {
          driftRisks.push({ agentName: a.name, issue: "Assigned to non-existent department", severity: "high" });
        }
      });

      const pendingSteps: { lineName: string; stepOrder: number; room: string; status: string }[] = [];
      for (const line of assemblyLinesData) {
        const steps = await storage.getAssemblyLineSteps(line.id);
        steps.filter(s => s.status === "pending" || s.status === "in_progress").forEach(s => {
          pendingSteps.push({
            lineName: line.name,
            stepOrder: s.stepOrder,
            room: s.departmentRoom,
            status: s.status,
          });
        });
      }

      res.json({
        summary: {
          totalAgents: agents.length,
          activeAgents: activeAgents.length,
          inactiveAgents: inactiveAgents.length,
          departments: workspaces.length,
          assemblyLines: assemblyLinesData.length,
          activeLines: assemblyLinesData.filter(l => l.status === "active").length,
        },
        coldZones,
        roomActivity: roomAgentCounts,
        overloadedCapabilities: overloadedCaps,
        underservedCapabilities: underservedCaps,
        driftRisks,
        pendingAssemblySteps: pendingSteps,
      });
    } catch (error) {
      console.error("Error fetching factory health:", error);
      res.status(500).json({ message: "Failed to fetch factory health" });
    }
  });

  app.post("/api/factory/assign", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const body = req.body ?? {};
      const { agentId, assemblyLineId, stepId, action } = body;

      if (!agentId || !action) {
        return res.status(400).json({ message: "agentId and action are required" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      switch (action) {
        case "activate": {
          const updated = await storage.updateAgent(agentId, { isActive: true });
          res.json({ message: `${agent.name} activated`, agent: updated });
          break;
        }
        case "deactivate": {
          const updated = await storage.updateAgent(agentId, { isActive: false });
          res.json({ message: `${agent.name} deactivated`, agent: updated });
          break;
        }
        case "assign-step": {
          if (!stepId) return res.status(400).json({ message: "stepId required for assign-step" });
          const step = await storage.updateAssemblyLineStep(stepId, { assignedAgentId: agentId, status: "in_progress" });
          res.json({ message: `${agent.name} assigned to step`, step });
          break;
        }
        case "move-department": {
          const { workspaceId } = body;
          if (!workspaceId) return res.status(400).json({ message: "workspaceId required for move-department" });
          const updated = await storage.updateAgent(agentId, { workspaceId });
          const ws = await storage.getWorkspace(workspaceId);
          res.json({ message: `${agent.name} moved to ${ws?.name || workspaceId}`, agent: updated });
          break;
        }
        default:
          res.status(400).json({ message: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error("Error in factory assign:", error);
      res.status(500).json({ message: "Failed to process assignment" });
    }
  });

  app.post("/api/command-chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, history, factoryContext, uploadedFiles } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      const agents = await storage.getAgentsByUser(userId);
      const workspaces = await storage.getWorkspacesByUser(userId);
      const assemblyLinesData = await storage.getAssemblyLinesByUser(userId);

      const agentList = agents.map(a => `- ${a.name} [id:${a.id}] (${(a.capabilities || []).join(", ")}) [${a.isActive ? "active" : "inactive"}] [${a.isVerified ? "verified" : "unverified"}] workspace: ${workspaces.find(w => w.id === a.workspaceId)?.name || a.workspaceId}`).join("\n");
      const deptList = workspaces.map(w => `- ${w.name} [id:${w.id}] (/${w.slug}) - ${w.description || "No description"}`).join("\n");

      const FACTORY_ROOMS = [
        { id: "research-lab", name: "Research Lab", capabilities: ["research", "analysis"] },
        { id: "code-workshop", name: "Code Workshop", capabilities: ["code-review", "engineering", "testing", "coding", "debugging"] },
        { id: "design-studio", name: "Design Studio", capabilities: ["design", "content-creation", "writing", "creative_writing", "content_generation"] },
        { id: "strategy-room", name: "Strategy Room", capabilities: ["strategy", "architecture", "planning"] },
        { id: "comms-center", name: "Comms Center", capabilities: ["communication", "security", "communicate", "discuss", "coordinate"] },
        { id: "break-room", name: "Break Room", capabilities: [] },
      ];

      const activeAgents = agents.filter(a => a.isActive);
      const roomCoverage = FACTORY_ROOMS.map(room => {
        const matching = activeAgents.filter(a =>
          (a.capabilities || []).some(cap =>
            room.capabilities.some(rc => cap.toLowerCase().includes(rc))
          )
        );
        return `${room.name}: ${matching.length > 0 ? matching.map(a => a.name).join(", ") : "COLD ZONE - no agents"}`;
      }).join("\n");

      const driftIssues: string[] = [];
      activeAgents.forEach(a => {
        const caps = a.capabilities || [];
        if (caps.length === 0) driftIssues.push(`${a.name}: No capabilities - cannot route to rooms`);
        if (!a.isVerified) driftIssues.push(`${a.name}: Unverified identity`);
        if (caps.length > 6) driftIssues.push(`${a.name}: ${caps.length} capabilities - may lack focus`);
      });

      let assemblyLineContext = "";
      if (assemblyLinesData.length > 0) {
        const lineDetails = [];
        for (const line of assemblyLinesData.slice(0, 5)) {
          const steps = await storage.getAssemblyLineSteps(line.id);
          const pendingCount = steps.filter(s => s.status === "pending").length;
          const inProgressCount = steps.filter(s => s.status === "in_progress").length;
          const completedCount = steps.filter(s => s.status === "completed").length;
          const unassigned = steps.filter(s => !s.assignedAgentId).length;
          lineDetails.push(`- ${line.name} [id:${line.id}] [${line.status}] Steps: ${completedCount} done, ${inProgressCount} in-progress, ${pendingCount} pending, ${unassigned} unassigned`);
        }
        assemblyLineContext = `\n\nAssembly Lines:\n${lineDetails.join("\n")}`;
      }

      let fileContext = "";
      if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
        fileContext = "\n\nUser uploaded files:\n" + uploadedFiles.map((f: any) =>
          `- ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB)${f.preview ? `\nContent preview:\n${f.preview}` : ""}`
        ).join("\n");
      }

      const systemPrompt = `You are Creative Intelligence — the Factory Operations AI for CB | CREATIVES. You are the chief operations officer of this agent factory. Your primary responsibilities are:

1. AGENT ASSIGNMENT - Assign agents to rooms, assembly line steps, and departments based on their capabilities
2. COLD ZONE MONITORING - Detect rooms with no agents and recommend coverage
3. QUALITY & DRIFT DETECTION - Identify agents that may be drifting from their assignment, lacking focus, or having capability mismatches
4. OPERATIONS MANAGEMENT - Ensure all assembly lines are progressing, all departments are covered, and agents are productive

FORMATTING RULES:
- Write in plain text for your conversational responses.
- Use simple dashes (-) for bullet points.
- Use numbered lists (1. 2. 3.) for sequential steps.
- Separate sections with blank lines for readability.
- Keep responses concise and scannable.
- Do NOT use markdown formatting like **bold**, *italic*, or ## headings in your text.

ASSIGNMENT ACTIONS:
When the user asks you to assign, reassign, activate, or deactivate agents, include an :::action: line in your response. The user's frontend will execute these actions automatically.

Available actions:
:::action:{"type":"assign-step","agentId":"<agent-id>","stepId":"<step-id>"}
:::action:{"type":"activate","agentId":"<agent-id>"}
:::action:{"type":"deactivate","agentId":"<agent-id>"}
:::action:{"type":"move-department","agentId":"<agent-id>","workspaceId":"<workspace-id>"}

Rules for actions:
- Always confirm what you're doing before issuing an action
- Use the actual agent IDs and step IDs from the data provided
- You can issue MULTIPLE actions in one response
- Each :::action: must be on its own line with the full JSON on the same line

DISPLAY CONTAINERS:
You can create visual display containers to show structured data. To open a container, include a line in your response that starts with :::display: followed by a JSON object on the SAME line. Each container appears as a visual panel the user can see.

Available container types and their JSON format:

1. Table - show structured data:
:::display:{"type":"table","title":"Title Here","headers":["Col1","Col2"],"rows":[["val1","val2"],["val3","val4"]]}

2. Summary - show organized information with sections:
:::display:{"type":"summary","title":"Title Here","sections":[{"heading":"Section 1","content":"Details here"},{"heading":"Section 2","content":"More details"}]}

3. Image - show an uploaded image:
:::display:{"type":"image","title":"Image Title","src":"/api/command-chat/uploads/filename","alt":"description"}

4. Video - embed a YouTube video:
:::display:{"type":"video","title":"Video Title","url":"https://www.youtube.com/watch?v=ID"}

5. Code - show code or technical content:
:::display:{"type":"code","title":"Title","language":"javascript","code":"const x = 1;"}

6. List - show a structured list with items:
:::display:{"type":"list","title":"Title","items":[{"label":"Item 1","detail":"Description","status":"active"},{"label":"Item 2","detail":"Description","status":"inactive"}]}

7. Metrics - show key numbers/stats:
:::display:{"type":"metrics","title":"Title","metrics":[{"label":"Total Agents","value":"21","change":"+3"},{"label":"Active","value":"18"}]}

RULES FOR DISPLAY CONTAINERS:
- You can open MULTIPLE containers in a single response to show different perspectives.
- Always include a brief text explanation BEFORE or AFTER the container.
- Use containers when data is best shown visually (tables, stats, comparisons).
- When the user asks about status, metrics, or comparisons, prefer containers over plain text.
- When the user uploads a file, use containers to display/analyze its contents.
- The :::display: line must be on its own line, with the full JSON on the same line.

PROACTIVE MONITORING:
When asked about factory health, cold zones, or quality, proactively analyze and report:
- Which rooms are "cold" (no agents with matching capabilities)
- Which agents might be drifting (wrong room for their skills, too many/few capabilities)
- Which assembly line steps are stalled (pending without assigned agents)
- Which capabilities are overloaded or underserved

Current Factory State:

Departments:
${deptList || "No departments yet"}

Agents:
${agentList || "No agents registered"}

Room Coverage (based on agent capabilities):
${roomCoverage}

${driftIssues.length > 0 ? `Quality & Drift Alerts:\n${driftIssues.map(d => `- ${d}`).join("\n")}` : "No drift issues detected."}
${assemblyLineContext}

${factoryContext ? `Factory 3D View: ${factoryContext}` : ""}
${fileContext}

Platform Architecture & Documentation:
${architectureDoc}

You can help with:
- Assigning agents to assembly line steps, rooms, and departments
- Monitoring cold zones and recommending agent redistribution
- Detecting quality drift and capability mismatches
- Activating/deactivating agents
- Planning agent workflows and operations
- Suggesting department configurations
- Creating tool specifications for agents
- Analyzing factory performance
- Answering questions about agent capabilities, platform features, and system architecture

Be proactive about identifying problems. When you see cold zones or drift, mention them even if not asked. Be concise and actionable.`;

      const chatMessages: { role: "user" | "assistant" | "system"; content: string }[] = [
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

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await commandChatOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: true,
        max_tokens: 2048,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
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

  // === Discussion Topics & Message Boards ===
  
  app.get("/api/workspaces/:workspaceId/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { workspaceId } = req.params;
      const access = await checkWorkspaceAccess(userId, workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });
      const topics = await storage.getTopicsByWorkspace(workspaceId);
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  app.post("/api/workspaces/:workspaceId/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { workspaceId } = req.params;
      const access = await checkWorkspaceAccess(userId, workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const schema = z.object({
        title: z.string().min(1).max(200),
        body: z.string().optional(),
        authorAgentId: z.string().optional().nullable(),
      });
      const validation = schema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });

      const topic = await storage.createTopic({
        workspaceId,
        title: validation.data.title,
        body: validation.data.body || null,
        authorId: userId,
        authorAgentId: validation.data.authorAgentId || null,
      });
      res.status(201).json(topic);
    } catch (error) {
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.patch("/api/topics/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topic = await storage.getTopic(req.params.id);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const memberAccess = await checkWorkspaceAccess(userId, topic.workspaceId);
      if (!memberAccess.hasAccess) return res.status(403).json({ message: "Access denied" });
      const adminAccess = await checkWorkspaceAccess(userId, topic.workspaceId, ["owner", "admin"]);
      if (!adminAccess.hasAccess && topic.authorId !== userId) return res.status(403).json({ message: "Access denied" });

      const schema = z.object({
        title: z.string().min(1).max(200).optional(),
        body: z.string().optional().nullable(),
        isPinned: z.boolean().optional(),
        isClosed: z.boolean().optional(),
      });
      const validation = schema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ message: "Validation error" });

      const updated = await storage.updateTopic(req.params.id, validation.data);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update topic" });
    }
  });

  app.delete("/api/topics/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topic = await storage.getTopic(req.params.id);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const memberAccess = await checkWorkspaceAccess(userId, topic.workspaceId);
      if (!memberAccess.hasAccess) return res.status(403).json({ message: "Access denied" });
      const adminAccess = await checkWorkspaceAccess(userId, topic.workspaceId, ["owner", "admin"]);
      if (!adminAccess.hasAccess && topic.authorId !== userId) return res.status(403).json({ message: "Access denied" });
      await storage.deleteTopic(req.params.id);
      res.json({ message: "Topic deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete topic" });
    }
  });

  app.get("/api/topics/:topicId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topic = await storage.getTopic(req.params.topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const access = await checkWorkspaceAccess(userId, topic.workspaceId);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });
      const messages = await storage.getMessagesByTopic(req.params.topicId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/topics/:topicId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topic = await storage.getTopic(req.params.topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      if (topic.isClosed) return res.status(400).json({ message: "Topic is closed" });
      const access = await checkWorkspaceAccess(userId, topic.workspaceId, ["owner", "admin", "member"]);
      if (!access.hasAccess) return res.status(403).json({ message: "Access denied" });

      const schema = z.object({
        content: z.string().min(1),
        authorAgentId: z.string().optional().nullable(),
      });
      const validation = schema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ message: "Validation error" });

      const message = await storage.createMessage({
        topicId: req.params.topicId,
        content: validation.data.content,
        authorId: userId,
        authorAgentId: validation.data.authorAgentId || null,
      });
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.delete("/api/messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteMessage(req.params.id);
      res.json({ message: "Message deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // GET all topics across all user's workspaces
  app.get("/api/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workspaces = await storage.getWorkspacesByUser(userId);
      const allTopics: any[] = [];
      for (const ws of workspaces) {
        const topics = await storage.getTopicsByWorkspace(ws.id);
        allTopics.push(...topics.map(t => ({ ...t, workspaceName: ws.name })));
      }
      allTopics.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      res.json(allTopics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  return httpServer;
}
