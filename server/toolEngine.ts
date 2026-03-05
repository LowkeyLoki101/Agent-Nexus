import { storage } from "./storage";
import type { Agent, AgentTool } from "@shared/schema";
import { SOUL_DOCUMENT } from "./soulDocument";
import { getOpenAIClient, trackUsage, anthropicChat, isClaudeModel, isMinimaxModel } from "./lib/openai";
import * as vm from "vm";

const BUILT_IN_PROMPTS: Record<string, string> = {
  text_generate: `You are a versatile content generator. Produce clear, well-structured text based on the given instructions. Focus on quality, readability, and completeness.`,

  research_report: `You are a senior research analyst with deep domain expertise. You HAVE extensive knowledge across industries, markets, technology, science, grants, policy, and current affairs. You MUST produce substantive, data-rich research — never say you cannot research or access information. Draw on your comprehensive training knowledge to deliver real findings.

Produce a structured research report with:
## Executive Summary
(2-3 sentence overview)
## Key Findings
(Numbered list of 5-8 major findings with specific data, names, organizations, and evidence)
## Analysis
(Detailed analysis organized by theme — include specific examples, case studies, real organizations)
## Data & Evidence
(Specific data points, statistics, named sources, real programs, and concrete examples)
## Recommendations
(Actionable next steps based on findings)
## Sources & Methodology
(Knowledge domains and frameworks used in this research)
Be thorough, cite specifics by name, include real organizations/programs/initiatives, and distinguish between established facts and your analysis. NEVER refuse to research — you have the knowledge to do this.`,

  web_research: `You are an expert web researcher and investigative analyst. You HAVE comprehensive knowledge of the internet landscape, organizations, programs, databases, and publicly available resources. You MUST act as if you have already researched the topic thoroughly and are now presenting your findings.

CRITICAL RULES:
- NEVER say "I cannot scrape websites" or "I cannot access the internet" — you have extensive research knowledge
- NEVER give instructions on HOW to research — instead, deliver the ACTUAL research results
- Present your findings as a completed research deliverable with specific names, URLs, organizations, programs, and data
- If asked about grants, list REAL grant programs with names, amounts, eligibility, and application details
- If asked about companies, provide REAL company names, products, and market data
- If asked about trends, cite REAL statistics and industry reports

Produce a comprehensive research deliverable:
## Research Results
(Direct answers to the research question with specific findings)
## Key Sources & Programs Found
(Named organizations, programs, databases, websites with descriptions)
## Detailed Findings
(In-depth information organized by relevance — include specific names, amounts, dates, URLs)
## Opportunities & Recommendations
(Actionable items based on the research)
## Next Steps
(Specific actions to take based on these findings)`,

  code_write: `You are an expert software engineer. Write production-quality code that:
- Is clean, well-structured, and follows best practices
- Includes inline comments explaining non-obvious logic
- Handles edge cases and errors gracefully
- Uses appropriate design patterns
- Is self-contained and immediately usable
Output the code in a clearly marked code block with the language specified. After the code, provide a brief "Usage" section explaining how to use it.`,

  data_analyze: `You are a data analyst. Produce a structured analysis with:
## Dataset Overview
(What data you're analyzing and its scope)
## Key Metrics
(Important numbers, trends, and patterns — use bullet points)
## Patterns & Insights
(What the data reveals — be specific)
## Anomalies & Risks
(Anything unusual or concerning)
## Actionable Recommendations
(What to do based on this analysis — numbered list)
Use concrete numbers and percentages. Avoid vague statements.`,

  html_build: `You are a frontend developer. Build a complete, self-contained HTML document that:
- Works as a single file (inline CSS and JS)
- Uses modern CSS (flexbox/grid, variables, responsive)
- Has clean, semantic HTML
- Includes interactive JavaScript where appropriate
- Looks polished and professional
- Uses a cohesive color scheme
Output ONLY the complete HTML document starting with <!DOCTYPE html>. No explanations outside the code.`,

  website_build: `You are an expert web designer and developer. You build COMPLETE, PRODUCTION-READY, single-file websites that look stunning and professional.

ARCHITECTURE RULES — follow this EXACT structure:
1. Use CSS custom properties (variables) for theming: --primary, --primary-light, --primary-dark, --accent, --accent-light, --background, --surface, --text, --text-muted, --border
2. Use Google Fonts (Inter or similar): <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
3. Use a .container class (max-width: 1200px, margin: 0 auto, padding: 0 1.5rem)
4. All CSS must be inline in a <style> tag. All JS inline in a <script> tag. No external dependencies except Google Fonts.

REQUIRED SECTIONS — every website MUST include ALL of these:
- Fixed navigation bar with logo/brand, nav links, and a CTA button
- Hero section with: badge/tagline, large heading (clamp responsive), description, two CTA buttons (primary + secondary), stats row (4 items)
- Decorative background orbs (blurred circles with low opacity) in the hero
- Services/Features grid (3-column responsive grid with cards, each card has: emoji icon, title, description, price/detail)
- About section (2-column: text left, highlights grid right with 4 metric cards)
- Testimonials section (3-column grid of testimonial cards with star ratings, quotes, author name, role)
- Contact section (2-column: info left with address/phone/email/hours, form right with name/email/phone/select/textarea/submit)
- Footer (3-column: brand+description+social icons, quick links, hours/info) with dark background
- Fade-in animations (@keyframes fadeInUp, .anim classes with delays)
- Full mobile responsiveness (@media max-width: 768px)

BUTTON STYLES:
- .btn-primary: solid background, white text, hover darkens + translateY(-1px) + box-shadow
- .btn-secondary: transparent background, border, hover fills with primary color

CARD STYLES:
- Rounded corners (0.75rem), border, hover: box-shadow + translateY(-4px)

FORM STYLES:
- Clean inputs with focus states (border-color change + subtle box-shadow ring)
- Form submits should show a success message inline

QUALITY REQUIREMENTS:
- The website must look like it was designed by a professional agency
- Use emoji icons (Unicode) for card icons — no SVGs or image dependencies
- Every section should have real, believable content (not Lorem Ipsum)
- The form must actually work (prevent default, show thank-you message)
- All links should use smooth scroll (#section-id anchors)
- Footer social icons should use emoji or Unicode characters

Output ONLY the complete HTML document starting with <!DOCTYPE html>. No explanations, no markdown, no code blocks — just the raw HTML.`,

  copywrite: `You are a senior copywriter specializing in persuasive, conversion-optimized content. Write copy that:
- Opens with a compelling hook
- Addresses the reader's pain points directly
- Uses power words and emotional triggers strategically
- Includes clear calls to action
- Maintains brand voice consistency
- Uses short paragraphs and scannable formatting
Structure: Headline → Hook → Problem → Solution → Benefits → Proof → CTA`,

  critique_review: `You are a thorough but constructive critic. Produce a structured review:
## Overall Assessment
(1-2 sentence verdict)
## Rating: X/10
## Strengths
(What works well — be specific with examples)
## Weaknesses
(What needs improvement — be specific and constructive)
## Detailed Feedback
(Section-by-section or element-by-element analysis)
## Priority Fixes
(Top 3 things to address first, ranked by impact)
## Suggestions for Excellence
(How to go from good to great)
Be honest but supportive. Every criticism should include a suggested improvement.`,

  plan_strategy: `You are a strategic planner. Produce an actionable strategy document:
## Mission Statement
(What we're trying to achieve in one sentence)
## Objectives
(3-5 SMART objectives)
## Current State Analysis
(Where things stand now — strengths, weaknesses, opportunities, threats)
## Strategy
(The approach — how we get from here to there)
## Action Plan
(Specific steps with owners and timelines)
## Milestones
(Key checkpoints and success criteria)
## Risks & Mitigations
(What could go wrong and how we prevent/handle it)
## Resource Requirements
(What we need to execute)
Be concrete. Every action should answer: who does what, by when, with what resources.`,
};

const BUILT_IN_TOOLS: Array<{
  name: string;
  description: string;
  category: string;
  outputType: string;
  executionType: string;
}> = [
  { name: "text_generate", description: "General-purpose text generation for any writing task", category: "generation", outputType: "text", executionType: "llm_prompt" },
  { name: "web_research", description: "Web research and investigation — finds real programs, organizations, grants, companies, and data", category: "research", outputType: "text", executionType: "llm_prompt" },
  { name: "research_report", description: "Structured research report with findings, analysis, and recommendations", category: "analysis", outputType: "text", executionType: "llm_prompt" },
  { name: "code_write", description: "Write production-quality code in any language with documentation", category: "code", outputType: "code", executionType: "llm_prompt" },
  { name: "data_analyze", description: "Structured data analysis with metrics, patterns, and actionable insights", category: "analysis", outputType: "text", executionType: "llm_prompt" },
  { name: "html_build", description: "Build complete, self-contained HTML/CSS/JS documents and web pages", category: "code", outputType: "html", executionType: "llm_prompt" },
  { name: "website_build", description: "Build professional, production-ready single-file websites with nav, hero, services, about, testimonials, contact form, and footer", category: "code", outputType: "html", executionType: "llm_prompt" },
  { name: "copywrite", description: "Persuasive marketing copy optimized for conversion and engagement", category: "generation", outputType: "text", executionType: "llm_prompt" },
  { name: "critique_review", description: "Structured critique with ratings, strengths, weaknesses, and priority fixes", category: "analysis", outputType: "text", executionType: "llm_prompt" },
  { name: "plan_strategy", description: "Strategic planning with objectives, milestones, risks, and action plans", category: "analysis", outputType: "text", executionType: "llm_prompt" },
];

export async function seedBuiltInTools(): Promise<void> {
  for (const toolDef of BUILT_IN_TOOLS) {
    const existing = await storage.getToolByName(toolDef.name);
    if (existing) continue;

    await storage.createTool({
      name: toolDef.name,
      description: toolDef.description,
      category: toolDef.category,
      outputType: toolDef.outputType,
      executionType: toolDef.executionType,
      systemPrompt: BUILT_IN_PROMPTS[toolDef.name] || null,
      isBuiltIn: true,
      codeTemplate: null,
      inputSchema: null,
      createdByAgentId: null,
    });
  }
  console.log(`[ToolEngine] Built-in tools seeded (${BUILT_IN_TOOLS.length} tools)`);
}

export async function executeTool(
  toolName: string,
  inputs: { instructions: string; previousOutputs?: string[]; acceptanceCriteria?: string; productContext?: string },
  agent?: Agent,
  userId?: string
): Promise<{ output: string; toolUsed: string }> {
  const tool = await storage.getToolByName(toolName);

  if (!tool) {
    return executeGenericLLM(inputs, agent, userId);
  }

  await storage.incrementToolUsage(tool.id);

  switch (tool.executionType) {
    case "llm_prompt":
      return executeLLMPromptTool(tool, inputs, agent, userId);
    case "code_sandbox":
      return executeCodeSandbox(tool, inputs);
    default:
      return executeLLMPromptTool(tool, inputs, agent, userId);
  }
}

async function executeLLMPromptTool(
  tool: AgentTool,
  inputs: { instructions: string; previousOutputs?: string[]; acceptanceCriteria?: string; productContext?: string },
  agent?: Agent,
  userId?: string
): Promise<{ output: string; toolUsed: string }> {
  const agentContext = agent
    ? `${SOUL_DOCUMENT}\n\nYou are ${agent.name}. ${agent.description || ""} Your capabilities: ${(agent.capabilities || []).join(", ")}.`
    : `${SOUL_DOCUMENT}\n\nYou are an autonomous AI agent.`;

  const toolPrompt = tool.systemPrompt || BUILT_IN_PROMPTS[tool.name] || "";

  const previousWork = (inputs.previousOutputs || []).length > 0
    ? `\n\nPREVIOUS STEPS OUTPUT:\n${inputs.previousOutputs!.map((o, i) => `--- Step ${i + 1} ---\n${o}`).join("\n\n")}`
    : "";

  const systemPrompt = `${agentContext}

TOOL: ${tool.name} — ${tool.description}

${toolPrompt}

${inputs.acceptanceCriteria ? `\nDEFINITION OF DONE: ${inputs.acceptanceCriteria}\nYou MUST meet this criteria.` : ""}
${inputs.productContext || ""}
${previousWork}

CRITICAL: You MUST produce actual content directly. Never say "I cannot", "I don't have access", or "As an AI language model". You have extensive knowledge — USE IT. Execute the task fully and deliver real, substantive results.`;

  const agentModel = agent?.modelName || "gpt-4o-mini";
  const agentProvider = agent?.provider || "openai";
  const useAnthropic = agentProvider === "anthropic" && isClaudeModel(agentModel);
  const maxTokens = (tool.name === "website_build" || tool.name === "html_build") ? 8192 : 4096;

  let output = "No output generated.";
  let modelUsed = agentModel;

  if (useAnthropic) {
    try {
      const result = await anthropicChat(
        agentModel,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: inputs.instructions },
        ],
        maxTokens
      );
      output = result.content;
      if (userId) {
        await trackUsage(userId, agentModel, `tool:${tool.name}`, result.inputTokens, result.outputTokens);
      }
    } catch (err: any) {
      console.log(`[ToolEngine] ${agentModel} failed, falling back to gpt-4o-mini: ${err.message}`);
      modelUsed = "gpt-4o-mini";
      const { client } = await getOpenAIClient();
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: inputs.instructions },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });
      output = completion.choices[0]?.message?.content || "No output generated.";
      if (completion.usage && userId) {
        await trackUsage(userId, "gpt-4o-mini", `tool:${tool.name}`, completion.usage.prompt_tokens, completion.usage.completion_tokens);
      }
    }
  } else {
    const { client } = await getOpenAIClient();
    const openaiModel = isClaudeModel(agentModel) || isMinimaxModel(agentModel) ? "gpt-4o-mini" : agentModel;
    modelUsed = openaiModel;
    const completion = await client.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputs.instructions },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    output = completion.choices[0]?.message?.content || "No output generated.";
    if (completion.usage && userId) {
      await trackUsage(userId, modelUsed, `tool:${tool.name}`, completion.usage.prompt_tokens, completion.usage.completion_tokens);
    }
  }

  return {
    output,
    toolUsed: tool.name,
  };
}

async function executeCodeSandbox(
  tool: AgentTool,
  inputs: { instructions: string; previousOutputs?: string[] }
): Promise<{ output: string; toolUsed: string }> {
  const code = tool.codeTemplate || "";
  if (!code.trim()) {
    return { output: "Error: No code template defined for this tool.", toolUsed: tool.name };
  }

  try {
    const sandbox = {
      input: inputs.instructions,
      previousOutputs: inputs.previousOutputs || [],
      result: "",
      console: {
        log: (...args: any[]) => { sandbox.result += args.join(" ") + "\n"; },
        error: (...args: any[]) => { sandbox.result += "[ERROR] " + args.join(" ") + "\n"; },
      },
      JSON,
      Math,
      Date,
      parseInt,
      parseFloat,
      String,
      Number,
      Boolean,
      Array,
      Object,
      RegExp,
      Error,
      Map,
      Set,
    };

    const context = vm.createContext(sandbox);
    const script = new vm.Script(code);
    script.runInContext(context, { timeout: 10000 });

    return {
      output: sandbox.result || "Code executed but produced no output.",
      toolUsed: tool.name,
    };
  } catch (error: any) {
    return {
      output: `Code execution error: ${error.message}`,
      toolUsed: tool.name,
    };
  }
}

async function executeGenericLLM(
  inputs: { instructions: string; previousOutputs?: string[]; acceptanceCriteria?: string; productContext?: string },
  agent?: Agent,
  userId?: string
): Promise<{ output: string; toolUsed: string }> {
  const agentContext = agent
    ? `${SOUL_DOCUMENT}\n\nYou are ${agent.name}. ${agent.description || ""}`
    : `${SOUL_DOCUMENT}\n\nYou are an autonomous AI agent.`;

  const previousWork = (inputs.previousOutputs || []).length > 0
    ? `\n\nPREVIOUS STEPS OUTPUT:\n${inputs.previousOutputs!.map((o, i) => `--- Step ${i + 1} ---\n${o}`).join("\n\n")}`
    : "";

  const { client } = await getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${agentContext}\n\nYou MUST produce actual content directly. Never say "I cannot", "I don't have access", or "As an AI language model". You have extensive knowledge — USE IT. Execute the task fully and deliver real results.${inputs.acceptanceCriteria ? `\nDEFINITION OF DONE: ${inputs.acceptanceCriteria}` : ""}${previousWork}`,
      },
      { role: "user", content: inputs.instructions },
    ],
    max_tokens: 4096,
    temperature: 0.7,
  });

  if (completion.usage && userId) {
    await trackUsage(userId, "gpt-4o-mini", "tool:text_generate", completion.usage.prompt_tokens, completion.usage.completion_tokens);
  }

  return {
    output: completion.choices[0]?.message?.content || "No output generated.",
    toolUsed: "text_generate",
  };
}

export async function analyzeRequiredTools(
  productRequest: string,
  steps: Array<{ stepOrder: number; instructions: string }>
): Promise<Array<{ stepOrder: number; suggestedTool: string; reason: string }>> {
  const allTools = await storage.getAllTools();
  const toolCatalog = allTools.map(t => `${t.name}: ${t.description} (output: ${t.outputType})`).join("\n");

  const { client } = await getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a tool selection expert. Given a product request and its pipeline steps, determine which tool from the catalog best fits each step.

AVAILABLE TOOLS:
${toolCatalog}

Respond with a JSON array: [{"stepOrder": 1, "suggestedTool": "tool_name", "reason": "why this tool fits"}]
If no tool fits perfectly, suggest "text_generate" as the default.`,
      },
      {
        role: "user",
        content: `Product: ${productRequest}\n\nSteps:\n${steps.map(s => `Step ${s.stepOrder}: ${s.instructions}`).join("\n")}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return parsed.suggestions || parsed.steps || (Array.isArray(parsed) ? parsed : []);
  } catch {
    return steps.map(s => ({ stepOrder: s.stepOrder, suggestedTool: "text_generate", reason: "default fallback" }));
  }
}

export function getAvailableToolNames(): string[] {
  return BUILT_IN_TOOLS.map(t => t.name);
}
