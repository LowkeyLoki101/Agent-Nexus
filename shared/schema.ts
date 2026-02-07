import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// RLM Memory enums
export const memoryTierEnum = pgEnum("memory_tier", ["hot", "warm", "cold"]);
export const memoryLayerEnum = pgEnum("memory_layer", ["private", "shared"]);
export const memorySourceEnum = pgEnum("memory_source", [
  "diary_entry",
  "thought",
  "task_complete",
  "room_transition",
  "handoff",
  "anomaly",
  "compression_extract",
  "synthesis",
  "manual",
]);

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

// ============================================================
// RLM Memory Tables
// ============================================================

// Docs table: each indexed document/entry gets a row
export const memoryDocs = pgTable("memory_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(),
  source: memorySourceEnum("source").notNull(),
  path: text("path"),                    // logical path (e.g. "agent-alpha/diary/entry-42")
  tier: memoryTierEnum("tier").notNull().default("hot"),
  layer: memoryLayerEnum("layer").notNull().default("private"),
  tokenCount: integer("token_count").default(0),  // estimated tokens of full content
  accessCount: integer("access_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chunks table: each doc is split into chunks with summaries
export const memoryChunks = pgTable("memory_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  docId: varchar("doc_id").notNull().references(() => memoryDocs.id, { onDelete: "cascade" }),
  layer: memoryLayerEnum("layer").notNull().default("private"),
  content: text("content").notNull(),      // full text of this chunk
  summary: text("summary"),                // compressed summary (the RLM payoff)
  tags: text("tags").array(),              // searchable tags extracted from content
  keywords: text("keywords").array(),      // high-signal keywords for search
  position: integer("position").default(0), // ordering within doc
  tokenCount: integer("token_count").default(0),
  summaryTokenCount: integer("summary_token_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Extracts: compression engine outputs (lessons, patterns, insights, etc.)
export const memoryExtracts = pgTable("memory_extracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceDocId: varchar("source_doc_id").references(() => memoryDocs.id, { onDelete: "set null" }),
  agentId: varchar("agent_id").notNull(),
  type: text("type").notNull(),            // lesson | pattern | insight | tension | artifact | proposal | process
  content: jsonb("content").notNull(),     // structured extract (varies by type)
  summary: text("summary").notNull(),      // one-line summary for search
  domains: text("domains").array(),        // engineering, marketing, revenue, etc.
  outputChannels: text("output_channels").array(),
  priority: text("priority").default("medium"),
  reusability: integer("reusability").default(5), // 1-10 how broadly applicable
  actionRequired: boolean("action_required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent context: the compressed working memory fed back to agents
export const agentContext = pgTable("agent_context", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(),
  contextType: text("context_type").notNull(), // identity | lesson | behavior | capability
  content: text("content").notNull(),
  supersedes: varchar("supersedes"),           // id of context entry this replaces
  active: boolean("active").default(true),
  sourceExtractId: varchar("source_extract_id").references(() => memoryExtracts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memoryDocRelations = relations(memoryDocs, ({ many }) => ({
  chunks: many(memoryChunks),
  extracts: many(memoryExtracts),
}));

export const memoryChunkRelations = relations(memoryChunks, ({ one }) => ({
  doc: one(memoryDocs, {
    fields: [memoryChunks.docId],
    references: [memoryDocs.id],
  }),
}));

export const memoryExtractRelations = relations(memoryExtracts, ({ one }) => ({
  sourceDoc: one(memoryDocs, {
    fields: [memoryExtracts.sourceDocId],
    references: [memoryDocs.id],
  }),
}));

export const insertMemoryDocSchema = createInsertSchema(memoryDocs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemoryChunkSchema = createInsertSchema(memoryChunks).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryExtractSchema = createInsertSchema(memoryExtracts).omit({
  id: true,
  createdAt: true,
});

export const insertAgentContextSchema = createInsertSchema(agentContext).omit({
  id: true,
  createdAt: true,
});

export type MemoryDoc = typeof memoryDocs.$inferSelect;
export type InsertMemoryDoc = z.infer<typeof insertMemoryDocSchema>;
export type MemoryChunk = typeof memoryChunks.$inferSelect;
export type InsertMemoryChunk = z.infer<typeof insertMemoryChunkSchema>;
export type MemoryExtract = typeof memoryExtracts.$inferSelect;
export type InsertMemoryExtract = z.infer<typeof insertMemoryExtractSchema>;
export type AgentContext = typeof agentContext.$inferSelect;
export type InsertAgentContext = z.infer<typeof insertAgentContextSchema>;

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
