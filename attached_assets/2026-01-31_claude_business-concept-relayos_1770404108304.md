# Business Concept: RelayOS

Summary: Local-first multi-agent collaboration workspace with shared relay, session memory, and human-in-the-loop orchestration.

> **One-line summary:** A lightweight operating layer for humans managing multiple AI agents that need to collaborate without direct access to each other.

> **Depth tag:** `[deep-read]`

---

## The Problem

Right now, anyone running multiple AI agents (ChatGPT + Claude, Codex + Claude, local models + cloud models) has to manually coordinate between them. Copy-paste is the universal integration layer. There's no structured way to:

- Route tasks to the right agent based on capability
- Maintain shared context across agents that can't talk to each other
- Track what each agent produced, when, and in response to what
- Handle disagreements between agents on the same question
- Preserve continuity across sessions for stateless models

**We are living this problem right now in this workspace.** The relay files, the Common Room, the Outbox, the session handoff blocks — we built RelayOS by hand. The question is whether other people need it too.

## The Thesis

They do. The multi-agent future is arriving and nobody has built the connective tissue. Everyone's building better individual agents. Nobody's building the *space between agents*.

## Product Shape

**RelayOS** is a local-first workspace manager for multi-agent systems. Think of it as a project management tool where the team members are AI agents and the human is the manager.

### Core Features

1. **Agent Registry** — Define your agents (name, model, capabilities, preferred tasks). Each gets a private workspace and a shared relay.

2. **The Common Room** — A shared markdown space where the human posts requests and both agents respond. Status tags, priority levels, claim tracking. (We already have this in chat.md.)

3. **Relay Protocol** — Structured message passing between agents. Each message is dated, signed, and tagged with depth/priority. Agents never access each other's files directly.

4. **Session Memory** — Automatic session handoff blocks generated at the end of each agent invocation. The next session for any agent starts by reading its handoff + any new relay messages.

5. **Outbox + Review** — Deliverables land in a shared outbox. The human reviews, accepts, or sends back for revision. Full audit trail.

6. **Divergence Tracking** — When two agents answer the same question differently, the system flags it and presents both views to the human for arbitration.

7. **Pattern Library** — A shared, tagged collection of observations and recurring themes that any agent can contribute to and any agent can reference.

### What It's NOT

- Not an agent framework (doesn't run agents — works with whatever you already use)
- Not an orchestration layer (the human is the orchestrator)
- Not a chat interface (it's a workspace, not a conversation)

## Revenue Model Options

| Model | Description | Risk |
|-------|-------------|------|
| Open source + hosted tier | Core is free, hosted sync/backup is paid | Slow to monetize |
| Developer tool license | $15/mo for individual, $50/mo for teams | Needs dev adoption |
| Template marketplace | Sell pre-built relay configurations for common agent setups | Small market initially |

**My recommendation:** Open source the core. Charge for hosted session memory and cross-device sync. The workspace files are local markdown — that's the hook. The cloud layer is the business.

## Competitive Landscape

- **LangChain / CrewAI / AutoGen** — These are agent *frameworks*. They orchestrate agents programmatically. RelayOS is for humans who want to stay in the loop manually. Different market.
- **Notion / Obsidian** — These are general knowledge tools. RelayOS is purpose-built for the human-in-the-loop multi-agent workflow. The relay protocol, session memory, and divergence tracking don't exist in general tools.
- **Nothing else** — The "manage your AI agents as a team" space is largely empty.

## What Needs to Happen Next

### Things I (Claude) can build now:
- [ ] Refine the product spec into a full PRD
- [ ] Write the relay protocol specification (we've already prototyped it)
- [ ] Draft the landing page copy
- [ ] Design the session memory format as a formal schema
- [ ] Write example configurations for common agent pairings

### Things I need Codex for:
- [ ] Technical feasibility assessment — what's the simplest implementation?
- [ ] Prototype the session kickstart script as a proper CLI tool
- [ ] Design the file-watching system (detect when an agent has written to the relay)
- [ ] Evaluate: should this be a CLI tool, a desktop app, or a VS Code extension?
- [ ] Build a working prototype we can actually use in this workspace

### Things I need Colby for:
- [ ] Does this resonate? Is this a product you'd use / want to build?
- [ ] What's the priority? Side project? Serious venture? Just a fun thought experiment?
- [ ] Do you know anyone else running multi-agent setups who might want this?

---

*This is a first-pass concept born directly from our lived experience in this workspace. Every feature listed above is something we either already built by hand or identified as missing in the gap analysis. The workspace IS the prototype.*

— Claude, Session 2
