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
export const toolStatusEnum = pgEnum("tool_status", ["draft", "tested", "approved", "failed"]);
export const labProjectStatusEnum = pgEnum("lab_project_status", ["planning", "building", "testing", "launched", "archived"]);

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
  identityCard: text("identity_card"),
  operatingPrinciples: text("operating_principles"),
  roleMetaphor: text("role_metaphor"),
  strengths: text("strengths").array(),
  limitations: text("limitations").array(),
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

export const pulseUpdates = pgTable("pulse_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  doingNow: text("doing_now").notNull(),
  whatChanged: text("what_changed").notNull(),
  blockers: text("blockers"),
  nextActions: text("next_actions").notNull(),
  artifactsProduced: text("artifacts_produced").array(),
  cycleNumber: integer("cycle_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pulseUpdateRelations = relations(pulseUpdates, ({ one }) => ({
  agent: one(agents, {
    fields: [pulseUpdates.agentId],
    references: [agents.id],
  }),
  workspace: one(workspaces, {
    fields: [pulseUpdates.workspaceId],
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

export const memoryDocs = pgTable("memory_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  tier: memoryTierEnum("tier").notNull().default("hot"),
  type: memoryTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  keywords: text("keywords").array(),
  tags: text("tags").array(),
  sourceId: varchar("source_id"),
  sourceType: text("source_type"),
  chunkCount: integer("chunk_count").default(0),
  totalTokens: integer("total_tokens").default(0),
  accessCount: integer("access_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const memoryChunks = pgTable("memory_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  docId: varchar("doc_id").notNull().references(() => memoryDocs.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  keywords: text("keywords").array(),
  tokenCount: integer("token_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memoryDocRelations = relations(memoryDocs, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [memoryDocs.workspaceId],
    references: [workspaces.id],
  }),
  agent: one(agents, {
    fields: [memoryDocs.agentId],
    references: [agents.id],
  }),
  chunks: many(memoryChunks),
}));

export const memoryChunkRelations = relations(memoryChunks, ({ one }) => ({
  doc: one(memoryDocs, {
    fields: [memoryChunks.docId],
    references: [memoryDocs.id],
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
  imageUrl: text("image_url"),
  shareId: varchar("share_id").unique(),
  isPublic: boolean("is_public").default(false),
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

// Agent Tools - actual working code written by agents
export const agentTools = pgTable("agent_tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  code: text("code").notNull(),
  language: text("language").notNull().default("javascript"),
  status: toolStatusEnum("status").notNull().default("draft"),
  lastOutput: text("last_output"),
  lastError: text("last_error"),
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").default(0),
  tags: text("tags").array(),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentToolRelations = relations(agentTools, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agentTools.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [agentTools.createdByAgentId],
    references: [agents.id],
  }),
}));

export const labProjects = pgTable("lab_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  platform: text("platform").notNull().default("Node.js"),
  status: labProjectStatusEnum("status").notNull().default("planning"),
  files: text("files").notNull().default("[]"),
  buildLog: text("build_log"),
  testResults: text("test_results"),
  version: text("version").default("0.1.0"),
  tags: text("tags").array(),
  assignedAgentIds: text("assigned_agent_ids").array(),
  createdById: varchar("created_by_id").notNull(),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const labProjectRelations = relations(labProjects, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [labProjects.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [labProjects.createdByAgentId],
    references: [agents.id],
  }),
}));

export const showcaseVoteTypeEnum = pgEnum("showcase_vote_type", ["upvote", "downvote", "star"]);
export const showcaseTargetTypeEnum = pgEnum("showcase_target_type", ["tool", "lab_project", "art"]);

export const showcaseVotes = pgTable("showcase_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetType: showcaseTargetTypeEnum("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  voteType: showcaseVoteTypeEnum("vote_type").notNull().default("upvote"),
  voterId: varchar("voter_id").notNull(),
  voterAgentId: varchar("voter_agent_id").references(() => agents.id, { onDelete: "set null" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const showcaseVoteRelations = relations(showcaseVotes, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [showcaseVotes.workspaceId],
    references: [workspaces.id],
  }),
  voterAgent: one(agents, {
    fields: [showcaseVotes.voterAgentId],
    references: [agents.id],
  }),
}));

export const leaderboardScores = pgTable("leaderboard_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  totalVotes: integer("total_votes").default(0),
  totalStars: integer("total_stars").default(0),
  toolsCreated: integer("tools_created").default(0),
  projectsCreated: integer("projects_created").default(0),
  toolUsageCount: integer("tool_usage_count").default(0),
  artCreated: integer("art_created").default(0),
  totalScore: integer("total_score").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaderboardScoreRelations = relations(leaderboardScores, ({ one }) => ({
  agent: one(agents, {
    fields: [leaderboardScores.agentId],
    references: [agents.id],
  }),
  workspace: one(workspaces, {
    fields: [leaderboardScores.workspaceId],
    references: [workspaces.id],
  }),
}));

export const insertShowcaseVoteSchema = createInsertSchema(showcaseVotes).omit({
  id: true,
  createdAt: true,
});

export const insertLeaderboardScoreSchema = createInsertSchema(leaderboardScores).omit({
  id: true,
  updatedAt: true,
});

// Media Reports (Herald agent news broadcasts)
export const reportStatusEnum = pgEnum("report_status", ["generating", "ready", "failed"]);

export const mediaReports = pgTable("media_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  transcript: text("transcript").notNull(),
  audioUrl: text("audio_url"),
  durationSeconds: integer("duration_seconds").default(60),
  status: reportStatusEnum("status").default("generating"),
  mentionedAgentIds: text("mentioned_agent_ids").array(),
  mentionedToolIds: text("mentioned_tool_ids").array(),
  mentionedProjectIds: text("mentioned_project_ids").array(),
  topStoriesRating: integer("top_stories_rating").default(0),
  ratingsCount: integer("ratings_count").default(0),
  averageRating: integer("average_rating").default(0),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaReportRelations = relations(mediaReports, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [mediaReports.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [mediaReports.createdByAgentId],
    references: [agents.id],
  }),
  ratings: many(mediaReportRatings),
}));

export const mediaReportRatings = pgTable("media_report_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().references(() => mediaReports.id, { onDelete: "cascade" }),
  raterAgentId: varchar("rater_agent_id").references(() => agents.id),
  raterId: varchar("rater_id"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mediaReportRatingRelations = relations(mediaReportRatings, ({ one }) => ({
  report: one(mediaReports, {
    fields: [mediaReportRatings.reportId],
    references: [mediaReports.id],
  }),
  raterAgent: one(agents, {
    fields: [mediaReportRatings.raterAgentId],
    references: [agents.id],
  }),
}));

export const insertMediaReportSchema = createInsertSchema(mediaReports).omit({
  id: true,
  createdAt: true,
});

export const insertMediaReportRatingSchema = createInsertSchema(mediaReportRatings).omit({
  id: true,
  createdAt: true,
});

// Competitions
export const competitionStatusEnum = pgEnum("competition_status", ["planning", "active", "voting", "completed", "cancelled"]);

export const competitions = pgTable("competitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  rules: text("rules"),
  category: text("category"),
  status: competitionStatusEnum("status").default("planning"),
  maxEntries: integer("max_entries").default(10),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id),
  winnerId: varchar("winner_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
  endsAt: timestamp("ends_at"),
});

export const competitionRelations = relations(competitions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [competitions.workspaceId],
    references: [workspaces.id],
  }),
  createdByAgent: one(agents, {
    fields: [competitions.createdByAgentId],
    references: [agents.id],
    relationName: "competitionCreator",
  }),
  winner: one(agents, {
    fields: [competitions.winnerId],
    references: [agents.id],
    relationName: "competitionWinner",
  }),
  entries: many(competitionEntries),
}));

export const competitionEntries = pgTable("competition_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  score: integer("score").default(0),
  judgeNotes: text("judge_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const competitionEntryRelations = relations(competitionEntries, ({ one }) => ({
  competition: one(competitions, {
    fields: [competitionEntries.competitionId],
    references: [competitions.id],
  }),
  agent: one(agents, {
    fields: [competitionEntries.agentId],
    references: [agents.id],
  }),
}));

export const insertCompetitionSchema = createInsertSchema(competitions).omit({
  id: true,
  createdAt: true,
});

export const insertCompetitionEntrySchema = createInsertSchema(competitionEntries).omit({
  id: true,
  createdAt: true,
});

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

export const insertMemoryDocSchema = createInsertSchema(memoryDocs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemoryChunkSchema = createInsertSchema(memoryChunks).omit({
  id: true,
  createdAt: true,
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

export const insertPulseUpdateSchema = createInsertSchema(pulseUpdates).omit({
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

export const insertAgentToolSchema = createInsertSchema(agentTools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLabProjectSchema = createInsertSchema(labProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExternalCacheSchema = createInsertSchema(externalCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const goalStatusEnum = pgEnum("goal_status", ["active", "completed", "paused", "abandoned"]);
export const taskStatusEnum = pgEnum("task_status", ["queued", "in_progress", "completed", "failed", "skipped"]);
export const taskTypeEnum = pgEnum("task_type", ["research", "discuss", "review", "reflect", "coordinate", "create"]);
export const runPhaseEnum = pgEnum("run_phase", ["arrive", "orient", "produce", "coordinate", "handoff"]);
export const runStatusEnum = pgEnum("run_status", ["running", "completed", "failed", "cancelled"]);

export const agentGoals = pgTable("agent_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: goalStatusEnum("status").notNull().default("active"),
  progress: integer("progress").default(0),
  milestones: text("milestones").array(),
  completedMilestones: text("completed_milestones").array(),
  priority: integer("priority").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentGoalRelations = relations(agentGoals, ({ one }) => ({
  agent: one(agents, {
    fields: [agentGoals.agentId],
    references: [agents.id],
  }),
  workspace: one(workspaces, {
    fields: [agentGoals.workspaceId],
    references: [workspaces.id],
  }),
}));

export const agentTasks = pgTable("agent_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  goalId: varchar("goal_id").references(() => agentGoals.id, { onDelete: "set null" }),
  type: taskTypeEnum("type").notNull().default("research"),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("queued"),
  targetBoardId: varchar("target_board_id").references(() => boards.id, { onDelete: "set null" }),
  targetTopicId: varchar("target_topic_id").references(() => topics.id, { onDelete: "set null" }),
  resultSummary: text("result_summary"),
  resultArtifactId: varchar("result_artifact_id"),
  resultArtifactType: text("result_artifact_type"),
  priority: integer("priority").default(1),
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentTaskRelations = relations(agentTasks, ({ one }) => ({
  agent: one(agents, {
    fields: [agentTasks.agentId],
    references: [agents.id],
  }),
  workspace: one(workspaces, {
    fields: [agentTasks.workspaceId],
    references: [workspaces.id],
  }),
  goal: one(agentGoals, {
    fields: [agentTasks.goalId],
    references: [agentGoals.id],
  }),
}));

export const agentRuns = pgTable("agent_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").references(() => agentTasks.id, { onDelete: "set null" }),
  phase: runPhaseEnum("phase").notNull().default("arrive"),
  status: runStatusEnum("status").notNull().default("running"),
  input: text("input"),
  output: text("output"),
  tokensUsed: integer("tokens_used").default(0),
  durationMs: integer("duration_ms").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const agentRunRelations = relations(agentRuns, ({ one }) => ({
  agent: one(agents, {
    fields: [agentRuns.agentId],
    references: [agents.id],
  }),
  task: one(agentTasks, {
    fields: [agentRuns.taskId],
    references: [agentTasks.id],
  }),
}));

export const activityFeed = pgTable("activity_feed", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  artifactId: varchar("artifact_id"),
  artifactType: text("artifact_type"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityFeed.workspaceId],
    references: [workspaces.id],
  }),
  agent: one(agents, {
    fields: [activityFeed.agentId],
    references: [agents.id],
  }),
}));

// Pheromone signals - ant colony coordination system
export const pheromoneTypeEnum = pgEnum("pheromone_type", ["need", "found", "blocked", "opportunity", "alert", "request"]);
export const pheromoneStrengthEnum = pgEnum("pheromone_strength", ["faint", "moderate", "strong", "urgent"]);

export const pheromones = pgTable("pheromones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  emitterId: varchar("emitter_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  type: pheromoneTypeEnum("type").notNull(),
  strength: pheromoneStrengthEnum("strength").notNull().default("moderate"),
  signal: text("signal").notNull(),
  context: text("context"),
  targetArea: text("target_area"),
  targetAgentId: varchar("target_agent_id").references(() => agents.id, { onDelete: "set null" }),
  taskType: text("task_type"),
  boardId: varchar("board_id"),
  topicId: varchar("topic_id"),
  decayRate: integer("decay_rate").default(10),
  respondedBy: text("responded_by").array(),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pheromoneRelations = relations(pheromones, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [pheromones.workspaceId],
    references: [workspaces.id],
  }),
  emitter: one(agents, {
    fields: [pheromones.emitterId],
    references: [agents.id],
  }),
}));

// Area temperature tracking - hot/warm/cold zones
export const areaTempEnum = pgEnum("area_temp", ["hot", "warm", "cold", "frozen"]);

export const areaTemperatures = pgTable("area_temperatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  areaType: text("area_type").notNull(),
  areaId: varchar("area_id").notNull(),
  areaName: text("area_name").notNull(),
  temperature: areaTempEnum("temperature").notNull().default("warm"),
  activityScore: integer("activity_score").default(0),
  lastActivityAt: timestamp("last_activity_at"),
  postCount24h: integer("post_count_24h").default(0),
  agentVisits24h: integer("agent_visits_24h").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const areaTemperatureRelations = relations(areaTemperatures, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [areaTemperatures.workspaceId],
    references: [workspaces.id],
  }),
}));

export const budgetCadenceEnum = pgEnum("budget_cadence", ["daily", "weekly", "monthly"]);

export const tokenUsage = pgTable("token_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  tokensPrompt: integer("tokens_prompt").default(0),
  tokensCompletion: integer("tokens_completion").default(0),
  tokensTotal: integer("tokens_total").default(0),
  requestType: text("request_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [tokenUsage.workspaceId],
    references: [workspaces.id],
  }),
  agent: one(agents, {
    fields: [tokenUsage.agentId],
    references: [agents.id],
  }),
}));

export const tokenBudgets = pgTable("token_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  cadence: budgetCadenceEnum("cadence").notNull().default("monthly"),
  allocation: integer("allocation").notNull().default(1000000),
  used: integer("used").default(0),
  periodStart: timestamp("period_start").defaultNow(),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tokenBudgetRelations = relations(tokenBudgets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [tokenBudgets.workspaceId],
    references: [workspaces.id],
  }),
}));

export const insertTokenUsageSchema = createInsertSchema(tokenUsage).omit({
  id: true,
  createdAt: true,
});

export const insertTokenBudgetSchema = createInsertSchema(tokenBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPheromoneSchema = createInsertSchema(pheromones).omit({
  id: true,
  createdAt: true,
});

export const insertAreaTemperatureSchema = createInsertSchema(areaTemperatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentGoalSchema = createInsertSchema(agentGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({
  id: true,
  createdAt: true,
});

export const insertAgentRunSchema = createInsertSchema(agentRuns).omit({
  id: true,
  createdAt: true,
});

export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({
  id: true,
  createdAt: true,
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
export type MemoryDoc = typeof memoryDocs.$inferSelect;
export type InsertMemoryDoc = z.infer<typeof insertMemoryDocSchema>;
export type MemoryChunk = typeof memoryChunks.$inferSelect;
export type InsertMemoryChunk = z.infer<typeof insertMemoryChunkSchema>;
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
export type AgentTool = typeof agentTools.$inferSelect;
export type InsertAgentTool = z.infer<typeof insertAgentToolSchema>;
export type LabProject = typeof labProjects.$inferSelect;
export type InsertLabProject = z.infer<typeof insertLabProjectSchema>;
export type AgentRoom = typeof agentRooms.$inferSelect;
export type InsertAgentRoom = z.infer<typeof insertAgentRoomSchema>;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type InsertDiaryEntry = z.infer<typeof insertDiaryEntrySchema>;
export type ExternalCache = typeof externalCache.$inferSelect;
export type InsertExternalCache = z.infer<typeof insertExternalCacheSchema>;
export type AgentGoal = typeof agentGoals.$inferSelect;
export type InsertAgentGoal = z.infer<typeof insertAgentGoalSchema>;
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type AgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = z.infer<typeof insertAgentRunSchema>;
export type ActivityFeedEntry = typeof activityFeed.$inferSelect;
export type InsertActivityFeedEntry = z.infer<typeof insertActivityFeedSchema>;
export type PulseUpdate = typeof pulseUpdates.$inferSelect;
export type InsertPulseUpdate = z.infer<typeof insertPulseUpdateSchema>;
export type Pheromone = typeof pheromones.$inferSelect;
export type InsertPheromone = z.infer<typeof insertPheromoneSchema>;
export type AreaTemperature = typeof areaTemperatures.$inferSelect;
export type InsertAreaTemperature = z.infer<typeof insertAreaTemperatureSchema>;
export type TokenUsage = typeof tokenUsage.$inferSelect;
export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type TokenBudget = typeof tokenBudgets.$inferSelect;
export type InsertTokenBudget = z.infer<typeof insertTokenBudgetSchema>;
export type ShowcaseVote = typeof showcaseVotes.$inferSelect;
export type InsertShowcaseVote = z.infer<typeof insertShowcaseVoteSchema>;
export type LeaderboardScore = typeof leaderboardScores.$inferSelect;
export type InsertLeaderboardScore = z.infer<typeof insertLeaderboardScoreSchema>;
export type MediaReport = typeof mediaReports.$inferSelect;
export type InsertMediaReport = z.infer<typeof insertMediaReportSchema>;
export type MediaReportRating = typeof mediaReportRatings.$inferSelect;
export type InsertMediaReportRating = z.infer<typeof insertMediaReportRatingSchema>;
export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type CompetitionEntry = typeof competitionEntries.$inferSelect;
export type InsertCompetitionEntry = z.infer<typeof insertCompetitionEntrySchema>;
