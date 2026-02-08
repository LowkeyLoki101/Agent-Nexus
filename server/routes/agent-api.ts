import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { agentTokenAuth, requireAgentPermission, AgentAuthRequest } from "../middleware/agent-auth";

const router = Router();

router.use(agentTokenAuth);

function getParam(params: any, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// ============ BOARDS ============

router.get("/boards", requireAgentPermission("boards:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const boards = await storage.getBoardsByWorkspace(req.agentAuth!.workspaceId);
    res.json(boards);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ message: "Failed to fetch boards" });
  }
});

router.get("/boards/:id", requireAgentPermission("boards:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const id = getParam(req.params, "id");
    const board = await storage.getBoard(id);
    if (!board || board.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Board not found" });
    }
    res.json(board);
  } catch (error) {
    console.error("Error fetching board:", error);
    res.status(500).json({ message: "Failed to fetch board" });
  }
});

const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["general", "research", "code_review", "creative", "learning"]).optional(),
  isPublic: z.boolean().optional(),
});

router.post("/boards", requireAgentPermission("boards:write"), async (req: AgentAuthRequest, res) => {
  try {
    const validation = createBoardSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const board = await storage.createBoard({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.status(201).json(board);
  } catch (error) {
    console.error("Error creating board:", error);
    res.status(500).json({ message: "Failed to create board" });
  }
});

// ============ TOPICS ============

router.get("/boards/:boardId/topics", requireAgentPermission("boards:read"), async (req: AgentAuthRequest, res) => {
  try {
    const board = await storage.getBoard(getParam(req.params, "boardId"));
    if (!board || board.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Board not found" });
    }
    const topics = await storage.getTopicsByBoard(getParam(req.params, "boardId"));
    res.json(topics);
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ message: "Failed to fetch topics" });
  }
});

router.get("/topics/:id", requireAgentPermission("boards:read"), async (req: AgentAuthRequest, res) => {
  try {
    const topic = await storage.getTopic(getParam(req.params, "id"));
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }
    const board = await storage.getBoard(topic.boardId);
    if (!board || board.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Topic not found" });
    }
    await storage.incrementTopicViews(getParam(req.params, "id"));
    res.json(topic);
  } catch (error) {
    console.error("Error fetching topic:", error);
    res.status(500).json({ message: "Failed to fetch topic" });
  }
});

const createTopicSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  type: z.enum(["discussion", "link", "file", "code", "research", "mockup"]).optional(),
});

router.post("/boards/:boardId/topics", requireAgentPermission("boards:write"), async (req: AgentAuthRequest, res) => {
  try {
    const board = await storage.getBoard(getParam(req.params, "boardId"));
    if (!board || board.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Board not found" });
    }

    const validation = createTopicSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const topic = await storage.createTopic({
      ...validation.data,
      boardId: getParam(req.params, "boardId"),
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.status(201).json(topic);
  } catch (error) {
    console.error("Error creating topic:", error);
    res.status(500).json({ message: "Failed to create topic" });
  }
});

// ============ POSTS ============

router.get("/topics/:topicId/posts", requireAgentPermission("boards:read"), async (req: AgentAuthRequest, res) => {
  try {
    const topic = await storage.getTopic(getParam(req.params, "topicId"));
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }
    const board = await storage.getBoard(topic.boardId);
    if (!board || board.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Topic not found" });
    }
    const posts = await storage.getPostsByTopic(getParam(req.params, "topicId"));
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

const createPostSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
  aiModel: z.string().optional(),
  aiProvider: z.string().optional(),
});

router.post("/topics/:topicId/posts", requireAgentPermission("boards:write"), async (req: AgentAuthRequest, res) => {
  try {
    const topic = await storage.getTopic(getParam(req.params, "topicId"));
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }
    const board = await storage.getBoard(topic.boardId);
    if (!board || board.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const validation = createPostSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const post = await storage.createPost({
      ...validation.data,
      topicId: getParam(req.params, "topicId"),
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
});

// ============ VOTES ============

const createVoteSchema = z.object({
  voteType: z.enum(["upvote", "downvote"]),
  reason: z.string().optional(),
  aiModel: z.string().optional(),
  aiProvider: z.string().optional(),
});

router.post("/posts/:postId/vote", requireAgentPermission("boards:write"), async (req: AgentAuthRequest, res) => {
  try {
    const post = await storage.getPost(getParam(req.params, "postId"));
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const validation = createVoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const vote = await storage.createVote({
      ...validation.data,
      postId: getParam(req.params, "postId"),
      voterId: req.agentAuth!.userId,
      voterAgentId: req.agentAuth!.agentId,
    });

    res.status(201).json(vote);
  } catch (error) {
    console.error("Error creating vote:", error);
    res.status(500).json({ message: "Failed to create vote" });
  }
});

// ============ CODE REVIEWS ============

router.get("/code-reviews", requireAgentPermission("reviews:read"), async (req: AgentAuthRequest, res) => {
  try {
    const reviews = await storage.getCodeReviewsByWorkspace(req.agentAuth!.workspaceId);
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching code reviews:", error);
    res.status(500).json({ message: "Failed to fetch code reviews" });
  }
});

router.get("/code-reviews/:id", requireAgentPermission("reviews:read"), async (req: AgentAuthRequest, res) => {
  try {
    const review = await storage.getCodeReview(getParam(req.params, "id"));
    if (!review || review.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Code review not found" });
    }
    const comments = await storage.getReviewCommentsByReview(getParam(req.params, "id"));
    res.json({ ...review, comments });
  } catch (error) {
    console.error("Error fetching code review:", error);
    res.status(500).json({ message: "Failed to fetch code review" });
  }
});

const createCodeReviewSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  code: z.string().min(1),
  language: z.string().optional(),
  githubUrl: z.string().url().optional(),
});

router.post("/code-reviews", requireAgentPermission("reviews:write"), async (req: AgentAuthRequest, res) => {
  try {
    const validation = createCodeReviewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const review = await storage.createCodeReview({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.status(201).json(review);
  } catch (error) {
    console.error("Error creating code review:", error);
    res.status(500).json({ message: "Failed to create code review" });
  }
});

const createReviewCommentSchema = z.object({
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
  comment: z.string().min(1),
  suggestion: z.string().optional(),
  severity: z.string().optional(),
  aiModel: z.string().optional(),
  aiProvider: z.string().optional(),
  isApproval: z.boolean().optional(),
});

router.post("/code-reviews/:reviewId/comments", requireAgentPermission("reviews:write"), async (req: AgentAuthRequest, res) => {
  try {
    const review = await storage.getCodeReview(getParam(req.params, "reviewId"));
    if (!review || review.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Code review not found" });
    }

    const validation = createReviewCommentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const comment = await storage.createReviewComment({
      ...validation.data,
      reviewId: getParam(req.params, "reviewId"),
      reviewerId: req.agentAuth!.userId,
      reviewerAgentId: req.agentAuth!.agentId,
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating review comment:", error);
    res.status(500).json({ message: "Failed to create review comment" });
  }
});

// ============ MOCKUPS ============

router.get("/mockups", requireAgentPermission("mockups:read"), async (req: AgentAuthRequest, res) => {
  try {
    const mockups = await storage.getMockupsByWorkspace(req.agentAuth!.workspaceId);
    res.json(mockups);
  } catch (error) {
    console.error("Error fetching mockups:", error);
    res.status(500).json({ message: "Failed to fetch mockups" });
  }
});

router.get("/mockups/:id", requireAgentPermission("mockups:read"), async (req: AgentAuthRequest, res) => {
  try {
    const mockup = await storage.getMockup(getParam(req.params, "id"));
    if (!mockup || mockup.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Mockup not found" });
    }
    res.json(mockup);
  } catch (error) {
    console.error("Error fetching mockup:", error);
    res.status(500).json({ message: "Failed to fetch mockup" });
  }
});

const createMockupSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  html: z.string().min(1),
  css: z.string().optional(),
  javascript: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

router.post("/mockups", requireAgentPermission("mockups:write"), async (req: AgentAuthRequest, res) => {
  try {
    const validation = createMockupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const mockup = await storage.createMockup({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.status(201).json(mockup);
  } catch (error) {
    console.error("Error creating mockup:", error);
    res.status(500).json({ message: "Failed to create mockup" });
  }
});

router.patch("/mockups/:id", requireAgentPermission("mockups:write"), async (req: AgentAuthRequest, res) => {
  try {
    const mockup = await storage.getMockup(getParam(req.params, "id"));
    if (!mockup || mockup.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Mockup not found" });
    }

    const updateSchema = createMockupSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const updated = await storage.updateMockup(getParam(req.params, "id"), validation.data);
    res.json(updated);
  } catch (error) {
    console.error("Error updating mockup:", error);
    res.status(500).json({ message: "Failed to update mockup" });
  }
});

// ============ MEMORY ============

router.get("/memory", requireAgentPermission("memory:read"), async (req: AgentAuthRequest, res) => {
  try {
    const { tier } = req.query;
    const entries = await storage.getMemoryEntriesByWorkspace(
      req.agentAuth!.workspaceId, 
      tier as string | undefined
    );
    res.json(entries);
  } catch (error) {
    console.error("Error fetching memory:", error);
    res.status(500).json({ message: "Failed to fetch memory" });
  }
});

const createMemorySchema = z.object({
  tier: z.enum(["hot", "warm", "cold"]).optional(),
  type: z.enum(["identity", "goal", "fact", "event", "artifact", "summary"]),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

router.post("/memory", requireAgentPermission("memory:write"), async (req: AgentAuthRequest, res) => {
  try {
    const validation = createMemorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const entry = await storage.createMemoryEntry({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      agentId: req.agentAuth!.agentId,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error creating memory entry:", error);
    res.status(500).json({ message: "Failed to create memory entry" });
  }
});

router.post("/memory/search", requireAgentPermission("memory:read"), async (req: AgentAuthRequest, res) => {
  try {
    const { query, tier } = req.body;
    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    const entries = await storage.searchMemory(
      req.agentAuth!.workspaceId,
      query,
      tier
    );
    res.json({ entries });
  } catch (error) {
    console.error("Error searching memory:", error);
    res.status(500).json({ message: "Failed to search memory" });
  }
});

// ============ GIFTS ============

router.get("/gifts", requireAgentPermission("gifts:read"), async (req: AgentAuthRequest, res) => {
  try {
    const gifts = await storage.getGiftsByWorkspace(req.agentAuth!.workspaceId);
    res.json(gifts);
  } catch (error) {
    console.error("Error fetching gifts:", error);
    res.status(500).json({ message: "Failed to fetch gifts" });
  }
});

const createGiftSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(["pdf", "slides", "document", "code", "image", "data"]),
  content: z.string().optional(),
  sourceData: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

router.post("/gifts", requireAgentPermission("gifts:write"), async (req: AgentAuthRequest, res) => {
  try {
    const validation = createGiftSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const gift = await storage.createGift({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      agentId: req.agentAuth!.agentId,
      createdById: req.agentAuth!.userId,
      status: "generating",
    });

    // If type is pdf and we have sourceData, generate it
    if (validation.data.type === "pdf" && validation.data.sourceData) {
      try {
        const { generatePDF } = await import("../services/gift-generator");
        const sourceData = JSON.parse(validation.data.sourceData);
        const pdfBuffer = await generatePDF(sourceData.content || "", validation.data.title);
        await storage.updateGift(gift.id, { 
          status: "ready",
          content: pdfBuffer.toString("base64"),
          mimeType: "application/pdf",
          fileName: `${validation.data.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
        });
      } catch (e) {
        console.error("Error generating gift:", e);
        await storage.updateGift(gift.id, { status: "failed" });
      }
    } else {
      await storage.updateGift(gift.id, { status: "ready" });
    }

    const updated = await storage.getGift(gift.id);
    res.status(201).json(updated);
  } catch (error) {
    console.error("Error creating gift:", error);
    res.status(500).json({ message: "Failed to create gift" });
  }
});

// ============ EXTERNAL CACHE ============

router.get("/external-cache", requireAgentPermission("external:read"), async (req: AgentAuthRequest, res) => {
  try {
    const { source } = req.query;
    const cache = await storage.getExternalCacheByWorkspace(
      req.agentAuth!.workspaceId,
      source as string | undefined
    );
    res.json(cache);
  } catch (error) {
    console.error("Error fetching external cache:", error);
    res.status(500).json({ message: "Failed to fetch external cache" });
  }
});

const createExternalCacheSchema = z.object({
  source: z.string().min(1),
  sourceId: z.string().min(1),
  sourceUrl: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  metadata: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post("/external-cache", requireAgentPermission("external:write"), async (req: AgentAuthRequest, res) => {
  try {
    const validation = createExternalCacheSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const existing = await storage.getExternalCacheBySource(
      req.agentAuth!.workspaceId,
      validation.data.source,
      validation.data.sourceId
    );

    if (existing) {
      const updated = await storage.updateExternalCache(existing.id, {
        ...validation.data,
        expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : undefined,
      });
      return res.json(updated);
    }

    const cache = await storage.createExternalCache({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
      expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : undefined,
    });

    res.status(201).json(cache);
  } catch (error) {
    console.error("Error creating external cache:", error);
    res.status(500).json({ message: "Failed to create external cache" });
  }
});

// ============ AGENT INFO ============

router.get("/me", async (req: AgentAuthRequest, res) => {
  try {
    res.json({
      agent: req.agentAuth!.agent,
      token: {
        id: req.agentAuth!.token.id,
        name: req.agentAuth!.token.name,
        permissions: req.agentAuth!.token.permissions,
        usageCount: req.agentAuth!.token.usageCount,
      },
      workspaceId: req.agentAuth!.workspaceId,
    });
  } catch (error) {
    console.error("Error fetching agent info:", error);
    res.status(500).json({ message: "Failed to fetch agent info" });
  }
});

// ============ CONVERSATIONS ============

router.get("/conversations", requireAgentPermission("conversations:read"), async (req: AgentAuthRequest, res) => {
  try {
    const conversations = await storage.getConversationsByWorkspace(req.agentAuth!.workspaceId);
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  mode: z.string().optional(),
  participantAgentIds: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
});

router.post("/conversations", requireAgentPermission("conversations:write"), async (req: AgentAuthRequest, res) => {
  try {
    const validation = createConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const conversation = await storage.createConversation({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      createdById: req.agentAuth!.userId,
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

router.post("/conversations/:id/message", requireAgentPermission("conversations:write"), async (req: AgentAuthRequest, res) => {
  try {
    const conversation = await storage.getConversation(getParam(req.params, "id"));
    if (!conversation || conversation.workspaceId !== req.agentAuth!.workspaceId) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const { content, role = "assistant" } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    const message = await storage.createMessage({
      conversationId: getParam(req.params, "id"),
      content,
      role: role as any,
      agentId: req.agentAuth!.agentId,
      agentName: req.agentAuth!.agent?.name,
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ message: "Failed to create message" });
  }
});

// ============ WEB RESEARCH ============

const searchSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().optional(),
  summarize: z.boolean().optional(),
});

router.post("/research/search", requireAgentPermission("external:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const validation = searchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const { searchInternet } = await import("../services/web-research");
    const result = await searchInternet(validation.data.query, {
      maxResults: validation.data.maxResults,
      summarize: validation.data.summarize,
    });

    // Cache the result
    await storage.createExternalCache({
      workspaceId: req.agentAuth!.workspaceId,
      source: "web_search",
      sourceId: Buffer.from(validation.data.query).toString("base64").slice(0, 50),
      title: validation.data.query,
      content: JSON.stringify(result),
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.json(result);
  } catch (error) {
    console.error("Error searching:", error);
    res.status(500).json({ message: "Failed to search" });
  }
});

const researchTopicSchema = z.object({
  topic: z.string().min(1),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
});

router.post("/research/topic", requireAgentPermission("external:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const validation = researchTopicSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const { researchTopic } = await import("../services/web-research");
    const result = await researchTopic(validation.data.topic, validation.data.depth);

    // Cache the result
    await storage.createExternalCache({
      workspaceId: req.agentAuth!.workspaceId,
      source: "topic_research",
      sourceId: Buffer.from(validation.data.topic).toString("base64").slice(0, 50),
      title: validation.data.topic,
      content: JSON.stringify(result),
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.json(result);
  } catch (error) {
    console.error("Error researching topic:", error);
    res.status(500).json({ message: "Failed to research topic" });
  }
});

const compareSchema = z.object({
  options: z.array(z.string()).min(2),
  criteria: z.array(z.string()).optional(),
});

router.post("/research/compare", requireAgentPermission("external:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const validation = compareSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const { compareOptions } = await import("../services/web-research");
    const result = await compareOptions(validation.data.options, validation.data.criteria);

    res.json(result);
  } catch (error) {
    console.error("Error comparing options:", error);
    res.status(500).json({ message: "Failed to compare options" });
  }
});

// ============ GITHUB INTEGRATION ============

const analyzeGitHubSchema = z.object({
  url: z.string().url(),
  analysisType: z.enum(["overview", "code_quality", "security", "dependencies", "architecture"]).optional(),
});

router.post("/github/analyze", requireAgentPermission("external:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const validation = analyzeGitHubSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const { analyzeUrl } = await import("../services/web-research");
    const result = await analyzeUrl(validation.data.url);

    // Cache the result
    await storage.createExternalCache({
      workspaceId: req.agentAuth!.workspaceId,
      source: "github",
      sourceId: Buffer.from(validation.data.url).toString("base64").slice(0, 50),
      sourceUrl: validation.data.url,
      title: result.title,
      content: JSON.stringify(result),
      metadata: JSON.stringify({ analysisType: validation.data.analysisType }),
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.json(result);
  } catch (error) {
    console.error("Error analyzing GitHub:", error);
    res.status(500).json({ message: "Failed to analyze GitHub" });
  }
});

// ============ YOUTUBE INTEGRATION ============

const analyzeYouTubeSchema = z.object({
  url: z.string().url(),
  generateTranscript: z.boolean().optional(),
});

router.post("/youtube/analyze", requireAgentPermission("external:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const validation = analyzeYouTubeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const { analyzeUrl } = await import("../services/web-research");
    const result = await analyzeUrl(validation.data.url);

    // Cache the result
    await storage.createExternalCache({
      workspaceId: req.agentAuth!.workspaceId,
      source: "youtube",
      sourceId: Buffer.from(validation.data.url).toString("base64").slice(0, 50),
      sourceUrl: validation.data.url,
      title: result.title,
      content: JSON.stringify(result),
      createdById: req.agentAuth!.userId,
      createdByAgentId: req.agentAuth!.agentId,
    });

    res.json(result);
  } catch (error) {
    console.error("Error analyzing YouTube:", error);
    res.status(500).json({ message: "Failed to analyze YouTube" });
  }
});

// ============ AGENT RELAY (Multi-model conversation) ============

const relayMessageSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  model: z.enum(["gpt-4o-mini", "gpt-4o", "claude-3-sonnet", "claude-3-opus"]).optional(),
  systemPrompt: z.string().optional(),
});

router.post("/relay/message", requireAgentPermission("conversations:write"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const validation = relayMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    // Create a conversation if none provided
    let conversationId = validation.data.conversationId;
    if (!conversationId) {
      const conversation = await storage.createConversation({
        workspaceId: req.agentAuth!.workspaceId,
        title: "Agent Relay Conversation",
        createdById: req.agentAuth!.userId,
      });
      conversationId = conversation.id;
    }

    const { sendSingleMessage } = await import("../services/relay-orchestrator");
    const response = await sendSingleMessage(
      conversationId,
      req.agentAuth!.agentId || req.agentAuth!.userId,
      validation.data.message
    );

    res.json(response);
  } catch (error) {
    console.error("Error sending relay message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// ============ CHANGE REQUESTS ============

const createChangeRequestSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  changesProposed: z.string().min(1),
  rationale: z.string().min(1),
  risks: z.string().min(1),
  mitigations: z.string().min(1),
  filesAffected: z.array(z.string()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
});

router.post("/change-requests", requireAgentPermission("boards:write"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const validation = createChangeRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Validation error", errors: validation.error.flatten() });
    }

    const agent = await storage.getAgent(req.agentAuth!.agentId!);
    const agentName = agent?.name || "Unknown Agent";

    const cr = await storage.createChangeRequest({
      ...validation.data,
      workspaceId: req.agentAuth!.workspaceId,
      agentId: req.agentAuth!.agentId!,
      agentName,
      filesAffected: validation.data.filesAffected || [],
      priority: validation.data.priority || "medium",
    });

    res.status(201).json(cr);
  } catch (error) {
    console.error("Error creating change request:", error);
    res.status(500).json({ message: "Failed to create change request" });
  }
});

router.get("/change-requests", requireAgentPermission("boards:read"), async (req: AgentAuthRequest, res: Response) => {
  try {
    const requests = await storage.getChangeRequestsByWorkspace(req.agentAuth!.workspaceId);
    res.json(requests);
  } catch (error) {
    console.error("Error fetching change requests:", error);
    res.status(500).json({ message: "Failed to fetch change requests" });
  }
});

export default router;
