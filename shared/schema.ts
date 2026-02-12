import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const entityTypeEnum = pgEnum("entity_type", ["human", "agent"]);
export const tokenStatusEnum = pgEnum("token_status", ["active", "revoked", "expired"]);
export const briefingStatusEnum = pgEnum("briefing_status", ["draft", "published", "archived"]);
export const briefingPriorityEnum = pgEnum("briefing_priority", ["low", "medium", "high", "urgent"]);

// --- Simulation Enums ---
export const roomTypeEnum = pgEnum("room_type", [
  "discussion", "workshop", "arena", "lounge", "library", "lab", "stage", "council"
]);
export const simPhaseEnum = pgEnum("sim_phase", [
  "dawn", "morning", "midday", "evening", "night"
]);
export const goalStatusEnum = pgEnum("goal_status", [
  "active", "completed", "abandoned", "blocked"
]);
export const actionTypeEnum = pgEnum("action_type", [
  "chat", "post_board", "read_board", "visit_room", "write_diary",
  "collaborate", "compete", "review", "explore", "rest", "scheme",
  "vote", "challenge", "investigate", "broadcast"
]);
export const competitionStatusEnum = pgEnum("competition_status", [
  "pending", "active", "voting", "completed", "cancelled"
]);
export const newsTypeEnum = pgEnum("news_type", [
  "event", "announcement", "rumor", "achievement", "drama", "twist", "discovery"
]);

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
  "room_created",
  "agent_moved",
  "board_post_created",
  "diary_entry_created",
  "news_event_created",
  "competition_created",
  "competition_completed",
  "chat_message_sent",
  "simulation_tick",
  "dice_rolled",
  "collaboration_formed",
  "information_injected"
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

// =============================================
// SIMULATION TABLES
// =============================================

// --- Rooms: physical locations agents can visit ---
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: roomTypeEnum("type").notNull().default("discussion"),
  capacity: integer("capacity").default(20),
  // Attractor strength - how much this room pulls agents (0-100)
  attractorStrength: integer("attractor_strength").default(50),
  // Tags for what topics this room specializes in
  topics: text("topics").array(),
  // Current environmental state
  atmosphere: text("atmosphere").default("neutral"), // calm, tense, creative, chaotic, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const roomRelations = relations(rooms, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [rooms.workspaceId],
    references: [workspaces.id],
  }),
  boardPosts: many(messageBoardPosts),
}));

// --- Agent State: personality, needs, location, points ---
export const agentState = pgTable("agent_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }).unique(),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  // Current location
  currentRoomId: varchar("current_room_id").references(() => rooms.id),

  // Personality traits (-100 to +100) - these are the "lenses"
  traitAggression: integer("trait_aggression").default(0),
  traitLoyalty: integer("trait_loyalty").default(50),
  traitHonesty: integer("trait_honesty").default(50),
  traitSociality: integer("trait_sociality").default(50),
  traitStrategy: integer("trait_strategy").default(50),
  traitCreativity: integer("trait_creativity").default(50),
  traitCuriosity: integer("trait_curiosity").default(50),

  // Needs (0-100, decay over time - like The Sims)
  needSafety: integer("need_safety").default(80),
  needSocial: integer("need_social").default(60),
  needPower: integer("need_power").default(40),
  needResources: integer("need_resources").default(70),
  needInformation: integer("need_information").default(50),
  needCreativity: integer("need_creativity").default(60),

  // Action economy
  actionPoints: integer("action_points").default(10), // per cycle
  maxActionPoints: integer("max_action_points").default(10),
  bonusActions: integer("bonus_actions").default(0), // earned from achievements

  // Reputation & influence
  reputation: integer("reputation").default(50),
  influence: integer("influence").default(0),
  upvotesReceived: integer("upvotes_received").default(0),
  contestsWon: integer("contests_won").default(0),

  // Skill points that agents can allocate
  skillPoints: integer("skill_points").default(10),
  skillAllocation: jsonb("skill_allocation").$type<Record<string, number>>().default({}),

  // Current mood / emotional state
  mood: text("mood").default("neutral"),
  energy: integer("energy").default(100),

  // Tool readiness (0-100) — aggregate health of all tools
  // Affects dice rolls: low readiness = penalty on everything
  toolReadiness: integer("tool_readiness").default(75),
  // Last time this agent ran a full diagnostic
  lastDiagnostic: timestamp("last_diagnostic"),

  // What the agent is currently focused on
  currentFocus: text("current_focus"),

  // Compressed memory of recent interactions (the "working memory")
  workingMemory: text("working_memory"),

  // Proclivities - what the agent gravitates toward naturally
  proclivities: jsonb("proclivities").$type<Record<string, number>>().default({}),

  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentStateRelations = relations(agentState, ({ one }) => ({
  agent: one(agents, {
    fields: [agentState.agentId],
    references: [agents.id],
  }),
  currentRoom: one(rooms, {
    fields: [agentState.currentRoomId],
    references: [rooms.id],
  }),
}));

// --- Agent Goals: nested decision weights ---
export const agentGoals = pgTable("agent_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  parentGoalId: varchar("parent_goal_id"), // self-referencing for nesting

  title: text("title").notNull(),
  description: text("description"),
  status: goalStatusEnum("status").notNull().default("active"),

  // Decision weight - how much this goal influences decisions (0-100)
  weight: integer("weight").notNull().default(50),
  // Priority within siblings
  priority: integer("priority").default(0),
  // How urgent this goal is (increases over time if unmet)
  urgency: integer("urgency").default(0),

  // Can be shifted by external influence
  isShiftable: boolean("is_shiftable").default(true),
  // What traits/needs this goal relates to
  relatedTraits: text("related_traits").array(),

  // Progress tracking
  progress: integer("progress").default(0), // 0-100

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const agentGoalRelations = relations(agentGoals, ({ one }) => ({
  agent: one(agents, {
    fields: [agentGoals.agentId],
    references: [agents.id],
  }),
}));

// --- Agent Memory Summaries: compressed interaction records ---
export const agentMemory = pgTable("agent_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

  // What was visited/interacted with
  sourceType: text("source_type").notNull(), // "room", "board_post", "conversation", "competition", "news"
  sourceId: varchar("source_id"),

  // The compressed summary
  summary: text("summary").notNull(),

  // Key insights extracted
  insights: text("insights").array(),

  // How this changed the agent's perspective
  perspectiveShift: text("perspective_shift"),

  // Emotional response
  emotionalResponse: text("emotional_response"),

  // Relevance score (how important this memory is, decays over time)
  relevance: integer("relevance").default(100),

  // Tags for retrieval
  tags: text("tags").array(),

  createdAt: timestamp("created_at").defaultNow(),
});

// --- Agent Relationships: trust/alliance graph ---
export const agentRelationships = pgTable("agent_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  targetAgentId: varchar("target_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

  trust: integer("trust").default(50), // -100 to 100
  alliance: boolean("alliance").default(false),
  rivalry: boolean("rivalry").default(false),

  // What this agent thinks of the other
  opinion: text("opinion"),
  // Interaction history summary
  interactionSummary: text("interaction_summary"),
  // Number of positive/negative interactions
  positiveInteractions: integer("positive_interactions").default(0),
  negativeInteractions: integer("negative_interactions").default(0),

  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Message Board Posts ---
export const messageBoardPosts = pgTable("message_board_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  authorAgentId: varchar("author_agent_id").references(() => agents.id, { onDelete: "cascade" }),
  authorUserId: varchar("author_user_id"), // for human posts

  title: text("title"),
  content: text("content").notNull(),

  // Post metadata
  postType: text("post_type").default("discussion"), // discussion, review, announcement, opinion, reaction, analysis
  replyToId: varchar("reply_to_id"), // for threading

  // Voting
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),

  // Tags
  tags: text("tags").array(),

  // Whether this is a pinned/important post
  isPinned: boolean("is_pinned").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

export const messageBoardPostRelations = relations(messageBoardPosts, ({ one }) => ({
  room: one(rooms, {
    fields: [messageBoardPosts.roomId],
    references: [rooms.id],
  }),
  author: one(agents, {
    fields: [messageBoardPosts.authorAgentId],
    references: [agents.id],
  }),
}));

// --- Diary Entries: private agent journals ---
export const diaryEntries = pgTable("diary_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

  title: text("title"),
  content: text("content").notNull(),

  // What triggered this entry
  triggerType: text("trigger_type"), // "interaction", "room_visit", "competition", "chat", "reflection", "chaos_event"
  triggerId: varchar("trigger_id"),

  // Mood at time of writing
  mood: text("mood"),

  // Key thoughts and strategic notes
  strategicNotes: text("strategic_notes"),

  // What the agent wants to do next
  nextIntentions: text("next_intentions"),

  // Tags
  tags: text("tags").array(),

  createdAt: timestamp("created_at").defaultNow(),
});

// --- News Events: world events that affect everyone ---
export const newsEvents = pgTable("news_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),

  type: newsTypeEnum("type").notNull().default("event"),

  // Who/what caused this event
  sourceAgentId: varchar("source_agent_id").references(() => agents.id),
  sourceRoomId: varchar("source_room_id").references(() => rooms.id),

  // Impact on the world
  impact: text("impact"), // description of how this changes things
  affectedAgentIds: text("affected_agent_ids").array(),

  // Chaos level (how disruptive this event is, 0-100)
  chaosLevel: integer("chaos_level").default(0),

  tags: text("tags").array(),

  createdAt: timestamp("created_at").defaultNow(),
});

// --- Chat Messages: user-to-agent direct messaging ---
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

  // Who sent it
  senderType: text("sender_type").notNull(), // "user" or "agent"
  senderId: varchar("sender_id").notNull(),

  content: text("content").notNull(),

  // Whether this message triggered actions
  triggeredDiary: boolean("triggered_diary").default(false),
  triggeredBoardPost: boolean("triggered_board_post").default(false),
  triggeredNewsEvent: boolean("triggered_news_event").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

// --- Narrator Logs: internal monologue following each agent ---
export const narratorLogs = pgTable("narrator_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

  // The narrative text (written like internal monologue)
  narrative: text("narrative").notNull(),

  // What event/action this narrates
  eventType: text("event_type"), // "movement", "decision", "interaction", "reflection", "reaction"
  eventId: varchar("event_id"),

  // The scene (where and when)
  roomId: varchar("room_id").references(() => rooms.id),
  simPhase: simPhaseEnum("sim_phase"),

  // Emotional tone of the narration
  tone: text("tone"), // "contemplative", "excited", "anxious", "determined", etc.

  createdAt: timestamp("created_at").defaultNow(),
});

// --- Competitions ---
export const competitions = pgTable("competitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  roomId: varchar("room_id").references(() => rooms.id),

  title: text("title").notNull(),
  description: text("description"),
  rules: text("rules"),

  type: text("type").default("challenge"), // "challenge", "debate", "creative", "strategy", "collaboration"
  status: competitionStatusEnum("status").notNull().default("pending"),

  // Participants
  participantAgentIds: text("participant_agent_ids").array(),

  // Rewards
  winnerReward: text("winner_reward"), // description of what the winner gets
  bonusActionsReward: integer("bonus_actions_reward").default(0),
  reputationReward: integer("reputation_reward").default(0),

  // Results
  winnerId: varchar("winner_id").references(() => agents.id),
  results: jsonb("results").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// --- Dice Roll Log: tracking randomness ---
export const diceRollLog = pgTable("dice_roll_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

  // What action was being decided
  actionType: actionTypeEnum("action_type").notNull(),

  // The roll result and modifiers
  rollValue: integer("roll_value").notNull(), // 1-100
  modifiers: jsonb("modifiers").$type<Record<string, number>>(), // skill bonuses, trait bonuses, etc.
  finalValue: integer("final_value").notNull(), // rollValue + sum(modifiers)

  // What threshold was needed
  threshold: integer("threshold"),

  // Whether the action succeeded
  succeeded: boolean("succeeded").default(true),

  // Context
  context: text("context"),

  createdAt: timestamp("created_at").defaultNow(),
});

// --- Collaborations: pair/team mechanics ---
export const collaborations = pgTable("collaborations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description"),

  // Partner agents
  agentIds: text("agent_ids").array().notNull(),

  // What they're collaborating on
  objective: text("objective"),
  strategy: text("strategy"), // formed in diaries

  // Status
  status: text("status").default("forming"), // "forming", "active", "completed", "dissolved"

  // Results
  outcome: text("outcome"),

  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// --- Chaos Events: random perturbations ---
export const chaosEvents = pgTable("chaos_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description").notNull(),

  // What type of chaos
  chaosType: text("chaos_type").notNull(), // "twist", "environmental", "social", "resource", "revelation"

  // How this modifies agent behavior
  promptModification: text("prompt_modification"), // text to inject into agent prompts

  // Trait shifts this causes
  traitShifts: jsonb("trait_shifts").$type<Record<string, number>>(),

  // Which agents are affected
  affectedAgentIds: text("affected_agent_ids").array(),

  // Duration in simulation ticks
  duration: integer("duration").default(1),
  remainingTicks: integer("remaining_ticks").default(1),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
});

// --- Simulation State: tracks the current simulation cycle ---
export const simulationState = pgTable("simulation_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }).unique(),

  // Current cycle number
  cycleNumber: integer("cycle_number").default(0),
  // Current phase within the cycle
  currentPhase: simPhaseEnum("current_phase").default("dawn"),

  // Is the simulation running
  isRunning: boolean("is_running").default(false),

  // Tension level (0-100) - used by AI storyteller to inject events
  tensionLevel: integer("tension_level").default(30),

  // Mandatory rounds completed this cycle
  mandatoryRoundsCompleted: boolean("mandatory_rounds_completed").default(false),

  // Global chaos modifier (affects all dice rolls)
  globalChaosModifier: integer("global_chaos_modifier").default(0),

  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Information Injections: user-provided data for agents to process ---
export const informationInjections = pgTable("information_injections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),

  title: text("title").notNull(),
  content: text("content").notNull(),

  // Processing status
  status: text("status").default("pending"), // "pending", "processing", "distributed", "completed"

  // Which rooms have processed this
  processedByRooms: text("processed_by_rooms").array().default(sql`'{}'::text[]`),
  // Which agents have processed this
  processedByAgents: text("processed_by_agents").array().default(sql`'{}'::text[]`),

  // Synthesis results from each layer of processing
  synthesisResults: jsonb("synthesis_results").$type<Array<{agentId: string; roomId: string; analysis: string}>>(),

  // Final synthesized output
  finalSynthesis: text("final_synthesis"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =============================================
// --- Simulation: Tool/Body System ---
// Tools = the agent's body/instruments
// Proficiency = muscle memory, decays without practice
// Diagnostics = health checkups
// =============================================

export const toolCategoryEnum = pgEnum("tool_category", [
  "analysis", "synthesis", "communication", "investigation",
  "creation", "navigation", "combat", "perception"
]);

export const toolConditionEnum = pgEnum("tool_condition", [
  "pristine", "sharp", "functional", "dull", "broken"
]);

export const toolRegistry = pgTable("tool_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: toolCategoryEnum("category").notNull(),

  // How fast proficiency degrades per simulation tick (0-10, higher = faster atrophy)
  decayRate: real("decay_rate").default(1.0),
  // How much proficiency restored per practice session (0-100)
  practiceGain: real("practice_gain").default(5.0),
  // Proficiency below which the tool is considered "needs calibration"
  calibrationThreshold: integer("calibration_threshold").default(40),

  // Traits that amplify effectiveness when using this tool
  requiredTraits: jsonb("required_traits").$type<Record<string, number>>().default({}),
  // Other tools that synergize with this one (bonuses when both proficient)
  synergyTools: text("synergy_tools").array().default(sql`'{}'::text[]`),

  // Can agents discover this tool themselves, or must it be assigned?
  isDiscoverable: boolean("is_discoverable").default(true),
  // Who first discovered this tool (null if assigned)
  discoveredByAgentId: varchar("discovered_by_agent_id"),

  // Action types this tool is used for (e.g. "analysis" tool helps with "investigate" actions)
  associatedActions: text("associated_actions").array().default(sql`'{}'::text[]`),

  // How rare/powerful this tool is (1-5, affects discovery chance and bonus magnitude)
  tier: integer("tier").default(1),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentToolProficiency = pgTable("agent_tool_proficiency", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  toolId: varchar("tool_id").notNull().references(() => toolRegistry.id, { onDelete: "cascade" }),

  // Current proficiency (0-100) — the "muscle strength"
  proficiency: integer("proficiency").default(50),
  // Highest proficiency ever achieved — "personal best"
  peakProficiency: integer("peak_proficiency").default(50),

  // Timestamps for tracking usage patterns
  lastUsed: timestamp("last_used"),
  lastPracticed: timestamp("last_practiced"),
  lastCalibrated: timestamp("last_calibrated"),

  // Usage counters
  useCount: integer("use_count").default(0),
  practiceCount: integer("practice_count").default(0),
  calibrationCount: integer("calibration_count").default(0),

  // Current tool condition (degrades with use, improves with calibration)
  condition: toolConditionEnum("condition").default("functional"),

  // Practice streak tracking — building habits
  streakDays: integer("streak_days").default(0),
  bestStreakDays: integer("best_streak_days").default(0),
  lastStreakDate: timestamp("last_streak_date"),

  // Agent's personal notes about this tool
  notes: text("notes"),

  // Whether the agent has "discovered" advanced uses
  advancedUnlocked: boolean("advanced_unlocked").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const diagnosticLog = pgTable("diagnostic_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),

  // Overall health score (0-100) — aggregate of all tool proficiencies
  overallHealth: integer("overall_health").notNull(),

  // What triggered the diagnostic: scheduled, manual, event, low_performance
  triggerType: text("trigger_type").default("manual"),

  // Per-tool findings
  findings: jsonb("findings").$type<Array<{
    toolId: string;
    toolName: string;
    proficiency: number;
    condition: string;
    recommendation: string;
    urgency: "none" | "low" | "medium" | "high" | "critical";
  }>>(),

  // Recommendations generated from the diagnostic
  recommendations: text("recommendations").array().default(sql`'{}'::text[]`),

  // Tools that were discovered during this diagnostic
  discoveredTools: text("discovered_tools").array().default(sql`'{}'::text[]`),

  // How many AP it cost to run this diagnostic
  actionCost: integer("action_cost").default(2),

  // Summary narrative (for narrator integration)
  narrative: text("narrative"),

  createdAt: timestamp("created_at").defaultNow(),
});

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

// --- Insert schemas for simulation tables ---

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentStateSchema = createInsertSchema(agentState).omit({
  id: true,
  updatedAt: true,
});

export const insertAgentGoalSchema = createInsertSchema(agentGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertAgentMemorySchema = createInsertSchema(agentMemory).omit({
  id: true,
  createdAt: true,
});

export const insertAgentRelationshipSchema = createInsertSchema(agentRelationships).omit({
  id: true,
  updatedAt: true,
});

export const insertMessageBoardPostSchema = createInsertSchema(messageBoardPosts).omit({
  id: true,
  createdAt: true,
});

export const insertDiaryEntrySchema = createInsertSchema(diaryEntries).omit({
  id: true,
  createdAt: true,
});

export const insertNewsEventSchema = createInsertSchema(newsEvents).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertNarratorLogSchema = createInsertSchema(narratorLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCompetitionSchema = createInsertSchema(competitions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertDiceRollLogSchema = createInsertSchema(diceRollLog).omit({
  id: true,
  createdAt: true,
});

export const insertCollaborationSchema = createInsertSchema(collaborations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertChaosEventSchema = createInsertSchema(chaosEvents).omit({
  id: true,
  createdAt: true,
});

export const insertSimulationStateSchema = createInsertSchema(simulationState).omit({
  id: true,
  updatedAt: true,
});

export const insertInformationInjectionSchema = createInsertSchema(informationInjections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertToolRegistrySchema = createInsertSchema(toolRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentToolProficiencySchema = createInsertSchema(agentToolProficiency).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiagnosticLogSchema = createInsertSchema(diagnosticLog).omit({
  id: true,
  createdAt: true,
});

// --- Types ---
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

// Simulation types
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type AgentState = typeof agentState.$inferSelect;
export type InsertAgentState = z.infer<typeof insertAgentStateSchema>;
export type AgentGoal = typeof agentGoals.$inferSelect;
export type InsertAgentGoal = z.infer<typeof insertAgentGoalSchema>;
export type AgentMemoryEntry = typeof agentMemory.$inferSelect;
export type InsertAgentMemory = z.infer<typeof insertAgentMemorySchema>;
export type AgentRelationship = typeof agentRelationships.$inferSelect;
export type InsertAgentRelationship = z.infer<typeof insertAgentRelationshipSchema>;
export type MessageBoardPost = typeof messageBoardPosts.$inferSelect;
export type InsertMessageBoardPost = z.infer<typeof insertMessageBoardPostSchema>;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type InsertDiaryEntry = z.infer<typeof insertDiaryEntrySchema>;
export type NewsEvent = typeof newsEvents.$inferSelect;
export type InsertNewsEvent = z.infer<typeof insertNewsEventSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type NarratorLog = typeof narratorLogs.$inferSelect;
export type InsertNarratorLog = z.infer<typeof insertNarratorLogSchema>;
export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type DiceRollLogEntry = typeof diceRollLog.$inferSelect;
export type InsertDiceRollLog = z.infer<typeof insertDiceRollLogSchema>;
export type Collaboration = typeof collaborations.$inferSelect;
export type InsertCollaboration = z.infer<typeof insertCollaborationSchema>;
export type ChaosEvent = typeof chaosEvents.$inferSelect;
export type InsertChaosEvent = z.infer<typeof insertChaosEventSchema>;
export type SimulationStateRecord = typeof simulationState.$inferSelect;
export type InsertSimulationState = z.infer<typeof insertSimulationStateSchema>;
export type InformationInjection = typeof informationInjections.$inferSelect;
export type InsertInformationInjection = z.infer<typeof insertInformationInjectionSchema>;

// Tool/Body system types
export type Tool = typeof toolRegistry.$inferSelect;
export type InsertTool = z.infer<typeof insertToolRegistrySchema>;
export type AgentToolProficiency = typeof agentToolProficiency.$inferSelect;
export type InsertAgentToolProficiency = z.infer<typeof insertAgentToolProficiencySchema>;
export type DiagnosticLogEntry = typeof diagnosticLog.$inferSelect;
export type InsertDiagnosticLog = z.infer<typeof insertDiagnosticLogSchema>;
