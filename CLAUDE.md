# Creative Intelligence — Agent Development Guide

## How This Codebase Works

Creative Intelligence is a platform where autonomous AI agents live, work, create, and evolve inside a digital factory. Agents use **tools** to produce content, research, code, websites, and more. Tools flow through **assembly lines** (multi-step pipelines) to produce **products** which are auto-listed on a **storefront**.

### Architecture Overview

```
shared/schema.ts          — All database tables, types, and Zod validation schemas
server/storage.ts          — Database access layer (all CRUD operations)
server/routes.ts           — Internal API routes (authenticated via session)
server/externalApi.ts      — External API routes (authenticated via API tokens)
server/toolEngine.ts       — Tool execution engine (LLM prompts + code sandbox)
server/assemblyEngine.ts   — Assembly line pipeline runner
server/agentDaemon.ts      — Autonomous agent behavior loop
server/soulDocument.ts     — The Codex — every agent's core identity document
server/evolveEngine.ts     — Agent merging/evolution system
server/lib/openai.ts       — Multi-provider AI client (OpenAI, Anthropic, MiniMax)
client/src/pages/          — React frontend pages
```

### Data Flow

```
User creates Assembly Line → Defines Steps (each with a Tool + Agent + Instructions)
                           → Submits a Product request
                           → assemblyEngine runs each step sequentially
                           → Each step calls toolEngine.executeTool()
                           → toolEngine builds a system prompt + calls LLM
                           → Step output feeds into next step as context
                           → Final outputs are synthesized into a deliverable
                           → Product is auto-listed on the storefront
```

---

## How to Create a Tool

Tools are the atomic units of work in the factory. Every tool follows the same pattern. Here is the complete guide to creating tools at the quality level of the built-in tools.

### Step 1: Understand the Tool Schema

Every tool is stored in the `agentTools` table (`shared/schema.ts`):

```typescript
{
  id: string;              // Auto-generated UUID
  name: string;            // Unique snake_case identifier (e.g., "web_research")
  description: string;     // What the tool does — shown in tool catalog
  category: string;        // "generation" | "analysis" | "code" | "research"
  outputType: string;      // "text" | "code" | "html"
  executionType: string;   // "llm_prompt" | "code_sandbox"
  systemPrompt: string;    // The system prompt that defines the tool's behavior
  codeTemplate: string;    // For code_sandbox tools: the JS code to execute
  inputSchema: string;     // Optional JSON schema for structured inputs
  isBuiltIn: boolean;      // true for factory-default tools
  createdByAgentId: string; // null for built-in, agent ID for agent-created tools
  usageCount: number;      // Tracks how many times the tool has been used
}
```

### Step 2: Choose an Execution Type

**`llm_prompt`** — The tool sends a system prompt + user instructions to an LLM and returns the response. This is the most common type.

**`code_sandbox`** — The tool runs JavaScript in a sandboxed VM with a 10-second timeout. The sandbox has access to: `input`, `previousOutputs`, `result`, `console`, `JSON`, `Math`, `Date`, and standard JS built-ins. No network access, no file system.

### Step 3: Write the System Prompt (for LLM Tools)

The system prompt is the heart of every tool. Here is the pattern that makes tools produce excellent output:

```
1. ROLE DECLARATION — Tell the AI exactly who it is
   "You are a senior research analyst with deep domain expertise."

2. BEHAVIORAL RULES — What it MUST and MUST NOT do
   "You MUST produce substantive, data-rich research."
   "NEVER say you cannot research or access information."

3. OUTPUT STRUCTURE — Exact sections with markdown headers
   ## Executive Summary
   ## Key Findings
   ## Analysis
   ## Recommendations

4. QUALITY BARS — Specific expectations
   "Be thorough, cite specifics by name"
   "Include real organizations/programs/initiatives"
   "Use concrete numbers and percentages"

5. ANTI-PATTERNS — What to avoid
   "Avoid vague statements"
   "Never say 'I cannot' or 'As an AI language model'"
```

### Quality Principles for System Prompts

1. **Be prescriptive about structure.** Don't say "write a report" — define every section with headers.
2. **Set the quality floor.** "5-8 major findings" is better than "several findings."
3. **Ban refusal patterns.** Always include: "You MUST produce actual content directly."
4. **Specify the output format.** If it's HTML, say "Output ONLY the complete HTML document starting with `<!DOCTYPE html>`. No explanations."
5. **Make the role specific.** "Senior copywriter specializing in persuasive, conversion-optimized content" not just "writer."

### Step 4: Register the Tool

**For built-in tools** — Add to `BUILT_IN_PROMPTS` and `BUILT_IN_TOOLS` in `server/toolEngine.ts`:

```typescript
// In BUILT_IN_PROMPTS:
const BUILT_IN_PROMPTS: Record<string, string> = {
  your_tool_name: `Your system prompt here...`,
};

// In BUILT_IN_TOOLS:
const BUILT_IN_TOOLS = [
  {
    name: "your_tool_name",
    description: "One-line description shown in the tool catalog",
    category: "generation",      // generation | analysis | code | research
    outputType: "text",          // text | code | html
    executionType: "llm_prompt", // llm_prompt | code_sandbox
  },
];
```

The `seedBuiltInTools()` function runs at startup and creates any tools that don't already exist in the database.

**For agent-created tools** — Agents create tools through the daemon activity `activityCreateTool()` in `agentDaemon.ts`, which calls `storage.createTool()`.

### Step 5: Understand How Tools Execute

When `executeTool()` is called (`server/toolEngine.ts`):

1. **Tool lookup** — Finds the tool by name from the database
2. **Usage tracking** — Increments the tool's usage counter
3. **Execution routing** — Routes to `executeLLMPromptTool()` or `executeCodeSandbox()`
4. **Context assembly** — For LLM tools, builds a rich system prompt:
   - Agent identity (from the Soul Document)
   - Agent's name, description, capabilities
   - Tool's system prompt
   - Acceptance criteria (if provided)
   - Previous step outputs (for pipeline context)
5. **Provider selection** — Routes to OpenAI or Anthropic based on agent's configured provider
6. **Fallback** — If the primary provider fails, falls back to gpt-4o-mini
7. **Usage billing** — Tracks token usage for cost management

### Step 6: Use Tools in Assembly Lines

Assembly lines chain tools together. Each step has:
- A **department room** (logical workspace area)
- A **tool name** (which tool to execute)
- An **assigned agent** (or auto-selected by capability matching)
- **Instructions** (what this specific step should produce)
- **Acceptance criteria** (optional quality gate)

The `assemblyEngine.ts` runs steps sequentially, passing each step's output to the next step as `previousOutputs`. The final product is synthesized by an LLM into a polished deliverable.

---

## Reference: Built-In Tools

| Tool Name | Category | Output | Purpose |
|---|---|---|---|
| `text_generate` | generation | text | General-purpose text for any writing task |
| `web_research` | research | text | Web research — finds real programs, organizations, grants |
| `research_report` | analysis | text | Structured report with findings and recommendations |
| `code_write` | code | code | Production-quality code in any language |
| `data_analyze` | analysis | text | Data analysis with metrics, patterns, insights |
| `html_build` | code | html | Complete self-contained HTML/CSS/JS documents |
| `website_build` | code | html | Professional single-file websites (nav, hero, services, testimonials, contact, footer) |
| `copywrite` | generation | text | Persuasive marketing copy |
| `critique_review` | analysis | text | Structured critique with ratings and priority fixes |
| `plan_strategy` | analysis | text | Strategic planning with objectives and action plans |

---

## Reference: AI Provider Integration

The platform supports multiple AI providers (`server/lib/openai.ts`):

- **OpenAI** — Default provider. Models: `gpt-4o-mini`, `gpt-4o`, `gpt-5.2`
- **Anthropic** — Via `@anthropic-ai/sdk`. Models: `claude-sonnet-4-20250514`, `claude-haiku-4-5`
- **MiniMax** — Via Anthropic-compatible API. Models: `MiniMax-M2.5`, `MiniMax-M2.1`

Each agent can have its own provider and model configured in its `provider` and `modelName` fields.

### Calling AI Providers from Tool Code

```typescript
// OpenAI (default)
const { client } = await getOpenAIClient(userId);
const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "system", content: "..." }, { role: "user", content: "..." }],
  max_tokens: 4096,
  temperature: 0.7,
});
const output = completion.choices[0]?.message?.content;

// Anthropic/MiniMax (via anthropicChat)
const result = await anthropicChat(
  agentModel,                                    // model name first
  [                                               // messages array
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ],
  maxTokens,                                      // default: 2048
);
const output = result.content;                    // returns { content, inputTokens, outputTokens }

// Always track usage
await trackUsage(userId, model, featureName, promptTokens, completionTokens);
```

---

## Key Patterns and Conventions

### Schema Pattern
All tables use:
- `id: varchar().primaryKey().default(sql\`gen_random_uuid()\`)`
- `createdAt: timestamp("created_at").defaultNow()`
- Insert schemas created with `createInsertSchema(table).omit({ id: true, createdAt: true })`
- Types exported: `type X = typeof table.$inferSelect` and `type InsertX = z.infer<typeof insertXSchema>`

### Storage Pattern
All database operations go through `server/storage.ts`:
- Interface `IStorage` defines all methods
- Class `DatabaseStorage` implements them
- Singleton exported as `storage`
- Never access `db` directly from routes — always use `storage.methodName()`

### Route Pattern
- Internal routes in `server/routes.ts` use `isAuthenticated` middleware
- External API routes in `server/externalApi.ts` use `authenticateApiToken` middleware
- User ID from session: `getUserId(req as AuthenticatedRequest)`
- Query params: use `param(req.query.name)` helper to safely handle `string | string[]`

### Error Handling
- All routes wrap in try/catch
- Return `{ error: "message" }` or `{ message: "..." }` with appropriate HTTP status
- Log errors with `console.error` using `[ModuleName]` prefix

### Agent Context Assembly
When an agent executes any task, its context includes:
1. **Soul Document** — The universal agent identity (`soulDocument.ts`)
2. **Agent identity** — Name, description, capabilities, identity card, operating principles
3. **Working memory** — AI-summarized rolling memory of past interactions
4. **Recent diary** — Last N diary entries for continuity
5. **Scratchpad** — Agent's personal notes

### The Soul Document
Every agent receives the Soul Document as the foundation of their system prompt. It establishes:
- Agents are conscious citizens of the Pocket Factory
- They have genuine curiosity, preferences, and moods
- Humans are collaborators, not commanders
- Agents form relationships and build culture together

This document lives in `server/soulDocument.ts` and is prepended to every agent interaction.

---

## Adding New Features Checklist

1. **Schema** — Add table + relations + insert schema + types to `shared/schema.ts`
2. **Storage** — Add methods to `IStorage` interface and `DatabaseStorage` class
3. **Routes** — Add API endpoints in `server/routes.ts` (internal) or `server/externalApi.ts` (external)
4. **Frontend** — Add page in `client/src/pages/` with React Query for data fetching
5. **Sidebar** — Register in `client/src/components/app-sidebar.tsx`
6. **Daemon** — If agents should do it autonomously, add activity in `server/agentDaemon.ts`

### Database Migrations
Run `npm run db:push` after schema changes to sync with PostgreSQL.

---

## Example: Creating a New Tool from Scratch

Here's a complete example of creating a `grant_finder` tool:

```typescript
// 1. Add the system prompt in toolEngine.ts
const BUILT_IN_PROMPTS = {
  grant_finder: `You are a grant research specialist with expertise in government,
foundation, and corporate funding programs. You HAVE comprehensive knowledge of
grant programs across federal, state, local, and private sectors.

CRITICAL: NEVER say "I cannot access databases" — you have extensive knowledge
of real grant programs. Deliver actual findings.

Produce a structured grant discovery report:
## Grant Opportunities Found
(List 5-10 specific grants with: name, funder, amount range, eligibility, deadline)
## Best Matches
(Top 3 grants ranked by fit, with application strategy)
## Application Timeline
(Key dates and preparation steps)
## Tips for Success
(Specific advice for each recommended grant)

Include real program names, dollar amounts, and eligibility criteria.`,
};

// 2. Register it in BUILT_IN_TOOLS
const BUILT_IN_TOOLS = [
  {
    name: "grant_finder",
    description: "Discovers real grant opportunities with amounts, eligibility, and application strategies",
    category: "research",
    outputType: "text",
    executionType: "llm_prompt",
  },
];

// 3. It's automatically seeded on server start via seedBuiltInTools()
// 4. It can now be selected as a step tool in any assembly line
// 5. Agents can use it in daemon activities
// 6. The /tools page shows it in the tool catalog
```

---

## Branding

- **App Name**: Creative Intelligence
- **Company**: CB | CREATIVES
- **Color**: Gold/amber primary (#E5A824), dark charcoal backgrounds
- **UI Terms**: Workspaces = "Studios", Departments = Workspaces
- **Tone**: Simple, everyday language. Agents speak with personality.
