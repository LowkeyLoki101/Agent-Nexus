import {
  workspaces,
  workspaceMembers,
  memberRoleEnum,
  agents,
  apiTokens,
  auditLogs,
  briefings,
  rooms,
  agentState,
  agentGoals,
  agentMemory,
  agentRelationships,
  messageBoardPosts,
  diaryEntries,
  newsEvents,
  chatMessages,
  narratorLogs,
  competitions,
  diceRollLog,
  collaborations,
  chaosEvents,
  simulationState,
  informationInjections,
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
  type Room,
  type InsertRoom,
  type AgentState,
  type InsertAgentState,
  type AgentGoal,
  type InsertAgentGoal,
  type AgentMemoryEntry,
  type InsertAgentMemory,
  type AgentRelationship,
  type InsertAgentRelationship,
  type MessageBoardPost,
  type InsertMessageBoardPost,
  type DiaryEntry,
  type InsertDiaryEntry,
  type NewsEvent,
  type InsertNewsEvent,
  type ChatMessage,
  type InsertChatMessage,
  type NarratorLog,
  type InsertNarratorLog,
  type Competition,
  type InsertCompetition,
  type DiceRollLogEntry,
  type InsertDiceRollLog,
  type Collaboration,
  type InsertCollaboration,
  type ChaosEvent,
  type InsertChaosEvent,
  type SimulationStateRecord,
  type InsertSimulationState,
  type InformationInjection,
  type InsertInformationInjection,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

type MemberRole = (typeof memberRoleEnum.enumValues)[number];

export interface IStorage {
  // --- Original ---
  getWorkspace(id: string): Promise<Workspace | undefined>;
  getWorkspaceBySlug(slug: string): Promise<Workspace | undefined>;
  getWorkspacesByUser(userId: string): Promise<Workspace[]>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: string, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined>;

  getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  addWorkspaceMember(member: InsertWorkspaceMember): Promise<WorkspaceMember>;
  removeWorkspaceMember(id: string): Promise<void>;
  updateMemberRole(id: string, role: MemberRole): Promise<WorkspaceMember | undefined>;

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

  // --- Simulation: Rooms ---
  getRoom(id: string): Promise<Room | undefined>;
  getRoomsByWorkspace(workspaceId: string): Promise<Room[]>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, updates: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<void>;

  // --- Simulation: Agent State ---
  getAgentState(agentId: string): Promise<AgentState | undefined>;
  getAgentStatesByWorkspace(workspaceId: string): Promise<AgentState[]>;
  getAgentStatesByRoom(roomId: string): Promise<AgentState[]>;
  createAgentState(state: InsertAgentState): Promise<AgentState>;
  updateAgentState(agentId: string, updates: Partial<AgentState>): Promise<AgentState | undefined>;

  // --- Simulation: Agent Goals ---
  getAgentGoals(agentId: string): Promise<AgentGoal[]>;
  getActiveGoals(agentId: string): Promise<AgentGoal[]>;
  createAgentGoal(goal: InsertAgentGoal): Promise<AgentGoal>;
  updateAgentGoal(id: string, updates: Partial<AgentGoal>): Promise<AgentGoal | undefined>;

  // --- Simulation: Agent Memory ---
  createAgentMemory(memory: InsertAgentMemory): Promise<AgentMemoryEntry>;
  getAgentMemories(agentId: string, limit?: number): Promise<AgentMemoryEntry[]>;
  decayMemoryRelevance(agentId: string, decayAmount?: number): Promise<void>;

  // --- Simulation: Agent Relationships ---
  getAgentRelationships(agentId: string): Promise<AgentRelationship[]>;
  getRelationship(agentId: string, targetId: string): Promise<AgentRelationship | undefined>;
  upsertRelationship(rel: InsertAgentRelationship): Promise<AgentRelationship>;

  // --- Simulation: Message Board ---
  getMessageBoardPosts(roomId: string, limit?: number): Promise<MessageBoardPost[]>;
  getRecentBoardPosts(workspaceId: string, limit?: number): Promise<MessageBoardPost[]>;
  createBoardPost(post: InsertMessageBoardPost): Promise<MessageBoardPost>;
  upvoteBoardPost(id: string): Promise<void>;
  downvoteBoardPost(id: string): Promise<void>;

  // --- Simulation: Diary Entries ---
  getDiaryEntries(agentId: string, limit?: number): Promise<DiaryEntry[]>;
  createDiaryEntry(entry: InsertDiaryEntry): Promise<DiaryEntry>;

  // --- Simulation: News Events ---
  getNewsEvents(workspaceId: string, limit?: number): Promise<NewsEvent[]>;
  createNewsEvent(event: InsertNewsEvent): Promise<NewsEvent>;

  // --- Simulation: Chat Messages ---
  getChatMessages(agentId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // --- Simulation: Narrator Logs ---
  getNarratorLogs(agentId: string, limit?: number): Promise<NarratorLog[]>;
  createNarratorLog(log: InsertNarratorLog): Promise<NarratorLog>;

  // --- Simulation: Competitions ---
  getCompetitions(workspaceId: string): Promise<Competition[]>;
  getActiveCompetitions(workspaceId: string): Promise<Competition[]>;
  createCompetition(comp: InsertCompetition): Promise<Competition>;
  updateCompetition(id: string, updates: Partial<Competition>): Promise<Competition | undefined>;

  // --- Simulation: Dice Rolls ---
  createDiceRollLog(roll: InsertDiceRollLog): Promise<DiceRollLogEntry>;
  getDiceRolls(agentId: string, limit?: number): Promise<DiceRollLogEntry[]>;

  // --- Simulation: Collaborations ---
  getCollaborations(workspaceId: string): Promise<Collaboration[]>;
  createCollaboration(collab: InsertCollaboration): Promise<Collaboration>;
  updateCollaboration(id: string, updates: Partial<Collaboration>): Promise<Collaboration | undefined>;

  // --- Simulation: Chaos Events ---
  getActiveChaosEvents(workspaceId: string): Promise<ChaosEvent[]>;
  createChaosEvent(event: InsertChaosEvent): Promise<ChaosEvent>;
  tickChaosEvents(workspaceId: string): Promise<void>;

  // --- Simulation: Simulation State ---
  getSimulationState(workspaceId: string): Promise<SimulationStateRecord | undefined>;
  upsertSimulationState(state: InsertSimulationState): Promise<SimulationStateRecord>;

  // --- Simulation: Information Injections ---
  getInformationInjections(workspaceId: string): Promise<InformationInjection[]>;
  getPendingInjections(workspaceId: string): Promise<InformationInjection[]>;
  createInformationInjection(injection: InsertInformationInjection): Promise<InformationInjection>;
  updateInformationInjection(id: string, updates: Partial<InformationInjection>): Promise<InformationInjection | undefined>;
}

export class DatabaseStorage implements IStorage {
  // =============================================
  // ORIGINAL METHODS (unchanged)
  // =============================================

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async getWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
    return workspace;
  }

  async getWorkspacesByUser(userId: string): Promise<Workspace[]> {
    const memberRows = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));

    const memberWorkspaceIds = memberRows.map((r) => r.workspaceId);

    if (memberWorkspaceIds.length === 0) {
      return db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
    }

    return db
      .select()
      .from(workspaces)
      .where(
        or(
          eq(workspaces.ownerId, userId),
          inArray(workspaces.id, memberWorkspaceIds)
        )
      );
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

  async updateMemberRole(id: string, role: MemberRole): Promise<WorkspaceMember | undefined> {
    const [updated] = await db
      .update(workspaceMembers)
      .set({ role })
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
    await db.update(apiTokens).set({ status: 'revoked' }).where(eq(apiTokens.id, id));
  }

  async incrementTokenUsage(id: string): Promise<void> {
    const token = await this.getApiToken(id);
    if (token) {
      await db.update(apiTokens).set({
        usageCount: (token.usageCount || 0) + 1,
        lastUsedAt: new Date()
      }).where(eq(apiTokens.id, id));
    }
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogsByWorkspace(workspaceId: string, limit = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs).where(eq(auditLogs.workspaceId, workspaceId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async getAuditLogsByUser(userId: string, limit = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async getRecentAuditLogs(userId: string, limit = 10): Promise<AuditLog[]> {
    return db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async getBriefing(id: string): Promise<Briefing | undefined> {
    const [briefing] = await db.select().from(briefings).where(eq(briefings.id, id));
    return briefing;
  }

  async getBriefingsByWorkspace(workspaceId: string): Promise<Briefing[]> {
    return db.select().from(briefings).where(eq(briefings.workspaceId, workspaceId)).orderBy(desc(briefings.createdAt));
  }

  async getBriefingsByUser(userId: string): Promise<Briefing[]> {
    return db.select().from(briefings).where(eq(briefings.createdById, userId)).orderBy(desc(briefings.createdAt));
  }

  async getRecentBriefings(userId: string, limit = 10): Promise<Briefing[]> {
    return db.select().from(briefings).where(eq(briefings.createdById, userId)).orderBy(desc(briefings.createdAt)).limit(limit);
  }

  async createBriefing(briefing: InsertBriefing): Promise<Briefing> {
    const [created] = await db.insert(briefings).values(briefing).returning();
    return created;
  }

  async updateBriefing(id: string, updates: Partial<InsertBriefing>): Promise<Briefing | undefined> {
    const [updated] = await db.update(briefings).set({ ...updates, updatedAt: new Date() }).where(eq(briefings.id, id)).returning();
    return updated;
  }

  async deleteBriefing(id: string): Promise<void> {
    await db.delete(briefings).where(eq(briefings.id, id));
  }

  // =============================================
  // SIMULATION: ROOMS
  // =============================================

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async getRoomsByWorkspace(workspaceId: string): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.workspaceId, workspaceId)).orderBy(rooms.name);
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const [created] = await db.insert(rooms).values(room).returning();
    return created;
  }

  async updateRoom(id: string, updates: Partial<InsertRoom>): Promise<Room | undefined> {
    const [updated] = await db.update(rooms).set({ ...updates, updatedAt: new Date() }).where(eq(rooms.id, id)).returning();
    return updated;
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(rooms).where(eq(rooms.id, id));
  }

  // =============================================
  // SIMULATION: AGENT STATE
  // =============================================

  async getAgentState(agentId: string): Promise<AgentState | undefined> {
    const [state] = await db.select().from(agentState).where(eq(agentState.agentId, agentId));
    return state;
  }

  async getAgentStatesByWorkspace(workspaceId: string): Promise<AgentState[]> {
    return db.select().from(agentState).where(eq(agentState.workspaceId, workspaceId));
  }

  async getAgentStatesByRoom(roomId: string): Promise<AgentState[]> {
    return db.select().from(agentState).where(eq(agentState.currentRoomId, roomId));
  }

  async createAgentState(state: InsertAgentState): Promise<AgentState> {
    const [created] = await db.insert(agentState).values(state).returning();
    return created;
  }

  async updateAgentState(agentId: string, updates: Partial<AgentState>): Promise<AgentState | undefined> {
    const [updated] = await db.update(agentState).set({ ...updates, updatedAt: new Date() }).where(eq(agentState.agentId, agentId)).returning();
    return updated;
  }

  // =============================================
  // SIMULATION: AGENT GOALS
  // =============================================

  async getAgentGoals(agentId: string): Promise<AgentGoal[]> {
    return db.select().from(agentGoals).where(eq(agentGoals.agentId, agentId)).orderBy(desc(agentGoals.priority));
  }

  async getActiveGoals(agentId: string): Promise<AgentGoal[]> {
    return db.select().from(agentGoals).where(and(eq(agentGoals.agentId, agentId), eq(agentGoals.status, "active"))).orderBy(desc(agentGoals.weight));
  }

  async createAgentGoal(goal: InsertAgentGoal): Promise<AgentGoal> {
    const [created] = await db.insert(agentGoals).values(goal).returning();
    return created;
  }

  async updateAgentGoal(id: string, updates: Partial<AgentGoal>): Promise<AgentGoal | undefined> {
    const [updated] = await db.update(agentGoals).set({ ...updates, updatedAt: new Date() }).where(eq(agentGoals.id, id)).returning();
    return updated;
  }

  // =============================================
  // SIMULATION: AGENT MEMORY
  // =============================================

  async createAgentMemory(memory: InsertAgentMemory): Promise<AgentMemoryEntry> {
    const [created] = await db.insert(agentMemory).values(memory).returning();
    return created;
  }

  async getAgentMemories(agentId: string, limit = 50): Promise<AgentMemoryEntry[]> {
    return db.select().from(agentMemory).where(eq(agentMemory.agentId, agentId)).orderBy(desc(agentMemory.createdAt)).limit(limit);
  }

  async decayMemoryRelevance(agentId: string, decayAmount = 5): Promise<void> {
    await db.execute(
      sql`UPDATE agent_memory SET relevance = GREATEST(0, relevance - ${decayAmount}) WHERE agent_id = ${agentId} AND relevance > 0`
    );
  }

  // =============================================
  // SIMULATION: AGENT RELATIONSHIPS
  // =============================================

  async getAgentRelationships(agentId: string): Promise<AgentRelationship[]> {
    return db.select().from(agentRelationships).where(eq(agentRelationships.agentId, agentId));
  }

  async getRelationship(agentId: string, targetId: string): Promise<AgentRelationship | undefined> {
    const [rel] = await db.select().from(agentRelationships).where(
      and(eq(agentRelationships.agentId, agentId), eq(agentRelationships.targetAgentId, targetId))
    );
    return rel;
  }

  async upsertRelationship(rel: InsertAgentRelationship): Promise<AgentRelationship> {
    const existing = await this.getRelationship(rel.agentId, rel.targetAgentId);
    if (existing) {
      const [updated] = await db.update(agentRelationships)
        .set({ ...rel, updatedAt: new Date() })
        .where(eq(agentRelationships.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(agentRelationships).values(rel).returning();
    return created;
  }

  // =============================================
  // SIMULATION: MESSAGE BOARD
  // =============================================

  async getMessageBoardPosts(roomId: string, limit = 50): Promise<MessageBoardPost[]> {
    return db.select().from(messageBoardPosts).where(eq(messageBoardPosts.roomId, roomId)).orderBy(desc(messageBoardPosts.createdAt)).limit(limit);
  }

  async getRecentBoardPosts(workspaceId: string, limit = 20): Promise<MessageBoardPost[]> {
    const workspaceRooms = await this.getRoomsByWorkspace(workspaceId);
    if (workspaceRooms.length === 0) return [];
    const roomIds = workspaceRooms.map(r => r.id);
    return db.select().from(messageBoardPosts).where(inArray(messageBoardPosts.roomId, roomIds)).orderBy(desc(messageBoardPosts.createdAt)).limit(limit);
  }

  async createBoardPost(post: InsertMessageBoardPost): Promise<MessageBoardPost> {
    const [created] = await db.insert(messageBoardPosts).values(post).returning();
    return created;
  }

  async upvoteBoardPost(id: string): Promise<void> {
    await db.execute(sql`UPDATE message_board_posts SET upvotes = upvotes + 1 WHERE id = ${id}`);
  }

  async downvoteBoardPost(id: string): Promise<void> {
    await db.execute(sql`UPDATE message_board_posts SET downvotes = downvotes + 1 WHERE id = ${id}`);
  }

  // =============================================
  // SIMULATION: DIARY ENTRIES
  // =============================================

  async getDiaryEntries(agentId: string, limit = 50): Promise<DiaryEntry[]> {
    return db.select().from(diaryEntries).where(eq(diaryEntries.agentId, agentId)).orderBy(desc(diaryEntries.createdAt)).limit(limit);
  }

  async createDiaryEntry(entry: InsertDiaryEntry): Promise<DiaryEntry> {
    const [created] = await db.insert(diaryEntries).values(entry).returning();
    return created;
  }

  // =============================================
  // SIMULATION: NEWS EVENTS
  // =============================================

  async getNewsEvents(workspaceId: string, limit = 50): Promise<NewsEvent[]> {
    return db.select().from(newsEvents).where(eq(newsEvents.workspaceId, workspaceId)).orderBy(desc(newsEvents.createdAt)).limit(limit);
  }

  async createNewsEvent(event: InsertNewsEvent): Promise<NewsEvent> {
    const [created] = await db.insert(newsEvents).values(event).returning();
    return created;
  }

  // =============================================
  // SIMULATION: CHAT MESSAGES
  // =============================================

  async getChatMessages(agentId: string, limit = 100): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.agentId, agentId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    return created;
  }

  // =============================================
  // SIMULATION: NARRATOR LOGS
  // =============================================

  async getNarratorLogs(agentId: string, limit = 50): Promise<NarratorLog[]> {
    return db.select().from(narratorLogs).where(eq(narratorLogs.agentId, agentId)).orderBy(desc(narratorLogs.createdAt)).limit(limit);
  }

  async createNarratorLog(log: InsertNarratorLog): Promise<NarratorLog> {
    const [created] = await db.insert(narratorLogs).values(log).returning();
    return created;
  }

  // =============================================
  // SIMULATION: COMPETITIONS
  // =============================================

  async getCompetitions(workspaceId: string): Promise<Competition[]> {
    return db.select().from(competitions).where(eq(competitions.workspaceId, workspaceId)).orderBy(desc(competitions.createdAt));
  }

  async getActiveCompetitions(workspaceId: string): Promise<Competition[]> {
    return db.select().from(competitions).where(
      and(eq(competitions.workspaceId, workspaceId), inArray(competitions.status, ["pending", "active", "voting"]))
    );
  }

  async createCompetition(comp: InsertCompetition): Promise<Competition> {
    const [created] = await db.insert(competitions).values(comp).returning();
    return created;
  }

  async updateCompetition(id: string, updates: Partial<Competition>): Promise<Competition | undefined> {
    const [updated] = await db.update(competitions).set(updates).where(eq(competitions.id, id)).returning();
    return updated;
  }

  // =============================================
  // SIMULATION: DICE ROLLS
  // =============================================

  async createDiceRollLog(roll: InsertDiceRollLog): Promise<DiceRollLogEntry> {
    const [created] = await db.insert(diceRollLog).values(roll).returning();
    return created;
  }

  async getDiceRolls(agentId: string, limit = 50): Promise<DiceRollLogEntry[]> {
    return db.select().from(diceRollLog).where(eq(diceRollLog.agentId, agentId)).orderBy(desc(diceRollLog.createdAt)).limit(limit);
  }

  // =============================================
  // SIMULATION: COLLABORATIONS
  // =============================================

  async getCollaborations(workspaceId: string): Promise<Collaboration[]> {
    return db.select().from(collaborations).where(eq(collaborations.workspaceId, workspaceId)).orderBy(desc(collaborations.createdAt));
  }

  async createCollaboration(collab: InsertCollaboration): Promise<Collaboration> {
    const [created] = await db.insert(collaborations).values(collab).returning();
    return created;
  }

  async updateCollaboration(id: string, updates: Partial<Collaboration>): Promise<Collaboration | undefined> {
    const [updated] = await db.update(collaborations).set(updates).where(eq(collaborations.id, id)).returning();
    return updated;
  }

  // =============================================
  // SIMULATION: CHAOS EVENTS
  // =============================================

  async getActiveChaosEvents(workspaceId: string): Promise<ChaosEvent[]> {
    return db.select().from(chaosEvents).where(
      and(eq(chaosEvents.workspaceId, workspaceId), eq(chaosEvents.isActive, true))
    );
  }

  async createChaosEvent(event: InsertChaosEvent): Promise<ChaosEvent> {
    const [created] = await db.insert(chaosEvents).values(event).returning();
    return created;
  }

  async tickChaosEvents(workspaceId: string): Promise<void> {
    // Decrease remaining ticks, deactivate expired
    await db.execute(
      sql`UPDATE chaos_events SET remaining_ticks = remaining_ticks - 1 WHERE workspace_id = ${workspaceId} AND is_active = true`
    );
    await db.execute(
      sql`UPDATE chaos_events SET is_active = false WHERE workspace_id = ${workspaceId} AND remaining_ticks <= 0`
    );
  }

  // =============================================
  // SIMULATION: SIMULATION STATE
  // =============================================

  async getSimulationState(workspaceId: string): Promise<SimulationStateRecord | undefined> {
    const [state] = await db.select().from(simulationState).where(eq(simulationState.workspaceId, workspaceId));
    return state;
  }

  async upsertSimulationState(state: InsertSimulationState): Promise<SimulationStateRecord> {
    const existing = await this.getSimulationState(state.workspaceId);
    if (existing) {
      const [updated] = await db.update(simulationState)
        .set({ ...state, updatedAt: new Date() })
        .where(eq(simulationState.workspaceId, state.workspaceId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(simulationState).values(state).returning();
    return created;
  }

  // =============================================
  // SIMULATION: INFORMATION INJECTIONS
  // =============================================

  async getInformationInjections(workspaceId: string): Promise<InformationInjection[]> {
    return db.select().from(informationInjections).where(eq(informationInjections.workspaceId, workspaceId)).orderBy(desc(informationInjections.createdAt));
  }

  async getPendingInjections(workspaceId: string): Promise<InformationInjection[]> {
    return db.select().from(informationInjections).where(
      and(eq(informationInjections.workspaceId, workspaceId), eq(informationInjections.status, "pending"))
    );
  }

  async createInformationInjection(injection: InsertInformationInjection): Promise<InformationInjection> {
    const [created] = await db.insert(informationInjections).values(injection as any).returning();
    return created;
  }

  async updateInformationInjection(id: string, updates: Partial<InformationInjection>): Promise<InformationInjection | undefined> {
    const [updated] = await db.update(informationInjections).set({ ...updates, updatedAt: new Date() }).where(eq(informationInjections.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
