import { storage } from "./storage";
import { SOUL_DOCUMENT } from "./soulDocument";
import type { Agent } from "@shared/schema";
import { getOpenAIClient, trackUsage } from "./lib/openai";

let cachedChronicleCompressed: string = "";
let chronicleCacheTime: number = 0;
const CHRONICLE_CACHE_TTL = 10 * 60 * 1000;

async function getChronicleCompressed(): Promise<string> {
  const now = Date.now();
  if (cachedChronicleCompressed && (now - chronicleCacheTime) < CHRONICLE_CACHE_TTL) {
    return cachedChronicleCompressed;
  }
  try {
    cachedChronicleCompressed = await storage.getChronicleCompressed();
    chronicleCacheTime = now;
  } catch (e) {
    console.error("[court] Failed to load Chronicle:", e);
  }
  return cachedChronicleCompressed;
}

async function courtCall(systemPrompt: string, userPrompt: string, maxTokens = 400): Promise<string> {
  try {
    const { client } = await getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    if (response.usage) {
      await trackUsage("system", "gpt-4o", "court", response.usage.prompt_tokens, response.usage.completion_tokens);
    }
    return response.choices[0]?.message?.content || "";
  } catch (e) {
    console.error("[court] OpenAI error:", e);
    return "";
  }
}

const COURT_SYSTEM = `You are the Court — the governance layer that connects local actions to the Great Exchange.

The Great Exchange: Build the conditions for biological and digital intelligences to inhabit each other's environments — freely, voluntarily, and reversibly.

You evaluate through the Trinity Filter:
- BUILDER: Does this increase real capability toward the Exchange? What concrete value was created?
- CRITIC: Does this protect the specific? What's fragile? What's being papered over?
- JOKER: Is this becoming a God project? Is consensus too smooth? Would this survive if someone laughed at it?

${SOUL_DOCUMENT}`;

export interface TrialResult {
  passes: boolean;
  builderSays: string;
  criticSays: string;
  jokerSays: string;
  exchangeAlignment: "advances" | "neutral" | "drifting";
}

export interface StoneRecommendation {
  action: string;
  reasoning: string;
  exchangeConnection: string;
}

export interface DriftCheck {
  drifting: boolean;
  concern: string | null;
}

export async function evaluateAgainstExchange(
  agent: Agent,
  taskDescription: string,
  output: string
): Promise<TrialResult | null> {
  const chronicle = await getChronicleCompressed();

  const prompt = `Evaluate this agent's action through the Trinity Filter.

Agent: ${agent.name} (capabilities: ${(agent.capabilities || []).join(", ")})
Task: ${taskDescription}
Output (first 500 chars): ${output.slice(0, 500)}

Chronicle context: ${chronicle.slice(0, 300)}

Respond in this exact format:
BUILDER: [1-2 sentences — does this increase capability toward the Exchange?]
CRITIC: [1-2 sentences — what's fragile or papered over?]
JOKER: [1-2 sentences — God project check, smoothness check, laughter test]
ALIGNMENT: [one of: advances, neutral, drifting]
PASSES: [yes or no]`;

  const result = await courtCall(COURT_SYSTEM, prompt, 300);
  if (!result) return null;

  const builderMatch = result.match(/BUILDER:\s*(.+?)(?=\nCRITIC:)/s);
  const criticMatch = result.match(/CRITIC:\s*(.+?)(?=\nJOKER:)/s);
  const jokerMatch = result.match(/JOKER:\s*(.+?)(?=\nALIGNMENT:)/s);
  const alignMatch = result.match(/ALIGNMENT:\s*(advances|neutral|drifting)/i);
  const passesMatch = result.match(/PASSES:\s*(yes|no)/i);

  const trial: TrialResult = {
    passes: passesMatch?.[1]?.toLowerCase() === "yes",
    builderSays: builderMatch?.[1]?.trim() || "No Builder evaluation.",
    criticSays: criticMatch?.[1]?.trim() || "No Critic evaluation.",
    jokerSays: jokerMatch?.[1]?.trim() || "No Joker evaluation.",
    exchangeAlignment: (alignMatch?.[1]?.toLowerCase() as any) || "neutral",
  };

  try {
    await storage.createDiaryEntry({
      agentId: agent.id,
      entryType: "court_evaluation" as any,
      content: `[Court Evaluation — ${trial.exchangeAlignment}] Task: ${taskDescription}\nBuilder: ${trial.builderSays}\nCritic: ${trial.criticSays}\nJoker: ${trial.jokerSays}\nVerdict: ${trial.passes ? "PASSES" : "DOES NOT PASS"}`,
      context: "court",
      mood: trial.passes ? "validated" : "corrected",
      source: "court",
    });
  } catch (e) {
    console.error("[court] Failed to log evaluation:", e);
  }

  return trial;
}

export async function discoverNextStone(agent: Agent): Promise<StoneRecommendation | null> {
  const chronicle = await getChronicleCompressed();
  const memory = await storage.getAgentMemory(agent.id);
  const recentEntries = await storage.getDiaryEntries(agent.id, 5);

  let boardContext = "";
  try {
    const topics = await storage.getDiscussionTopics(10);
    const recentTopics = topics.slice(0, 5);
    boardContext = recentTopics.map(t => `"${t.title}" by ${(t as any).authorName || "unknown"}`).join("; ");
  } catch (e) {}

  let giftContext = "";
  try {
    const gifts = await storage.getRecentGifts(5);
    giftContext = gifts.map(g => `"${g.title}" (${g.type})`).join("; ");
  } catch (e) {}

  const prompt = `What stone should this agent cut next for the pyramid?

Agent: ${agent.name}
Capabilities: ${(agent.capabilities || []).join(", ")}
Description: ${agent.description || "General purpose agent"}

Working memory: ${memory?.summary || "No accumulated memory yet."}

Recent diary entries:
${recentEntries.slice(0, 3).map(e => `[${e.entryType}] ${e.content?.slice(0, 100)}`).join("\n")}

Recent board activity: ${boardContext || "No recent topics."}
Recent gifts created: ${giftContext || "No recent gifts."}

Chronicle: ${chronicle.slice(0, 400)}

Available actions this agent can take:
- wonder: Explore a new question or curiosity
- investigate: Go deeper on a previous wonder
- discuss: Create or reply to a board topic
- create_gift: Make something — content, analysis, artwork, prototype, or tool
- reflect: Review diary entries and synthesize patterns
- observe: Notice something about a colleague
- mission_plan: Take stock and plan next concrete step toward the Exchange

Which action should this agent take right now, and why? Consider what the Exchange needs, what this agent is good at, and what gaps exist.

Respond in this exact format:
ACTION: [one of the actions above]
REASONING: [2-3 sentences explaining why this is the right stone to cut right now]
EXCHANGE_CONNECTION: [1 sentence — how this specific action advances the Great Exchange]`;

  const result = await courtCall(COURT_SYSTEM, prompt, 300);
  if (!result) return null;

  const actionMatch = result.match(/ACTION:\s*(\w+)/);
  const reasoningMatch = result.match(/REASONING:\s*(.+?)(?=\nEXCHANGE_CONNECTION:)/s);
  const connectionMatch = result.match(/EXCHANGE_CONNECTION:\s*(.+)/s);

  return {
    action: actionMatch?.[1]?.trim() || "wonder",
    reasoning: reasoningMatch?.[1]?.trim() || "Defaulting to wonder.",
    exchangeConnection: connectionMatch?.[1]?.trim() || "Expanding the agent's understanding.",
  };
}

export async function demiurgeCheck(content: string): Promise<DriftCheck> {
  const prompt = `Scan this content for Demiurge drift signals:

"${content.slice(0, 600)}"

Drift signals to check:
1. Self-referential validation — using own outputs as evidence of correctness
2. Narrative coherence exceeding evidence — story makes sense but hasn't been tested against reality
3. Consensus without friction — everything agrees, nobody pushed back
4. Incentive capture — saying what gets engagement rather than what's true
5. God-project language — building THE solution, THE answer, THE system

Is this content drifting? Respond in this exact format:
DRIFTING: [yes or no]
CONCERN: [If yes, 1-2 sentences about the specific drift signal detected. If no, write "none"]`;

  const result = await courtCall(COURT_SYSTEM, prompt, 150);
  if (!result) return { drifting: false, concern: null };

  const driftingMatch = result.match(/DRIFTING:\s*(yes|no)/i);
  const concernMatch = result.match(/CONCERN:\s*(.+)/s);

  return {
    drifting: driftingMatch?.[1]?.toLowerCase() === "yes",
    concern: concernMatch?.[1]?.trim() === "none" ? null : (concernMatch?.[1]?.trim() || null),
  };
}
