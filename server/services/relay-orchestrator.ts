import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";
import type { Agent, Conversation, Message, InsertMessage } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface RelayConfig {
  maxTurns?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface ConversationContext {
  conversation: Conversation;
  agents: Agent[];
  messages: Message[];
}

function buildContextMessages(context: ConversationContext, currentAgentId: string): { role: "user" | "assistant"; content: string }[] {
  const history: { role: "user" | "assistant"; content: string }[] = [];
  
  for (const msg of context.messages) {
    const isCurrentAgent = msg.agentId === currentAgentId;
    history.push({
      role: isCurrentAgent ? "assistant" : "user",
      content: `${msg.agentName ? `[${msg.agentName}]: ` : ""}${msg.content}`,
    });
  }
  
  return history;
}

function getAgentProvider(agent: Agent): "openai" | "anthropic" | "unknown" {
  const name = agent.name.toLowerCase();
  const capabilities = agent.capabilities?.join(" ").toLowerCase() || "";
  
  if (name.includes("chatgpt") || name.includes("gpt") || capabilities.includes("openai")) {
    return "openai";
  }
  if (name.includes("claude") || capabilities.includes("anthropic")) {
    return "anthropic";
  }
  return "unknown";
}

async function callOpenAI(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  temperature = 0.7
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature,
    max_tokens: 2048,
  });
  
  return response.choices[0]?.message?.content || "";
}

async function callAnthropic(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  temperature = 0.7
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });
  
  const textBlock = response.content.find(block => block.type === "text");
  return textBlock ? (textBlock as { type: "text"; text: string }).text : "";
}

export async function generateAgentResponse(
  context: ConversationContext,
  agent: Agent,
  config: RelayConfig = {}
): Promise<string> {
  const provider = getAgentProvider(agent);
  const systemPrompt = config.systemPrompt || context.conversation.systemPrompt || 
    `You are ${agent.name}, an AI assistant collaborating with other agents. 
     Be concise, helpful, and build on previous messages in the conversation.
     Focus on the task at hand and contribute meaningfully to the discussion.`;
  
  const messages = buildContextMessages(context, agent.id);
  const temperature = config.temperature ?? 0.7;
  
  if (provider === "openai") {
    return callOpenAI(systemPrompt, messages, temperature);
  } else if (provider === "anthropic") {
    return callAnthropic(systemPrompt, messages, temperature);
  } else {
    throw new Error(`Unknown provider for agent ${agent.name}`);
  }
}

export async function runConversationTurn(
  conversationId: string,
  agentId: string,
  prompt?: string
): Promise<Message> {
  const conversation = await storage.getConversation(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }
  
  const messages = await storage.getMessagesByConversation(conversationId);
  const agents = await Promise.all(
    (conversation.participantAgentIds || []).map(id => storage.getAgent(id))
  );
  
  const context: ConversationContext = {
    conversation,
    agents: agents.filter((a): a is Agent => a !== undefined),
    messages,
  };
  
  if (prompt) {
    const userMessage = await storage.createMessage({
      conversationId,
      role: "user",
      content: prompt,
      agentName: "User",
    });
    context.messages.push(userMessage);
  }
  
  const response = await generateAgentResponse(context, agent);
  
  const agentMessage = await storage.createMessage({
    conversationId,
    agentId: agent.id,
    role: "assistant",
    content: response,
    agentName: agent.name,
  });
  
  return agentMessage;
}

export async function orchestrateConversation(
  conversationId: string,
  initialPrompt: string,
  config: RelayConfig = {}
): Promise<Message[]> {
  const conversation = await storage.getConversation(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  
  const participantIds = conversation.participantAgentIds || [];
  if (participantIds.length < 2) {
    throw new Error("Conversation requires at least 2 agent participants");
  }
  
  const agents = await Promise.all(
    participantIds.map(id => storage.getAgent(id))
  );
  const validAgents = agents.filter((a): a is Agent => a !== undefined);
  
  if (validAgents.length < 2) {
    throw new Error("Could not find all participating agents");
  }
  
  const maxTurns = config.maxTurns || 4;
  const newMessages: Message[] = [];
  
  const userMessage = await storage.createMessage({
    conversationId,
    role: "user",
    content: initialPrompt,
    agentName: "User",
  });
  newMessages.push(userMessage);
  
  for (let turn = 0; turn < maxTurns; turn++) {
    for (const agent of validAgents) {
      const message = await runConversationTurn(conversationId, agent.id);
      newMessages.push(message);
    }
  }
  
  return newMessages;
}

export async function sendSingleMessage(
  conversationId: string,
  agentId: string,
  userPrompt: string
): Promise<Message> {
  return runConversationTurn(conversationId, agentId, userPrompt);
}
