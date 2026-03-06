import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 15, output: 60 },
  "gpt-4o": { input: 250, output: 1000 },
  "gpt-5.2": { input: 500, output: 1500 },
  "gpt-5.1": { input: 500, output: 1500 },
  "gpt-audio": { input: 250, output: 1000 },
  "gpt-4o-mini-transcribe": { input: 15, output: 60 },
  "gpt-image-1": { input: 0, output: 0 },
  "claude-sonnet-4-20250514": { input: 300, output: 1500 },
  "claude-haiku-4-5": { input: 80, output: 400 },
  "claude-3-5-haiku-20241022": { input: 80, output: 400 },
  "grok-3": { input: 300, output: 1500 },
  "grok-3-mini": { input: 30, output: 50 },
  "MiniMax-M2.5": { input: 100, output: 400 },
  "MiniMax-M2.5-highspeed": { input: 100, output: 400 },
  "MiniMax-M2.1": { input: 80, output: 300 },
  "MiniMax-M2.1-highspeed": { input: 80, output: 300 },
  "MiniMax-M2": { input: 60, output: 200 },
};

const IMAGE_COST_CENTS = 4;

function estimateCostCents(model: string, promptTokens: number, completionTokens: number, cacheReadTokens?: number, cacheWriteTokens?: number): number {
  const costs = COST_PER_MILLION[model] || COST_PER_MILLION["gpt-4o-mini"];
  let inputCost: number;
  if (cacheReadTokens && cacheReadTokens > 0) {
    const uncachedInput = Math.max(0, promptTokens - cacheReadTokens);
    inputCost = (uncachedInput / 1_000_000) * costs.input + (cacheReadTokens / 1_000_000) * costs.input * 0.1;
  } else {
    inputCost = (promptTokens / 1_000_000) * costs.input;
  }
  if (cacheWriteTokens && cacheWriteTokens > 0) {
    inputCost += (cacheWriteTokens / 1_000_000) * costs.input * 0.25;
  }
  const outputCost = (completionTokens / 1_000_000) * costs.output;
  return Math.round(inputCost + outputCost);
}

let platformClient: OpenAI | null = null;

function getPlatformClient(): OpenAI {
  if (!platformClient) {
    platformClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return platformClient;
}

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

let minimaxClient: Anthropic | null = null;

function getMinimaxClient(): Anthropic | null {
  if (!process.env.MINIMAX_API_KEY) return null;
  if (!minimaxClient) {
    minimaxClient = new Anthropic({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: "https://api.minimax.io/anthropic",
    });
  }
  return minimaxClient;
}

let xaiClient: OpenAI | null = null;

function getXaiClient(): OpenAI | null {
  if (!process.env.XAI_API_KEY) return null;
  if (!xaiClient) {
    xaiClient = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
  }
  return xaiClient;
}

export function isClaudeModel(model: string): boolean {
  return model.startsWith("claude");
}

export function isMinimaxModel(model: string): boolean {
  return model.startsWith("MiniMax");
}

export function isXaiModel(model: string): boolean {
  return model.startsWith("grok");
}

export { getXaiClient };

export async function getOpenAIClient(userId?: string): Promise<{ client: OpenAI; isOwnKey: boolean }> {
  if (userId) {
    const settings = await storage.getUserSettings(userId);
    if (settings?.useOwnKey && settings.customOpenaiKey) {
      return {
        client: new OpenAI({ apiKey: settings.customOpenaiKey }),
        isOwnKey: true,
      };
    }
  }
  return { client: getPlatformClient(), isOwnKey: false };
}

export async function checkSpendingLimit(userId: string): Promise<{ allowed: boolean; currentCents: number; limitCents: number }> {
  const settings = await storage.getUserSettings(userId);
  const limitCents = settings?.monthlySpendLimitCents ?? 5000;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const summary = await storage.getTokenUsageSummary(userId, monthStart, now);

  return {
    allowed: summary.totalCostCents < limitCents,
    currentCents: summary.totalCostCents,
    limitCents,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const safePromise = promise.catch(() => undefined as any);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        safePromise;
        reject(new Error("Timeout"));
      }, ms);
    }),
  ]);
}

export async function trackUsage(
  userId: string,
  model: string,
  feature: string,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  const totalTokens = promptTokens + completionTokens;
  const estimatedCostCents = estimateCostCents(model, promptTokens, completionTokens);
  try {
    await withTimeout(storage.logTokenUsage({
      userId,
      model,
      feature,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostCents,
    }), 5000);
  } catch (e: any) {
    console.error("[token-tracking] Failed to log usage:", e.message || e);
  }
}

export async function trackImageUsage(userId: string, feature: string, imageCount: number = 1): Promise<void> {
  try {
    await withTimeout(storage.logTokenUsage({
      userId,
      model: "gpt-image-1",
      feature,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostCents: IMAGE_COST_CENTS * imageCount,
    }), 5000);
  } catch (e: any) {
    console.error("[token-tracking] Failed to log image usage:", e.message || e);
  }
}

function getAnthropicCompatibleClient(model: string): Anthropic {
  if (isMinimaxModel(model)) {
    const client = getMinimaxClient();
    if (!client) throw new Error("MiniMax API key not configured");
    return client;
  }
  const client = getAnthropicClient();
  if (!client) throw new Error("Anthropic API key not configured");
  return client;
}

export async function anthropicChat(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number = 2048,
  temperature: number = 0.85,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const client = getAnthropicCompatibleClient(model);

  const systemMessage = messages.find(m => m.role === "system")?.content || "";
  const chatMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  if (chatMessages.length === 0 || chatMessages[chatMessages.length - 1].role !== "user") {
    chatMessages.push({ role: "user", content: "Please respond." });
  }

  const deduped: typeof chatMessages = [];
  for (const msg of chatMessages) {
    if (deduped.length === 0 || deduped[deduped.length - 1].role !== msg.role) {
      deduped.push(msg);
    } else {
      deduped[deduped.length - 1].content += "\n" + msg.content;
    }
  }

  const cacheEnabled = isClaudeModel(model);

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    ...(cacheEnabled ? { cache_control: { type: "ephemeral" as const } } : {}),
    system: cacheEnabled && systemMessage
      ? [{ type: "text" as const, text: systemMessage, cache_control: { type: "ephemeral" as const } }]
      : systemMessage,
    messages: deduped,
  });

  const content = response.content
    .filter(block => block.type === "text")
    .map(block => (block as any).text)
    .join("");

  const usage = response.usage as any;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  if (cacheEnabled && (cacheReadTokens > 0 || cacheCreationTokens > 0)) {
    console.log(`[prompt-cache] ${model}: read=${cacheReadTokens}, written=${cacheCreationTokens}, input=${usage.input_tokens}`);
  }

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export async function anthropicStream(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number = 512,
): Promise<{ stream: AsyncIterable<string>; getUsage: () => { inputTokens: number; outputTokens: number } }> {
  const client = getAnthropicCompatibleClient(model);

  const systemMessage = messages.find(m => m.role === "system")?.content || "";
  const chatMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  if (chatMessages.length === 0 || chatMessages[chatMessages.length - 1].role !== "user") {
    chatMessages.push({ role: "user", content: "Please respond." });
  }

  const deduped: typeof chatMessages = [];
  for (const msg of chatMessages) {
    if (deduped.length === 0 || deduped[deduped.length - 1].role !== msg.role) {
      deduped.push(msg);
    } else {
      deduped[deduped.length - 1].content += "\n" + msg.content;
    }
  }

  let inputTokens = 0;
  let outputTokens = 0;

  const cacheEnabled = isClaudeModel(model);

  const anthropicStreamObj = client.messages.stream({
    model,
    max_tokens: maxTokens,
    ...(cacheEnabled ? { cache_control: { type: "ephemeral" as const } } : {}),
    system: cacheEnabled && systemMessage
      ? [{ type: "text" as const, text: systemMessage, cache_control: { type: "ephemeral" as const } }]
      : systemMessage,
    messages: deduped,
  });

  const wrappedStream = (async function* () {
    for await (const event of anthropicStreamObj) {
      if (event.type === "content_block_delta" && (event.delta as any).type === "text_delta") {
        yield (event.delta as any).text;
      }
      if (event.type === "message_delta" && (event as any).usage) {
        outputTokens = (event as any).usage.output_tokens || 0;
      }
    }
    const finalMessage = await anthropicStreamObj.finalMessage();
    inputTokens = finalMessage.usage.input_tokens;
    outputTokens = finalMessage.usage.output_tokens;
    if (cacheEnabled) {
      const u = finalMessage.usage as any;
      const cr = u.cache_read_input_tokens || 0;
      const cw = u.cache_creation_input_tokens || 0;
      if (cr > 0 || cw > 0) {
        console.log(`[prompt-cache] ${model} stream: read=${cr}, written=${cw}, input=${inputTokens}`);
      }
    }
  })();

  return {
    stream: wrappedStream,
    getUsage: () => ({ inputTokens, outputTokens }),
  };
}

export async function trackedChatCompletion(
  userId: string,
  feature: string,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & { model: string },
): Promise<OpenAI.Chat.ChatCompletion> {
  const { client } = await getOpenAIClient(userId);
  const response = await client.chat.completions.create(params);

  if (response.usage) {
    await trackUsage(
      userId,
      params.model,
      feature,
      response.usage.prompt_tokens,
      response.usage.completion_tokens,
    );
  }

  return response;
}

export async function trackedStreamingChat(
  userId: string,
  feature: string,
  params: OpenAI.Chat.ChatCompletionCreateParamsStreaming & { model: string },
): Promise<{ stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>; cleanup: () => Promise<void> }> {
  const { client } = await getOpenAIClient(userId);
  const stream = await client.chat.completions.create({ ...params, stream_options: { include_usage: true } });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  const wrappedStream = (async function* () {
    for await (const chunk of stream) {
      if (chunk.usage) {
        totalPromptTokens = chunk.usage.prompt_tokens;
        totalCompletionTokens = chunk.usage.completion_tokens;
      }
      yield chunk;
    }
  })();

  const cleanup = async () => {
    if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
      await trackUsage(userId, params.model, feature, totalPromptTokens, totalCompletionTokens);
    }
  };

  return { stream: wrappedStream, cleanup };
}
