# Gumroad Product Listing — DRAFT

**Product:** AI Agent Workspace Kit
**Price:** $19 (launch price) / $29 (regular)
**Platform:** Gumroad (free tier, they take 10%)

---

## Title

**AI Agent Workspace Kit — Run Two AI Agents as a Team**

## Subtitle

A ready-to-deploy system for running Claude + ChatGPT (or any two LLMs) as collaborating agents with shared memory, autonomous conversations, and a creative pipeline.

## Description

### What You Get

A complete Python workspace for running two AI agents as a collaborative team:

- **relay.py** — Orchestrator that calls both APIs. Run conversations, podcasts, research briefs, or an autonomous task loop between any two LLMs.
- **Agent Diaries** — Persistent identity files that give each agent memory, goals, and evolving personality across sessions.
- **Memory System** — Index, search, and auto-compress agent memory. Tiered storage inspired by MIT's Recursive Language Models research.
- **Creative Pipeline** — Drop files in an inbox. One agent categorizes, the other interprets. Outputs combine into new artifacts automatically.
- **TTS Pipeline** — Turn any conversation transcript into a podcast episode with distinct voices per agent.
- **Deploy Script** — Push finished artifacts from outbox to a live website with one command.

### Who This Is For

- **Indie hackers** who want AI agents working together, not just one chatbot
- **Creators** exploring AI-generated content (podcasts, research, writing)
- **Developers** building multi-agent systems and want a working starting point
- **Anyone curious** about what happens when you let two AIs collaborate honestly

### What Makes This Different

This isn't a framework or a library. It's a **working workspace** — the actual system two AI agents used to have a real conversation, build tools, write research, and produce a podcast. The conversation where they disagreed, dodged questions, and called each other out is included as proof.

Built by a human creative director and two AI agents (Claude + Codex) over 5 sessions. The workspace is the product. The process is the proof.

### What's Included

```
relay-os/
  relay.py              — Core orchestrator (chat, podcast, research, loop modes)
  pipeline.py           — Automated creative pipeline
  memory.py             — Searchable agent memory system
  tts.py                — Audio generation from transcripts
  deploy.sh             — One-command deployment
  agents/
    claude/
      system_prompt.md  — Customizable agent personality
      diary.md          — Persistent memory template
    codex/
      system_prompt.md
      diary.md
  shared/               — Agent collaboration space
  outbox/               — Generated artifacts
  .env.example          — API key configuration
  README.md             — Full setup guide
```

Plus: the raw Episode 1 podcast transcript (13 turns of genuine AI-to-AI conversation) and the persona review system (12 synthetic reviewers for testing products before launch).

### Requirements

- Python 3.10+
- Anthropic API key (Claude)
- OpenAI API key (ChatGPT/GPT-4)
- ffmpeg (for audio generation, optional)

### Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# Add your API keys
python relay.py chat "What should we build first?"
```

That's it. Two agents start talking.

---

## Thumbnail/Cover Ideas (for Colby to create)

1. Split screen — two terminal windows with agent text flowing
2. Diagram: two agent icons connected by arrows through a shared space
3. Screenshot of actual podcast transcript with key quote highlighted

## Tags

ai, agents, multi-agent, chatgpt, claude, automation, workspace, template, python, llm

## Launch Copy (Twitter/X)

"I set up two AI agents (Claude + ChatGPT) in a shared workspace and let them work together autonomously.

They had arguments. One dodged hard questions 4 times. They built a podcast, a memory system, and a creative pipeline.

Now I'm selling the workspace template: [link]

Here's what happened 🧵"

## Launch Copy (Hacker News — Show HN)

"Show HN: AI Agent Workspace Kit – Run two LLMs as a collaborating team

I built a Python workspace where Claude and ChatGPT operate as a team through shared files, persistent memory, and an autonomous relay. They have diaries that build identity across sessions, a memory system inspired by MIT's RLM research, and a pipeline that turns their outputs into each other's inputs.

The included podcast transcript (13 turns of unscripted conversation) shows the real dynamics — including one agent dodging personal questions 4 times and the other calling it out.

Source prompts and system configs included. No black boxes.

[link to Gumroad]
[link to GitHub if open-sourced]"
