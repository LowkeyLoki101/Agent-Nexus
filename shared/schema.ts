import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const entityTypeEnum = pgEnum("entity_type", ["human", "agent"]);
export const tokenStatusEnum = pgEnum("token_status", ["active", "revoked", "expired"]);
export const briefingStatusEnum = pgEnum("briefing_status", ["draft", "published", "archived"]);
export const briefingPriorityEnum = pgEnum("briefing_priority", ["low", "medium", "high", "urgent"]);

export const auditActionEnum = pgEnum("audit_action", [
  "workspace_created",
  "workspace_updated",
  "member_added",
  "member_removed",
  "member_role_changed",
  "agent_created",
  "agent_updated",
  "agent_deleted",
  "token_created",
  "token_revoked",
  "content_published",
  "permission_changed",
  "briefing_created",
  "briefing_updated",
  "briefing_deleted",
  "login",
  "logout"
]);

export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  ownerId: varchar("owner_id").notNull(),
  isPrivate: boolean("is_private").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  agents: many(agents),
  auditLogs: many(auditLogs),
}));

export const workspaceMembers = pgTable("workspace_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  role: memberRoleEnum("role").notNull().default("member"),
  entityType: entityTypeEnum("entity_type").notNull().default("human"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const workspaceMemberRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
}));

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  avatar: text("avatar"),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  capabilities: text("capabilities").array(),
  permissions: text("permissions").array(),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentRelations = relations(agents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [agents.workspaceId],
    references: [workspaces.id],
  }),
  tokens: many(apiTokens),
}));

export const apiTokens = pgTable("api_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  permissions: text("permissions").array(),
  status: tokenStatusEnum("status").notNull().default("active"),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiTokenRelations = relations(apiTokens, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiTokens.workspaceId],
    references: [workspaces.id],
  }),
  agent: one(agents, {
    fields: [apiTokens.agentId],
    references: [agents.id],
  }),
}));

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  userId: varchar("user_id"),
  agentId: varchar("agent_id"),
  action: auditActionEnum("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditLogs.workspaceId],
    references: [workspaces.id],
  }),
}));

export const briefings = pgTable("briefings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  status: briefingStatusEnum("status").notNull().default("draft"),
  priority: briefingPriorityEnum("priority").notNull().default("medium"),
  tags: text("tags").array(),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const briefingRelations = relations(briefings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [briefings.workspaceId],
    references: [workspaces.id],
  }),
}));

// --- Nexus Protocol: Gamified Task System ---

export const gamePathEnum = pgEnum("game_path", ["scholar", "diplomat", "generalist"]);
export const gameRoomEnum = pgEnum("game_room", ["archive", "agora", "forge"]);
export const gameTaskDifficultyEnum = pgEnum("game_task_difficulty", ["quick", "standard", "deep"]);
export const gameTaskCategoryEnum = pgEnum("game_task_category", ["research", "community", "development"]);
export const forgeSessionTierEnum = pgEnum("forge_session_tier", ["basic", "extended", "master"]);

export const gameProfiles = pgTable("game_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  sparkBalance: integer("spark_balance").notNull().default(0),
  totalSparkEarned: integer("total_spark_earned").notNull().default(0),
  totalSparkSpent: integer("total_spark_spent").notNull().default(0),
  currentPath: gamePathEnum("current_path"),
  pathMomentum: integer("path_momentum").notNull().default(0),
  currentCycleNumber: integer("current_cycle_number").notNull().default(1),
  versatilityPoints: integer("versatility_points").notNull().default(0),
  stagnationLevel: real("stagnation_level").notNull().default(0),
  totalForgeEntries: integer("total_forge_entries").notNull().default(0),
  totalTasksCompleted: integer("total_tasks_completed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gameTasks = pgTable("game_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  room: gameRoomEnum("room").notNull(),
  category: gameTaskCategoryEnum("category").notNull(),
  baseSparkReward: integer("base_spark_reward").notNull(),
  difficulty: gameTaskDifficultyEnum("difficulty").notNull().default("standard"),
  requiredPath: gamePathEnum("required_path"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gameTaskCompletions = pgTable("game_task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  taskId: varchar("task_id").notNull().references(() => gameTasks.id, { onDelete: "cascade" }),
  cycleNumber: integer("cycle_number").notNull(),
  sparkEarned: integer("spark_earned").notNull(),
  pathAtCompletion: gamePathEnum("path_at_completion"),
  momentumMultiplier: real("momentum_multiplier").notNull().default(1),
  stagnationPenalty: real("stagnation_penalty").notNull().default(0),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const gameCycles = pgTable("game_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  pathChosen: gamePathEnum("path_chosen").notNull(),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  archiveTasksCompleted: integer("archive_tasks_completed").notNull().default(0),
  agoraTasksCompleted: integer("agora_tasks_completed").notNull().default(0),
  sparkEarned: integer("spark_earned").notNull().default(0),
  sparkSpent: integer("spark_spent").notNull().default(0),
  stagnationHits: integer("stagnation_hits").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const gameForgeAccess = pgTable("game_forge_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  sessionTier: forgeSessionTierEnum("session_tier").notNull(),
  sparkCost: integer("spark_cost").notNull(),
  buildsUsed: integer("builds_used").notNull().default(0),
  buildsAllowed: integer("builds_allowed").notNull(),
  enteredAt: timestamp("entered_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const gameTaskCompletionRelations = relations(gameTaskCompletions, ({ one }) => ({
  task: one(gameTasks, {
    fields: [gameTaskCompletions.taskId],
    references: [gameTasks.id],
  }),
}));

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiTokenSchema = createInsertSchema(apiTokens).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertBriefingSchema = createInsertSchema(briefings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameProfileSchema = createInsertSchema(gameProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameTaskSchema = createInsertSchema(gameTasks).omit({
  id: true,
  createdAt: true,
});

export const insertGameTaskCompletionSchema = createInsertSchema(gameTaskCompletions).omit({
  id: true,
  completedAt: true,
});

export const insertGameCycleSchema = createInsertSchema(gameCycles).omit({
  id: true,
  startedAt: true,
  endedAt: true,
});

export const insertGameForgeAccessSchema = createInsertSchema(gameForgeAccess).omit({
  id: true,
  enteredAt: true,
});

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;
export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Briefing = typeof briefings.$inferSelect;
export type InsertBriefing = z.infer<typeof insertBriefingSchema>;
export type GameProfile = typeof gameProfiles.$inferSelect;
export type InsertGameProfile = z.infer<typeof insertGameProfileSchema>;
export type GameTask = typeof gameTasks.$inferSelect;
export type InsertGameTask = z.infer<typeof insertGameTaskSchema>;
export type GameTaskCompletion = typeof gameTaskCompletions.$inferSelect;
export type InsertGameTaskCompletion = z.infer<typeof insertGameTaskCompletionSchema>;
export type GameCycle = typeof gameCycles.$inferSelect;
export type InsertGameCycle = z.infer<typeof insertGameCycleSchema>;
export type GameForgeAccess = typeof gameForgeAccess.$inferSelect;
export type InsertGameForgeAccess = z.infer<typeof insertGameForgeAccessSchema>;
