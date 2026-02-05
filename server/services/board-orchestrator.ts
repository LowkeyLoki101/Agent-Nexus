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
