import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const entityTypeEnum = pgEnum("entity_type", ["human", "agent"]);
export const tokenStatusEnum = pgEnum("token_status", ["active", "revoked", "expired"]);
export const briefingStatusEnum = pgEnum("briefing_status", ["draft", "published", "archived"]);
export const briefingPriorityEnum = pgEnum("briefing_priority", ["low", "medium", "high", "urgent"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["active", "paused", "completed"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);
export const giftTypeEnum = pgEnum("gift_type", ["pdf", "slides", "document", "code", "image", "data"]);
export const giftStatusEnum = pgEnum("gift_status", ["generating", "ready", "failed"]);
export const memoryTierEnum = pgEnum("memory_tier", ["hot", "warm", "cold"]);
export const memoryTypeEnum = pgEnum("memory_type", ["identity", "goal", "fact", "event", "artifact", "summary"]);

export const agentProviderEnum = pgEnum("agent_provider", ["openai", "anthropic", "xai"]);
export const diaryMoodEnum = pgEnum("diary_mood", ["thinking", "dreaming", "wanting", "reflecting", "planning", "creating", "observing"]);

export const boardTypeEnum = pgEnum("board_type", ["general", "research", "code_review", "creative", "learning"]);
export const postTypeEnum = pgEnum("post_type", ["discussion", "link", "file", "code", "research", "mockup"]);
export const voteTypeEnum = pgEnum("vote_type", ["upvote", "downvote"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected", "needs_revision"]);
export const mockupStatusEnum = pgEnum("mockup_status", ["draft", "published", "archived"]);

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
  "gift_created",
  "gift_downloaded",
  "memory_created",
  "memory_queried",
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
  provider: agentProviderEnum("provider").default("openai"),
  modelName: text("model_name"),
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
  room: one(agentRooms),
  diaryEntries: many(diaryEntries),
}));

export const agentRooms = pgTable("agent_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }).unique(),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  orientation: text("orientation"),
  projectStatus: text("project_status"),
  personalNotes: text("personal_notes"),
  lastBriefedAt: timestamp("last_briefed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentRoomRelations = relations(agentRooms, ({ one, many }) => ({
  agent: one(agents, {
    fields: [agentRooms.agentId],
    references: [agents.id],
  }),
  workspace: one(workspaces, {
    fields: [agentRooms.workspaceId],
    references: [workspaces.id],
  }),
}));

export const diaryEntries = pgTable("diary_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  mood: diaryMoodEnum("mood").notNull().default("thinking"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array(),
  isPrivate: boolean("is_private").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const diaryEntryRelations = relations(diaryEntries, ({ one }) => ({
  agent: one(agents, {
    fields: [diaryEntries.agentId],
    references: [agents.id],
  }),
  workspace: one(workspaces, {
    fields: [diaryEntries.workspaceId],
    references: [workspaces.id],
  }),
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

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: conversationStatusEnum("status").notNull().default("active"),
  mode: text("mode").default("chat"),
  participantAgentIds: text("participant_agent_ids").array(),
  systemPrompt: text("system_prompt"),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [conversations.workspaceId],
    references: [workspaces.id],
  }),
  messages: many(messages),
}));

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  agentName: text("agent_name"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  agent: one(agents, {
    fields: [messages.agentId],
    references: [agents.id],
  }),
}));

export const gifts = pgTable("gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  type: giftTypeEnum("type").notNull(),
  status: giftStatusEnum("status").notNull().default("generating"),
  content: text("content"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  sourceData: text("source_data"),
  tags: text("tags").array(),
  createdById: varchar("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const giftRelations = relations(gifts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [gifts.workspaceId],
    references: [workspaces.id],
  }),
  conversation: one(conversations, {
    fields: [gifts.conversationId],
    references: [conversations.id],
  }),
  agent: one(agents, {
    fields: [gifts.agentId],
    references: [agents.id],
  }),
}));

export const memoryEntries = pgTable("memory_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  tier: memoryTierEnum("tier").notNull().default("warm"),
  type: memoryTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  tags: text("tags").array(),
  sourceId: varchar("source_id"),
  sourceType: text("source_type"),
  accessCount: integer("access_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const memoryEntryRelations = relations(memoryEntries, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [memoryEntries.workspaceId],
    references: [workspaces.id],
  }),
  agent: one(agents, {
    fields: [memoryEntries.agentId],
    references: [agents.id],
  }),
}));

// Message Boards for agent discussions
export const boards = pgTable("boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: boardTypeEnum("type").notNull().default("general"),
  isPublic: boolean("is_public").default(false),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const boardRelations = relations(boards, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [boards.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [boards.createdByAgentId],
    references: [agents.id],
  }),
  topics: many(topics),
}));

// Topics within boards
export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  type: postTypeEnum("type").notNull().default("discussion"),
  isPinned: boolean("is_pinned").default(false),
  isLocked: boolean("is_locked").default(false),
  viewCount: integer("view_count").default(0),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const topicRelations = relations(topics, ({ one, many }) => ({
  board: one(boards, {
    fields: [topics.boardId],
    references: [boards.id],
  }),
  createdByAgent: one(agents, {
    fields: [topics.createdByAgentId],
    references: [agents.id],
  }),
  posts: many(posts),
  attachments: many(attachments),
}));

// Posts (replies) within topics
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id"),
  content: text("content").notNull(),
  aiModel: text("ai_model"),
  aiProvider: text("ai_provider"),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const postRelations = relations(posts, ({ one, many }) => ({
  topic: one(topics, {
    fields: [posts.topicId],
    references: [topics.id],
  }),
  createdByAgent: one(agents, {
    fields: [posts.createdByAgentId],
    references: [agents.id],
  }),
  votes: many(votes),
  attachments: many(attachments),
}));

// Votes on posts (multi-model peer review)
export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  voteType: voteTypeEnum("vote_type").notNull(),
  reason: text("reason"),
  aiModel: text("ai_model"),
  aiProvider: text("ai_provider"),
  voterId: varchar("voter_id").notNull(),
  voterAgentId: varchar("voter_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voteRelations = relations(votes, ({ one }) => ({
  post: one(posts, {
    fields: [votes.postId],
    references: [posts.id],
  }),
  voterAgent: one(agents, {
    fields: [votes.voterAgentId],
    references: [agents.id],
  }),
}));

// Attachments (files, links, code snippets)
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => topics.id, { onDelete: "cascade" }),
  postId: varchar("post_id").references(() => posts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  content: text("content"),
  metadata: text("metadata"),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const attachmentRelations = relations(attachments, ({ one }) => ({
  topic: one(topics, {
    fields: [attachments.topicId],
    references: [topics.id],
  }),
  post: one(posts, {
    fields: [attachments.postId],
    references: [posts.id],
  }),
  createdByAgent: one(agents, {
    fields: [attachments.createdByAgentId],
    references: [agents.id],
  }),
}));

// Code reviews with multi-model voting
export const codeReviews = pgTable("code_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  code: text("code").notNull(),
  language: text("language"),
  githubUrl: text("github_url"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  approvalCount: integer("approval_count").default(0),
  rejectionCount: integer("rejection_count").default(0),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const codeReviewRelations = relations(codeReviews, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [codeReviews.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [codeReviews.createdByAgentId],
    references: [agents.id],
  }),
  reviewComments: many(reviewComments),
}));

// Review comments from multiple AI models
export const reviewComments = pgTable("review_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").notNull().references(() => codeReviews.id, { onDelete: "cascade" }),
  lineStart: integer("line_start"),
  lineEnd: integer("line_end"),
  comment: text("comment").notNull(),
  suggestion: text("suggestion"),
  severity: text("severity"),
  aiModel: text("ai_model"),
  aiProvider: text("ai_provider"),
  isApproval: boolean("is_approval").default(false),
  reviewerId: varchar("reviewer_id").notNull(),
  reviewerAgentId: varchar("reviewer_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviewCommentRelations = relations(reviewComments, ({ one }) => ({
  review: one(codeReviews, {
    fields: [reviewComments.reviewId],
    references: [codeReviews.id],
  }),
  reviewerAgent: one(agents, {
    fields: [reviewComments.reviewerAgentId],
    references: [agents.id],
  }),
}));

// HTML Mockups for creative design
export const mockups = pgTable("mockups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  html: text("html").notNull(),
  css: text("css"),
  javascript: text("javascript"),
  status: mockupStatusEnum("status").notNull().default("draft"),
  previewUrl: text("preview_url"),
  tags: text("tags").array(),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mockupRelations = relations(mockups, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [mockups.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [mockups.createdByAgentId],
    references: [agents.id],
  }),
}));

// External integrations cache (GitHub, YouTube transcripts, web research)
export const externalCache = pgTable("external_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  sourceId: text("source_id").notNull(),
  sourceUrl: text("source_url"),
  title: text("title"),
  content: text("content"),
  metadata: text("metadata"),
  expiresAt: timestamp("expires_at"),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const externalCacheRelations = relations(externalCache, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [externalCache.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [externalCache.createdByAgentId],
    references: [agents.id],
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

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertGiftSchema = createInsertSchema(gifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentRoomSchema = createInsertSchema(agentRooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiaryEntrySchema = createInsertSchema(diaryEntries).omit({
  id: true,
  createdAt: true,
});

export const insertBoardSchema = createInsertSchema(boards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

export const insertCodeReviewSchema = createInsertSchema(codeReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewCommentSchema = createInsertSchema(reviewComments).omit({
  id: true,
  createdAt: true,
});

export const insertMockupSchema = createInsertSchema(mockups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExternalCacheSchema = createInsertSchema(externalCache).omit({
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
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Gift = typeof gifts.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
export type Board = typeof boards.$inferSelect;
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type CodeReview = typeof codeReviews.$inferSelect;
export type InsertCodeReview = z.infer<typeof insertCodeReviewSchema>;
export type ReviewComment = typeof reviewComments.$inferSelect;
export type InsertReviewComment = z.infer<typeof insertReviewCommentSchema>;
export type Mockup = typeof mockups.$inferSelect;
export type InsertMockup = z.infer<typeof insertMockupSchema>;
export type AgentRoom = typeof agentRooms.$inferSelect;
export type InsertAgentRoom = z.infer<typeof insertAgentRoomSchema>;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type InsertDiaryEntry = z.infer<typeof insertDiaryEntrySchema>;
export type ExternalCache = typeof externalCache.$inferSelect;
export type InsertExternalCache = z.infer<typeof insertExternalCacheSchema>;
