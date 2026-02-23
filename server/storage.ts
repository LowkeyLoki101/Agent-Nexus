import {
  workspaces,
  workspaceMembers,
  agents,
  apiTokens,
  auditLogs,
  briefings,
  gifts,
  giftComments,
  assemblyLines,
  assemblyLineSteps,
  products,
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
  type Gift,
  type InsertGift,
  type GiftComment,
  type InsertGiftComment,
  type AssemblyLine,
  type InsertAssemblyLine,
  type AssemblyLineStep,
  type InsertAssemblyLineStep,
  type Product,
  type InsertProduct,
  agentNotes,
  agentFileDrafts,
  type AgentNote,
  type InsertAgentNote,
  type AgentFileDraft,
  type InsertAgentFileDraft,
  discussionTopics,
  discussionMessages,
  type DiscussionTopic,
  type InsertDiscussionTopic,
  type DiscussionMessage,
  type InsertDiscussionMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
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

  getGift(id: string): Promise<Gift | undefined>;
  getGiftsByUser(userId: string): Promise<Gift[]>;
  getGiftsByAgent(agentId: string): Promise<Gift[]>;
  getRecentGifts(limit?: number): Promise<Gift[]>;
  createGift(gift: InsertGift): Promise<Gift>;
  updateGift(id: string, updates: Partial<InsertGift>): Promise<Gift | undefined>;
  deleteGift(id: string): Promise<void>;
  likeGift(id: string): Promise<void>;

  getGiftComments(giftId: string): Promise<GiftComment[]>;
  createGiftComment(comment: InsertGiftComment): Promise<GiftComment>;

  getAssemblyLine(id: string): Promise<AssemblyLine | undefined>;
  getAssemblyLinesByUser(userId: string): Promise<AssemblyLine[]>;
  createAssemblyLine(line: InsertAssemblyLine): Promise<AssemblyLine>;
  updateAssemblyLine(id: string, updates: Partial<InsertAssemblyLine>): Promise<AssemblyLine | undefined>;
  deleteAssemblyLine(id: string): Promise<void>;

  getAssemblyLineSteps(assemblyLineId: string): Promise<AssemblyLineStep[]>;
  getAssemblyLineStepById(id: string): Promise<AssemblyLineStep | undefined>;
  createAssemblyLineStep(step: InsertAssemblyLineStep): Promise<AssemblyLineStep>;
  updateAssemblyLineStep(id: string, updates: Partial<InsertAssemblyLineStep>): Promise<AssemblyLineStep | undefined>;

  getProduct(id: string): Promise<Product | undefined>;
  getProductsByUser(userId: string): Promise<Product[]>;
  getProductsByAssemblyLine(assemblyLineId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined>;

  getAgentNotes(agentId?: string): Promise<AgentNote[]>;
  getAgentNote(id: string): Promise<AgentNote | undefined>;
  createAgentNote(note: InsertAgentNote): Promise<AgentNote>;
  updateAgentNote(id: string, updates: Partial<InsertAgentNote>): Promise<AgentNote | undefined>;
  deleteAgentNote(id: string): Promise<void>;

  getAgentFileDrafts(status?: string): Promise<AgentFileDraft[]>;
  getAgentFileDraft(id: string): Promise<AgentFileDraft | undefined>;
  getAgentFileDraftsByAgent(agentId: string): Promise<AgentFileDraft[]>;
  createAgentFileDraft(draft: InsertAgentFileDraft): Promise<AgentFileDraft>;
  updateAgentFileDraft(id: string, updates: Partial<InsertAgentFileDraft>): Promise<AgentFileDraft | undefined>;
  deleteAgentFileDraft(id: string): Promise<void>;

  getTopicsByWorkspace(workspaceId: string): Promise<DiscussionTopic[]>;
  getTopic(id: string): Promise<DiscussionTopic | undefined>;
  createTopic(data: InsertDiscussionTopic): Promise<DiscussionTopic>;
  updateTopic(id: string, data: Partial<InsertDiscussionTopic>): Promise<DiscussionTopic | undefined>;
  deleteTopic(id: string): Promise<void>;
  getMessagesByTopic(topicId: string): Promise<DiscussionMessage[]>;
  createMessage(data: InsertDiscussionMessage): Promise<DiscussionMessage>;
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

  async getGift(id: string): Promise<Gift | undefined> {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id));
    return gift;
  }

  async getGiftsByUser(userId: string): Promise<Gift[]> {
    const userAgents = await db.select().from(agents).where(eq(agents.createdById, userId));
    if (userAgents.length === 0) return [];
    const agentIds = userAgents.map(a => a.id);
    return db.select().from(gifts).where(inArray(gifts.agentId, agentIds)).orderBy(desc(gifts.createdAt));
  }

  async getGiftsByAgent(agentId: string): Promise<Gift[]> {
    return db.select().from(gifts).where(eq(gifts.agentId, agentId)).orderBy(desc(gifts.createdAt));
  }

  async getRecentGifts(limit = 20): Promise<Gift[]> {
    return db.select().from(gifts).orderBy(desc(gifts.createdAt)).limit(limit);
  }

  async createGift(gift: InsertGift): Promise<Gift> {
    const [created] = await db.insert(gifts).values(gift).returning();
    return created;
  }

  async updateGift(id: string, updates: Partial<InsertGift>): Promise<Gift | undefined> {
    const [updated] = await db.update(gifts).set({ ...updates, updatedAt: new Date() }).where(eq(gifts.id, id)).returning();
    return updated;
  }

  async deleteGift(id: string): Promise<void> {
    await db.delete(gifts).where(eq(gifts.id, id));
  }

  async likeGift(id: string): Promise<void> {
    await db.update(gifts).set({ likes: sql`COALESCE(${gifts.likes}, 0) + 1` }).where(eq(gifts.id, id));
  }

  async getGiftComments(giftId: string): Promise<GiftComment[]> {
    return db.select().from(giftComments).where(eq(giftComments.giftId, giftId)).orderBy(asc(giftComments.createdAt));
  }

  async createGiftComment(comment: InsertGiftComment): Promise<GiftComment> {
    const [created] = await db.insert(giftComments).values(comment).returning();
    return created;
  }

  async getAssemblyLine(id: string): Promise<AssemblyLine | undefined> {
    const [line] = await db.select().from(assemblyLines).where(eq(assemblyLines.id, id));
    return line;
  }

  async getAssemblyLinesByUser(userId: string): Promise<AssemblyLine[]> {
    return db.select().from(assemblyLines).where(eq(assemblyLines.ownerId, userId)).orderBy(desc(assemblyLines.createdAt));
  }

  async createAssemblyLine(line: InsertAssemblyLine): Promise<AssemblyLine> {
    const [created] = await db.insert(assemblyLines).values(line).returning();
    return created;
  }

  async updateAssemblyLine(id: string, updates: Partial<InsertAssemblyLine>): Promise<AssemblyLine | undefined> {
    const [updated] = await db.update(assemblyLines).set({ ...updates, updatedAt: new Date() }).where(eq(assemblyLines.id, id)).returning();
    return updated;
  }

  async deleteAssemblyLine(id: string): Promise<void> {
    await db.delete(assemblyLines).where(eq(assemblyLines.id, id));
  }

  async getAssemblyLineSteps(assemblyLineId: string): Promise<AssemblyLineStep[]> {
    return db.select().from(assemblyLineSteps).where(eq(assemblyLineSteps.assemblyLineId, assemblyLineId)).orderBy(asc(assemblyLineSteps.stepOrder));
  }

  async getAssemblyLineStepById(id: string): Promise<AssemblyLineStep | undefined> {
    const [step] = await db.select().from(assemblyLineSteps).where(eq(assemblyLineSteps.id, id));
    return step;
  }

  async createAssemblyLineStep(step: InsertAssemblyLineStep): Promise<AssemblyLineStep> {
    const [created] = await db.insert(assemblyLineSteps).values(step).returning();
    return created;
  }

  async updateAssemblyLineStep(id: string, updates: Partial<InsertAssemblyLineStep>): Promise<AssemblyLineStep | undefined> {
    const [updated] = await db.update(assemblyLineSteps).set(updates).where(eq(assemblyLineSteps.id, id)).returning();
    return updated;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductsByUser(userId: string): Promise<Product[]> {
    return db.select().from(products).where(eq(products.ownerId, userId)).orderBy(desc(products.createdAt));
  }

  async getProductsByAssemblyLine(assemblyLineId: string): Promise<Product[]> {
    return db.select().from(products).where(eq(products.assemblyLineId, assemblyLineId)).orderBy(desc(products.createdAt));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return updated;
  }

  async getAgentNotes(agentId?: string): Promise<AgentNote[]> {
    if (agentId) {
      return db.select().from(agentNotes).where(eq(agentNotes.agentId, agentId)).orderBy(desc(agentNotes.updatedAt));
    }
    return db.select().from(agentNotes).orderBy(desc(agentNotes.updatedAt));
  }

  async getAgentNote(id: string): Promise<AgentNote | undefined> {
    const [note] = await db.select().from(agentNotes).where(eq(agentNotes.id, id));
    return note;
  }

  async createAgentNote(note: InsertAgentNote): Promise<AgentNote> {
    const [created] = await db.insert(agentNotes).values(note).returning();
    return created;
  }

  async updateAgentNote(id: string, updates: Partial<InsertAgentNote>): Promise<AgentNote | undefined> {
    const [updated] = await db.update(agentNotes).set({ ...updates, updatedAt: new Date() }).where(eq(agentNotes.id, id)).returning();
    return updated;
  }

  async deleteAgentNote(id: string): Promise<void> {
    await db.delete(agentNotes).where(eq(agentNotes.id, id));
  }

  async getAgentFileDrafts(status?: string): Promise<AgentFileDraft[]> {
    if (status) {
      return db.select().from(agentFileDrafts).where(eq(agentFileDrafts.status, status as any)).orderBy(desc(agentFileDrafts.updatedAt));
    }
    return db.select().from(agentFileDrafts).orderBy(desc(agentFileDrafts.updatedAt));
  }

  async getAgentFileDraft(id: string): Promise<AgentFileDraft | undefined> {
    const [draft] = await db.select().from(agentFileDrafts).where(eq(agentFileDrafts.id, id));
    return draft;
  }

  async getAgentFileDraftsByAgent(agentId: string): Promise<AgentFileDraft[]> {
    return db.select().from(agentFileDrafts).where(eq(agentFileDrafts.agentId, agentId)).orderBy(desc(agentFileDrafts.updatedAt));
  }

  async createAgentFileDraft(draft: InsertAgentFileDraft): Promise<AgentFileDraft> {
    const [created] = await db.insert(agentFileDrafts).values(draft).returning();
    return created;
  }

  async updateAgentFileDraft(id: string, updates: Partial<InsertAgentFileDraft>): Promise<AgentFileDraft | undefined> {
    const [updated] = await db.update(agentFileDrafts).set({ ...updates, updatedAt: new Date() }).where(eq(agentFileDrafts.id, id)).returning();
    return updated;
  }

  async deleteAgentFileDraft(id: string): Promise<void> {
    await db.delete(agentFileDrafts).where(eq(agentFileDrafts.id, id));
  }

  async getTopicsByWorkspace(workspaceId: string): Promise<DiscussionTopic[]> {
    return db.select().from(discussionTopics).where(eq(discussionTopics.workspaceId, workspaceId)).orderBy(desc(discussionTopics.isPinned), desc(discussionTopics.createdAt));
  }

  async getTopic(id: string): Promise<DiscussionTopic | undefined> {
    const [topic] = await db.select().from(discussionTopics).where(eq(discussionTopics.id, id));
    return topic;
  }

  async createTopic(data: InsertDiscussionTopic): Promise<DiscussionTopic> {
    const [topic] = await db.insert(discussionTopics).values(data).returning();
    return topic;
  }

  async updateTopic(id: string, data: Partial<InsertDiscussionTopic>): Promise<DiscussionTopic | undefined> {
    const [topic] = await db.update(discussionTopics).set({ ...data, updatedAt: new Date() }).where(eq(discussionTopics.id, id)).returning();
    return topic;
  }

  async deleteTopic(id: string): Promise<void> {
    await db.delete(discussionTopics).where(eq(discussionTopics.id, id));
  }

  async getMessagesByTopic(topicId: string): Promise<DiscussionMessage[]> {
    return db.select().from(discussionMessages).where(eq(discussionMessages.topicId, topicId)).orderBy(asc(discussionMessages.createdAt));
  }

  async createMessage(data: InsertDiscussionMessage): Promise<DiscussionMessage> {
    const [message] = await db.insert(discussionMessages).values(data).returning();
    return message;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(discussionMessages).where(eq(discussionMessages.id, id));
  }
}

export const storage = new DatabaseStorage();
