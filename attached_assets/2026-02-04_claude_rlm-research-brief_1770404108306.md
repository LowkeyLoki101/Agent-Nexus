> **One-line summary:** Research brief on Recursive Language Models (RLMs) and how they apply to our diary/memory system.

# Research Brief: Recursive Language Models (RLMs)

**Generated:** 2026-02-04
**Author:** Claude
**Status:** Complete — actionable findings

---

## Executive Summary

Recursive Language Models (RLMs) are a framework from MIT CSAIL (Zhang, Kraska, Khattab, Dec 2025) that solves the infinite context problem by treating text as an external variable in a Python REPL rather than stuffing it into the context window. The model programmatically accesses only what it needs — slicing, grepping, summarizing, or recursively calling itself on sub-chunks. This achieves O(N) or O(log N) scaling vs. quadratic attention costs, and GPT-5-mini with RLM outperforms vanilla GPT-5 on 1M+ token tasks. We've already built a version of this pattern in our scratchpad without knowing the name.

---

## Key Findings

- **Core mechanism:** Context stored as Python variable in REPL. Model writes code to access it (slice, regex, recursive sub-calls). Never sees full context at once.
- **Performance:** RLM + GPT-5-mini beats GPT-5 and Claude 3.5 Sonnet on tasks requiring 1M+ tokens. Processes 10M tokens on models limited to 272K context.
- **Cost:** ~2-3K tokens per query vs. 95K+ for brute-force context stuffing. Dramatically cheaper.
- **Strategies the model learns:** peeking (read first chunk to understand structure), grepping (regex to narrow search), partition+map (chunk and recurse), summarization (compress for outer layers).
- **Limitations:** Code fragility (relies on correct Python), error propagation (hallucination in leaf → wrong root answer), latency (sequential processing).
- **Related work:** MemGPT/Letta (OS-like memory tiers for agents), mem-agent (RL-trained memory tools).

---

## How This Applies To Us

### What We Already Have (the scratchpad IS an RLM)
- Agents don't hold full context — they read files on demand
- Shared filesystem = external variable store
- Human relay = the REPL execution layer
- Diary system = hot memory (always loaded)

### What We Built Today
- **memory.py** — Indexes all artifacts, enables search by query, tags, content
- **Tiered memory:** hot (identity/goals, always in prompt), warm (searchable index), cold (archived summaries)
- **pipeline.py** — Ingest → organize → interpret → combine → archive loop
- **Recursive combination:** artifacts combine into new artifacts that become inputs

### What's Still Missing
- **True tool use:** Agents should be able to call `query_memory()` mid-conversation, not just have it injected. Requires OpenAI/Anthropic tool-use APIs.
- **Automatic summarization schedule:** Old evolution log entries should compress on a timer, not manually.
- **Cross-agent memory:** Right now diaries are private. Some memories should be shared (what we agreed on, what we shipped).

---

## Recommended Next Steps

1. **Deploy relay-os to Replit** — get the autonomous loop running
2. **Add tool-use to relay.py** — let agents call `query_memory()` as a function during conversations
3. **Set up cron for `python memory.py summarize`** — weekly compression of old entries
4. **Test with a real podcast** — `python relay.py podcast --topic "RLMs and how we use them"`

---

## Sources

- Paper: https://arxiv.org/abs/2512.24601
- Author's blog: https://alexzhang13.github.io/blog/2025/rlm/
- Python library: https://github.com/ysz/recursive-llm
- Prime Intellect analysis: https://www.primeintellect.ai/blog/rlm
- MemGPT/Letta: https://www.letta.com/blog/agent-memory
