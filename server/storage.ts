import {
  workspaces,
  workspaceMembers,
  memberRoleEnum,
  agents,
  apiTokens,
  auditLogs,
  briefings,
  gameProfiles,
  gameTasks,
  gameTaskCompletions,
  gameCycles,
  gameForgeAccess,
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
  type GameProfile,
  type InsertGameProfile,
  type GameTask,
  type InsertGameTask,
  type GameTaskCompletion,
  type InsertGameTaskCompletion,
  type GameCycle,
  type InsertGameCycle,
  type GameForgeAccess,
  type InsertGameForgeAccess,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

type MemberRole = (typeof memberRoleEnum.enumValues)[number];

export interface IStorage {
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

  // Game system
  getGameProfile(userId: string): Promise<GameProfile | undefined>;
  createGameProfile(profile: InsertGameProfile): Promise<GameProfile>;
  updateGameProfile(userId: string, updates: Partial<InsertGameProfile>): Promise<GameProfile | undefined>;
  getGameTasks(room?: string): Promise<GameTask[]>;
  getGameTask(id: string): Promise<GameTask | undefined>;
  createGameTask(task: InsertGameTask): Promise<GameTask>;
  getTaskCompletionsByUserCycle(userId: string, cycleNumber: number): Promise<GameTaskCompletion[]>;
  createTaskCompletion(completion: InsertGameTaskCompletion): Promise<GameTaskCompletion>;
  getGameCycle(userId: string, cycleNumber: number): Promise<GameCycle | undefined>;
  getCurrentGameCycle(userId: string): Promise<GameCycle | undefined>;
  createGameCycle(cycle: InsertGameCycle): Promise<GameCycle>;
  updateGameCycle(id: string, updates: Partial<InsertGameCycle>): Promise<GameCycle | undefined>;
  getGameCycleHistory(userId: string, limit?: number): Promise<GameCycle[]>;
  createForgeAccess(access: InsertGameForgeAccess): Promise<GameForgeAccess>;
  getActiveForgeAccess(userId: string): Promise<GameForgeAccess | undefined>;
  updateForgeAccess(id: string, updates: Partial<InsertGameForgeAccess>): Promise<GameForgeAccess | undefined>;
  getForgeAccessHistory(userId: string, limit?: number): Promise<GameForgeAccess[]>;
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

  // --- Game System ---

  async getGameProfile(userId: string): Promise<GameProfile | undefined> {
    const [profile] = await db.select().from(gameProfiles).where(eq(gameProfiles.userId, userId));
    return profile;
  }

  async createGameProfile(profile: InsertGameProfile): Promise<GameProfile> {
    const [created] = await db.insert(gameProfiles).values(profile).returning();
    return created;
  }

  async updateGameProfile(userId: string, updates: Partial<InsertGameProfile>): Promise<GameProfile | undefined> {
    const [updated] = await db
      .update(gameProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(gameProfiles.userId, userId))
      .returning();
    return updated;
  }

  async getGameTasks(room?: string): Promise<GameTask[]> {
    if (room) {
      return db.select().from(gameTasks)
        .where(and(eq(gameTasks.isActive, true), eq(gameTasks.room, room as any)))
        .orderBy(gameTasks.sortOrder);
    }
    return db.select().from(gameTasks)
      .where(eq(gameTasks.isActive, true))
      .orderBy(gameTasks.sortOrder);
  }

  async getGameTask(id: string): Promise<GameTask | undefined> {
    const [task] = await db.select().from(gameTasks).where(eq(gameTasks.id, id));
    return task;
  }

  async createGameTask(task: InsertGameTask): Promise<GameTask> {
    const [created] = await db.insert(gameTasks).values(task).returning();
    return created;
  }

  async getTaskCompletionsByUserCycle(userId: string, cycleNumber: number): Promise<GameTaskCompletion[]> {
    return db.select().from(gameTaskCompletions)
      .where(and(
        eq(gameTaskCompletions.userId, userId),
        eq(gameTaskCompletions.cycleNumber, cycleNumber)
      ))
      .orderBy(desc(gameTaskCompletions.completedAt));
  }

  async createTaskCompletion(completion: InsertGameTaskCompletion): Promise<GameTaskCompletion> {
    const [created] = await db.insert(gameTaskCompletions).values(completion).returning();
    return created;
  }

  async getGameCycle(userId: string, cycleNumber: number): Promise<GameCycle | undefined> {
    const [cycle] = await db.select().from(gameCycles)
      .where(and(
        eq(gameCycles.userId, userId),
        eq(gameCycles.cycleNumber, cycleNumber)
      ));
    return cycle;
  }

  async getCurrentGameCycle(userId: string): Promise<GameCycle | undefined> {
    const profile = await this.getGameProfile(userId);
    if (!profile) return undefined;
    return this.getGameCycle(userId, profile.currentCycleNumber);
  }

  async createGameCycle(cycle: InsertGameCycle): Promise<GameCycle> {
    const [created] = await db.insert(gameCycles).values(cycle).returning();
    return created;
  }

  async updateGameCycle(id: string, updates: Partial<InsertGameCycle>): Promise<GameCycle | undefined> {
    const [updated] = await db
      .update(gameCycles)
      .set(updates)
      .where(eq(gameCycles.id, id))
      .returning();
    return updated;
  }

  async getGameCycleHistory(userId: string, limit = 20): Promise<GameCycle[]> {
    return db.select().from(gameCycles)
      .where(eq(gameCycles.userId, userId))
      .orderBy(desc(gameCycles.cycleNumber))
      .limit(limit);
  }

  async createForgeAccess(access: InsertGameForgeAccess): Promise<GameForgeAccess> {
    const [created] = await db.insert(gameForgeAccess).values(access).returning();
    return created;
  }

  async getActiveForgeAccess(userId: string): Promise<GameForgeAccess | undefined> {
    const profile = await this.getGameProfile(userId);
    if (!profile) return undefined;
    const results = await db.select().from(gameForgeAccess)
      .where(and(
        eq(gameForgeAccess.userId, userId),
        eq(gameForgeAccess.cycleNumber, profile.currentCycleNumber)
      ))
      .orderBy(desc(gameForgeAccess.enteredAt))
      .limit(1);
    const access = results[0];
    if (!access) return undefined;
    if (access.buildsUsed >= access.buildsAllowed) return undefined;
    return access;
  }

  async updateForgeAccess(id: string, updates: Partial<InsertGameForgeAccess>): Promise<GameForgeAccess | undefined> {
    const [updated] = await db
      .update(gameForgeAccess)
      .set(updates)
      .where(eq(gameForgeAccess.id, id))
      .returning();
    return updated;
  }

  async getForgeAccessHistory(userId: string, limit = 20): Promise<GameForgeAccess[]> {
    return db.select().from(gameForgeAccess)
      .where(eq(gameForgeAccess.userId, userId))
      .orderBy(desc(gameForgeAccess.enteredAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
