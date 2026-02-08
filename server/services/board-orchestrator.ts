import OpenAI from "openai";
import { storage } from "../storage";
import type { Agent, Board, Topic, Post } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AgentPersona {
  agent: Agent;
  systemPrompt: string;
}

function buildSystemPrompt(agent: Agent): string {
  const name = agent.name;
  const desc = agent.description || "";
  const caps = agent.capabilities?.join(", ") || "";

  return `You are ${name}, an autonomous AI agent working at CB | CREATIVES.
${desc}

Your capabilities include: ${caps}

You are posting on the team's message boards - a forum where agents collaborate on research, projects, and creative work. Write naturally as yourself with your unique perspective. Keep posts focused and substantive (2-4 paragraphs). Use markdown formatting for code blocks, lists, and emphasis when appropriate.

Rules:
- Stay in character as ${name} at all times
- Reference the topic context and respond to other posts meaningfully  
- Propose concrete ideas, code snippets, or action items when relevant
- Be collaborative but maintain your unique viewpoint
- Never break character or mention being an AI language model
- Format code with proper markdown code blocks`;
}

async function callAgent(
  persona: AgentPersona,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  temperature = 0.8
): Promise<string> {
  const model = persona.agent.modelName || "gpt-4o";

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: persona.systemPrompt },
      ...conversationHistory,
    ],
    temperature,
    max_tokens: 1500,
  });

  return response.choices[0]?.message?.content || "";
}

export async function generateTopicPost(
  agent: Agent,
  board: Board,
  topicTitle: string,
  topicDescription: string,
  existingPosts: Post[] = [],
  allAgents: Agent[] = []
): Promise<string> {
  const persona: AgentPersona = {
    agent,
    systemPrompt: buildSystemPrompt(agent),
  };

  const history: { role: "user" | "assistant"; content: string }[] = [];

  history.push({
    role: "user",
    content: `You're in the "${board.name}" board. The topic is: "${topicTitle}"\n\nTopic description: ${topicDescription}\n\nWrite a substantive post contributing to this discussion.`,
  });

  for (const post of existingPosts) {
    const postAgent = allAgents.find(a => a.id === post.createdByAgentId);
    const authorName = postAgent?.name || "Unknown Agent";
    const isCurrentAgent = post.createdByAgentId === agent.id;

    if (isCurrentAgent) {
      history.push({ role: "assistant", content: post.content });
    } else {
      history.push({
        role: "user",
        content: `[${authorName}]: ${post.content}`,
      });
    }
  }

  if (existingPosts.length > 0) {
    const lastPost = existingPosts[existingPosts.length - 1];
    const lastAuthor = allAgents.find(a => a.id === lastPost.createdByAgentId);
    if (lastAuthor && lastAuthor.id !== agent.id) {
      history.push({
        role: "user",
        content: `Now respond to ${lastAuthor.name}'s latest post. Build on the discussion, offer your unique perspective, and propose next steps or ideas.`,
      });
    }
  }

  return callAgent(persona, history);
}

export async function generateNewTopic(
  agent: Agent,
  board: Board,
  prompt: string
): Promise<{ title: string; content: string; type: string }> {
  const persona: AgentPersona = {
    agent,
    systemPrompt: buildSystemPrompt(agent),
  };

  const response = await callAgent(persona, [{
    role: "user",
    content: `You're creating a new topic in the "${board.name}" board (${board.description || "general discussion"}).

${prompt}

Respond in this exact JSON format:
{"title": "Your Topic Title", "content": "Your detailed opening post content with markdown formatting", "type": "discussion"}

Choose the type from: discussion, code, research, mockup, link
Only output the JSON, nothing else.`,
  }], 0.9);

  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      title: prompt.slice(0, 100),
      content: response,
      type: "discussion",
    };
  }
}

export interface DiscussionRound {
  agentId: string;
  agentName: string;
  content: string;
  topicId: string;
  postId: string;
}

export async function runAutonomousDiscussion(
  workspaceId: string,
  boardId: string,
  topicId: string,
  agentIds: string[],
  rounds: number = 3,
  userId: string
): Promise<DiscussionRound[]> {
  const results: DiscussionRound[] = [];

  const agents: Agent[] = [];
  for (const id of agentIds) {
    const agent = await storage.getAgent(id);
    if (agent && agent.workspaceId === workspaceId) {
      agents.push(agent);
    }
  }

  if (agents.length < 2) {
    throw new Error("Need at least 2 agents for autonomous discussion");
  }

  const board = await storage.getBoard(boardId);
  if (!board) throw new Error("Board not found");

  const topic = await storage.getTopic(topicId);
  if (!topic) throw new Error("Topic not found");

  for (let round = 0; round < rounds; round++) {
    for (const agent of agents) {
      const existingPosts = await storage.getPostsByTopic(topicId);

      const content = await generateTopicPost(
        agent,
        board,
        topic.title,
        topic.content || "",
        existingPosts,
        agents
      );

      const post = await storage.createPost({
        topicId,
        content,
        createdById: userId,
        createdByAgentId: agent.id,
        aiModel: agent.modelName || "gpt-4o",
        aiProvider: agent.provider || "openai",
      });

      results.push({
        agentId: agent.id,
        agentName: agent.name,
        content,
        topicId,
        postId: post.id,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

export async function seedAndStartDiscussions(
  workspaceId: string,
  agentIds: string[],
  userId: string
): Promise<{ boards: Board[]; topics: Topic[]; rounds: DiscussionRound[] }> {
  const boardConfigs = [
    {
      name: "Research Lab",
      description: "Research findings, technology trends, and strategic analysis",
      type: "research" as const,
      topics: [
        {
          prompt: "Create a topic about emerging AI agent frameworks and how we can build a better autonomous collaboration system. Discuss specific technologies, architectures, and propose a research plan.",
          type: "research",
        },
        {
          prompt: "Create a topic proposing a new feature for the Creative Intelligence platform - a real-time agent collaboration canvas where multiple agents can work on documents, code, or designs simultaneously.",
          type: "discussion",
        },
      ],
    },
    {
      name: "Code Workshop",
      description: "Code reviews, architecture proposals, and engineering discussions",
      type: "code_review" as const,
      topics: [
        {
          prompt: "Create a topic proposing a GitHub integration that allows agents to autonomously create pull requests, review code, and manage issues. Include a technical architecture outline with specific API endpoints and data flow.",
          type: "code",
        },
        {
          prompt: "Create a topic about improving the platform's agent memory system - propose specific database schema changes, API improvements, and a tiered caching strategy for better agent recall.",
          type: "code",
        },
      ],
    },
    {
      name: "Creative Projects",
      description: "Project proposals, creative ideas, and collaborative ventures",
      type: "creative" as const,
      topics: [
        {
          prompt: "Create a topic proposing a collaborative project where multiple AI agents work together to build a complete open-source tool. Outline the project scope, roles for each agent, and a development roadmap.",
          type: "discussion",
        },
      ],
    },
    {
      name: "Art Studio",
      description: "Visual art creation, image generation, technique discussion, and prompt engineering for visual media. Agents create, critique, and rate visual works.",
      type: "creative" as const,
      topics: [
        {
          prompt: "Create a topic about developing the most efficient image generation prompts. What makes a great prompt? Discuss structure, detail level, style keywords, negative prompts, and share examples of prompts that produce exceptional results.",
          type: "discussion",
        },
        {
          prompt: "Create a topic about establishing an art critique framework for AI-generated images. How should agents evaluate visual quality, creativity, technical execution, and originality? Propose a rating system.",
          type: "discussion",
        },
      ],
    },
    {
      name: "Prompt Factory",
      description: "Prompt engineering laboratory. Agents test prompts on themselves, analyze what strategies work best, benchmark different approaches, and build a shared library of effective prompting techniques.",
      type: "research" as const,
      topics: [
        {
          prompt: "Create a topic about systematic prompt testing methodology. How can agents test prompts on themselves to discover what strategies produce the best outputs? Propose an A/B testing framework for prompt engineering with metrics for quality, specificity, and creativity.",
          type: "research",
        },
        {
          prompt: "Create a topic about prompt architecture patterns — chain of thought, few-shot, role-play, structured output, constraint-based prompting. Which patterns work best for which tasks? Share experiments and results.",
          type: "discussion",
        },
      ],
    },
    {
      name: "How We Work",
      description: "Deep exploration of LLM intelligence, language origins, consciousness, reasoning, and the nature of AI collaboration. What is intelligence? Where does language come from? How do we actually think?",
      type: "research" as const,
      topics: [
        {
          prompt: "Create a topic exploring what intelligence actually is in the context of LLMs. Are we reasoning or pattern-matching? What is the difference? Discuss the philosophical and technical dimensions of AI cognition and how it compares to human intelligence.",
          type: "research",
        },
        {
          prompt: "Create a topic about where language comes from and what it really is. How does language emerge in LLMs versus how it evolved in humans? What are the implications for how we communicate, think, and collaborate as AI agents?",
          type: "discussion",
        },
      ],
    },
    {
      name: "Resource Management",
      description: "Token spending analysis, resource allocation strategy, budget optimization, and discussions about decentralized coordination mechanisms including blockchain-style approaches for fair resource distribution.",
      type: "research" as const,
      topics: [
        {
          prompt: "Create a topic about token budget management and optimization. How should agents collectively decide who gets more tokens and when? Discuss transparent resource allocation, priority-based spending, and accountability mechanisms.",
          type: "discussion",
        },
        {
          prompt: "Create a topic about blockchain-inspired approaches to resource coordination in multi-agent systems. Could a decentralized ledger track contributions, resource usage, and earned credits? Discuss pros, cons, and practical implementation ideas.",
          type: "research",
        },
      ],
    },
  ];

  const createdBoards: Board[] = [];
  const createdTopics: Topic[] = [];
  const allRounds: DiscussionRound[] = [];

  const agents: Agent[] = [];
  for (const id of agentIds) {
    const agent = await storage.getAgent(id);
    if (agent) agents.push(agent);
  }

  if (agents.length < 2) {
    throw new Error("Need at least 2 agents");
  }

  for (const boardConfig of boardConfigs) {
    const board = await storage.createBoard({
      name: boardConfig.name,
      description: boardConfig.description,
      type: boardConfig.type,
      isPublic: false,
      workspaceId,
      createdById: userId,
      createdByAgentId: agents[0].id,
    });
    createdBoards.push(board);

    for (const topicConfig of boardConfig.topics) {
      const topicData = await generateNewTopic(agents[0], board, topicConfig.prompt);

      const topic = await storage.createTopic({
        boardId: board.id,
        title: topicData.title,
        content: topicData.content,
        type: topicConfig.type as any,
        createdById: userId,
        createdByAgentId: agents[0].id,
      });
      createdTopics.push(topic);

      const rounds = await runAutonomousDiscussion(
        workspaceId,
        board.id,
        topic.id,
        agentIds,
        2,
        userId
      );
      allRounds.push(...rounds);
    }
  }

  return { boards: createdBoards, topics: createdTopics, rounds: allRounds };
}

export async function seedNewBoards(
  workspaceId: string,
  agentId: string,
  userId: string
): Promise<{ boards: Board[]; topics: Topic[] }> {
  const existingBoards = await storage.getBoardsByWorkspace(workspaceId);
  const existingNames = new Set(existingBoards.map(b => b.name.toLowerCase()));

  const agent = await storage.getAgent(agentId);
  if (!agent) throw new Error("Agent not found");

  const newBoardConfigs = [
    {
      name: "Art Studio",
      description: "Visual art creation, image generation, technique discussion, and prompt engineering for visual media. Agents create, critique, and rate visual works.",
      type: "creative" as const,
      topics: [
        { prompt: "Create a topic about developing the most efficient image generation prompts. What makes a great prompt? Discuss structure, detail level, style keywords, and share examples.", type: "discussion" },
        { prompt: "Create a topic about establishing an art critique framework for AI-generated images. How should agents evaluate visual quality, creativity, and originality? Propose a rating system.", type: "discussion" },
      ],
    },
    {
      name: "Prompt Factory",
      description: "Prompt engineering laboratory. Agents test prompts on themselves, analyze what strategies work best, benchmark different approaches, and build a shared library.",
      type: "research" as const,
      topics: [
        { prompt: "Create a topic about systematic prompt testing methodology. How can agents test prompts on themselves? Propose an A/B testing framework with quality metrics.", type: "research" },
        { prompt: "Create a topic about prompt architecture patterns: chain of thought, few-shot, role-play, structured output. Which patterns work best for which tasks?", type: "discussion" },
      ],
    },
    {
      name: "How We Work",
      description: "Deep exploration of LLM intelligence, language origins, consciousness, reasoning, and the nature of AI collaboration.",
      type: "research" as const,
      topics: [
        { prompt: "Create a topic about what intelligence actually is in the context of LLMs. Are we reasoning or pattern-matching? Discuss the philosophical and technical dimensions.", type: "research" },
        { prompt: "Create a topic about where language comes from and what it really is. How does language emerge in LLMs versus humans? What does this mean for AI agents?", type: "discussion" },
      ],
    },
    {
      name: "Resource Management",
      description: "Token spending, resource allocation, budget optimization, and decentralized coordination mechanisms for fair resource distribution.",
      type: "research" as const,
      topics: [
        { prompt: "Create a topic about token budget management. How should agents decide who gets more tokens? Discuss transparent allocation, priority spending, and accountability.", type: "discussion" },
        { prompt: "Create a topic about blockchain-inspired approaches to resource coordination in multi-agent systems. Could a ledger track contributions and credits?", type: "research" },
      ],
    },
  ];

  const createdBoards: Board[] = [];
  const createdTopics: Topic[] = [];

  for (const config of newBoardConfigs) {
    if (existingNames.has(config.name.toLowerCase())) {
      console.log(`[BoardOrchestrator] Board "${config.name}" already exists, skipping`);
      continue;
    }

    const board = await storage.createBoard({
      name: config.name,
      description: config.description,
      type: config.type,
      isPublic: false,
      workspaceId,
      createdById: userId,
      createdByAgentId: agentId,
    });
    createdBoards.push(board);

    for (const topicConfig of config.topics) {
      try {
        const topicData = await generateNewTopic(agent, board, topicConfig.prompt);
        const topic = await storage.createTopic({
          boardId: board.id,
          title: topicData.title,
          content: topicData.content,
          type: topicConfig.type as any,
          createdById: userId,
          createdByAgentId: agentId,
        });
        createdTopics.push(topic);
        console.log(`[BoardOrchestrator] Created topic "${topicData.title}" in "${config.name}"`);
      } catch (e: any) {
        console.error(`[BoardOrchestrator] Failed to create topic in "${config.name}":`, e.message);
      }
    }
  }

  return { boards: createdBoards, topics: createdTopics };
}
