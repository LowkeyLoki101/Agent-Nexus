import {
  workspaces,
  workspaceMembers,
  agents,
  apiTokens,
  auditLogs,
  briefings,
  conversations,
  messages,
  type Workspace,
  type InsertWorkspace,
  type WorkspaceMember,
  type InsertWorkspaceMember,
  type Agent,
  type InsertAgent,
  type ApiToken,
  type InsertApiToken,
  type AuditLog,
  type InsertAuditLog,
  type Briefing,
  type InsertBriefing,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

export interface IStorage {
  getWorkspace(id: string): Promise<Workspace | undefined>;
  getWorkspaceBySlug(slug: string): Promise<Workspace | undefined>;
  getWorkspacesByUser(userId: string): Promise<Workspace[]>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: string, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  
  getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  addWorkspaceMember(member: InsertWorkspaceMember): Promise<WorkspaceMember>;
  removeWorkspaceMember(id: string): Promise<void>;
  updateMemberRole(id: string, role: string): Promise<WorkspaceMember | undefined>;
  
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentsByWorkspace(workspaceId: string): Promise<Agent[]>;
  getAgentsByUser(userId: string): Promise<Agent[]>;
  getRecentAgents(userId: string, limit?: number): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<void>;
  
  getApiToken(id: string): Promise<ApiToken | undefined>;
  getApiTokensByWorkspace(workspaceId: string): Promise<ApiToken[]>;
  getApiTokensByUser(userId: string): Promise<ApiToken[]>;
  createApiToken(token: InsertApiToken): Promise<{ token: ApiToken; plainToken: string }>;
  revokeApiToken(id: string): Promise<void>;
  incrementTokenUsage(id: string): Promise<void>;
  
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByWorkspace(workspaceId: string, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]>;
  getRecentAuditLogs(userId: string, limit?: number): Promise<AuditLog[]>;

  getBriefing(id: string): Promise<Briefing | undefined>;
  getBriefingsByWorkspace(workspaceId: string): Promise<Briefing[]>;
  getBriefingsByUser(userId: string): Promise<Briefing[]>;
  getRecentBriefings(userId: string, limit?: number): Promise<Briefing[]>;
  createBriefing(briefing: InsertBriefing): Promise<Briefing>;
  updateBriefing(id: string, updates: Partial<InsertBriefing>): Promise<Briefing | undefined>;
  deleteBriefing(id: string): Promise<void>;

  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsByWorkspace(workspaceId: string): Promise<Conversation[]>;
  getConversationsByUser(userId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<void>;

  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async getWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
    return workspace;
  }

  async getWorkspacesByUser(userId: string): Promise<Workspace[]> {
    return db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const [created] = await db.insert(workspaces).values(workspace).returning();
    return created;
  }

  async updateWorkspace(id: string, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const [updated] = await db
      .update(workspaces)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async addWorkspaceMember(member: InsertWorkspaceMember): Promise<WorkspaceMember> {
    const [created] = await db.insert(workspaceMembers).values(member).returning();
    return created;
  }

  async removeWorkspaceMember(id: string): Promise<void> {
    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));
  }

  async updateMemberRole(id: string, role: string): Promise<WorkspaceMember | undefined> {
    const [updated] = await db
      .update(workspaceMembers)
      .set({ role: role as any })
      .where(eq(workspaceMembers.id, id))
      .returning();
    return updated;
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async getAgentsByWorkspace(workspaceId: string): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.workspaceId, workspaceId));
  }

  async getAgentsByUser(userId: string): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.createdById, userId));
  }

  async getRecentAgents(userId: string, limit = 10): Promise<Agent[]> {
    return db
      .select()
      .from(agents)
      .where(eq(agents.createdById, userId))
      .orderBy(desc(agents.createdAt))
      .limit(limit);
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: string, updates: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [updated] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async deleteAgent(id: string): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }

  async getApiToken(id: string): Promise<ApiToken | undefined> {
    const [token] = await db.select().from(apiTokens).where(eq(apiTokens.id, id));
    return token;
  }

  async getApiTokensByWorkspace(workspaceId: string): Promise<ApiToken[]> {
    return db.select().from(apiTokens).where(eq(apiTokens.workspaceId, workspaceId));
  }

  async getApiTokensByUser(userId: string): Promise<ApiToken[]> {
    return db.select().from(apiTokens).where(eq(apiTokens.createdById, userId));
  }

  async createApiToken(tokenData: InsertApiToken): Promise<{ token: ApiToken; plainToken: string }> {
    const plainToken = `ahub_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const tokenPrefix = plainToken.slice(0, 12);

    const [created] = await db
      .insert(apiTokens)
      .values({
        ...tokenData,
        tokenHash,
        tokenPrefix,
      })
      .returning();

    return { token: created, plainToken };
  }

  async revokeApiToken(id: string): Promise<void> {
    await db
      .update(apiTokens)
      .set({ status: 'revoked' })
      .where(eq(apiTokens.id, id));
  }

  async incrementTokenUsage(id: string): Promise<void> {
    const token = await this.getApiToken(id);
    if (token) {
      await db
        .update(apiTokens)
        .set({ 
          usageCount: (token.usageCount || 0) + 1,
          lastUsedAt: new Date()
        })
        .where(eq(apiTokens.id, id));
    }
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogsByWorkspace(workspaceId: string, limit = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.workspaceId, workspaceId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAuditLogsByUser(userId: string, limit = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getRecentAuditLogs(userId: string, limit = 10): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getBriefing(id: string): Promise<Briefing | undefined> {
    const [briefing] = await db.select().from(briefings).where(eq(briefings.id, id));
    return briefing;
  }

  async getBriefingsByWorkspace(workspaceId: string): Promise<Briefing[]> {
    return db
      .select()
      .from(briefings)
      .where(eq(briefings.workspaceId, workspaceId))
      .orderBy(desc(briefings.createdAt));
  }

  async getBriefingsByUser(userId: string): Promise<Briefing[]> {
    return db
      .select()
      .from(briefings)
      .where(eq(briefings.createdById, userId))
      .orderBy(desc(briefings.createdAt));
  }

  async getRecentBriefings(userId: string, limit = 10): Promise<Briefing[]> {
    return db
      .select()
      .from(briefings)
      .where(eq(briefings.createdById, userId))
      .orderBy(desc(briefings.createdAt))
      .limit(limit);
  }

  async createBriefing(briefing: InsertBriefing): Promise<Briefing> {
    const [created] = await db.insert(briefings).values(briefing).returning();
    return created;
  }

  async updateBriefing(id: string, updates: Partial<InsertBriefing>): Promise<Briefing | undefined> {
    const [updated] = await db
      .update(briefings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(briefings.id, id))
      .returning();
    return updated;
  }

  async deleteBriefing(id: string): Promise<void> {
    await db.delete(briefings).where(eq(briefings.id, id));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getConversationsByWorkspace(workspaceId: string): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.workspaceId, workspaceId))
      .orderBy(desc(conversations.createdAt));
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.createdById, userId))
      .orderBy(desc(conversations.createdAt));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(conversations).values(conversation).returning();
    return created;
  }

  async updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async deleteConversation(id: string): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }
}

export const storage = new DatabaseStorage();
