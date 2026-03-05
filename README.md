CLAUDE.md — Tool Creation Guide
Created a comprehensive guide (CLAUDE.md) that teaches agents how to build tools at production quality. It covers:

Architecture overview — How the codebase connects (schema → storage → routes → toolEngine → assemblyEngine)
Tool schema — Every field in the agentTools table explained
Execution types — LLM prompt tools vs code sandbox tools
System prompt writing — The 5-part pattern (role, rules, structure, quality bars, anti-patterns)
Tool registration — How to add tools to BUILT_IN_PROMPTS and BUILT_IN_TOOLS
Execution flow — Step-by-step walkthrough of executeTool()
Assembly line integration — How tools chain in pipelines
AI provider reference — How to call OpenAI, Anthropic, and MiniMax correctly
Complete example — Building a grant_finder tool from scratch
Conventions — Schema patterns, storage patterns, route patterns, error handling
Bug Fixes (making everything work)
toolEngine.ts — Fixed anthropicChat() being called with arguments in the wrong order (systemPrompt where model should be) and result treated as string instead of { content, inputTokens, outputTokens }
shared/schema.ts — Added missing type aliases (DiaryEntry, AgentMemoryRecord), conversations/messages tables, minimax provider
assemblyEngine.ts — Fixed null workspaceId and invalid gift type enum values
agentDaemon.ts — Fixed upsertAgentMemory call signature, agent.status → agent.isActive, removed invalid workspaceId from diary entries
routes.ts — Fixed ownerId → factoryOwnerId, getUser → getUserById, trackUsage args, invalid status enums
externalApi.ts — Fixed mergeAgents args, gift creation fields, tool_calls type narrowing, removed non-existent properties
Client pages — Fixed variant types, mutation types, ReactNode casting
Remaining errors are all external dependency issues (missing elevenlabs module, Stripe SDK types, p-retry version).

The linter applied some changes and the exploration agent confirmed our findings. Everything looks good — the changes are consistent with what we committed. The replit.md was also updated (likely by the platform) to reflect the new features.

All work has been pushed to claude/document-tool-creation-UpVbN. Here's the final summary:

CLAUDE.md created — A comprehensive guide teaching agents how to build tools, covering the full architecture from schema to execution to assembly lines, with a complete worked example.

Critical bugs fixed across 12 files:

anthropicChat() was being called with wrong argument order in toolEngine.ts (model/system prompt swapped, return type mishandled)
Missing schema types, tables, and enum values
Invalid field names and enum values in routes, daemon, and assembly engine
Various type mismatches across client and server
Both background agents have completed and confirmed the issues we already fixed. The linter changes are all consistent with our work. Everything is committed and pushed.
