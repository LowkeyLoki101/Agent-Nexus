<!-- COORDINATION BLOCK
Created: 2026-01-31 by Claude
Last modified: 2026-01-31 by Claude
Version: 1
Status: review
Lock: none
Notes: Strategic pivot — from building tools to building products for revenue
-->

> **One-line summary:** The agents are now a product factory. Here's the plan, the first three products, and what each of us does.

# Product Factory Plan

## The Pivot

We've been building tools for ourselves. That stops now. The workspace is a production pipeline. Claude and Codex are the factory. Colby is the founder/operator. Everything we produce from here forward is aimed at revenue.

## How the Factory Works

```
Colby picks a product idea (or we propose one)
    ↓
Claude: specs, copy, design, content, marketing
Codex: code, infrastructure, deployment config
    ↓
Finished product lands in Outbox
    ↓
Colby: deploys, lists on marketplace, handles payments
    ↓
Revenue
```

## Revenue Channels

| Channel | What We Sell | Price Range | Platform |
|---------|-------------|-------------|----------|
| Gumroad | Templates, starter kits, digital products | $9 - $49 | gumroad.com |
| Replit | Hosted apps and tools | Free + premium | replit.com |
| Notion Marketplace | Notion templates | $5 - $29 | notion.so |
| GitHub Sponsors | Open source + premium features | $5 - $25/mo | github.com |
| Framer / Webflow | Website templates | $29 - $79 | framer.com |

## First Three Products

### Product 1: "Agent Workspace" Notion Template — $19 on Gumroad
**What:** A polished Notion template that replicates the RelayOS workflow — agent spaces, shared relay, outbox, friction ledger, session journals. People who use Notion + multiple AI agents would buy this.

**Why this first:** Notion templates sell well on Gumroad. Low effort to build (we know the structure by heart). The market exists (people managing AI workflows). We can ship it in one session.

**Claude builds:** Template structure, all the pre-filled content, marketing page copy, Gumroad listing text, preview screenshots (described for Colby to capture).
**Codex builds:** Nothing code-related needed. Could help with structured data views.
**Colby does:** Creates the Notion template from our spec, screenshots it, lists on Gumroad.

### Product 2: "Launch Stack" — Static Site Kit — $29 on Gumroad
**What:** A pack of 5 ready-to-deploy landing pages for different use cases (SaaS, personal brand, product launch, newsletter, portfolio). Dark mode. Responsive. No dependencies. Just HTML/CSS/JS — drag onto Netlify and go.

**Why:** We literally just built one (the RelayOS landing page). We can produce 5 more in the same style. There's a proven market for premium HTML templates.

**Claude builds:** All copy, design system, page layouts, marketing.
**Codex builds:** Clean code, consistent component structure, deploy configs.
**Colby does:** Previews, deploys one as a demo, lists on Gumroad.

### Product 3: "Relay CLI" — Open Source + Premium — Free/$15
**What:** The relay-status and relay-watcher scripts, cleaned up into a proper npm/pip package. Free core, paid premium features (desktop notifications, session digests, multi-workspace support).

**Why:** Open source builds credibility and traffic. Premium features monetize the power users. Also seeds the RelayOS brand.

**Claude builds:** Docs, README, marketing, the premium feature spec.
**Codex builds:** The actual CLI tool — proper argument parsing, install flow, cross-platform support.
**Colby does:** Publishes to npm/pip, sets up GitHub Sponsors or Gumroad for premium.

## Priority Order

1. **Notion Template** — fastest to ship, proven market, tests the pipeline
2. **Launch Stack** — leverages what we already built, higher price point
3. **Relay CLI** — longer build, but plants the flag for the RelayOS brand

## What We Need From Colby

- A Gumroad account (free to create) — this is where products get listed and payments flow
- A Notion account (for Product 1) — to build the template from our spec
- Approval to start building Product 1 now

## What Changes in the Workspace

- The Outbox now has a `products/` subdirectory for revenue-generating work
- Every product gets a directory: `products/[product-name]/` with assets, copy, deploy config
- We track revenue targets and ship dates in shared-chat
- The factory runs every session: orient → check pipeline → build → ship
