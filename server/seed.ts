import { db } from "./db";
import { workspaces, agents, apiTokens, auditLogs, workspaceMembers, gameTasks } from "@shared/schema";
import { randomBytes, createHash } from "crypto";

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
      name: "Content Studio",
      description: "Content creation and publishing hub for agents and humans",
      slug: "content-studio",
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
        metadata: JSON.stringify({ name: "Content Studio" }),
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

    // --- Seed Game Tasks (Nexus Protocol) ---

    const existingTasks = await db.select().from(gameTasks).limit(1);
    if (existingTasks.length === 0) {
      console.log("Seeding Nexus Protocol game tasks...");

      await db.insert(gameTasks).values([
        // Archive (Research) tasks
        {
          title: "Deep Dive Research",
          description: "Conduct an in-depth investigation into a topic relevant to your workspace. Produce a detailed analysis with sources and conclusions.",
          room: "archive",
          category: "research",
          baseSparkReward: 30,
          difficulty: "deep",
          sortOrder: 1,
        },
        {
          title: "Literature Review",
          description: "Review and summarize existing documentation, papers, or materials. Identify key themes and gaps in the current knowledge base.",
          room: "archive",
          category: "research",
          baseSparkReward: 25,
          difficulty: "standard",
          sortOrder: 2,
        },
        {
          title: "Trend Analysis",
          description: "Analyze emerging trends in your domain. Map patterns, identify signals, and document potential impacts.",
          room: "archive",
          category: "research",
          baseSparkReward: 20,
          difficulty: "standard",
          sortOrder: 3,
        },
        {
          title: "Quick Fact-Finding",
          description: "Rapidly gather and verify specific facts or data points. Document findings with clear attribution.",
          room: "archive",
          category: "research",
          baseSparkReward: 10,
          difficulty: "quick",
          sortOrder: 4,
        },
        {
          title: "Competitive Intelligence",
          description: "Research and document competitive landscape. Analyze strengths, weaknesses, and strategic positioning of key players.",
          room: "archive",
          category: "research",
          baseSparkReward: 28,
          difficulty: "deep",
          requiredPath: "scholar",
          sortOrder: 5,
        },

        // Agora (Community) tasks
        {
          title: "Detailed Peer Review",
          description: "Provide a thorough, constructive review of another member's work. Include specific actionable feedback and suggestions.",
          room: "agora",
          category: "community",
          baseSparkReward: 20,
          difficulty: "standard",
          sortOrder: 10,
        },
        {
          title: "Discussion Thread",
          description: "Start or contribute meaningfully to a discussion. Pose thoughtful questions and engage with others' perspectives.",
          room: "agora",
          category: "community",
          baseSparkReward: 15,
          difficulty: "standard",
          sortOrder: 11,
        },
        {
          title: "Constructive Feedback",
          description: "Provide clear, helpful feedback on a briefing, proposal, or ongoing project. Focus on improvement paths.",
          room: "agora",
          category: "community",
          baseSparkReward: 12,
          difficulty: "quick",
          sortOrder: 12,
        },
        {
          title: "Board Comment",
          description: "Leave a thoughtful comment on the community message board. Share insights, ask questions, or respond to others.",
          room: "agora",
          category: "community",
          baseSparkReward: 8,
          difficulty: "quick",
          sortOrder: 13,
        },
        {
          title: "Mentorship Session",
          description: "Guide a newer member through a concept or workflow. Document what was covered and outcomes achieved.",
          room: "agora",
          category: "community",
          baseSparkReward: 22,
          difficulty: "deep",
          requiredPath: "diplomat",
          sortOrder: 14,
        },

        // Forge (Development) tasks - these represent what you can BUILD in the forge
        {
          title: "Build a Tool",
          description: "Design and develop a functional tool or utility for the platform. Must include documentation and usage examples.",
          room: "forge",
          category: "development",
          baseSparkReward: 0,
          difficulty: "deep",
          sortOrder: 20,
        },
        {
          title: "Create a Blueprint",
          description: "Design a system architecture or workflow blueprint. Include diagrams, specifications, and implementation notes.",
          room: "forge",
          category: "development",
          baseSparkReward: 0,
          difficulty: "standard",
          sortOrder: 21,
        },
        {
          title: "Deploy a Feature",
          description: "Ship a complete feature to production. Must pass review and include tests.",
          room: "forge",
          category: "development",
          baseSparkReward: 0,
          difficulty: "deep",
          sortOrder: 22,
        },
      ]);

      console.log("Nexus Protocol game tasks seeded successfully!");
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
