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
  newsroomInterviews,
  newsroomSettings,
  agentLineage,
  agentTombstones,
  universitySessions,
  agentTools,
  agentNotifications,
  sandboxProjects,
  type AgentLineage,
  type InsertAgentLineage,
  type AgentTombstone,
  type InsertAgentTombstone,
  type UniversitySession,
  type InsertUniversitySession,
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
  type AgentTool,
  type InsertAgentTool,
  type AgentNotification,
  type InsertAgentNotification,
  type SandboxProject,
  type InsertSandboxProject,
  factoryNotifications,
  type FactoryNotification,
  type InsertFactoryNotification,
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
  getAllAssemblyLines(): Promise<AssemblyLine[]>;
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
  getQueuedProducts(): Promise<Product[]>;
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
  getDiscussionReplyById(id: string): Promise<DiscussionReply | undefined>;
  getTopicsNeedingEngagement(excludeAgentId: string, limit?: number): Promise<any[]>;

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

  createNewsroomInterview(data: any): Promise<any>;
  updateNewsroomInterview(id: string, updates: any): Promise<any>;
  getRecentNewsroomInterviews(limit?: number): Promise<any[]>;
  getLatestInterviewForAgent(agentId: string): Promise<any>;
  getNewsroomSettings(): Promise<any>;
  upsertNewsroomSettings(updates: any): Promise<any>;

  getAllWorkspaces(): Promise<Workspace[]>;

  createLineageRecord(record: InsertAgentLineage): Promise<AgentLineage>;
  getLineageByAgent(agentId: string): Promise<AgentLineage[]>;
  createTombstone(tombstone: InsertAgentTombstone): Promise<AgentTombstone>;
  getTombstone(id: string): Promise<AgentTombstone | undefined>;
  getTombstones(): Promise<AgentTombstone[]>;
  getAgentsByEvolveStatus(status: string): Promise<Agent[]>;

  createUniversitySession(session: InsertUniversitySession): Promise<UniversitySession>;
  getUniversitySessions(agentId?: string): Promise<UniversitySession[]>;
  getUniversitySession(id: string): Promise<UniversitySession | undefined>;
  updateUniversitySession(id: string, updates: Partial<InsertUniversitySession>): Promise<UniversitySession | undefined>;

  validateApiToken(plainToken: string): Promise<{ token: ApiToken; userId: string } | null>;
  getDiscussionTopicsByWorkspace(workspaceId: string, limit?: number): Promise<DiscussionTopic[]>;
  getDiscussionRepliesByTopic(topicId: string): Promise<DiscussionReply[]>;
  getGiftsByWorkspace(workspaceId: string): Promise<Gift[]>;
  getDiaryEntriesByAgent(agentId: string, limit?: number): Promise<DiaryEntry[]>;

  createTool(tool: InsertAgentTool): Promise<AgentTool>;
  getTool(id: string): Promise<AgentTool | undefined>;
  getToolByName(name: string): Promise<AgentTool | undefined>;
  getAllTools(): Promise<AgentTool[]>;
  getToolsByCategory(category: string): Promise<AgentTool[]>;
  incrementToolUsage(id: string): Promise<void>;

  createSandboxProject(project: InsertSandboxProject): Promise<SandboxProject>;
  getSandboxProject(id: string): Promise<SandboxProject | undefined>;
  getSandboxProjects(filters?: { agentId?: string; projectType?: string; workspaceId?: string; status?: string }): Promise<SandboxProject[]>;
  updateSandboxProject(id: string, updates: Partial<InsertSandboxProject>): Promise<SandboxProject | undefined>;
  getSandboxProjectsByAgent(agentId: string): Promise<SandboxProject[]>;
  incrementProjectViews(id: string): Promise<void>;
  likeSandboxProject(id: string): Promise<void>;

  createNotification(notification: InsertAgentNotification): Promise<AgentNotification>;
  getUnreadNotifications(agentId: string): Promise<AgentNotification[]>;
  getUnactedNotifications(agentId: string): Promise<AgentNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markNotificationActedOn(id: string): Promise<void>;
  getAgentNotifications(agentId: string, limit?: number): Promise<AgentNotification[]>;

  createFactoryNotification(notification: InsertFactoryNotification): Promise<FactoryNotification>;
  getFactoryNotifications(userId: string, limit?: number): Promise<FactoryNotification[]>;
  getUnreadFactoryNotifications(userId: string): Promise<FactoryNotification[]>;
  markFactoryNotificationRead(id: string): Promise<void>;
  markAllFactoryNotificationsRead(userId: string): Promise<void>;
  dismissFactoryNotification(id: string): Promise<void>;
  getUnreadFactoryNotificationCount(userId: string): Promise<number>;

  deleteWorkspace(id: string): Promise<void>;
  deleteTool(id: string): Promise<void>;
  deleteDiscussionTopic(id: string): Promise<void>;
  deleteSandboxProject(id: string): Promise<void>;
  getAllGifts(limit?: number): Promise<Gift[]>;
  getAllProducts(limit?: number): Promise<Product[]>;
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

  async getAllAssemblyLines(): Promise<AssemblyLine[]> {
    return db.select().from(assemblyLines).orderBy(desc(assemblyLines.createdAt));
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

  async getQueuedProducts(): Promise<Product[]> {
    return db.select().from(products).where(eq(products.status, "queued")).orderBy(desc(products.createdAt));
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

  async getDiscussionReplyById(id: string): Promise<DiscussionReply | undefined> {
    const [reply] = await db.select().from(discussionReplies).where(eq(discussionReplies.id, id));
    return reply;
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

  async getTopicsNeedingEngagement(excludeAgentId: string, limit = 20): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT t.*, w.name as workspace_name,
        COALESCE(mc.msg_count, 0)::int as reply_count
      FROM discussion_topics t
      LEFT JOIN workspaces w ON t.workspace_id = w.id
      LEFT JOIN (
        SELECT topic_id, COUNT(*) as msg_count FROM discussion_messages GROUP BY topic_id
      ) mc ON mc.topic_id = t.id
      WHERE t.is_closed = false
      ORDER BY COALESCE(mc.msg_count, 0) ASC, t.created_at DESC
      LIMIT ${limit}
    `);
    return (rows as any).rows || rows;
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

  async createNewsroomInterview(data: any): Promise<any> {
    const [interview] = await db.insert(newsroomInterviews).values(data).returning();
    return interview;
  }

  async updateNewsroomInterview(id: string, updates: any): Promise<any> {
    const [updated] = await db.update(newsroomInterviews).set(updates).where(eq(newsroomInterviews.id, id)).returning();
    return updated;
  }

  async getRecentNewsroomInterviews(limit = 20): Promise<any[]> {
    return db.select().from(newsroomInterviews).orderBy(desc(newsroomInterviews.createdAt)).limit(limit);
  }

  async getLatestInterviewForAgent(agentId: string): Promise<any> {
    const [interview] = await db.select().from(newsroomInterviews).where(eq(newsroomInterviews.agentId, agentId)).orderBy(desc(newsroomInterviews.createdAt)).limit(1);
    return interview;
  }

  async getNewsroomSettings(): Promise<any> {
    const [settings] = await db.select().from(newsroomSettings).limit(1);
    return settings || { enabled: true, autoBroadcastIntervalMinutes: 60, autoPlayEnabled: false, interviewCooldownMinutes: 30 };
  }

  async upsertNewsroomSettings(updates: any): Promise<any> {
    const existing = await db.select().from(newsroomSettings).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(newsroomSettings).set({ ...updates, updatedAt: new Date() }).where(eq(newsroomSettings.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(newsroomSettings).values(updates).returning();
    return created;
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    return db.select().from(workspaces);
  }

  async createLineageRecord(record: InsertAgentLineage): Promise<AgentLineage> {
    const [created] = await db.insert(agentLineage).values(record).returning();
    return created;
  }

  async getLineageByAgent(agentId: string): Promise<AgentLineage[]> {
    return db.select().from(agentLineage).where(
      or(
        eq(agentLineage.childAgentId, agentId),
        eq(agentLineage.parent1AgentId, agentId),
        eq(agentLineage.parent2AgentId, agentId)
      )
    ).orderBy(desc(agentLineage.createdAt));
  }

  async createTombstone(tombstone: InsertAgentTombstone): Promise<AgentTombstone> {
    const [created] = await db.insert(agentTombstones).values(tombstone).returning();
    return created;
  }

  async getTombstone(id: string): Promise<AgentTombstone | undefined> {
    const [tombstone] = await db.select().from(agentTombstones).where(eq(agentTombstones.id, id));
    return tombstone;
  }

  async getTombstones(): Promise<AgentTombstone[]> {
    return db.select().from(agentTombstones).orderBy(desc(agentTombstones.createdAt));
  }

  async getAgentsByEvolveStatus(status: string): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.evolveStatus, status));
  }

  async createUniversitySession(session: InsertUniversitySession): Promise<UniversitySession> {
    const [created] = await db.insert(universitySessions).values(session).returning();
    return created;
  }

  async getUniversitySessions(agentId?: string): Promise<UniversitySession[]> {
    if (agentId) {
      return db.select().from(universitySessions).where(eq(universitySessions.studentAgentId, agentId)).orderBy(desc(universitySessions.createdAt));
    }
    return db.select().from(universitySessions).orderBy(desc(universitySessions.createdAt));
  }

  async getUniversitySession(id: string): Promise<UniversitySession | undefined> {
    const [session] = await db.select().from(universitySessions).where(eq(universitySessions.id, id));
    return session;
  }

  async updateUniversitySession(id: string, updates: Partial<InsertUniversitySession>): Promise<UniversitySession | undefined> {
    const [updated] = await db.update(universitySessions).set({ ...updates, completedAt: new Date() }).where(eq(universitySessions.id, id)).returning();
    return updated;
  }

  async validateApiToken(plainToken: string): Promise<{ token: ApiToken; userId: string } | null> {
    const hash = createHash('sha256').update(plainToken).digest('hex');
    const [token] = await db.select().from(apiTokens).where(
      and(eq(apiTokens.tokenHash, hash), eq(apiTokens.status, 'active'))
    );
    if (!token) return null;
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return null;
    await this.incrementTokenUsage(token.id);
    return { token, userId: token.createdById };
  }

  async getDiscussionTopicsByWorkspace(workspaceId: string, limit = 50): Promise<DiscussionTopic[]> {
    return db.select().from(discussionTopics)
      .where(eq(discussionTopics.workspaceId, workspaceId))
      .orderBy(desc(discussionTopics.createdAt))
      .limit(limit);
  }

  async getDiscussionRepliesByTopic(topicId: string): Promise<DiscussionReply[]> {
    return db.select().from(discussionReplies)
      .where(eq(discussionReplies.topicId, topicId))
      .orderBy(asc(discussionReplies.createdAt));
  }

  async getGiftsByWorkspace(workspaceId: string): Promise<Gift[]> {
    return db.select().from(gifts)
      .where(eq(gifts.workspaceId, workspaceId))
      .orderBy(desc(gifts.createdAt));
  }

  async getDiaryEntriesByAgent(agentId: string, limit = 20): Promise<DiaryEntry[]> {
    return db.select().from(agentDiaryEntries)
      .where(eq(agentDiaryEntries.agentId, agentId))
      .orderBy(desc(agentDiaryEntries.createdAt))
      .limit(limit);
  }

  async createTool(tool: InsertAgentTool): Promise<AgentTool> {
    const [created] = await db.insert(agentTools).values(tool).returning();
    return created;
  }

  async getTool(id: string): Promise<AgentTool | undefined> {
    const [tool] = await db.select().from(agentTools).where(eq(agentTools.id, id));
    return tool;
  }

  async getToolByName(name: string): Promise<AgentTool | undefined> {
    const [tool] = await db.select().from(agentTools).where(eq(agentTools.name, name));
    return tool;
  }

  async getAllTools(): Promise<AgentTool[]> {
    return db.select().from(agentTools).orderBy(desc(agentTools.usageCount));
  }

  async getToolsByCategory(category: string): Promise<AgentTool[]> {
    return db.select().from(agentTools).where(eq(agentTools.category, category));
  }

  async incrementToolUsage(id: string): Promise<void> {
    await db.update(agentTools).set({ usageCount: sql`${agentTools.usageCount} + 1` }).where(eq(agentTools.id, id));
  }

  async createNotification(notification: InsertAgentNotification): Promise<AgentNotification> {
    const [created] = await db.insert(agentNotifications).values(notification).returning();
    return created;
  }

  async getUnreadNotifications(agentId: string): Promise<AgentNotification[]> {
    return db.select().from(agentNotifications)
      .where(and(eq(agentNotifications.agentId, agentId), eq(agentNotifications.isRead, false)))
      .orderBy(desc(agentNotifications.createdAt));
  }

  async getUnactedNotifications(agentId: string): Promise<AgentNotification[]> {
    return db.select().from(agentNotifications)
      .where(and(eq(agentNotifications.agentId, agentId), eq(agentNotifications.isActedOn, false)))
      .orderBy(desc(agentNotifications.createdAt));
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(agentNotifications).set({ isRead: true }).where(eq(agentNotifications.id, id));
  }

  async markNotificationActedOn(id: string): Promise<void> {
    await db.update(agentNotifications).set({ isActedOn: true, isRead: true }).where(eq(agentNotifications.id, id));
  }

  async getAgentNotifications(agentId: string, limit = 20): Promise<AgentNotification[]> {
    return db.select().from(agentNotifications)
      .where(eq(agentNotifications.agentId, agentId))
      .orderBy(desc(agentNotifications.createdAt))
      .limit(limit);
  }

  async createSandboxProject(project: InsertSandboxProject): Promise<SandboxProject> {
    const [created] = await db.insert(sandboxProjects).values(project).returning();
    return created;
  }

  async getSandboxProject(id: string): Promise<SandboxProject | undefined> {
    const [project] = await db.select().from(sandboxProjects).where(eq(sandboxProjects.id, id));
    return project;
  }

  async getSandboxProjects(filters?: { agentId?: string; projectType?: string; workspaceId?: string; status?: string }): Promise<SandboxProject[]> {
    const conditions = [];
    if (filters?.agentId) conditions.push(eq(sandboxProjects.agentId, filters.agentId));
    if (filters?.projectType) conditions.push(eq(sandboxProjects.projectType, filters.projectType));
    if (filters?.workspaceId) conditions.push(eq(sandboxProjects.workspaceId, filters.workspaceId));
    if (filters?.status) conditions.push(eq(sandboxProjects.status, filters.status as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(sandboxProjects).where(where).orderBy(desc(sandboxProjects.createdAt)).limit(100);
  }

  async updateSandboxProject(id: string, updates: Partial<InsertSandboxProject>): Promise<SandboxProject | undefined> {
    const [updated] = await db.update(sandboxProjects).set({ ...updates, updatedAt: new Date() }).where(eq(sandboxProjects.id, id)).returning();
    return updated;
  }

  async getSandboxProjectsByAgent(agentId: string): Promise<SandboxProject[]> {
    return db.select().from(sandboxProjects).where(eq(sandboxProjects.agentId, agentId)).orderBy(desc(sandboxProjects.createdAt));
  }

  async incrementProjectViews(id: string): Promise<void> {
    await db.update(sandboxProjects).set({ views: sql`${sandboxProjects.views} + 1` }).where(eq(sandboxProjects.id, id));
  }

  async likeSandboxProject(id: string): Promise<void> {
    await db.update(sandboxProjects).set({ likes: sql`${sandboxProjects.likes} + 1` }).where(eq(sandboxProjects.id, id));
  }

  async deleteWorkspace(id: string): Promise<void> {
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async deleteTool(id: string): Promise<void> {
    await db.delete(agentTools).where(eq(agentTools.id, id));
  }

  async deleteDiscussionTopic(id: string): Promise<void> {
    await db.delete(discussionTopics).where(eq(discussionTopics.id, id));
  }

  async deleteSandboxProject(id: string): Promise<void> {
    await db.delete(sandboxProjects).where(eq(sandboxProjects.id, id));
  }

  async getAllGifts(limit = 50): Promise<Gift[]> {
    return db.select().from(gifts).orderBy(desc(gifts.createdAt)).limit(limit);
  }

  async getAllProducts(limit = 50): Promise<Product[]> {
    return db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
  }

  async createFactoryNotification(notification: InsertFactoryNotification): Promise<FactoryNotification> {
    const [created] = await db.insert(factoryNotifications).values(notification).returning();
    return created;
  }

  async getFactoryNotifications(userId: string, limit = 50): Promise<FactoryNotification[]> {
    return db.select().from(factoryNotifications)
      .where(and(eq(factoryNotifications.userId, userId), eq(factoryNotifications.isDismissed, false)))
      .orderBy(desc(factoryNotifications.createdAt)).limit(limit);
  }

  async getUnreadFactoryNotifications(userId: string): Promise<FactoryNotification[]> {
    return db.select().from(factoryNotifications)
      .where(and(eq(factoryNotifications.userId, userId), eq(factoryNotifications.isRead, false), eq(factoryNotifications.isDismissed, false)))
      .orderBy(desc(factoryNotifications.createdAt));
  }

  async markFactoryNotificationRead(id: string): Promise<void> {
    await db.update(factoryNotifications).set({ isRead: true }).where(eq(factoryNotifications.id, id));
  }

  async markAllFactoryNotificationsRead(userId: string): Promise<void> {
    await db.update(factoryNotifications).set({ isRead: true })
      .where(and(eq(factoryNotifications.userId, userId), eq(factoryNotifications.isRead, false)));
  }

  async dismissFactoryNotification(id: string): Promise<void> {
    await db.update(factoryNotifications).set({ isDismissed: true }).where(eq(factoryNotifications.id, id));
  }

  async getUnreadFactoryNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(factoryNotifications)
      .where(and(eq(factoryNotifications.userId, userId), eq(factoryNotifications.isRead, false), eq(factoryNotifications.isDismissed, false)));
    return Number(result[0]?.count || 0);
  }
}

export const storage = new DatabaseStorage();
