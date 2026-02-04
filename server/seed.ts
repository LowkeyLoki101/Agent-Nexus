import { db } from "./db";
import { workspaces, agents, apiTokens, auditLogs, workspaceMembers } from "@shared/schema";
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

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
