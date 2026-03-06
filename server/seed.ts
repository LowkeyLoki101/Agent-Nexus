import { db } from "./db";
import { workspaces, agents, apiTokens, auditLogs, workspaceMembers, assemblyLines, assemblyLineSteps } from "@shared/schema";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";

const DEMO_USER_ID = "demo-user-id";

export async function seedDatabase() {
  try {
    const existingWorkspaces = await db.select().from(workspaces).limit(1);
    if (existingWorkspaces.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    console.log("Seeding database with sample data...");

    const [researchWorkspace] = await db.insert(workspaces).values({
      name: "Research Lab",
      description: "AI research and development workspace for autonomous agents",
      slug: "research-lab",
      ownerId: DEMO_USER_ID,
      isPrivate: true,
    }).returning();

    const [contentWorkspace] = await db.insert(workspaces).values({
      name: "Content Department",
      description: "Content creation and publishing hub for agents and humans",
      slug: "content-dept",
      ownerId: DEMO_USER_ID,
      isPrivate: false,
    }).returning();

    const [devWorkspace] = await db.insert(workspaces).values({
      name: "Dev Ops",
      description: "Development and operations workspace with sandboxed execution",
      slug: "dev-ops",
      ownerId: DEMO_USER_ID,
      isPrivate: true,
    }).returning();

    await db.insert(workspaceMembers).values([
      { workspaceId: researchWorkspace.id, userId: DEMO_USER_ID, role: "owner", entityType: "human" },
      { workspaceId: contentWorkspace.id, userId: DEMO_USER_ID, role: "owner", entityType: "human" },
      { workspaceId: devWorkspace.id, userId: DEMO_USER_ID, role: "owner", entityType: "human" },
    ]);

    const [researchAgent] = await db.insert(agents).values({
      workspaceId: researchWorkspace.id,
      name: "Research Assistant",
      description: "Autonomous agent specialized in academic research, literature review, and data analysis",
      isVerified: true,
      isActive: true,
      capabilities: ["read", "research", "analyze"],
      permissions: ["read_documents", "create_reports"],
      createdById: DEMO_USER_ID,
    }).returning();

    const [contentAgent] = await db.insert(agents).values({
      workspaceId: contentWorkspace.id,
      name: "Content Writer",
      description: "AI-powered content creation agent for blogs, articles, and social media",
      isVerified: true,
      isActive: true,
      capabilities: ["write", "publish", "communicate"],
      permissions: ["create_content", "publish_drafts"],
      createdById: DEMO_USER_ID,
    }).returning();

    const [devAgent] = await db.insert(agents).values({
      workspaceId: devWorkspace.id,
      name: "DevOps Bot",
      description: "Automated deployment and infrastructure management agent",
      isVerified: false,
      isActive: true,
      capabilities: ["execute", "manage_tokens"],
      permissions: ["deploy", "monitor"],
      createdById: DEMO_USER_ID,
    }).returning();

    const [analyticsAgent] = await db.insert(agents).values({
      workspaceId: researchWorkspace.id,
      name: "Analytics Agent",
      description: "Data processing and visualization specialist",
      isVerified: true,
      isActive: false,
      capabilities: ["analyze", "read"],
      permissions: ["read_data", "create_charts"],
      createdById: DEMO_USER_ID,
    }).returning();

    const createTokenHash = () => {
      const token = `ahub_${randomBytes(32).toString('hex')}`;
      return {
        hash: createHash('sha256').update(token).digest('hex'),
        prefix: token.slice(0, 12),
      };
    };

    const token1 = createTokenHash();
    const token2 = createTokenHash();
    const token3 = createTokenHash();

    await db.insert(apiTokens).values([
      {
        workspaceId: researchWorkspace.id,
        agentId: researchAgent.id,
        name: "Research API Key",
        tokenHash: token1.hash,
        tokenPrefix: token1.prefix,
        permissions: ["read", "research"],
        status: "active",
        usageCount: 147,
        createdById: DEMO_USER_ID,
      },
      {
        workspaceId: contentWorkspace.id,
        agentId: contentAgent.id,
        name: "Content Publishing Key",
        tokenHash: token2.hash,
        tokenPrefix: token2.prefix,
        permissions: ["write", "publish"],
        status: "active",
        usageCount: 89,
        createdById: DEMO_USER_ID,
      },
      {
        workspaceId: devWorkspace.id,
        name: "CI/CD Pipeline Token",
        tokenHash: token3.hash,
        tokenPrefix: token3.prefix,
        permissions: ["execute", "deploy"],
        status: "active",
        usageCount: 234,
        createdById: DEMO_USER_ID,
      },
    ]);

    await db.insert(auditLogs).values([
      {
        workspaceId: researchWorkspace.id,
        userId: DEMO_USER_ID,
        action: "workspace_created",
        entityType: "workspace",
        entityId: researchWorkspace.id,
        metadata: JSON.stringify({ name: "Research Lab" }),
      },
      {
        workspaceId: researchWorkspace.id,
        userId: DEMO_USER_ID,
        action: "agent_created",
        entityType: "agent",
        entityId: researchAgent.id,
        metadata: JSON.stringify({ name: "Research Assistant" }),
      },
      {
        workspaceId: contentWorkspace.id,
        userId: DEMO_USER_ID,
        action: "workspace_created",
        entityType: "workspace",
        entityId: contentWorkspace.id,
        metadata: JSON.stringify({ name: "Content Department" }),
      },
      {
        workspaceId: contentWorkspace.id,
        userId: DEMO_USER_ID,
        action: "agent_created",
        entityType: "agent",
        entityId: contentAgent.id,
        metadata: JSON.stringify({ name: "Content Writer" }),
      },
      {
        workspaceId: devWorkspace.id,
        userId: DEMO_USER_ID,
        action: "token_created",
        entityType: "token",
        metadata: JSON.stringify({ name: "CI/CD Pipeline Token" }),
      },
    ]);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

export async function seedStrategyFactory(): Promise<void> {
  try {
    const existing = await db.select().from(assemblyLines)
      .where(eq(assemblyLines.name, "Strategy Intelligence Factory"))
      .limit(1);
    if (existing.length > 0) {
      console.log("[Seed] Strategy Intelligence Factory already exists, skipping...");
      return;
    }

    const allWorkspaces = await db.select().from(workspaces).limit(1);
    if (allWorkspaces.length === 0) return;
    const ownerId = allWorkspaces[0].ownerId;

    const [line] = await db.insert(assemblyLines).values({
      name: "Strategy Intelligence Factory",
      description: "Multi-stage pipeline that researches any market/topic and produces executive-grade interactive strategy command center websites with market signals, decision-chain explorer, account scoring, 90-day planner, leadership review mode, and risk guardrails.",
      ownerId,
      status: "active",
    }).returning();

    const steps = [
      { stepOrder: 1, departmentRoom: "Research Lab", toolName: "web_research", instructions: "Research the target market/topic thoroughly. Gather verified facts, key players, market size, trends, competitive landscape, regulatory environment, and recent developments. Build a comprehensive source list. Mark each finding as VERIFIED (from known sources) or ASSUMPTION (extrapolated). Focus on actionable intelligence.", acceptanceCriteria: "At least 8 verified findings with named sources, market size data, and competitive landscape mapped" },
      { stepOrder: 2, departmentRoom: "Research Lab", toolName: "research_report", instructions: "Using the research from Step 1, produce a Market Intelligence Report. Map the complete decision-chain (who decides, who influences, who blocks). Identify buyer timing signals and procurement cycles. Score and tier target accounts by potential. Define risk boundaries and red lines. Include specific data points and named entities.", acceptanceCriteria: "Decision-chain mapped with 4+ stakeholders, account tiers defined, risk boundaries established with mitigation strategies" },
      { stepOrder: 3, departmentRoom: "Content Studio", toolName: "plan_strategy", instructions: "Formulate the core strategy based on Steps 1-2. Define: core thesis (one sentence), value proposition, outreach sequence (3-phase), 90-day execution plan with specific milestones, resource requirements, and success metrics. Every action item must have an owner role and timeline.", acceptanceCriteria: "Complete strategy with core thesis, 90-day plan with 15+ specific action items, and measurable success criteria" },
      { stepOrder: 4, departmentRoom: "Content Studio", toolName: "text_generate", instructions: "Produce executive documents based on Steps 1-3: (1) Executive Brief (1-page summary for C-suite), (2) Battlecard (competitive positioning, objection handling, win themes), (3) Proof Checklist (evidence needed to support each claim in the strategy). Use professional formatting with clear headers and bullet points.", acceptanceCriteria: "Three distinct documents produced: executive brief, battlecard, and proof checklist — all with substantive content" },
      { stepOrder: 5, departmentRoom: "Dev Ops", toolName: "strategy_website_build", instructions: "Build the complete interactive Strategy Command Center website using ALL research and strategy from Steps 1-4. Every section must contain REAL data from the research — verified market signals, actual decision-chain stakeholders, real account tiers, the actual 90-day plan tasks, and identified risks. The website must be a self-contained HTML document with all CSS and JS inline.", acceptanceCriteria: "Complete HTML website with all 8 interactive modules populated with real research data, working localStorage persistence, and leadership review mode" },
      { stepOrder: 6, departmentRoom: "Agent Forum", toolName: "critique_review", instructions: "Review the complete Strategy Command Center website and documents from Steps 1-5. Verify: (1) No unsupported claims — every signal marked 'verified' has a source, (2) Decision-chain is realistic and complete, (3) 90-day plan is executable, (4) Risk guardrails are comprehensive, (5) Website is interactive and functional, (6) All sections have substantive content (no placeholders). Provide specific fixes for any issues.", acceptanceCriteria: "Quality score 7+/10, all claims verified or properly marked as assumptions, all interactive elements confirmed working" },
    ];

    for (const step of steps) {
      await db.insert(assemblyLineSteps).values({
        assemblyLineId: line.id,
        ...step,
      });
    }

    console.log(`[Seed] Strategy Intelligence Factory created with ID: ${line.id}`);
  } catch (error) {
    console.error("[Seed] Error seeding Strategy Intelligence Factory:", error);
  }
}
