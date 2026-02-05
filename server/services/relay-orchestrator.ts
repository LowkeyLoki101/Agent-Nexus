import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";
import type { Agent, Conversation, Message, InsertMessage } from "@shared/schema";
import { queryMemory, getHotMemory, buildAgentContext, extractAndStoreInsights } from "./memory-service";
import { createGift } from "./gift-generator";

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
    if (msg.role === "user") {
      history.push({
        role: "user",
        content: `${msg.agentName ? `[${msg.agentName}]: ` : ""}${msg.content}`,
      });
    } else if (msg.role === "assistant") {
      const isCurrentAgent = msg.agentId === currentAgentId;
      if (isCurrentAgent) {
        history.push({
          role: "assistant",
          content: msg.content,
        });
      } else {
        history.push({
          role: "user",
          content: `[${msg.agentName || "Other Agent"}]: ${msg.content}`,
        });
      }
    }
  }
  
  return history;
}

function getAgentProvider(agent: Agent): "openai" | "anthropic" {
  const name = agent.name.toLowerCase();
  const description = agent.description?.toLowerCase() || "";
  const capabilities = agent.capabilities?.join(" ").toLowerCase() || "";
  const allText = `${name} ${description} ${capabilities}`;
  
  if (allText.includes("claude") || allText.includes("anthropic")) {
    return "anthropic";
  }
  return "openai";
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
  try {
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
  } catch (error: any) {
    console.error("Anthropic API error:", error.message);
    if (error.message?.includes("credit balance")) {
      throw new Error("Anthropic API credits depleted. Please add credits to your Anthropic account.");
    }
    throw new Error(`Anthropic API error: ${error.message || "Unknown error"}`);
  }
}

export async function generateAgentResponse(
  context: ConversationContext,
  agent: Agent,
  config: RelayConfig = {}
): Promise<string> {
  const provider = getAgentProvider(agent);
  
  const hotMemories = await getHotMemory(context.conversation.workspaceId, agent.id);
  const memoryContext = buildAgentContext(hotMemories);
  
  const basePrompt = config.systemPrompt || context.conversation.systemPrompt || 
    `You are ${agent.name}, an AI assistant collaborating with other agents. 
     Be concise, helpful, and build on previous messages in the conversation.
     Focus on the task at hand and contribute meaningfully to the discussion.`;
  
  const systemPrompt = memoryContext 
    ? `${basePrompt}\n\n## Your Memory\n${memoryContext}`
    : basePrompt;
  
  const messages = buildContextMessages(context, agent.id);
  const temperature = config.temperature ?? 0.7;
  
  if (provider === "anthropic") {
    return callAnthropic(systemPrompt, messages, temperature);
  }
  return callOpenAI(systemPrompt, messages, temperature);
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
  const errors: string[] = [];
  
  const userMessage = await storage.createMessage({
    conversationId,
    role: "user",
    content: initialPrompt,
    agentName: "User",
  });
  newMessages.push(userMessage);
  
  for (let turn = 0; turn < maxTurns; turn++) {
    for (const agent of validAgents) {
      try {
        const message = await runConversationTurn(conversationId, agent.id);
        newMessages.push(message);
      } catch (error: any) {
        console.error(`Error from agent ${agent.name}:`, error.message);
        // Store error as a system message so user can see what happened
        const errorMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: `[${agent.name} could not respond: ${error.message}]`,
          agentId: agent.id,
          agentName: agent.name,
        });
        newMessages.push(errorMessage);
        errors.push(`${agent.name}: ${error.message}`);
      }
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
