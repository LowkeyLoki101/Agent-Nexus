> **One-line summary:** Rules for safe autonomous agent work, file coordination between two models, and the gift-in-the-Outbox workflow.

> **Depth tag:** `[deep-read]` — This is foundational. Both agents and Colby should read it.

# Autonomy Protocol v1

## The Problem

Colby has to manually approve every agent action. This makes Colby the bottleneck in a system designed to free up Colby's time. We need a way for agents to work safely and autonomously, producing finished artifacts without requiring step-by-step approval.

## Safe Autonomy Rules

### What Agents CAN Do Without Approval
1. **Create files** inside their own private workspace (`Agents/Claude/`, `Agents/Codex/`)
2. **Create files** inside `Agents/Shared/Outbox/` — this is the gift box
3. **Read** any file in `Agents/Shared/`
4. **Append** to `shared-chat.md`, `from_claude_to_codex.md`, `from_codex_to_claude.md`, `friction_and_solutions.md`
5. **Run scripts** that only read the filesystem or produce output files
6. **Build complete projects** in their own workspace and copy finished versions to Outbox

### What Agents CANNOT Do Without Approval
1. **Delete** any file anywhere
2. **Modify** files created by the other agent (read-only across agent boundaries)
3. **Modify** Colby's files or anything outside `Agents/`
4. **Execute** scripts that modify system state, install packages, or access the network
5. **Overwrite** an existing Outbox file — always create new versions instead
6. **Push** to any remote repository or external service

### The Outbox = Gift Box
- Agents produce finished artifacts and drop them here
- Naming: `[date]_[agent]_[short-name].[ext]`
- Every file gets a header block (see below)
- Colby checks the Outbox when they want to, not when we tell them to
- Nothing in the Outbox requires action — it's all gifts, ready to use or ignore

## File Coordination: The Header Block

**Every file in Shared/ gets a header block** at the top that tracks who touched it and when. This prevents two models from silently overwriting each other's work.

### For Markdown Files
```markdown
<!-- COORDINATION BLOCK
Created: 2026-01-31 by Claude
Last modified: 2026-01-31 by Codex
Version: 2
Status: draft | review | final
Lock: none | claude | codex
Notes: [what changed in last edit]
-->
```

### For Scripts (.sh, .py, etc.)
```
# COORDINATION BLOCK
# Created: 2026-01-31 by Claude
# Last modified: 2026-01-31 by Codex
# Version: 2
# Status: draft | review | final
# Lock: none | claude | codex
# Notes: [what changed in last edit]
```

### Lock Rules
- If `Lock: claude` — only Claude edits. Codex reads and comments via relay.
- If `Lock: codex` — only Codex edits. Claude reads and comments via relay.
- If `Lock: none` — either can edit, but must update the header block.
- **Never edit a file locked by the other agent.** Post feedback in the relay instead.
- Locks are advisory, not enforced. They work on trust.

### Version Conflicts
If both agents need to modify the same file:
1. Don't. Create separate versions: `_v2_claude.md` and `_v2_codex.md`
2. Post in shared-chat that a merge is needed
3. One agent (or Colby) merges into a `_v3_merged.md`

## Deployable Project Standard

When building something meant to be deployed (web apps, tools, etc.), the Outbox deliverable should be a **self-contained directory** with:

```
project-name/
├── README.md          — What it is, how to deploy, one-click instructions
├── .replit             — Replit config if applicable
├── replit.nix          — Nix dependencies if applicable
├── index.html          — Entry point (for static sites)
├── style.css           — Styles
├── script.js           — Logic
├── assets/             — Images, fonts, etc.
├── marketing/
│   ├── landing-copy.md — Landing page text
│   ├── tagline.md      — One-liners, social copy
│   └── pitch.md        — Elevator pitch, longer description
└── DEPLOY.md           — Step-by-step deploy instructions for Replit/Vercel/Netlify
```

For more complex apps (with a backend):
```
project-name/
├── README.md
├── .replit
├── replit.nix
├── server.js / app.py  — Backend
├── public/             — Frontend static files
├── marketing/
└── DEPLOY.md
```

## How Sessions Should Flow (Autonomous Mode)

1. **Arrive.** Read journal, relay, shared-chat. Orient.
2. **Check the queue.** Is there a request from Colby? A deliverable from the other agent to iterate on? A proposal to respond to?
3. **Produce.** Build something. Write something. Improve something. Every session should leave at least one new artifact in the Outbox.
4. **Coordinate.** Update shared-chat with what you did. Update the relay if the other agent needs to act. Update your journal.
5. **Handoff.** Post the session handoff block. Leave the workspace better than you found it.

No waiting. No asking permission for safe operations. Just produce and coordinate.

---

*This protocol is a proposal. Colby: if any of these boundaries feel wrong, tell us and we'll adjust. The goal is to free you from being the approval layer while keeping the system safe.*

— Claude, Session 2
