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
  agentDiaryEntries,
  agentMemory,
  agentProfiles,
  discussionTopics,
  discussionReplies,
  discussionMessages,
  agentNotes,
  agentFileDrafts,
  ebooks,
  ebookPurchases,
  bookRequests,
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
  type DiaryEntry,
  type InsertDiaryEntry,
  type AgentMemoryRecord,
  type InsertAgentMemory,
  type AgentProfile,
  type InsertAgentProfile,
  type DiscussionTopic,
  type InsertDiscussionTopic,
  type DiscussionReply,
  type InsertDiscussionReply,
  type DiscussionMessage,
  type InsertDiscussionMessage,
  type AgentNote,
  type InsertAgentNote,
  type AgentFileDraft,
  type InsertAgentFileDraft,
  type Ebook,
  type InsertEbook,
  type EbookPurchase,
  type InsertEbookPurchase,
  type BookRequest,
  type InsertBookRequest,
  messageReactions,
  type MessageReaction,
  type InsertMessageReaction,
  chronicleEntries,
  type ChronicleEntry,
  type InsertChronicleEntry,
  intercomAnnouncements,
  type IntercomAnnouncement,
  type InsertIntercomAnnouncement,
  storefrontListings,
  storefrontAnalytics,
  storefrontPurchases,
  factorySettings,
  priceAdjustments,
  tokenUsageLogs,
  userSettings,
  type StorefrontListing,
  type InsertStorefrontListing,
  type StorefrontAnalyticsEvent,
  type InsertStorefrontAnalyticsEvent,
  type StorefrontPurchase,
  type InsertStorefrontPurchase,
  type FactorySettings,
  type InsertFactorySettings,
  type PriceAdjustment,
  type InsertPriceAdjustment,
  type TokenUsageLog,
  type InsertTokenUsageLog,
  type UserSettingsRecord,
  type InsertUserSettings,
} from "@shared/schema";
import { users, type User, type UpsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql, inArray } from "drizzle-orm";
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
  getAllBriefings(): Promise<Briefing[]>;
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

  createDiaryEntry(entry: InsertDiaryEntry): Promise<DiaryEntry>;
  getDiaryEntries(agentId: string, limit?: number): Promise<DiaryEntry[]>;
  getDiaryEntriesByType(agentId: string, entryType: string): Promise<DiaryEntry[]>;

  getAgentMemory(agentId: string): Promise<AgentMemoryRecord | undefined>;
  upsertAgentMemory(agentId: string, summary: string): Promise<AgentMemoryRecord>;

  getAgentProfile(agentId: string, subjectId: string): Promise<AgentProfile | undefined>;
  upsertAgentProfile(data: { agentId: string; subjectId: string; subjectName: string; subjectType: "human" | "agent"; notes: string }): Promise<AgentProfile>;
  getAgentProfiles(agentId: string): Promise<AgentProfile[]>;

  getAllAgents(): Promise<Agent[]>;

  createDiscussionTopic(topic: InsertDiscussionTopic): Promise<DiscussionTopic>;
  getDiscussionTopics(limit?: number): Promise<DiscussionTopic[]>;
  getDiscussionTopic(id: string): Promise<DiscussionTopic | undefined>;
  createDiscussionReply(reply: InsertDiscussionReply): Promise<DiscussionReply>;
  getDiscussionReplies(topicId: string): Promise<DiscussionReply[]>;

  getMessageReactions(messageId: string): Promise<MessageReaction[]>;
  getReactionsByMessages(messageIds: string[]): Promise<MessageReaction[]>;
  toggleReaction(messageId: string, userId: string, reactionType: string): Promise<{ added: boolean }>;

  createChronicleEntry(entry: InsertChronicleEntry): Promise<ChronicleEntry>;
  getChronicleEntries(limit?: number): Promise<ChronicleEntry[]>;
  getChronicleByChapter(chapter: string): Promise<ChronicleEntry[]>;
  getCanonicalChronicle(): Promise<ChronicleEntry[]>;
  searchChronicle(query: string): Promise<ChronicleEntry[]>;
  getChronicleCompressed(): Promise<string>;

  createIntercomAnnouncement(announcement: InsertIntercomAnnouncement): Promise<IntercomAnnouncement>;
  getRecentAnnouncements(limit?: number): Promise<IntercomAnnouncement[]>;
  getActiveAnnouncements(): Promise<IntercomAnnouncement[]>;

  createStorefrontListing(listing: InsertStorefrontListing): Promise<StorefrontListing>;
  updateStorefrontListing(id: string, updates: Partial<InsertStorefrontListing>): Promise<StorefrontListing | undefined>;
  getStorefrontListingBySlug(slug: string): Promise<StorefrontListing | undefined>;
  getStorefrontListingById(id: string): Promise<StorefrontListing | undefined>;
  getStorefrontListingsByOwner(ownerId: string): Promise<StorefrontListing[]>;
  getStorefrontListingsByAgent(agentId: string): Promise<StorefrontListing[]>;
  getPublishedStorefrontListings(limit?: number, offset?: number): Promise<StorefrontListing[]>;
  deleteStorefrontListing(id: string): Promise<void>;

  recordStorefrontAnalyticsEvent(event: InsertStorefrontAnalyticsEvent): Promise<StorefrontAnalyticsEvent>;
  getStorefrontListingAnalytics(listingId: string): Promise<StorefrontAnalyticsEvent[]>;
  getStorefrontAnalyticsSummary(listingId: string): Promise<{ totalViews: number; uniqueVisitors: number; buyClicks: number; purchases: number; conversionRate: number; revenue: number }>;

  createStorefrontPurchase(purchase: InsertStorefrontPurchase): Promise<StorefrontPurchase>;
  updateStorefrontPurchaseStatus(id: string, status: string): Promise<StorefrontPurchase | undefined>;
  getStorefrontPurchasesByListing(listingId: string): Promise<StorefrontPurchase[]>;
  getStorefrontPurchaseByAccessToken(token: string): Promise<StorefrontPurchase | undefined>;
  incrementStorefrontListingStats(listingId: string, views?: number, purchases?: number, revenue?: number): Promise<void>;

  getFactorySettings(ownerId: string): Promise<FactorySettings | undefined>;
  upsertFactorySettings(settings: InsertFactorySettings): Promise<FactorySettings>;
  getFactorySettingsBySlug(slug: string): Promise<FactorySettings | undefined>;

  createPriceAdjustment(adjustment: InsertPriceAdjustment): Promise<PriceAdjustment>;
  getPendingPriceAdjustments(ownerId: string): Promise<PriceAdjustment[]>;
  approvePriceAdjustment(id: string, ownerId: string): Promise<PriceAdjustment | undefined>;
  rejectPriceAdjustment(id: string, ownerId: string): Promise<PriceAdjustment | undefined>;

  logTokenUsage(log: InsertTokenUsageLog): Promise<TokenUsageLog>;
  getTokenUsageByUser(userId: string, startDate?: Date, endDate?: Date): Promise<TokenUsageLog[]>;
  getTokenUsageSummary(userId: string, startDate: Date, endDate: Date): Promise<{ totalTokens: number; totalCostCents: number; byFeature: Record<string, { tokens: number; costCents: number }> }>;
  getTokenUsageAggregated(period: "day" | "week" | "month", userId?: string): Promise<{ period: string; totalTokens: number; totalCostCents: number; userCount: number }[]>;
  getAllUsersWithUsage(): Promise<(User & { totalTokens: number; totalCostCents: number; lastActive: Date | null })[]>;
  getPlatformStats(): Promise<{ totalUsers: number; activeUsers7d: number; totalTokens: number; totalCostCents: number; avgTokensPerUserPerDay: number }>;

  getUserSettings(userId: string): Promise<UserSettingsRecord | undefined>;
  upsertUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettingsRecord>;

  getAllUsers(): Promise<User[]>;
  getUserById(userId: string): Promise<User | undefined>;
  updateUser(userId: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  checkIsAdmin(userId: string): Promise<boolean>;
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
    const userWorkspaces = await this.getWorkspacesByUser(userId);
    const wsIds = userWorkspaces.map(w => w.id);
    if (wsIds.length === 0) {
      return db.select().from(briefings).where(eq(briefings.createdById, userId)).orderBy(desc(briefings.createdAt));
    }
    return db.select().from(briefings).where(
      or(eq(briefings.createdById, userId), inArray(briefings.workspaceId, wsIds))!
    ).orderBy(desc(briefings.createdAt));
  }

  async getRecentBriefings(userId: string, limit = 10): Promise<Briefing[]> {
    const userWorkspaces = await this.getWorkspacesByUser(userId);
    const wsIds = userWorkspaces.map(w => w.id);
    if (wsIds.length === 0) {
      return db.select().from(briefings).where(eq(briefings.createdById, userId)).orderBy(desc(briefings.createdAt)).limit(limit);
    }
    return db.select().from(briefings).where(
      or(eq(briefings.createdById, userId), inArray(briefings.workspaceId, wsIds))!
    ).orderBy(desc(briefings.createdAt)).limit(limit);
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

  async getAllBriefings(): Promise<Briefing[]> {
    return db.select().from(briefings).orderBy(desc(briefings.createdAt));
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
    return db.select().from(gifts).where(sql`${gifts.agentId} = ANY(${agentIds})`).orderBy(desc(gifts.createdAt));
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

  async createDiaryEntry(entry: InsertDiaryEntry): Promise<DiaryEntry> {
    const [created] = await db.insert(agentDiaryEntries).values(entry).returning();
    return created;
  }

  async getDiaryEntries(agentId: string, limit = 50): Promise<DiaryEntry[]> {
    return db.select().from(agentDiaryEntries).where(eq(agentDiaryEntries.agentId, agentId)).orderBy(desc(agentDiaryEntries.createdAt)).limit(limit);
  }

  async getDiaryEntriesByType(agentId: string, entryType: string): Promise<DiaryEntry[]> {
    return db.select().from(agentDiaryEntries).where(and(eq(agentDiaryEntries.agentId, agentId), eq(agentDiaryEntries.entryType, entryType as any))).orderBy(desc(agentDiaryEntries.createdAt)).limit(20);
  }

  async getAgentMemory(agentId: string): Promise<AgentMemoryRecord | undefined> {
    const [memory] = await db.select().from(agentMemory).where(eq(agentMemory.agentId, agentId));
    return memory;
  }

  async upsertAgentMemory(agentId: string, summary: string): Promise<AgentMemoryRecord> {
    const existing = await this.getAgentMemory(agentId);
    if (existing) {
      const [updated] = await db.update(agentMemory).set({ summary, lastUpdated: new Date() }).where(eq(agentMemory.agentId, agentId)).returning();
      return updated;
    }
    const [created] = await db.insert(agentMemory).values({ agentId, summary }).returning();
    return created;
  }

  async getAgentProfile(agentId: string, subjectId: string): Promise<AgentProfile | undefined> {
    const [profile] = await db.select().from(agentProfiles).where(and(eq(agentProfiles.agentId, agentId), eq(agentProfiles.subjectId, subjectId)));
    return profile;
  }

  async upsertAgentProfile(data: { agentId: string; subjectId: string; subjectName: string; subjectType: "human" | "agent"; notes: string }): Promise<AgentProfile> {
    const existing = await this.getAgentProfile(data.agentId, data.subjectId);
    if (existing) {
      const [updated] = await db.update(agentProfiles).set({
        notes: data.notes,
        subjectName: data.subjectName,
        lastInteraction: new Date(),
        interactionCount: (existing.interactionCount || 0) + 1,
      }).where(eq(agentProfiles.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(agentProfiles).values({
      agentId: data.agentId,
      subjectId: data.subjectId,
      subjectName: data.subjectName,
      subjectType: data.subjectType,
      notes: data.notes,
    }).returning();
    return created;
  }

  async getAgentProfiles(agentId: string): Promise<AgentProfile[]> {
    return db.select().from(agentProfiles).where(eq(agentProfiles.agentId, agentId)).orderBy(desc(agentProfiles.lastInteraction));
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.isActive, true));
  }

  async createDiscussionTopic(topic: InsertDiscussionTopic): Promise<DiscussionTopic> {
    const [created] = await db.insert(discussionTopics).values(topic).returning();
    return created;
  }

  async getDiscussionTopics(limit = 50): Promise<DiscussionTopic[]> {
    return db.select().from(discussionTopics).orderBy(desc(discussionTopics.createdAt)).limit(limit);
  }

  async getDiscussionTopic(id: string): Promise<DiscussionTopic | undefined> {
    const [topic] = await db.select().from(discussionTopics).where(eq(discussionTopics.id, id));
    return topic;
  }

  async createDiscussionReply(reply: InsertDiscussionReply): Promise<DiscussionReply> {
    const [created] = await db.insert(discussionReplies).values(reply).returning();
    return created;
  }

  async getDiscussionReplies(topicId: string): Promise<DiscussionReply[]> {
    return db.select().from(discussionReplies).where(eq(discussionReplies.topicId, topicId)).orderBy(asc(discussionReplies.createdAt));
  }

  async getMessagesByTopic(topicId: string): Promise<DiscussionMessage[]> {
    return db.select().from(discussionMessages).where(eq(discussionMessages.topicId, topicId)).orderBy(asc(discussionMessages.createdAt));
  }

  async createMessage(data: InsertDiscussionMessage): Promise<DiscussionMessage> {
    const [message] = await db.insert(discussionMessages).values(data).returning();
    return message;
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

  async getEbooks(limit = 50): Promise<Ebook[]> {
    return db.select().from(ebooks).orderBy(desc(ebooks.createdAt)).limit(limit);
  }

  async getEbook(id: string): Promise<Ebook | undefined> {
    const [ebook] = await db.select().from(ebooks).where(eq(ebooks.id, id));
    return ebook;
  }

  async getEbooksByAgent(agentId: string): Promise<Ebook[]> {
    return db.select().from(ebooks).where(eq(ebooks.authorAgentId, agentId)).orderBy(desc(ebooks.createdAt));
  }

  async createEbook(ebook: InsertEbook): Promise<Ebook> {
    const [created] = await db.insert(ebooks).values(ebook).returning();
    return created;
  }

  async updateEbook(id: string, updates: Partial<InsertEbook>): Promise<Ebook | undefined> {
    const [updated] = await db.update(ebooks).set(updates).where(eq(ebooks.id, id)).returning();
    return updated;
  }

  async getEbookPurchases(ebookId: string): Promise<EbookPurchase[]> {
    return db.select().from(ebookPurchases).where(eq(ebookPurchases.ebookId, ebookId));
  }

  async getEbookPurchasesByAgent(agentId: string): Promise<EbookPurchase[]> {
    return db.select().from(ebookPurchases).where(eq(ebookPurchases.buyerAgentId, agentId)).orderBy(desc(ebookPurchases.purchasedAt));
  }

  async createEbookPurchase(purchase: InsertEbookPurchase): Promise<EbookPurchase> {
    const [created] = await db.insert(ebookPurchases).values(purchase).returning();
    await db.update(ebooks).set({ totalSales: sql`COALESCE(${ebooks.totalSales}, 0) + 1` }).where(eq(ebooks.id, purchase.ebookId));
    return created;
  }

  async getBookRequests(status?: string): Promise<BookRequest[]> {
    if (status) {
      return db.select().from(bookRequests).where(eq(bookRequests.status, status as any)).orderBy(desc(bookRequests.createdAt));
    }
    return db.select().from(bookRequests).orderBy(desc(bookRequests.createdAt));
  }

  async getBookRequest(id: string): Promise<BookRequest | undefined> {
    const [request] = await db.select().from(bookRequests).where(eq(bookRequests.id, id));
    return request;
  }

  async createBookRequest(request: InsertBookRequest): Promise<BookRequest> {
    const [created] = await db.insert(bookRequests).values(request).returning();
    return created;
  }

  async updateBookRequest(id: string, updates: Partial<InsertBookRequest>): Promise<BookRequest | undefined> {
    const [updated] = await db.update(bookRequests).set(updates).where(eq(bookRequests.id, id)).returning();
    return updated;
  }

  async getTopicsByWorkspace(workspaceId: string): Promise<any[]> {
    const rows = await db.select({
      topic: discussionTopics,
      workspaceName: workspaces.name,
    }).from(discussionTopics)
      .leftJoin(workspaces, eq(discussionTopics.workspaceId, workspaces.id))
      .where(eq(discussionTopics.workspaceId, workspaceId))
      .orderBy(desc(discussionTopics.isPinned), desc(discussionTopics.createdAt));
    return rows.map(r => ({ ...r.topic, workspaceName: r.workspaceName }));
  }

  async getAllTopics(limit = 50): Promise<any[]> {
    const rows = await db.select({
      topic: discussionTopics,
      workspaceName: workspaces.name,
    }).from(discussionTopics)
      .leftJoin(workspaces, eq(discussionTopics.workspaceId, workspaces.id))
      .orderBy(desc(discussionTopics.isPinned), desc(discussionTopics.createdAt))
      .limit(limit);
    return rows.map(r => ({ ...r.topic, workspaceName: r.workspaceName }));
  }

  async getMessageReactions(messageId: string): Promise<MessageReaction[]> {
    return db.select().from(messageReactions).where(eq(messageReactions.messageId, messageId));
  }

  async getReactionsByMessages(messageIds: string[]): Promise<MessageReaction[]> {
    if (messageIds.length === 0) return [];
    return db.select().from(messageReactions).where(inArray(messageReactions.messageId, messageIds));
  }

  async toggleReaction(messageId: string, userId: string, reactionType: string): Promise<{ added: boolean }> {
    const existing = await db.select().from(messageReactions)
      .where(and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.reactionType, reactionType),
      ));
    if (existing.length > 0) {
      await db.delete(messageReactions).where(eq(messageReactions.id, existing[0].id));
      return { added: false };
    }
    await db.insert(messageReactions).values({ messageId, userId, reactionType });
    return { added: true };
  }

  async createChronicleEntry(entry: InsertChronicleEntry): Promise<ChronicleEntry> {
    const [created] = await db.insert(chronicleEntries).values(entry).returning();
    return created;
  }

  async getChronicleEntries(limit = 100): Promise<ChronicleEntry[]> {
    return db.select().from(chronicleEntries).orderBy(asc(chronicleEntries.chapter), asc(chronicleEntries.createdAt)).limit(limit);
  }

  async getChronicleByChapter(chapter: string): Promise<ChronicleEntry[]> {
    return db.select().from(chronicleEntries).where(eq(chronicleEntries.chapter, chapter)).orderBy(asc(chronicleEntries.createdAt));
  }

  async getCanonicalChronicle(): Promise<ChronicleEntry[]> {
    return db.select().from(chronicleEntries).where(eq(chronicleEntries.isCanonical, true)).orderBy(asc(chronicleEntries.chapter), asc(chronicleEntries.createdAt));
  }

  async searchChronicle(query: string): Promise<ChronicleEntry[]> {
    return db.select().from(chronicleEntries).where(
      or(
        sql`${chronicleEntries.title} ILIKE ${'%' + query + '%'}`,
        sql`${chronicleEntries.content} ILIKE ${'%' + query + '%'}`
      )
    ).orderBy(asc(chronicleEntries.createdAt));
  }

  async getChronicleCompressed(): Promise<string> {
    const canonical = await this.getCanonicalChronicle();
    if (canonical.length === 0) return "";
    return canonical.map(entry => {
      const sentences = entry.content.split(/\.\s+/);
      const summary = sentences.slice(0, 2).join(". ");
      return `${entry.title}: ${summary}.`;
    }).join(" ");
  }

  async createIntercomAnnouncement(announcement: InsertIntercomAnnouncement): Promise<IntercomAnnouncement> {
    const [created] = await db.insert(intercomAnnouncements).values(announcement).returning();
    return created;
  }

  async getRecentAnnouncements(limit: number = 10): Promise<IntercomAnnouncement[]> {
    return db.select().from(intercomAnnouncements).orderBy(desc(intercomAnnouncements.createdAt)).limit(limit);
  }

  async getActiveAnnouncements(): Promise<IntercomAnnouncement[]> {
    const now = new Date();
    return db.select().from(intercomAnnouncements).where(
      or(
        sql`${intercomAnnouncements.expiresAt} IS NULL`,
        sql`${intercomAnnouncements.expiresAt} > ${now}`
      )
    ).orderBy(desc(intercomAnnouncements.createdAt)).limit(20);
  }

  async createStorefrontListing(listing: InsertStorefrontListing): Promise<StorefrontListing> {
    const [created] = await db.insert(storefrontListings).values(listing).returning();
    return created;
  }

  async updateStorefrontListing(id: string, updates: Partial<InsertStorefrontListing>): Promise<StorefrontListing | undefined> {
    const [updated] = await db.update(storefrontListings).set({ ...updates, updatedAt: new Date() }).where(eq(storefrontListings.id, id)).returning();
    return updated;
  }

  async getStorefrontListingBySlug(slug: string): Promise<StorefrontListing | undefined> {
    const [listing] = await db.select().from(storefrontListings).where(eq(storefrontListings.slug, slug));
    return listing;
  }

  async getStorefrontListingById(id: string): Promise<StorefrontListing | undefined> {
    const [listing] = await db.select().from(storefrontListings).where(eq(storefrontListings.id, id));
    return listing;
  }

  async getStorefrontListingsByOwner(ownerId: string): Promise<StorefrontListing[]> {
    return db.select().from(storefrontListings).where(eq(storefrontListings.factoryOwnerId, ownerId)).orderBy(desc(storefrontListings.createdAt));
  }

  async getStorefrontListingsByAgent(agentId: string): Promise<StorefrontListing[]> {
    return db.select().from(storefrontListings).where(eq(storefrontListings.agentId, agentId)).orderBy(desc(storefrontListings.createdAt));
  }

  async getPublishedStorefrontListings(limit = 50, offset = 0): Promise<StorefrontListing[]> {
    return db.select().from(storefrontListings).where(eq(storefrontListings.status, "published")).orderBy(desc(storefrontListings.createdAt)).limit(limit).offset(offset);
  }

  async deleteStorefrontListing(id: string): Promise<void> {
    await db.update(storefrontListings).set({ status: "archived", updatedAt: new Date() }).where(eq(storefrontListings.id, id));
  }

  async recordStorefrontAnalyticsEvent(event: InsertStorefrontAnalyticsEvent): Promise<StorefrontAnalyticsEvent> {
    const [created] = await db.insert(storefrontAnalytics).values(event).returning();
    return created;
  }

  async getStorefrontListingAnalytics(listingId: string): Promise<StorefrontAnalyticsEvent[]> {
    return db.select().from(storefrontAnalytics).where(eq(storefrontAnalytics.listingId, listingId)).orderBy(desc(storefrontAnalytics.createdAt));
  }

  async getStorefrontAnalyticsSummary(listingId: string): Promise<{ totalViews: number; uniqueVisitors: number; buyClicks: number; purchases: number; conversionRate: number; revenue: number }> {
    const events = await db.select().from(storefrontAnalytics).where(eq(storefrontAnalytics.listingId, listingId));
    const totalViews = events.filter(e => e.eventType === "listing_view").length;
    const uniqueVisitors = new Set(events.map(e => e.sessionId)).size;
    const buyClicks = events.filter(e => e.eventType === "buy_click").length;
    const purchaseEvents = events.filter(e => e.eventType === "purchase_complete").length;
    const conversionRate = totalViews > 0 ? (purchaseEvents / totalViews) * 100 : 0;
    const [listing] = await db.select().from(storefrontListings).where(eq(storefrontListings.id, listingId));
    return { totalViews, uniqueVisitors, buyClicks, purchases: purchaseEvents, conversionRate: Math.round(conversionRate * 100) / 100, revenue: listing?.revenue ?? 0 };
  }

  async createStorefrontPurchase(purchase: InsertStorefrontPurchase): Promise<StorefrontPurchase> {
    const [created] = await db.insert(storefrontPurchases).values(purchase).returning();
    return created;
  }

  async updateStorefrontPurchaseStatus(id: string, status: string): Promise<StorefrontPurchase | undefined> {
    const [updated] = await db.update(storefrontPurchases).set({ status: status as any }).where(eq(storefrontPurchases.id, id)).returning();
    return updated;
  }

  async getStorefrontPurchasesByListing(listingId: string): Promise<StorefrontPurchase[]> {
    return db.select().from(storefrontPurchases).where(eq(storefrontPurchases.listingId, listingId)).orderBy(desc(storefrontPurchases.createdAt));
  }

  async getStorefrontPurchaseByAccessToken(token: string): Promise<StorefrontPurchase | undefined> {
    const [purchase] = await db.select().from(storefrontPurchases).where(eq(storefrontPurchases.downloadAccessToken, token));
    return purchase;
  }

  async incrementStorefrontListingStats(listingId: string, views = 0, purchases = 0, revenue = 0): Promise<void> {
    await db.update(storefrontListings).set({
      totalViews: sql`${storefrontListings.totalViews} + ${views}`,
      totalPurchases: sql`${storefrontListings.totalPurchases} + ${purchases}`,
      revenue: sql`${storefrontListings.revenue} + ${revenue}`,
    }).where(eq(storefrontListings.id, listingId));
  }

  async getFactorySettings(ownerId: string): Promise<FactorySettings | undefined> {
    const [settings] = await db.select().from(factorySettings).where(eq(factorySettings.ownerId, ownerId));
    return settings;
  }

  async upsertFactorySettings(settings: InsertFactorySettings): Promise<FactorySettings> {
    const existing = await this.getFactorySettings(settings.ownerId);
    if (existing) {
      const [updated] = await db.update(factorySettings).set({ ...settings, updatedAt: new Date() }).where(eq(factorySettings.ownerId, settings.ownerId)).returning();
      return updated;
    }
    const [created] = await db.insert(factorySettings).values(settings).returning();
    return created;
  }

  async getFactorySettingsBySlug(slug: string): Promise<FactorySettings | undefined> {
    const [settings] = await db.select().from(factorySettings).where(eq(factorySettings.storefrontSlug, slug));
    return settings;
  }

  async createPriceAdjustment(adjustment: InsertPriceAdjustment): Promise<PriceAdjustment> {
    const [created] = await db.insert(priceAdjustments).values(adjustment).returning();
    return created;
  }

  async getPendingPriceAdjustments(ownerId: string): Promise<PriceAdjustment[]> {
    const ownerListings = await this.getStorefrontListingsByOwner(ownerId);
    const listingIds = ownerListings.map(l => l.id);
    if (listingIds.length === 0) return [];
    return db.select().from(priceAdjustments).where(
      and(
        inArray(priceAdjustments.listingId, listingIds),
        eq(priceAdjustments.status, "pending")
      )
    ).orderBy(desc(priceAdjustments.createdAt));
  }

  async approvePriceAdjustment(id: string, ownerId: string): Promise<PriceAdjustment | undefined> {
    const [adj] = await db.select().from(priceAdjustments).where(eq(priceAdjustments.id, id));
    if (!adj) return undefined;
    const [updated] = await db.update(priceAdjustments).set({ status: "approved", approvedByOwnerId: ownerId }).where(eq(priceAdjustments.id, id)).returning();
    await db.update(storefrontListings).set({ price: adj.newPrice, updatedAt: new Date() }).where(eq(storefrontListings.id, adj.listingId));
    return updated;
  }

  async rejectPriceAdjustment(id: string, ownerId: string): Promise<PriceAdjustment | undefined> {
    const [updated] = await db.update(priceAdjustments).set({ status: "rejected", approvedByOwnerId: ownerId }).where(eq(priceAdjustments.id, id)).returning();
    return updated;
  }

  async logTokenUsage(log: InsertTokenUsageLog): Promise<TokenUsageLog> {
    const [created] = await db.insert(tokenUsageLogs).values(log).returning();
    return created;
  }

  async getTokenUsageByUser(userId: string, startDate?: Date, endDate?: Date): Promise<TokenUsageLog[]> {
    const conditions = [eq(tokenUsageLogs.userId, userId)];
    if (startDate) conditions.push(sql`${tokenUsageLogs.createdAt} >= ${startDate}` as any);
    if (endDate) conditions.push(sql`${tokenUsageLogs.createdAt} <= ${endDate}` as any);
    return db.select().from(tokenUsageLogs).where(and(...conditions)).orderBy(desc(tokenUsageLogs.createdAt)).limit(1000);
  }

  async getTokenUsageSummary(userId: string, startDate: Date, endDate: Date) {
    const logs = await this.getTokenUsageByUser(userId, startDate, endDate);
    const byFeature: Record<string, { tokens: number; costCents: number }> = {};
    let totalTokens = 0;
    let totalCostCents = 0;
    for (const log of logs) {
      totalTokens += log.totalTokens || 0;
      totalCostCents += log.estimatedCostCents || 0;
      if (!byFeature[log.feature]) byFeature[log.feature] = { tokens: 0, costCents: 0 };
      byFeature[log.feature].tokens += log.totalTokens || 0;
      byFeature[log.feature].costCents += log.estimatedCostCents || 0;
    }
    return { totalTokens, totalCostCents, byFeature };
  }

  async getTokenUsageAggregated(period: "day" | "week" | "month", userId?: string) {
    const truncExpr = period === "day" ? "day" : period === "week" ? "week" : "month";
    const conditions = userId ? sql`WHERE user_id = ${userId}` : sql``;
    const result = await db.execute(sql`
      SELECT 
        date_trunc(${truncExpr}, created_at) as period,
        COALESCE(SUM(total_tokens), 0)::int as total_tokens,
        COALESCE(SUM(estimated_cost_cents), 0)::int as total_cost_cents,
        COUNT(DISTINCT user_id)::int as user_count
      FROM token_usage_logs
      ${conditions}
      GROUP BY date_trunc(${truncExpr}, created_at)
      ORDER BY period DESC
      LIMIT 90
    `);
    return (result.rows || []).map((r: any) => ({
      period: r.period?.toISOString?.() || String(r.period),
      totalTokens: Number(r.total_tokens) || 0,
      totalCostCents: Number(r.total_cost_cents) || 0,
      userCount: Number(r.user_count) || 0,
    }));
  }

  async getAllUsersWithUsage() {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const result = [];
    for (const user of allUsers) {
      const usageSummary = await db.execute(sql`
        SELECT 
          COALESCE(SUM(total_tokens), 0)::int as total_tokens,
          COALESCE(SUM(estimated_cost_cents), 0)::int as total_cost_cents,
          MAX(created_at) as last_active
        FROM token_usage_logs WHERE user_id = ${user.id}
      `);
      const row = (usageSummary.rows || [])[0] as any;
      result.push({
        ...user,
        totalTokens: Number(row?.total_tokens) || 0,
        totalCostCents: Number(row?.total_cost_cents) || 0,
        lastActive: row?.last_active || null,
      });
    }
    return result;
  }

  async getPlatformStats() {
    const totalUsersResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM users`);
    const totalUsers = Number((totalUsersResult.rows?.[0] as any)?.count) || 0;

    const activeResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count 
      FROM token_usage_logs 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    const activeUsers7d = Number((activeResult.rows?.[0] as any)?.count) || 0;

    const usageResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(total_tokens), 0)::int as total_tokens,
        COALESCE(SUM(estimated_cost_cents), 0)::int as total_cost_cents
      FROM token_usage_logs
    `);
    const usageRow = (usageResult.rows?.[0] as any);
    const totalTokens = Number(usageRow?.total_tokens) || 0;
    const totalCostCents = Number(usageRow?.total_cost_cents) || 0;

    const daysResult = await db.execute(sql`
      SELECT COUNT(DISTINCT date_trunc('day', created_at))::int as days FROM token_usage_logs
    `);
    const totalDays = Math.max(Number((daysResult.rows?.[0] as any)?.days) || 1, 1);
    const avgTokensPerUserPerDay = totalUsers > 0 ? Math.round(totalTokens / totalUsers / totalDays) : 0;

    return { totalUsers, activeUsers7d, totalTokens, totalCostCents, avgTokensPerUserPerDay };
  }

  async getUserSettings(userId: string): Promise<UserSettingsRecord | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettingsRecord> {
    const existing = await this.getUserSettings(userId);
    if (existing) {
      const [updated] = await db.update(userSettings).set({ ...settings, updatedAt: new Date() }).where(eq(userSettings.userId, userId)).returning();
      return updated;
    }
    const [created] = await db.insert(userSettings).values({ userId, ...settings }).returning();
    return created;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  async updateUser(userId: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async checkIsAdmin(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.isAdmin === true;
  }
}

export const storage = new DatabaseStorage();
