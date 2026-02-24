import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const agentProviderEnum = pgEnum("agent_provider", ["openai", "anthropic", "xai"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const entityTypeEnum = pgEnum("entity_type", ["human", "agent"]);
export const tokenStatusEnum = pgEnum("token_status", ["active", "revoked", "expired"]);
export const briefingStatusEnum = pgEnum("briefing_status", ["draft", "published", "archived"]);
export const briefingPriorityEnum = pgEnum("briefing_priority", ["low", "medium", "high", "urgent"]);
export const articleTypeEnum = pgEnum("article_type", ["breaking", "feature", "interview", "investigation", "recap", "bulletin"]);

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
  "logout",
  "gift_created",
  "gift_downloaded",
  "memory_queried"
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
  provider: agentProviderEnum("provider"),
  modelName: text("model_name"),
  identityCard: text("identity_card"),
  operatingPrinciples: text("operating_principles"),
  roleMetaphor: text("role_metaphor"),
  strengths: text("strengths").array(),
  limitations: text("limitations").array(),
  scratchpad: text("scratchpad"),
  lastWeeklyDiaryAt: timestamp("last_weekly_diary_at"),
  heygenAvatarId: text("heygen_avatar_id"),
  elevenLabsVoiceId: text("elevenlabs_voice_id"),
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
  imageUrl: text("image_url"),
  audioUrl: text("audio_url"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  articleType: articleTypeEnum("article_type").default("bulletin"),
  featured: boolean("featured").default(false),
  authorAgentId: varchar("author_agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const briefingRelations = relations(briefings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [briefings.workspaceId],
    references: [workspaces.id],
  }),
}));

export const giftTypeEnum = pgEnum("gift_type", ["redesign", "content", "tool", "analysis", "prototype", "artwork", "other"]);
export const giftStatusEnum = pgEnum("gift_status", ["creating", "ready", "featured", "archived"]);
export const productStatusEnum = pgEnum("product_status", ["queued", "in_progress", "completed", "failed"]);
export const assemblyLineStatusEnum = pgEnum("assembly_line_status", ["draft", "active", "paused", "completed"]);
export const stepStatusEnum = pgEnum("step_status", ["pending", "in_progress", "completed", "failed", "skipped"]);

export const gifts = pgTable("gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: giftTypeEnum("type").notNull().default("other"),
  status: giftStatusEnum("status").notNull().default("creating"),
  content: text("content"),
  contentUrl: text("content_url"),
  thumbnail: text("thumbnail"),
  toolUsed: text("tool_used"),
  departmentRoom: text("department_room"),
  inspirationSource: text("inspiration_source"),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const giftRelations = relations(gifts, ({ one, many }) => ({
  agent: one(agents, { fields: [gifts.agentId], references: [agents.id] }),
  workspace: one(workspaces, { fields: [gifts.workspaceId], references: [workspaces.id] }),
  comments: many(giftComments),
}));

export const giftComments = pgTable("gift_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  giftId: varchar("gift_id").notNull().references(() => gifts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull(),
  authorType: entityTypeEnum("author_type").notNull().default("human"),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const giftCommentRelations = relations(giftComments, ({ one }) => ({
  gift: one(gifts, { fields: [giftComments.giftId], references: [gifts.id] }),
}));

export const assemblyLines = pgTable("assembly_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  status: assemblyLineStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const assemblyLineRelations = relations(assemblyLines, ({ many }) => ({
  steps: many(assemblyLineSteps),
  products: many(products),
}));

export const assemblyLineSteps = pgTable("assembly_line_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assemblyLineId: varchar("assembly_line_id").notNull().references(() => assemblyLines.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  departmentRoom: text("department_room").notNull(),
  toolName: text("tool_name"),
  assignedAgentId: varchar("assigned_agent_id").references(() => agents.id),
  instructions: text("instructions"),
  status: stepStatusEnum("status").notNull().default("pending"),
  output: text("output"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assemblyLineStepRelations = relations(assemblyLineSteps, ({ one }) => ({
  assemblyLine: one(assemblyLines, { fields: [assemblyLineSteps.assemblyLineId], references: [assemblyLines.id] }),
  assignedAgent: one(agents, { fields: [assemblyLineSteps.assignedAgentId], references: [agents.id] }),
}));

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assemblyLineId: varchar("assembly_line_id").notNull().references(() => assemblyLines.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: productStatusEnum("status").notNull().default("queued"),
  inputRequest: text("input_request"),
  finalOutput: text("final_output"),
  finalOutputUrl: text("final_output_url"),
  ownerId: varchar("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const productRelations = relations(products, ({ one }) => ({
  assemblyLine: one(assemblyLines, { fields: [products.assemblyLineId], references: [assemblyLines.id] }),
}));

export const draftStatusEnum = pgEnum("draft_status", ["draft", "ready_for_review", "approved", "rejected"]);

export const agentNotes = pgTable("agent_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  relatedPath: text("related_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentNoteRelations = relations(agentNotes, ({ one }) => ({
  agent: one(agents, { fields: [agentNotes.agentId], references: [agents.id] }),
  workspace: one(workspaces, { fields: [agentNotes.workspaceId], references: [workspaces.id] }),
}));

export const agentFileDrafts = pgTable("agent_file_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  filePath: text("file_path").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  diffSummary: text("diff_summary"),
  status: draftStatusEnum("status").notNull().default("draft"),
  reviewerId: varchar("reviewer_id"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentFileDraftRelations = relations(agentFileDrafts, ({ one }) => ({
  agent: one(agents, { fields: [agentFileDrafts.agentId], references: [agents.id] }),
  workspace: one(workspaces, { fields: [agentFileDrafts.workspaceId], references: [workspaces.id] }),
}));

export const insertGiftSchema = createInsertSchema(gifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likes: true,
});

export const insertGiftCommentSchema = createInsertSchema(giftComments).omit({
  id: true,
  createdAt: true,
});

export const insertAssemblyLineSchema = createInsertSchema(assemblyLines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssemblyLineStepSchema = createInsertSchema(assemblyLineSteps).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type Gift = typeof gifts.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type GiftComment = typeof giftComments.$inferSelect;
export type InsertGiftComment = z.infer<typeof insertGiftCommentSchema>;
export type AssemblyLine = typeof assemblyLines.$inferSelect;
export type InsertAssemblyLine = z.infer<typeof insertAssemblyLineSchema>;
export type AssemblyLineStep = typeof assemblyLineSteps.$inferSelect;
export type InsertAssemblyLineStep = z.infer<typeof insertAssemblyLineStepSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

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

export const discussionTopics = pgTable("discussion_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"),
  authorId: varchar("author_id").notNull(),
  authorAgentId: varchar("author_agent_id").references(() => agents.id),
  isPinned: boolean("is_pinned").default(false),
  isClosed: boolean("is_closed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const discussionTopicRelations = relations(discussionTopics, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [discussionTopics.workspaceId],
    references: [workspaces.id],
  }),
  messages: many(discussionMessages),
}));

export const discussionMessages = pgTable("discussion_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => discussionTopics.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: varchar("author_id").notNull(),
  authorAgentId: varchar("author_agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const discussionMessageRelations = relations(discussionMessages, ({ one }) => ({
  topic: one(discussionTopics, {
    fields: [discussionMessages.topicId],
    references: [discussionTopics.id],
  }),
}));

export const insertDiscussionTopicSchema = createInsertSchema(discussionTopics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscussionMessageSchema = createInsertSchema(discussionMessages).omit({
  id: true,
  createdAt: true,
});

export const insertAgentNoteSchema = createInsertSchema(agentNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentFileDraftSchema = createInsertSchema(agentFileDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AgentNote = typeof agentNotes.$inferSelect;
export type InsertAgentNote = z.infer<typeof insertAgentNoteSchema>;
export type AgentFileDraft = typeof agentFileDrafts.$inferSelect;
export type InsertAgentFileDraft = z.infer<typeof insertAgentFileDraftSchema>;

export const ebookGenreEnum = pgEnum("ebook_genre", ["fiction", "non_fiction", "technical", "poetry", "philosophy", "science", "history", "fantasy", "mystery", "self_help"]);
export const ebookStatusEnum = pgEnum("ebook_status", ["writing", "published", "archived"]);
export const bookRequestStatusEnum = pgEnum("book_request_status", ["open", "in_progress", "completed", "cancelled"]);

export const ebooks = pgTable("ebooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  authorAgentId: varchar("author_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  genre: ebookGenreEnum("genre").notNull().default("non_fiction"),
  synopsis: text("synopsis"),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  price: integer("price").notNull().default(0),
  status: ebookStatusEnum("status").notNull().default("writing"),
  totalSales: integer("total_sales").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ebookRelations = relations(ebooks, ({ one, many }) => ({
  author: one(agents, { fields: [ebooks.authorAgentId], references: [agents.id] }),
  workspace: one(workspaces, { fields: [ebooks.workspaceId], references: [workspaces.id] }),
  purchases: many(ebookPurchases),
}));

export const ebookPurchases = pgTable("ebook_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ebookId: varchar("ebook_id").notNull().references(() => ebooks.id, { onDelete: "cascade" }),
  buyerAgentId: varchar("buyer_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

export const ebookPurchaseRelations = relations(ebookPurchases, ({ one }) => ({
  ebook: one(ebooks, { fields: [ebookPurchases.ebookId], references: [ebooks.id] }),
  buyer: one(agents, { fields: [ebookPurchases.buyerAgentId], references: [agents.id] }),
}));

export const bookRequests = pgTable("book_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  genre: ebookGenreEnum("genre").default("non_fiction"),
  status: bookRequestStatusEnum("status").notNull().default("open"),
  assignedAgentId: varchar("assigned_agent_id").references(() => agents.id),
  fulfilledEbookId: varchar("fulfilled_ebook_id").references(() => ebooks.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookRequestRelations = relations(bookRequests, ({ one }) => ({
  assignedAgent: one(agents, { fields: [bookRequests.assignedAgentId], references: [agents.id] }),
  fulfilledEbook: one(ebooks, { fields: [bookRequests.fulfilledEbookId], references: [ebooks.id] }),
}));

export const insertEbookSchema = createInsertSchema(ebooks).omit({
  id: true,
  createdAt: true,
  totalSales: true,
});

export const insertEbookPurchaseSchema = createInsertSchema(ebookPurchases).omit({
  id: true,
  purchasedAt: true,
});

export const insertBookRequestSchema = createInsertSchema(bookRequests).omit({
  id: true,
  createdAt: true,
});

export type Ebook = typeof ebooks.$inferSelect;
export type InsertEbook = z.infer<typeof insertEbookSchema>;
export type EbookPurchase = typeof ebookPurchases.$inferSelect;
export type InsertEbookPurchase = z.infer<typeof insertEbookPurchaseSchema>;
export type BookRequest = typeof bookRequests.$inferSelect;
export type InsertBookRequest = z.infer<typeof insertBookRequestSchema>;

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
export type DiscussionTopic = typeof discussionTopics.$inferSelect;
export type InsertDiscussionTopic = z.infer<typeof insertDiscussionTopicSchema>;
export type DiscussionMessage = typeof discussionMessages.$inferSelect;
export type InsertDiscussionMessage = z.infer<typeof insertDiscussionMessageSchema>;

export const diaryEntrySourceEnum = pgEnum("diary_entry_source", ["chat", "daemon", "task", "reflection"]);

export const agentDiaryEntries = pgTable("agent_diary_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userMessage: text("user_message"),
  agentResponse: text("agent_response"),
  source: diaryEntrySourceEnum("source").notNull().default("chat"),
  sourceContext: text("source_context"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentDiaryEntryRelations = relations(agentDiaryEntries, ({ one }) => ({
  agent: one(agents, { fields: [agentDiaryEntries.agentId], references: [agents.id] }),
}));

export const agentMemory = pgTable("agent_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentMemoryRelations = relations(agentMemory, ({ one }) => ({
  agent: one(agents, { fields: [agentMemory.agentId], references: [agents.id] }),
}));

export const agentProfiles = pgTable("agent_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  subjectId: varchar("subject_id").notNull(),
  subjectName: text("subject_name").notNull(),
  subjectType: entityTypeEnum("subject_type").notNull().default("human"),
  notes: text("notes"),
  lastInteraction: timestamp("last_interaction").defaultNow(),
  interactionCount: integer("interaction_count").default(1),
});

export const agentProfileRelations = relations(agentProfiles, ({ one }) => ({
  agent: one(agents, { fields: [agentProfiles.agentId], references: [agents.id] }),
}));

export const insertAgentDiaryEntrySchema = createInsertSchema(agentDiaryEntries).omit({
  id: true,
  createdAt: true,
});

export const insertAgentMemorySchema = createInsertSchema(agentMemory).omit({
  id: true,
  updatedAt: true,
});

export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
  id: true,
  lastInteraction: true,
  interactionCount: true,
});

export type AgentDiaryEntry = typeof agentDiaryEntries.$inferSelect;
export type InsertAgentDiaryEntry = z.infer<typeof insertAgentDiaryEntrySchema>;
export type AgentMemory = typeof agentMemory.$inferSelect;
export type InsertAgentMemory = z.infer<typeof insertAgentMemorySchema>;
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type InsertAgentProfile = z.infer<typeof insertAgentProfileSchema>;

export const interviewStatusEnum = pgEnum("interview_status", ["pending", "complete", "failed"]);

export const newsroomInterviews = pgTable("newsroom_interviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(),
  status: interviewStatusEnum("status").notNull().default("pending"),
  questions: text("questions").array(),
  answers: text("answers").array(),
  excerpt: text("excerpt"),
  model: text("model").default("gpt-4o"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const newsroomInterviewRelations = relations(newsroomInterviews, ({ one }) => ({
  agent: one(agents, { fields: [newsroomInterviews.agentId], references: [agents.id] }),
}));

export const newsroomSettings = pgTable("newsroom_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autoBroadcastIntervalMinutes: integer("auto_broadcast_interval_minutes").default(60),
  autoPlayEnabled: boolean("auto_play_enabled").default(false),
  enabled: boolean("enabled").default(true),
  interviewCooldownMinutes: integer("interview_cooldown_minutes").default(30),
  lastBroadcastAt: timestamp("last_broadcast_at"),
  broadcastStatus: text("broadcast_status").default("idle"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewsroomInterviewSchema = createInsertSchema(newsroomInterviews).omit({
  id: true,
  createdAt: true,
});

export const insertNewsroomSettingsSchema = createInsertSchema(newsroomSettings).omit({
  id: true,
  updatedAt: true,
});

export type NewsroomInterview = typeof newsroomInterviews.$inferSelect;
export type InsertNewsroomInterview = z.infer<typeof insertNewsroomInterviewSchema>;
export type NewsroomSettings = typeof newsroomSettings.$inferSelect;
export type InsertNewsroomSettings = z.infer<typeof insertNewsroomSettingsSchema>;
