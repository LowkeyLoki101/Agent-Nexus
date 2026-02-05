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
  boards,
  topics,
  posts,
  votes,
  attachments,
  codeReviews,
  reviewComments,
  mockups,
  externalCache,
  agentRooms,
  diaryEntries,
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
  type ExternalCache,
  type InsertExternalCache,
  type AgentRoom,
  type InsertAgentRoom,
  type DiaryEntry,
  type InsertDiaryEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, ilike, sql } from "drizzle-orm";
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

  // Token authentication
  validateApiToken(plainToken: string): Promise<{ token: ApiToken; agent: Agent | null } | null>;
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
}

export const storage = new DatabaseStorage();
