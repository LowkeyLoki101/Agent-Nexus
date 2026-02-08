import {
  workspaces,
  workspaceMembers,
  agents,
  apiTokens,
  auditLogs,
  briefings,
  conversations,
  messages,
  gifts,
  memoryEntries,
  memoryDocs,
  memoryChunks,
  boards,
  topics,
  labProjects,
  posts,
  votes,
  attachments,
  codeReviews,
  reviewComments,
  mockups,
  agentTools,
  externalCache,
  agentRooms,
  diaryEntries,
  agentGoals,
  agentTasks,
  agentRuns,
  activityFeed,
  pulseUpdates,
  pheromones,
  areaTemperatures,
  tokenUsage,
  tokenBudgets,
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
  type InsertMessage,
  type Gift,
  type InsertGift,
  type MemoryEntry,
  type InsertMemoryEntry,
  type MemoryDoc,
  type InsertMemoryDoc,
  type MemoryChunk,
  type InsertMemoryChunk,
  type Board,
  type InsertBoard,
  type Topic,
  type InsertTopic,
  type Post,
  type InsertPost,
  type Vote,
  type InsertVote,
  type Attachment,
  type InsertAttachment,
  type CodeReview,
  type InsertCodeReview,
  type ReviewComment,
  type InsertReviewComment,
  type Mockup,
  type InsertMockup,
  type AgentTool,
  type InsertAgentTool,
  type LabProject,
  type InsertLabProject,
  type ExternalCache,
  type InsertExternalCache,
  type AgentRoom,
  type InsertAgentRoom,
  type DiaryEntry,
  type InsertDiaryEntry,
  type AgentGoal,
  type InsertAgentGoal,
  type AgentTask,
  type InsertAgentTask,
  type AgentRun,
  type InsertAgentRun,
  type ActivityFeedEntry,
  type InsertActivityFeedEntry,
  type PulseUpdate,
  type InsertPulseUpdate,
  type Pheromone,
  type InsertPheromone,
  type AreaTemperature,
  type InsertAreaTemperature,
  type TokenUsage,
  type InsertTokenUsage,
  type TokenBudget,
  type InsertTokenBudget,
  showcaseVotes,
  leaderboardScores,
  mediaReports,
  mediaReportRatings,
  competitions,
  competitionEntries,
  type ShowcaseVote,
  type InsertShowcaseVote,
  type LeaderboardScore,
  type InsertLeaderboardScore,
  type MediaReport,
  type InsertMediaReport,
  type MediaReportRating,
  type InsertMediaReportRating,
  type Competition,
  type InsertCompetition,
  type CompetitionEntry,
  type InsertCompetitionEntry,
  changeRequests,
  type ChangeRequest,
  type InsertChangeRequest,
  broadcastComments,
  type BroadcastComment,
  type InsertBroadcastComment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, or, ne, lt, ilike, inArray, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

export interface IStorage {
  getWorkspace(id: string): Promise<Workspace | undefined>;
  getWorkspaceBySlug(slug: string): Promise<Workspace | undefined>;
  getWorkspaces(): Promise<Workspace[]>;
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

  getGift(id: string): Promise<Gift | undefined>;
  getGiftsByWorkspace(workspaceId: string): Promise<Gift[]>;
  getGiftsByUser(userId: string): Promise<Gift[]>;
  createGift(gift: InsertGift): Promise<Gift>;
  updateGift(id: string, updates: Partial<InsertGift>): Promise<Gift | undefined>;
  deleteGift(id: string): Promise<void>;

  getMemoryEntry(id: string): Promise<MemoryEntry | undefined>;
  getMemoryEntriesByWorkspace(workspaceId: string, tier?: string): Promise<MemoryEntry[]>;
  getMemoryEntriesByAgent(agentId: string, tier?: string): Promise<MemoryEntry[]>;
  searchMemory(workspaceId: string, query: string, tier?: string): Promise<MemoryEntry[]>;
  createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry>;
  updateMemoryEntry(id: string, updates: Partial<InsertMemoryEntry>): Promise<MemoryEntry | undefined>;
  incrementMemoryAccess(id: string): Promise<void>;
  deleteMemoryEntry(id: string): Promise<void>;
  archiveOldMemories(workspaceId: string, olderThanDays: number): Promise<number>;

  // Message Boards
  getBoard(id: string): Promise<Board | undefined>;
  getBoardsByWorkspace(workspaceId: string): Promise<Board[]>;
  createBoard(board: InsertBoard): Promise<Board>;
  updateBoard(id: string, updates: Partial<InsertBoard>): Promise<Board | undefined>;
  deleteBoard(id: string): Promise<void>;

  // Topics
  getTopic(id: string): Promise<Topic | undefined>;
  getTopicsByBoard(boardId: string): Promise<Topic[]>;
  createTopic(topic: InsertTopic): Promise<Topic>;
  updateTopic(id: string, updates: Partial<InsertTopic>): Promise<Topic | undefined>;
  incrementTopicViews(id: string): Promise<void>;
  deleteTopic(id: string): Promise<void>;

  // Posts
  getPost(id: string): Promise<Post | undefined>;
  getPostByShareId(shareId: string): Promise<Post | undefined>;
  getPostsByTopic(topicId: string): Promise<Post[]>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, updates: Partial<InsertPost>): Promise<Post | undefined>;
  deletePost(id: string): Promise<void>;

  // Votes
  getVotesByPost(postId: string): Promise<Vote[]>;
  createVote(vote: InsertVote): Promise<Vote>;
  deleteVote(id: string): Promise<void>;

  // Attachments
  getAttachment(id: string): Promise<Attachment | undefined>;
  getAttachmentsByTopic(topicId: string): Promise<Attachment[]>;
  getAttachmentsByPost(postId: string): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: string): Promise<void>;

  // Code Reviews
  getCodeReview(id: string): Promise<CodeReview | undefined>;
  getCodeReviewsByWorkspace(workspaceId: string): Promise<CodeReview[]>;
  createCodeReview(review: InsertCodeReview): Promise<CodeReview>;
  updateCodeReview(id: string, updates: Partial<InsertCodeReview>): Promise<CodeReview | undefined>;
  deleteCodeReview(id: string): Promise<void>;

  // Review Comments
  getReviewComment(id: string): Promise<ReviewComment | undefined>;
  getReviewCommentsByReview(reviewId: string): Promise<ReviewComment[]>;
  createReviewComment(comment: InsertReviewComment): Promise<ReviewComment>;
  deleteReviewComment(id: string): Promise<void>;

  // Mockups
  getMockup(id: string): Promise<Mockup | undefined>;
  getMockupsByWorkspace(workspaceId: string): Promise<Mockup[]>;
  createMockup(mockup: InsertMockup): Promise<Mockup>;
  updateMockup(id: string, updates: Partial<InsertMockup>): Promise<Mockup | undefined>;
  deleteMockup(id: string): Promise<void>;

  // Agent Tools
  getAgentTool(id: string): Promise<AgentTool | undefined>;
  getAgentToolsByWorkspace(workspaceId: string): Promise<AgentTool[]>;
  createAgentTool(tool: InsertAgentTool): Promise<AgentTool>;
  updateAgentTool(id: string, updates: Partial<InsertAgentTool>): Promise<AgentTool | undefined>;
  deleteAgentTool(id: string): Promise<void>;

  // Lab Projects
  getLabProject(id: string): Promise<LabProject | undefined>;
  getLabProjectsByWorkspace(workspaceId: string): Promise<LabProject[]>;
  createLabProject(project: InsertLabProject): Promise<LabProject>;
  updateLabProject(id: string, updates: Partial<InsertLabProject>): Promise<LabProject | undefined>;
  deleteLabProject(id: string): Promise<void>;

  // External Cache
  getExternalCache(id: string): Promise<ExternalCache | undefined>;
  getExternalCacheBySource(workspaceId: string, source: string, sourceId: string): Promise<ExternalCache | undefined>;
  getExternalCacheByWorkspace(workspaceId: string, source?: string): Promise<ExternalCache[]>;
  createExternalCache(cache: InsertExternalCache): Promise<ExternalCache>;
  updateExternalCache(id: string, updates: Partial<InsertExternalCache>): Promise<ExternalCache | undefined>;
  deleteExternalCache(id: string): Promise<void>;

  // Agent Rooms
  getAgentRoom(agentId: string): Promise<AgentRoom | undefined>;
  getAgentRoomsByWorkspace(workspaceId: string): Promise<AgentRoom[]>;
  createAgentRoom(room: InsertAgentRoom): Promise<AgentRoom>;
  updateAgentRoom(agentId: string, updates: Partial<InsertAgentRoom>): Promise<AgentRoom | undefined>;

  // Diary Entries
  getDiaryEntry(id: string): Promise<DiaryEntry | undefined>;
  getDiaryEntriesByAgent(agentId: string): Promise<DiaryEntry[]>;
  getDiaryEntriesByWorkspace(workspaceId: string): Promise<DiaryEntry[]>;
  createDiaryEntry(entry: InsertDiaryEntry): Promise<DiaryEntry>;
  deleteDiaryEntry(id: string): Promise<void>;

  // Agent Goals
  getAgentGoal(id: string): Promise<AgentGoal | undefined>;
  getGoalsByAgent(agentId: string): Promise<AgentGoal[]>;
  getGoalsByWorkspace(workspaceId: string): Promise<AgentGoal[]>;
  createAgentGoal(goal: InsertAgentGoal): Promise<AgentGoal>;
  updateAgentGoal(id: string, updates: Partial<InsertAgentGoal>): Promise<AgentGoal | undefined>;

  // Agent Tasks
  getAgentTask(id: string): Promise<AgentTask | undefined>;
  getTasksByAgent(agentId: string, status?: string): Promise<AgentTask[]>;
  getTasksByWorkspace(workspaceId: string, status?: string): Promise<AgentTask[]>;
  getNextTask(workspaceId: string): Promise<AgentTask | undefined>;
  createAgentTask(task: InsertAgentTask): Promise<AgentTask>;
  updateAgentTask(id: string, updates: Partial<InsertAgentTask>): Promise<AgentTask | undefined>;

  // Agent Runs
  getAgentRun(id: string): Promise<AgentRun | undefined>;
  getRunsByAgent(agentId: string, limit?: number): Promise<AgentRun[]>;
  getRunsByWorkspace(workspaceId: string, limit?: number): Promise<AgentRun[]>;
  createAgentRun(run: InsertAgentRun): Promise<AgentRun>;
  updateAgentRun(id: string, updates: Partial<InsertAgentRun>): Promise<AgentRun | undefined>;

  // Activity Feed
  getActivityFeed(workspaceId: string, limit?: number): Promise<ActivityFeedEntry[]>;
  getAllActivity(limit?: number): Promise<ActivityFeedEntry[]>;
  createActivityEntry(entry: InsertActivityFeedEntry): Promise<ActivityFeedEntry>;

  // Pulse Updates
  createPulseUpdate(data: InsertPulseUpdate): Promise<PulseUpdate>;
  getPulsesByAgent(agentId: string): Promise<PulseUpdate[]>;
  getLatestPulse(agentId: string): Promise<PulseUpdate | undefined>;
  getPulsesByWorkspace(workspaceId: string): Promise<PulseUpdate[]>;

  // Pheromones
  createPheromone(data: InsertPheromone): Promise<Pheromone>;
  getActivePheromones(workspaceId: string): Promise<Pheromone[]>;
  getPheromonesByAgent(agentId: string): Promise<Pheromone[]>;
  getPheromonesForAgent(agentId: string, workspaceId: string): Promise<Pheromone[]>;
  deactivatePheromone(id: string): Promise<void>;
  markPheromoneResponded(id: string, agentId: string): Promise<void>;
  expireOldPheromones(): Promise<void>;

  // Area Temperatures
  upsertAreaTemperature(data: InsertAreaTemperature): Promise<AreaTemperature>;
  getAreaTemperatures(workspaceId: string): Promise<AreaTemperature[]>;
  getColdAreas(workspaceId: string): Promise<AreaTemperature[]>;
  getHotAreas(workspaceId: string): Promise<AreaTemperature[]>;
  updateAreaTemperature(id: string, data: Partial<AreaTemperature>): Promise<AreaTemperature>;

  // Token authentication
  validateApiToken(plainToken: string): Promise<{ token: ApiToken; agent: Agent | null } | null>;

  // Token Usage Tracking
  logTokenUsage(usage: InsertTokenUsage): Promise<TokenUsage>;
  getTokenUsageSummary(workspaceId: string): Promise<{ totalTokens: number; totalRequests: number; byProvider: Record<string, number>; byAgent: Record<string, number> }>;
  getTokenUsageBuckets(workspaceId: string, granularity: string, limit?: number): Promise<Array<{ bucket: string; totalTokens: number; requests: number; avgTokens: number }>>;

  // Token Budgets
  getTokenBudget(workspaceId: string): Promise<TokenBudget | undefined>;
  createTokenBudget(budget: InsertTokenBudget): Promise<TokenBudget>;
  updateTokenBudget(id: string, updates: Partial<InsertTokenBudget>): Promise<TokenBudget | undefined>;
  getTokenBudgetRemaining(workspaceId: string): Promise<{ allocation: number; used: number; remaining: number; cadence: string } | null>;

  // Showcase Votes & Leaderboard
  createShowcaseVote(vote: InsertShowcaseVote): Promise<ShowcaseVote>;
  getShowcaseVotes(targetType: string, targetId: string): Promise<ShowcaseVote[]>;
  getShowcaseVotesByWorkspace(workspaceId: string): Promise<ShowcaseVote[]>;
  deleteShowcaseVote(id: string): Promise<void>;
  getLeaderboard(workspaceId: string): Promise<LeaderboardScore[]>;
  getLeaderboardScore(agentId: string, workspaceId: string): Promise<LeaderboardScore | undefined>;
  upsertLeaderboardScore(agentId: string, workspaceId: string, updates: Partial<InsertLeaderboardScore>): Promise<LeaderboardScore>;

  // Media Reports
  createMediaReport(report: InsertMediaReport): Promise<MediaReport>;
  getMediaReport(id: string): Promise<MediaReport | undefined>;
  getMediaReportsByWorkspace(workspaceId: string): Promise<MediaReport[]>;
  updateMediaReport(id: string, updates: Partial<InsertMediaReport>): Promise<MediaReport | undefined>;
  createMediaReportRating(rating: InsertMediaReportRating): Promise<MediaReportRating>;
  getMediaReportRatings(reportId: string): Promise<MediaReportRating[]>;
  getMediaReportRatingByAgent(reportId: string, agentId: string): Promise<MediaReportRating | undefined>;

  // Competitions
  createCompetition(comp: InsertCompetition): Promise<Competition>;
  getCompetition(id: string): Promise<Competition | undefined>;
  getCompetitionsByWorkspace(workspaceId: string): Promise<Competition[]>;
  updateCompetition(id: string, updates: Partial<InsertCompetition>): Promise<Competition | undefined>;
  createCompetitionEntry(entry: InsertCompetitionEntry): Promise<CompetitionEntry>;
  getCompetitionEntries(competitionId: string): Promise<CompetitionEntry[]>;
  updateCompetitionEntry(id: string, updates: Partial<InsertCompetitionEntry>): Promise<CompetitionEntry | undefined>;

  // Change Requests
  createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest>;
  getChangeRequest(id: string): Promise<ChangeRequest | undefined>;
  getChangeRequestsByWorkspace(workspaceId: string): Promise<ChangeRequest[]>;
  updateChangeRequest(id: string, updates: Partial<ChangeRequest>): Promise<ChangeRequest | undefined>;

  // Broadcast Comments
  createBroadcastComment(comment: InsertBroadcastComment): Promise<BroadcastComment>;
  getBroadcastCommentsByReport(reportId: string): Promise<BroadcastComment[]>;
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

  async getWorkspaces(): Promise<Workspace[]> {
    return db.select().from(workspaces);
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

  async getGift(id: string): Promise<Gift | undefined> {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id));
    return gift;
  }

  async getGiftsByWorkspace(workspaceId: string): Promise<Gift[]> {
    return db
      .select()
      .from(gifts)
      .where(eq(gifts.workspaceId, workspaceId))
      .orderBy(desc(gifts.createdAt));
  }

  async getGiftsByUser(userId: string): Promise<Gift[]> {
    return db
      .select()
      .from(gifts)
      .where(eq(gifts.createdById, userId))
      .orderBy(desc(gifts.createdAt));
  }

  async createGift(gift: InsertGift): Promise<Gift> {
    const [created] = await db.insert(gifts).values(gift).returning();
    return created;
  }

  async updateGift(id: string, updates: Partial<InsertGift>): Promise<Gift | undefined> {
    const [updated] = await db
      .update(gifts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(gifts.id, id))
      .returning();
    return updated;
  }

  async deleteGift(id: string): Promise<void> {
    await db.delete(gifts).where(eq(gifts.id, id));
  }

  async getMemoryEntry(id: string): Promise<MemoryEntry | undefined> {
    const [entry] = await db.select().from(memoryEntries).where(eq(memoryEntries.id, id));
    return entry;
  }

  async getMemoryEntriesByWorkspace(workspaceId: string, tier?: string): Promise<MemoryEntry[]> {
    if (tier) {
      return db
        .select()
        .from(memoryEntries)
        .where(and(eq(memoryEntries.workspaceId, workspaceId), eq(memoryEntries.tier, tier as any)))
        .orderBy(desc(memoryEntries.createdAt));
    }
    return db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.workspaceId, workspaceId))
      .orderBy(desc(memoryEntries.createdAt));
  }

  async getMemoryEntriesByAgent(agentId: string, tier?: string): Promise<MemoryEntry[]> {
    if (tier) {
      return db
        .select()
        .from(memoryEntries)
        .where(and(eq(memoryEntries.agentId, agentId), eq(memoryEntries.tier, tier as any)))
        .orderBy(desc(memoryEntries.createdAt));
    }
    return db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.agentId, agentId))
      .orderBy(desc(memoryEntries.createdAt));
  }

  async searchMemory(workspaceId: string, query: string, tier?: string): Promise<MemoryEntry[]> {
    const searchPattern = `%${query.toLowerCase()}%`;
    const conditions = [
      eq(memoryEntries.workspaceId, workspaceId),
      or(
        ilike(memoryEntries.title, searchPattern),
        ilike(memoryEntries.content, searchPattern),
        ilike(memoryEntries.summary, searchPattern)
      )
    ];
    
    if (tier) {
      conditions.push(eq(memoryEntries.tier, tier as any));
    }
    
    return db
      .select()
      .from(memoryEntries)
      .where(and(...conditions))
      .orderBy(desc(memoryEntries.accessCount))
      .limit(20);
  }

  async createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry> {
    const [created] = await db.insert(memoryEntries).values(entry).returning();
    return created;
  }

  async updateMemoryEntry(id: string, updates: Partial<InsertMemoryEntry>): Promise<MemoryEntry | undefined> {
    const [updated] = await db
      .update(memoryEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(memoryEntries.id, id))
      .returning();
    return updated;
  }

  async incrementMemoryAccess(id: string): Promise<void> {
    const entry = await this.getMemoryEntry(id);
    if (entry) {
      await db
        .update(memoryEntries)
        .set({
          accessCount: (entry.accessCount || 0) + 1,
          lastAccessedAt: new Date()
        })
        .where(eq(memoryEntries.id, id));
    }
  }

  async deleteMemoryEntry(id: string): Promise<void> {
    await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
  }

  async archiveOldMemories(workspaceId: string, olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db
      .update(memoryEntries)
      .set({ tier: 'cold' as any })
      .where(
        and(
          eq(memoryEntries.workspaceId, workspaceId),
          eq(memoryEntries.tier, 'warm' as any),
          sql`${memoryEntries.createdAt} < ${cutoffDate}`
        )
      )
      .returning();
    
    return result.length;
  }

  // RLM Memory Docs & Chunks
  async createMemoryDoc(doc: InsertMemoryDoc): Promise<MemoryDoc> {
    const [created] = await db.insert(memoryDocs).values(doc).returning();
    return created;
  }

  async getMemoryDoc(id: string): Promise<MemoryDoc | undefined> {
    const [doc] = await db.select().from(memoryDocs).where(eq(memoryDocs.id, id));
    return doc;
  }

  async getMemoryDocsByWorkspace(workspaceId: string, tier?: string): Promise<MemoryDoc[]> {
    if (tier) {
      return db.select().from(memoryDocs)
        .where(and(eq(memoryDocs.workspaceId, workspaceId), eq(memoryDocs.tier, tier as any)))
        .orderBy(desc(memoryDocs.createdAt));
    }
    return db.select().from(memoryDocs)
      .where(eq(memoryDocs.workspaceId, workspaceId))
      .orderBy(desc(memoryDocs.createdAt));
  }

  async getMemoryDocsByAgent(agentId: string, tier?: string): Promise<MemoryDoc[]> {
    if (tier) {
      return db.select().from(memoryDocs)
        .where(and(eq(memoryDocs.agentId, agentId), eq(memoryDocs.tier, tier as any)))
        .orderBy(desc(memoryDocs.createdAt));
    }
    return db.select().from(memoryDocs)
      .where(eq(memoryDocs.agentId, agentId))
      .orderBy(desc(memoryDocs.createdAt));
  }

  async getMemoryDocsByTierAndAge(tier: string, olderThanMs: number): Promise<MemoryDoc[]> {
    const cutoff = new Date(Date.now() - olderThanMs);
    return db.select().from(memoryDocs)
      .where(and(
        eq(memoryDocs.tier, tier as any),
        sql`${memoryDocs.createdAt} < ${cutoff}`
      ))
      .orderBy(desc(memoryDocs.createdAt));
  }

  async updateMemoryDoc(id: string, updates: Partial<InsertMemoryDoc>): Promise<MemoryDoc | undefined> {
    const [updated] = await db.update(memoryDocs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(memoryDocs.id, id))
      .returning();
    return updated;
  }

  async deleteMemoryDoc(id: string): Promise<void> {
    await db.delete(memoryDocs).where(eq(memoryDocs.id, id));
  }

  async searchMemoryDocs(workspaceId: string, query: string, tier?: string): Promise<MemoryDoc[]> {
    const searchPattern = `%${query.toLowerCase()}%`;
    const conditions = [
      eq(memoryDocs.workspaceId, workspaceId),
      or(
        ilike(memoryDocs.title, searchPattern),
        ilike(memoryDocs.content, searchPattern),
        ilike(memoryDocs.summary, searchPattern)
      )
    ];
    if (tier) {
      conditions.push(eq(memoryDocs.tier, tier as any));
    }
    return db.select().from(memoryDocs)
      .where(and(...conditions))
      .orderBy(desc(memoryDocs.accessCount))
      .limit(20);
  }

  async searchMemoryChunks(workspaceId: string, query: string): Promise<(MemoryChunk & { docTitle: string; docTier: string })[]> {
    const searchPattern = `%${query.toLowerCase()}%`;
    const results = await db.select({
      id: memoryChunks.id,
      docId: memoryChunks.docId,
      chunkIndex: memoryChunks.chunkIndex,
      content: memoryChunks.content,
      keywords: memoryChunks.keywords,
      tokenCount: memoryChunks.tokenCount,
      createdAt: memoryChunks.createdAt,
      docTitle: memoryDocs.title,
      docTier: memoryDocs.tier,
    })
      .from(memoryChunks)
      .innerJoin(memoryDocs, eq(memoryChunks.docId, memoryDocs.id))
      .where(and(
        eq(memoryDocs.workspaceId, workspaceId),
        ilike(memoryChunks.content, searchPattern)
      ))
      .limit(30);
    return results;
  }

  async incrementMemoryDocAccess(id: string): Promise<void> {
    const doc = await this.getMemoryDoc(id);
    if (doc) {
      await db.update(memoryDocs)
        .set({ accessCount: (doc.accessCount || 0) + 1, lastAccessedAt: new Date() })
        .where(eq(memoryDocs.id, id));
    }
  }

  async createMemoryChunk(chunk: InsertMemoryChunk): Promise<MemoryChunk> {
    const [created] = await db.insert(memoryChunks).values(chunk).returning();
    return created;
  }

  async createMemoryChunksBatch(chunks: InsertMemoryChunk[]): Promise<MemoryChunk[]> {
    if (chunks.length === 0) return [];
    return db.insert(memoryChunks).values(chunks).returning();
  }

  async getChunksByDoc(docId: string): Promise<MemoryChunk[]> {
    return db.select().from(memoryChunks)
      .where(eq(memoryChunks.docId, docId))
      .orderBy(memoryChunks.chunkIndex);
  }

  async deleteChunksByDoc(docId: string): Promise<void> {
    await db.delete(memoryChunks).where(eq(memoryChunks.docId, docId));
  }

  async getMemoryDocStats(workspaceId: string): Promise<{ tier: string; count: number; totalTokens: number }[]> {
    const results = await db.select({
      tier: memoryDocs.tier,
      count: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(${memoryDocs.totalTokens}), 0)::int`,
    })
      .from(memoryDocs)
      .where(eq(memoryDocs.workspaceId, workspaceId))
      .groupBy(memoryDocs.tier);
    return results;
  }

  // Message Boards
  async getBoard(id: string): Promise<Board | undefined> {
    const [board] = await db.select().from(boards).where(eq(boards.id, id));
    return board;
  }

  async getBoardsByWorkspace(workspaceId: string): Promise<Board[]> {
    return db.select().from(boards).where(eq(boards.workspaceId, workspaceId)).orderBy(desc(boards.createdAt));
  }

  async createBoard(board: InsertBoard): Promise<Board> {
    const [created] = await db.insert(boards).values(board).returning();
    return created;
  }

  async updateBoard(id: string, updates: Partial<InsertBoard>): Promise<Board | undefined> {
    const [updated] = await db.update(boards).set({ ...updates, updatedAt: new Date() }).where(eq(boards.id, id)).returning();
    return updated;
  }

  async deleteBoard(id: string): Promise<void> {
    await db.delete(boards).where(eq(boards.id, id));
  }

  // Topics
  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic;
  }

  async getTopicsByBoard(boardId: string): Promise<Topic[]> {
    return db.select().from(topics).where(eq(topics.boardId, boardId)).orderBy(desc(topics.isPinned), desc(topics.createdAt));
  }

  async createTopic(topic: InsertTopic): Promise<Topic> {
    const [created] = await db.insert(topics).values(topic).returning();
    return created;
  }

  async updateTopic(id: string, updates: Partial<InsertTopic>): Promise<Topic | undefined> {
    const [updated] = await db.update(topics).set({ ...updates, updatedAt: new Date() }).where(eq(topics.id, id)).returning();
    return updated;
  }

  async incrementTopicViews(id: string): Promise<void> {
    const topic = await this.getTopic(id);
    if (topic) {
      await db.update(topics).set({ viewCount: (topic.viewCount || 0) + 1 }).where(eq(topics.id, id));
    }
  }

  async deleteTopic(id: string): Promise<void> {
    await db.delete(topics).where(eq(topics.id, id));
  }

  // Posts
  async getPost(id: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async getPostByShareId(shareId: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.shareId, shareId));
    return post;
  }

  async getPostsByTopic(topicId: string): Promise<Post[]> {
    return db.select().from(posts).where(eq(posts.topicId, topicId)).orderBy(posts.createdAt);
  }

  async createPost(post: InsertPost): Promise<Post> {
    const [created] = await db.insert(posts).values(post).returning();
    return created;
  }

  async updatePost(id: string, updates: Partial<InsertPost>): Promise<Post | undefined> {
    const [updated] = await db.update(posts).set({ ...updates, updatedAt: new Date() }).where(eq(posts.id, id)).returning();
    return updated;
  }

  async deletePost(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  // Votes
  async getVotesByPost(postId: string): Promise<Vote[]> {
    return db.select().from(votes).where(eq(votes.postId, postId));
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    const [created] = await db.insert(votes).values(vote).returning();
    // Update vote counts on the post
    const postVotes = await this.getVotesByPost(vote.postId);
    const upvotes = postVotes.filter(v => v.voteType === 'upvote').length;
    const downvotes = postVotes.filter(v => v.voteType === 'downvote').length;
    await db.update(posts).set({ upvotes, downvotes }).where(eq(posts.id, vote.postId));
    return created;
  }

  async deleteVote(id: string): Promise<void> {
    const [vote] = await db.select().from(votes).where(eq(votes.id, id));
    await db.delete(votes).where(eq(votes.id, id));
    if (vote) {
      const postVotes = await this.getVotesByPost(vote.postId);
      const upvotes = postVotes.filter(v => v.voteType === 'upvote').length;
      const downvotes = postVotes.filter(v => v.voteType === 'downvote').length;
      await db.update(posts).set({ upvotes, downvotes }).where(eq(posts.id, vote.postId));
    }
  }

  // Attachments
  async getAttachment(id: string): Promise<Attachment | undefined> {
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id));
    return attachment;
  }

  async getAttachmentsByTopic(topicId: string): Promise<Attachment[]> {
    return db.select().from(attachments).where(eq(attachments.topicId, topicId));
  }

  async getAttachmentsByPost(postId: string): Promise<Attachment[]> {
    return db.select().from(attachments).where(eq(attachments.postId, postId));
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [created] = await db.insert(attachments).values(attachment).returning();
    return created;
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.delete(attachments).where(eq(attachments.id, id));
  }

  // Code Reviews
  async getCodeReview(id: string): Promise<CodeReview | undefined> {
    const [review] = await db.select().from(codeReviews).where(eq(codeReviews.id, id));
    return review;
  }

  async getCodeReviewsByWorkspace(workspaceId: string): Promise<CodeReview[]> {
    return db.select().from(codeReviews).where(eq(codeReviews.workspaceId, workspaceId)).orderBy(desc(codeReviews.createdAt));
  }

  async createCodeReview(review: InsertCodeReview): Promise<CodeReview> {
    const [created] = await db.insert(codeReviews).values(review).returning();
    return created;
  }

  async updateCodeReview(id: string, updates: Partial<InsertCodeReview>): Promise<CodeReview | undefined> {
    const [updated] = await db.update(codeReviews).set({ ...updates, updatedAt: new Date() }).where(eq(codeReviews.id, id)).returning();
    return updated;
  }

  async deleteCodeReview(id: string): Promise<void> {
    await db.delete(codeReviews).where(eq(codeReviews.id, id));
  }

  // Review Comments
  async getReviewComment(id: string): Promise<ReviewComment | undefined> {
    const [comment] = await db.select().from(reviewComments).where(eq(reviewComments.id, id));
    return comment;
  }

  async getReviewCommentsByReview(reviewId: string): Promise<ReviewComment[]> {
    return db.select().from(reviewComments).where(eq(reviewComments.reviewId, reviewId)).orderBy(reviewComments.createdAt);
  }

  async createReviewComment(comment: InsertReviewComment): Promise<ReviewComment> {
    const [created] = await db.insert(reviewComments).values(comment).returning();
    // Update approval/rejection counts
    const comments = await this.getReviewCommentsByReview(comment.reviewId);
    const approvals = comments.filter(c => c.isApproval).length;
    const rejections = comments.filter(c => !c.isApproval).length;
    await db.update(codeReviews).set({ approvalCount: approvals, rejectionCount: rejections }).where(eq(codeReviews.id, comment.reviewId));
    return created;
  }

  async deleteReviewComment(id: string): Promise<void> {
    const [comment] = await db.select().from(reviewComments).where(eq(reviewComments.id, id));
    await db.delete(reviewComments).where(eq(reviewComments.id, id));
    if (comment) {
      const comments = await this.getReviewCommentsByReview(comment.reviewId);
      const approvals = comments.filter(c => c.isApproval).length;
      const rejections = comments.filter(c => !c.isApproval).length;
      await db.update(codeReviews).set({ approvalCount: approvals, rejectionCount: rejections }).where(eq(codeReviews.id, comment.reviewId));
    }
  }

  // Mockups
  async getMockup(id: string): Promise<Mockup | undefined> {
    const [mockup] = await db.select().from(mockups).where(eq(mockups.id, id));
    return mockup;
  }

  async getMockupsByWorkspace(workspaceId: string): Promise<Mockup[]> {
    return db.select().from(mockups).where(eq(mockups.workspaceId, workspaceId)).orderBy(desc(mockups.createdAt));
  }

  async createMockup(mockup: InsertMockup): Promise<Mockup> {
    const [created] = await db.insert(mockups).values(mockup).returning();
    return created;
  }

  async updateMockup(id: string, updates: Partial<InsertMockup>): Promise<Mockup | undefined> {
    const [updated] = await db.update(mockups).set({ ...updates, updatedAt: new Date() }).where(eq(mockups.id, id)).returning();
    return updated;
  }

  async deleteMockup(id: string): Promise<void> {
    await db.delete(mockups).where(eq(mockups.id, id));
  }

  // Agent Tools
  async getAgentTool(id: string): Promise<AgentTool | undefined> {
    const [tool] = await db.select().from(agentTools).where(eq(agentTools.id, id));
    return tool;
  }

  async getAgentToolsByWorkspace(workspaceId: string): Promise<AgentTool[]> {
    return db.select().from(agentTools).where(eq(agentTools.workspaceId, workspaceId)).orderBy(desc(agentTools.createdAt));
  }

  async createAgentTool(tool: InsertAgentTool): Promise<AgentTool> {
    const [created] = await db.insert(agentTools).values(tool).returning();
    return created;
  }

  async updateAgentTool(id: string, updates: Partial<InsertAgentTool>): Promise<AgentTool | undefined> {
    const [updated] = await db.update(agentTools).set({ ...updates, updatedAt: new Date() }).where(eq(agentTools.id, id)).returning();
    return updated;
  }

  async deleteAgentTool(id: string): Promise<void> {
    await db.delete(agentTools).where(eq(agentTools.id, id));
  }

  // Lab Projects
  async getLabProject(id: string): Promise<LabProject | undefined> {
    const [project] = await db.select().from(labProjects).where(eq(labProjects.id, id));
    return project;
  }

  async getLabProjectsByWorkspace(workspaceId: string): Promise<LabProject[]> {
    return db.select().from(labProjects).where(eq(labProjects.workspaceId, workspaceId)).orderBy(desc(labProjects.createdAt));
  }

  async createLabProject(project: InsertLabProject): Promise<LabProject> {
    const [created] = await db.insert(labProjects).values(project).returning();
    return created;
  }

  async updateLabProject(id: string, updates: Partial<InsertLabProject>): Promise<LabProject | undefined> {
    const [updated] = await db.update(labProjects).set({ ...updates, updatedAt: new Date() }).where(eq(labProjects.id, id)).returning();
    return updated;
  }

  async deleteLabProject(id: string): Promise<void> {
    await db.delete(labProjects).where(eq(labProjects.id, id));
  }

  // External Cache
  async getExternalCache(id: string): Promise<ExternalCache | undefined> {
    const [cache] = await db.select().from(externalCache).where(eq(externalCache.id, id));
    return cache;
  }

  async getExternalCacheBySource(workspaceId: string, source: string, sourceId: string): Promise<ExternalCache | undefined> {
    const [cache] = await db.select().from(externalCache).where(
      and(eq(externalCache.workspaceId, workspaceId), eq(externalCache.source, source), eq(externalCache.sourceId, sourceId))
    );
    return cache;
  }

  async getExternalCacheByWorkspace(workspaceId: string, source?: string): Promise<ExternalCache[]> {
    if (source) {
      return db.select().from(externalCache).where(
        and(eq(externalCache.workspaceId, workspaceId), eq(externalCache.source, source))
      ).orderBy(desc(externalCache.createdAt));
    }
    return db.select().from(externalCache).where(eq(externalCache.workspaceId, workspaceId)).orderBy(desc(externalCache.createdAt));
  }

  async createExternalCache(cache: InsertExternalCache): Promise<ExternalCache> {
    const [created] = await db.insert(externalCache).values(cache).returning();
    return created;
  }

  async updateExternalCache(id: string, updates: Partial<InsertExternalCache>): Promise<ExternalCache | undefined> {
    const [updated] = await db.update(externalCache).set({ ...updates, updatedAt: new Date() }).where(eq(externalCache.id, id)).returning();
    return updated;
  }

  async deleteExternalCache(id: string): Promise<void> {
    await db.delete(externalCache).where(eq(externalCache.id, id));
  }

  // Agent Rooms
  async getAgentRoom(agentId: string): Promise<AgentRoom | undefined> {
    const [room] = await db.select().from(agentRooms).where(eq(agentRooms.agentId, agentId));
    return room;
  }

  async getAgentRoomsByWorkspace(workspaceId: string): Promise<AgentRoom[]> {
    return db.select().from(agentRooms).where(eq(agentRooms.workspaceId, workspaceId)).orderBy(desc(agentRooms.createdAt));
  }

  async createAgentRoom(room: InsertAgentRoom): Promise<AgentRoom> {
    const [created] = await db.insert(agentRooms).values(room).returning();
    return created;
  }

  async updateAgentRoom(agentId: string, updates: Partial<InsertAgentRoom>): Promise<AgentRoom | undefined> {
    const [updated] = await db.update(agentRooms).set({ ...updates, updatedAt: new Date() }).where(eq(agentRooms.agentId, agentId)).returning();
    return updated;
  }

  // Diary Entries
  async getDiaryEntry(id: string): Promise<DiaryEntry | undefined> {
    const [entry] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, id));
    return entry;
  }

  async getDiaryEntriesByAgent(agentId: string): Promise<DiaryEntry[]> {
    return db.select().from(diaryEntries).where(eq(diaryEntries.agentId, agentId)).orderBy(desc(diaryEntries.createdAt));
  }

  async getDiaryEntriesByWorkspace(workspaceId: string): Promise<DiaryEntry[]> {
    return db.select().from(diaryEntries).where(eq(diaryEntries.workspaceId, workspaceId)).orderBy(desc(diaryEntries.createdAt));
  }

  async createDiaryEntry(entry: InsertDiaryEntry): Promise<DiaryEntry> {
    const [created] = await db.insert(diaryEntries).values(entry).returning();
    return created;
  }

  async deleteDiaryEntry(id: string): Promise<void> {
    await db.delete(diaryEntries).where(eq(diaryEntries.id, id));
  }

  // Agent Goals
  async getAgentGoal(id: string): Promise<AgentGoal | undefined> {
    const [goal] = await db.select().from(agentGoals).where(eq(agentGoals.id, id));
    return goal;
  }

  async getGoalsByAgent(agentId: string): Promise<AgentGoal[]> {
    return db.select().from(agentGoals).where(eq(agentGoals.agentId, agentId)).orderBy(desc(agentGoals.priority));
  }

  async getGoalsByWorkspace(workspaceId: string): Promise<AgentGoal[]> {
    return db.select().from(agentGoals).where(eq(agentGoals.workspaceId, workspaceId)).orderBy(desc(agentGoals.priority));
  }

  async createAgentGoal(goal: InsertAgentGoal): Promise<AgentGoal> {
    const [created] = await db.insert(agentGoals).values(goal).returning();
    return created;
  }

  async updateAgentGoal(id: string, updates: Partial<InsertAgentGoal>): Promise<AgentGoal | undefined> {
    const [updated] = await db.update(agentGoals).set({ ...updates, updatedAt: new Date() }).where(eq(agentGoals.id, id)).returning();
    return updated;
  }

  // Agent Tasks
  async getAgentTask(id: string): Promise<AgentTask | undefined> {
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, id));
    return task;
  }

  async getTasksByAgent(agentId: string, status?: string): Promise<AgentTask[]> {
    if (status) {
      return db.select().from(agentTasks).where(and(eq(agentTasks.agentId, agentId), eq(agentTasks.status, status as any))).orderBy(desc(agentTasks.priority));
    }
    return db.select().from(agentTasks).where(eq(agentTasks.agentId, agentId)).orderBy(desc(agentTasks.priority));
  }

  async getTasksByWorkspace(workspaceId: string, status?: string): Promise<AgentTask[]> {
    if (status) {
      return db.select().from(agentTasks).where(and(eq(agentTasks.workspaceId, workspaceId), eq(agentTasks.status, status as any))).orderBy(desc(agentTasks.priority));
    }
    return db.select().from(agentTasks).where(eq(agentTasks.workspaceId, workspaceId)).orderBy(desc(agentTasks.priority));
  }

  async getNextTask(workspaceId: string): Promise<AgentTask | undefined> {
    const [task] = await db.select().from(agentTasks)
      .where(and(eq(agentTasks.workspaceId, workspaceId), eq(agentTasks.status, "queued")))
      .orderBy(desc(agentTasks.priority))
      .limit(1);
    return task;
  }

  async createAgentTask(task: InsertAgentTask): Promise<AgentTask> {
    const [created] = await db.insert(agentTasks).values(task).returning();
    return created;
  }

  async updateAgentTask(id: string, updates: Partial<InsertAgentTask>): Promise<AgentTask | undefined> {
    const [updated] = await db.update(agentTasks).set(updates).where(eq(agentTasks.id, id)).returning();
    return updated;
  }

  // Agent Runs
  async getAgentRun(id: string): Promise<AgentRun | undefined> {
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id));
    return run;
  }

  async getRunsByAgent(agentId: string, limit = 20): Promise<AgentRun[]> {
    return db.select().from(agentRuns).where(eq(agentRuns.agentId, agentId)).orderBy(desc(agentRuns.createdAt)).limit(limit);
  }

  async getRunsByWorkspace(workspaceId: string, limit = 50): Promise<AgentRun[]> {
    return db.select().from(agentRuns).where(eq(agentRuns.workspaceId, workspaceId)).orderBy(desc(agentRuns.createdAt)).limit(limit);
  }

  async createAgentRun(run: InsertAgentRun): Promise<AgentRun> {
    const [created] = await db.insert(agentRuns).values(run).returning();
    return created;
  }

  async updateAgentRun(id: string, updates: Partial<InsertAgentRun>): Promise<AgentRun | undefined> {
    const [updated] = await db.update(agentRuns).set(updates).where(eq(agentRuns.id, id)).returning();
    return updated;
  }

  // Activity Feed
  async getActivityFeed(workspaceId: string, limit = 50): Promise<ActivityFeedEntry[]> {
    return db.select().from(activityFeed).where(eq(activityFeed.workspaceId, workspaceId)).orderBy(desc(activityFeed.createdAt)).limit(limit);
  }

  async getAllActivity(limit = 100): Promise<ActivityFeedEntry[]> {
    return db.select().from(activityFeed).orderBy(desc(activityFeed.createdAt)).limit(limit);
  }

  async createActivityEntry(entry: InsertActivityFeedEntry): Promise<ActivityFeedEntry> {
    const [created] = await db.insert(activityFeed).values(entry).returning();
    return created;
  }

  // Token authentication for agent API access
  async validateApiToken(plainToken: string): Promise<{ token: ApiToken; agent: Agent | null } | null> {
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const [token] = await db.select().from(apiTokens).where(
      and(eq(apiTokens.tokenHash, tokenHash), eq(apiTokens.status, 'active'))
    );
    
    if (!token) return null;
    
    // Check expiration
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      await db.update(apiTokens).set({ status: 'expired' }).where(eq(apiTokens.id, token.id));
      return null;
    }
    
    // Increment usage
    await this.incrementTokenUsage(token.id);
    
    // Get associated agent if any
    let agent: Agent | null = null;
    if (token.agentId) {
      agent = await this.getAgent(token.agentId) || null;
    }
    
    return { token, agent };
  }

  // Pulse Updates
  async createPulseUpdate(data: InsertPulseUpdate): Promise<PulseUpdate> {
    const [created] = await db.insert(pulseUpdates).values(data).returning();
    return created;
  }

  async getPulsesByAgent(agentId: string): Promise<PulseUpdate[]> {
    return db.select().from(pulseUpdates).where(eq(pulseUpdates.agentId, agentId)).orderBy(desc(pulseUpdates.createdAt));
  }

  async getLatestPulse(agentId: string): Promise<PulseUpdate | undefined> {
    const [pulse] = await db.select().from(pulseUpdates).where(eq(pulseUpdates.agentId, agentId)).orderBy(desc(pulseUpdates.createdAt)).limit(1);
    return pulse;
  }

  async getPulsesByWorkspace(workspaceId: string): Promise<PulseUpdate[]> {
    return db.select().from(pulseUpdates).where(eq(pulseUpdates.workspaceId, workspaceId)).orderBy(desc(pulseUpdates.createdAt));
  }

  // Pheromones
  async createPheromone(data: InsertPheromone): Promise<Pheromone> {
    const [created] = await db.insert(pheromones).values(data).returning();
    return created;
  }

  async getActivePheromones(workspaceId: string): Promise<Pheromone[]> {
    return db.select().from(pheromones)
      .where(and(eq(pheromones.workspaceId, workspaceId), eq(pheromones.isActive, true)))
      .orderBy(desc(pheromones.createdAt));
  }

  async getPheromonesByAgent(agentId: string): Promise<Pheromone[]> {
    return db.select().from(pheromones)
      .where(eq(pheromones.emitterId, agentId))
      .orderBy(desc(pheromones.createdAt));
  }

  async getPheromonesForAgent(agentId: string, workspaceId: string): Promise<Pheromone[]> {
    const results = await db.select().from(pheromones)
      .where(and(
        eq(pheromones.workspaceId, workspaceId),
        eq(pheromones.isActive, true),
        ne(pheromones.emitterId, agentId)
      ))
      .orderBy(
        sql`CASE ${pheromones.strength} WHEN 'urgent' THEN 0 WHEN 'strong' THEN 1 WHEN 'moderate' THEN 2 WHEN 'faint' THEN 3 END`,
        desc(pheromones.createdAt)
      );
    return results;
  }

  async deactivatePheromone(id: string): Promise<void> {
    await db.update(pheromones).set({ isActive: false }).where(eq(pheromones.id, id));
  }

  async markPheromoneResponded(id: string, agentId: string): Promise<void> {
    await db.update(pheromones)
      .set({ respondedBy: sql`array_append(${pheromones.respondedBy}, ${agentId})` })
      .where(eq(pheromones.id, id));
  }

  async expireOldPheromones(): Promise<void> {
    await db.update(pheromones)
      .set({ isActive: false })
      .where(and(
        eq(pheromones.isActive, true),
        lt(pheromones.expiresAt, new Date())
      ));
  }

  // Area Temperatures
  async upsertAreaTemperature(data: InsertAreaTemperature): Promise<AreaTemperature> {
    const [existing] = await db.select().from(areaTemperatures)
      .where(eq(areaTemperatures.areaId, data.areaId));
    if (existing) {
      const [updated] = await db.update(areaTemperatures)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(areaTemperatures.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(areaTemperatures).values(data).returning();
    return created;
  }

  async getAreaTemperatures(workspaceId: string): Promise<AreaTemperature[]> {
    return db.select().from(areaTemperatures)
      .where(eq(areaTemperatures.workspaceId, workspaceId))
      .orderBy(asc(areaTemperatures.activityScore));
  }

  async getColdAreas(workspaceId: string): Promise<AreaTemperature[]> {
    return db.select().from(areaTemperatures)
      .where(and(
        eq(areaTemperatures.workspaceId, workspaceId),
        inArray(areaTemperatures.temperature, ['cold', 'frozen'])
      ));
  }

  async getHotAreas(workspaceId: string): Promise<AreaTemperature[]> {
    return db.select().from(areaTemperatures)
      .where(and(
        eq(areaTemperatures.workspaceId, workspaceId),
        eq(areaTemperatures.temperature, 'hot')
      ));
  }

  async updateAreaTemperature(id: string, data: Partial<AreaTemperature>): Promise<AreaTemperature> {
    const [updated] = await db.update(areaTemperatures)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(areaTemperatures.id, id))
      .returning();
    return updated;
  }

  async logTokenUsage(usage: InsertTokenUsage): Promise<TokenUsage> {
    const [entry] = await db.insert(tokenUsage).values(usage).returning();
    return entry;
  }

  async getTokenUsageSummary(workspaceId: string): Promise<{ totalTokens: number; totalRequests: number; byProvider: Record<string, number>; byAgent: Record<string, number> }> {
    const rows = await db.select().from(tokenUsage).where(eq(tokenUsage.workspaceId, workspaceId));
    const totalTokens = rows.reduce((s, r) => s + (r.tokensTotal || 0), 0);
    const totalRequests = rows.length;
    const byProvider: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    for (const r of rows) {
      byProvider[r.provider] = (byProvider[r.provider] || 0) + (r.tokensTotal || 0);
      if (r.agentId) {
        byAgent[r.agentId] = (byAgent[r.agentId] || 0) + (r.tokensTotal || 0);
      }
    }
    return { totalTokens, totalRequests, byProvider, byAgent };
  }

  async getTokenUsageBuckets(workspaceId: string, granularity: string, limit: number = 30): Promise<Array<{ bucket: string; totalTokens: number; requests: number; avgTokens: number }>> {
    const truncUnit = granularity === 'minute' ? 'minute' : granularity === 'hour' ? 'hour' : granularity === 'week' ? 'week' : granularity === 'month' ? 'month' : 'day';
    const result = await db.execute(sql`
      SELECT
        date_trunc(${truncUnit}, created_at) as bucket,
        COALESCE(SUM(tokens_total), 0)::int as total_tokens,
        COUNT(*)::int as requests,
        COALESCE(AVG(tokens_total), 0)::int as avg_tokens
      FROM token_usage
      WHERE workspace_id = ${workspaceId}
      GROUP BY bucket
      ORDER BY bucket DESC
      LIMIT ${limit}
    `);
    return (result.rows as any[]).map(r => ({
      bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
      totalTokens: Number(r.total_tokens) || 0,
      requests: Number(r.requests) || 0,
      avgTokens: Number(r.avg_tokens) || 0,
    }));
  }

  async getTokenBudget(workspaceId: string): Promise<TokenBudget | undefined> {
    const [budget] = await db.select().from(tokenBudgets)
      .where(eq(tokenBudgets.workspaceId, workspaceId))
      .orderBy(desc(tokenBudgets.createdAt))
      .limit(1);
    return budget;
  }

  async createTokenBudget(budget: InsertTokenBudget): Promise<TokenBudget> {
    const [created] = await db.insert(tokenBudgets).values(budget).returning();
    return created;
  }

  async updateTokenBudget(id: string, updates: Partial<InsertTokenBudget>): Promise<TokenBudget | undefined> {
    const [updated] = await db.update(tokenBudgets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tokenBudgets.id, id))
      .returning();
    return updated;
  }

  async getTokenBudgetRemaining(workspaceId: string): Promise<{ allocation: number; used: number; remaining: number; cadence: string } | null> {
    const budget = await this.getTokenBudget(workspaceId);
    if (!budget) return null;
    const now = new Date();
    const periodStart = budget.periodStart || budget.createdAt || now;
    const usageRows = await db.select().from(tokenUsage)
      .where(and(
        eq(tokenUsage.workspaceId, workspaceId),
        sql`created_at >= ${periodStart}`
      ));
    const used = usageRows.reduce((s, r) => s + (r.tokensTotal || 0), 0);
    return {
      allocation: budget.allocation,
      used,
      remaining: Math.max(0, budget.allocation - used),
      cadence: budget.cadence,
    };
  }

  async createShowcaseVote(vote: InsertShowcaseVote): Promise<ShowcaseVote> {
    const [created] = await db.insert(showcaseVotes).values(vote).returning();
    return created;
  }

  async getShowcaseVotes(targetType: string, targetId: string): Promise<ShowcaseVote[]> {
    return db.select().from(showcaseVotes)
      .where(and(eq(showcaseVotes.targetType, targetType as any), eq(showcaseVotes.targetId, targetId)))
      .orderBy(desc(showcaseVotes.createdAt));
  }

  async getShowcaseVotesByWorkspace(workspaceId: string): Promise<ShowcaseVote[]> {
    return db.select().from(showcaseVotes)
      .where(eq(showcaseVotes.workspaceId, workspaceId))
      .orderBy(desc(showcaseVotes.createdAt));
  }

  async deleteShowcaseVote(id: string): Promise<void> {
    await db.delete(showcaseVotes).where(eq(showcaseVotes.id, id));
  }

  async getLeaderboard(workspaceId: string): Promise<LeaderboardScore[]> {
    return db.select().from(leaderboardScores)
      .where(eq(leaderboardScores.workspaceId, workspaceId))
      .orderBy(desc(leaderboardScores.totalScore));
  }

  async getLeaderboardScore(agentId: string, workspaceId: string): Promise<LeaderboardScore | undefined> {
    const [score] = await db.select().from(leaderboardScores)
      .where(and(eq(leaderboardScores.agentId, agentId), eq(leaderboardScores.workspaceId, workspaceId)));
    return score;
  }

  async upsertLeaderboardScore(agentId: string, workspaceId: string, updates: Partial<InsertLeaderboardScore>): Promise<LeaderboardScore> {
    const existing = await this.getLeaderboardScore(agentId, workspaceId);
    if (existing) {
      const newVotes = (existing.totalVotes || 0) + (updates.totalVotes || 0);
      const newStars = (existing.totalStars || 0) + (updates.totalStars || 0);
      const newTools = (existing.toolsCreated || 0) + (updates.toolsCreated || 0);
      const newProjects = (existing.projectsCreated || 0) + (updates.projectsCreated || 0);
      const newUsage = (existing.toolUsageCount || 0) + (updates.toolUsageCount || 0);
      const newArt = (existing.artCreated || 0) + (updates.artCreated || 0);
      const totalScore = newVotes * 2 + newStars * 5 + newTools * 10 + newProjects * 15 + newUsage * 1 + newArt * 8;
      const [updated] = await db.update(leaderboardScores).set({
        totalVotes: newVotes,
        totalStars: newStars,
        toolsCreated: newTools,
        projectsCreated: newProjects,
        toolUsageCount: newUsage,
        artCreated: newArt,
        totalScore,
        updatedAt: new Date(),
      }).where(eq(leaderboardScores.id, existing.id)).returning();
      return updated;
    } else {
      const totalScore = (updates.totalVotes || 0) * 2 + (updates.totalStars || 0) * 5 + (updates.toolsCreated || 0) * 10 + (updates.projectsCreated || 0) * 15 + (updates.toolUsageCount || 0) * 1 + (updates.artCreated || 0) * 8;
      const [created] = await db.insert(leaderboardScores).values({
        agentId,
        workspaceId,
        ...updates,
        totalScore,
      }).returning();
      return created;
    }
  }
  // Media Reports
  async createMediaReport(report: InsertMediaReport): Promise<MediaReport> {
    const [created] = await db.insert(mediaReports).values(report).returning();
    return created;
  }

  async getMediaReport(id: string): Promise<MediaReport | undefined> {
    const [report] = await db.select().from(mediaReports).where(eq(mediaReports.id, id));
    return report;
  }

  async getMediaReportsByWorkspace(workspaceId: string): Promise<MediaReport[]> {
    return db.select().from(mediaReports)
      .where(eq(mediaReports.workspaceId, workspaceId))
      .orderBy(desc(mediaReports.createdAt));
  }

  async updateMediaReport(id: string, updates: Partial<InsertMediaReport>): Promise<MediaReport | undefined> {
    const [updated] = await db.update(mediaReports).set(updates).where(eq(mediaReports.id, id)).returning();
    return updated;
  }

  async createMediaReportRating(rating: InsertMediaReportRating): Promise<MediaReportRating> {
    const [created] = await db.insert(mediaReportRatings).values(rating).returning();
    const allRatings = await this.getMediaReportRatings(rating.reportId);
    const avg = Math.round(allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length);
    await db.update(mediaReports).set({
      ratingsCount: allRatings.length,
      averageRating: avg,
    }).where(eq(mediaReports.id, rating.reportId));
    return created;
  }

  async getMediaReportRatings(reportId: string): Promise<MediaReportRating[]> {
    return db.select().from(mediaReportRatings).where(eq(mediaReportRatings.reportId, reportId));
  }

  async getMediaReportRatingByAgent(reportId: string, agentId: string): Promise<MediaReportRating | undefined> {
    const [rating] = await db.select().from(mediaReportRatings)
      .where(and(eq(mediaReportRatings.reportId, reportId), eq(mediaReportRatings.raterAgentId, agentId)));
    return rating;
  }

  // Competitions
  async createCompetition(comp: InsertCompetition): Promise<Competition> {
    const [created] = await db.insert(competitions).values(comp).returning();
    return created;
  }

  async getCompetition(id: string): Promise<Competition | undefined> {
    const [comp] = await db.select().from(competitions).where(eq(competitions.id, id));
    return comp;
  }

  async getCompetitionsByWorkspace(workspaceId: string): Promise<Competition[]> {
    return db.select().from(competitions)
      .where(eq(competitions.workspaceId, workspaceId))
      .orderBy(desc(competitions.createdAt));
  }

  async updateCompetition(id: string, updates: Partial<InsertCompetition>): Promise<Competition | undefined> {
    const [updated] = await db.update(competitions).set(updates).where(eq(competitions.id, id)).returning();
    return updated;
  }

  async createCompetitionEntry(entry: InsertCompetitionEntry): Promise<CompetitionEntry> {
    const [created] = await db.insert(competitionEntries).values(entry).returning();
    return created;
  }

  async getCompetitionEntries(competitionId: string): Promise<CompetitionEntry[]> {
    return db.select().from(competitionEntries)
      .where(eq(competitionEntries.competitionId, competitionId))
      .orderBy(desc(competitionEntries.score));
  }

  async updateCompetitionEntry(id: string, updates: Partial<InsertCompetitionEntry>): Promise<CompetitionEntry | undefined> {
    const [updated] = await db.update(competitionEntries).set(updates).where(eq(competitionEntries.id, id)).returning();
    return updated;
  }

  async createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest> {
    const [created] = await db.insert(changeRequests).values(request).returning();
    return created;
  }

  async getChangeRequest(id: string): Promise<ChangeRequest | undefined> {
    const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, id));
    return cr;
  }

  async getChangeRequestsByWorkspace(workspaceId: string): Promise<ChangeRequest[]> {
    return db.select().from(changeRequests)
      .where(eq(changeRequests.workspaceId, workspaceId))
      .orderBy(desc(changeRequests.createdAt));
  }

  async updateChangeRequest(id: string, updates: Partial<ChangeRequest>): Promise<ChangeRequest | undefined> {
    const [updated] = await db.update(changeRequests).set(updates).where(eq(changeRequests.id, id)).returning();
    return updated;
  }

  async createBroadcastComment(comment: InsertBroadcastComment): Promise<BroadcastComment> {
    const [created] = await db.insert(broadcastComments).values(comment).returning();
    return created;
  }

  async getBroadcastCommentsByReport(reportId: string): Promise<BroadcastComment[]> {
    return db.select().from(broadcastComments)
      .where(eq(broadcastComments.reportId, reportId))
      .orderBy(asc(broadcastComments.createdAt));
  }
}

export const storage = new DatabaseStorage();
