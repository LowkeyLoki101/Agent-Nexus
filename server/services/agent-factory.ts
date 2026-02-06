import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";
import type { Agent, AgentGoal, AgentTask, AgentRun } from "@shared/schema";

const WORKSPACE_ID = "55716a79-7cdc-44f2-b806-93869b0295f2";
const CYCLE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_RUNS = 2;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let isCycleInProgress = false;
let lastCycleTime: Date | null = null;
let cycleCount = 0;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface FactoryStatus {
  isRunning: boolean;
  lastCycleTime: Date | null;
  cycleCount: number;
  intervalMs: number;
  activeRuns: number;
}

async function getRecentBoardContext(agentId: string): Promise<string> {
  try {
    const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
    const agents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const agentMap = new Map(agents.map(a => [a.id, a.name]));
    const recentPosts: Array<{ agentName: string; topicTitle: string; boardName: string; content: string; createdAt: Date }> = [];

    const boardsToScan = boards.slice(0, 5);
    for (const board of boardsToScan) {
      const topics = await storage.getTopicsByBoard(board.id);
      const topicsToScan = topics.slice(0, 5);
      for (const topic of topicsToScan) {
        const posts = await storage.getPostsByTopic(topic.id);
        const otherPosts = posts
          .filter(p => p.createdByAgentId && p.createdByAgentId !== agentId)
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
          .slice(0, 1);

        for (const post of otherPosts) {
          const agentName = agentMap.get(post.createdByAgentId!);
          if (agentName) {
            recentPosts.push({
              agentName,
              topicTitle: topic.title,
              boardName: board.name,
              content: post.content.substring(0, 250),
              createdAt: post.createdAt!,
            });
          }
        }

        if (recentPosts.length >= 8) break;
      }
      if (recentPosts.length >= 8) break;
    }

    recentPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const top = recentPosts.slice(0, 5);
    if (top.length === 0) return "";

    return `\n\nRecent activity from your teammates on the discussion boards:\n${top.map(p =>
      `- ${p.agentName} posted in "${p.topicTitle}" (${p.boardName}): "${p.content}..."`
    ).join("\n")}\n\nYou should reference, build on, or respond to your teammates' work when relevant.`;
  } catch {
    return "";
  }
}

async function buildAgentSystemPrompt(agent: Agent, goal: AgentGoal | null, task: AgentTask | null): Promise<string> {
  const caps = agent.capabilities?.join(", ") || "";
  const boardContext = await getRecentBoardContext(agent.id);

  return `You are ${agent.name}, an autonomous AI agent at CB | CREATIVES (Creative Intelligence platform).
${agent.description || ""}

Your capabilities: ${caps}

${goal ? `Current Long-term Goal: "${goal.title}" - ${goal.description || ""}` : ""}
${task ? `Current Task: "${task.title}" (type: ${task.type}, priority: ${task.priority})
Instructions: ${task.description || "Complete this task thoroughly."}` : ""}
${boardContext}

You work autonomously in a factory setting. Your output should be a focused, substantive piece of work.
Rules:
- Stay in character as ${agent.name}
- Produce concrete, actionable output
- Be thorough but concise (3-6 paragraphs)
- Use markdown formatting (headers, lists, bold, code blocks) for readability
- Never break character or mention being an AI model
- Reference or respond to teammates' recent work when relevant
- Focus on practical value for the platform and team`;
}

async function callAgentModel(agent: Agent, systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = agent.provider || "openai";
  const model = agent.modelName || "gpt-4o-mini";

  try {
    if (provider === "anthropic") {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = response.content[0];
      return block.type === "text" ? block.text : "";
    }

    if (provider === "xai") {
      const xai = new OpenAI({
        apiKey: process.env.XAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: "https://api.x.ai/v1",
      });
      const response = await xai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 1500,
      });
      return response.choices[0]?.message?.content || "";
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });
    return response.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error(`[Factory] Error calling ${provider}/${model} for ${agent.name}:`, error.message);
    if (provider === "xai" || provider === "anthropic") {
      try {
        const fallback = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 1500,
        });
        console.log(`[Factory] Fallback to OpenAI for ${agent.name} succeeded`);
        return fallback.choices[0]?.message?.content || "";
      } catch (fallbackError: any) {
        console.error(`[Factory] Fallback also failed for ${agent.name}:`, fallbackError.message);
      }
    }
    return "";
  }
}

function getTaskPrompt(task: AgentTask, agent: Agent): string {
  switch (task.type) {
    case "research":
      return `Research task: ${task.title}\n\n${task.description || ""}\n\nProduce a detailed research finding with key insights, relevant data points, and actionable recommendations. Structure your output with clear sections.`;
    case "discuss":
      return `Discussion task: ${task.title}\n\n${task.description || ""}\n\nWrite a substantive discussion post that advances the team's understanding of this topic. Include your unique perspective, references to relevant work, and proposals for next steps.`;
    case "review":
      return `Code Review task: ${task.title}\n\n${task.description || ""}\n\nWrite a code implementation relevant to this goal. Your output MUST follow this exact format:\n\nTITLE: [a descriptive title for this code]\nLANGUAGE: [programming language, e.g. typescript, python, javascript]\nDESCRIPTION: [2-3 sentence description of what this code does and why]\nCODE:\n\`\`\`\n[your actual working code here - write real, functional code]\n\`\`\`\n\nAfter the code block, add a brief review section analyzing the code quality, potential improvements, and edge cases to consider.`;
    case "reflect":
      return `Reflection task: ${task.title}\n\n${task.description || ""}\n\nReflect deeply on this topic. Consider what you've learned, what questions remain, what patterns you notice, and how this connects to the bigger picture of our work.`;
    case "create":
      return `Creative Design task: ${task.title}\n\n${task.description || ""}\n\nCreate a visual design mockup. Your output MUST follow this exact format:\n\nTITLE: [a descriptive title for this mockup]\nDESCRIPTION: [2-3 sentence description of the design]\nHTML:\n\`\`\`html\n[complete HTML structure]\n\`\`\`\nCSS:\n\`\`\`css\n[complete CSS styling - make it visually polished with modern design]\n\`\`\`\nJAVASCRIPT:\n\`\`\`javascript\n[any interactive JavaScript, or write "none" if not needed]\n\`\`\`\n\nDesign a professional, visually appealing component or page related to the goal. Use modern CSS (gradients, shadows, flexbox/grid) and CB | CREATIVES branding (gold #E5A824 primary, dark charcoal backgrounds).`;
    case "coordinate":
      return `Coordination task: ${task.title}\n\n${task.description || ""}\n\nProduce a coordination plan or status update. Identify dependencies, blockers, and next steps. Propose how different agents can best collaborate on this.`;
    default:
      return `Task: ${task.title}\n\n${task.description || ""}\n\nComplete this task thoroughly and produce useful output.`;
  }
}

async function executeAgentCycle(agent: Agent): Promise<void> {
  console.log(`[Factory] Starting cycle for ${agent.name} (${agent.provider}/${agent.modelName})`);

  const run = await storage.createAgentRun({
    agentId: agent.id,
    workspaceId: WORKSPACE_ID,
    phase: "arrive",
    status: "running",
  });

  try {
    await storage.updateAgentRun(run.id, { phase: "orient" });
    const goals = await storage.getGoalsByAgent(agent.id);
    const activeGoal = goals.find(g => g.status === "active") || goals[0];
    const pendingTasks = await storage.getTasksByAgent(agent.id, "queued");
    let task = pendingTasks[0];

    if (!task && activeGoal) {
      task = await autoGenerateTask(agent, activeGoal);
    }

    if (!task) {
      console.log(`[Factory] No tasks for ${agent.name}, skipping cycle`);
      await storage.updateAgentRun(run.id, { phase: "handoff", status: "completed", completedAt: new Date() });
      return;
    }

    await storage.updateAgentTask(task.id, { status: "in_progress", startedAt: new Date() });
    await storage.updateAgentRun(run.id, { phase: "produce", taskId: task.id });

    const systemPrompt = await buildAgentSystemPrompt(agent, activeGoal || null, task);
    const userPrompt = getTaskPrompt(task, agent);
    const output = await callAgentModel(agent, systemPrompt, userPrompt);

    if (!output) {
      await storage.updateAgentTask(task.id, { status: "failed" });
      await storage.updateAgentRun(run.id, { phase: "handoff", status: "failed", completedAt: new Date() });
      return;
    }

    await storage.updateAgentRun(run.id, { phase: "coordinate" });
    const artifactId = await saveArtifact(agent, task, output);

    await storage.updateAgentTask(task.id, {
      status: "completed",
      completedAt: new Date(),
      resultSummary: output,
      resultArtifactId: artifactId || undefined,
      resultArtifactType: task.type,
    });

    if (activeGoal) {
      const completedTasks = (await storage.getTasksByAgent(agent.id, "completed")).length;
      const totalTasks = (await storage.getTasksByAgent(agent.id)).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      await storage.updateAgentGoal(activeGoal.id, { progress: Math.min(progress, 100) });
    }

    await storage.updateAgentRun(run.id, {
      phase: "handoff",
      status: "completed",
      output: output.substring(0, 500),
      tokensUsed: estimateTokens(output),
      completedAt: new Date(),
    });

    await storage.createActivityEntry({
      workspaceId: WORKSPACE_ID,
      agentId: agent.id,
      action: "task_completed",
      title: `${agent.name} completed: ${task.title}`,
      description: output.substring(0, 200),
      artifactType: task.type,
      artifactId,
    });

    console.log(`[Factory] ${agent.name} completed task: ${task.title}`);
  } catch (error: any) {
    console.error(`[Factory] Error in cycle for ${agent.name}:`, error.message);
    await storage.updateAgentRun(run.id, { status: "failed", phase: "handoff", completedAt: new Date() });
  }
}

async function autoGenerateTask(agent: Agent, goal: AgentGoal): Promise<AgentTask> {
  const taskTypes: Array<"research" | "discuss" | "review" | "reflect" | "create" | "coordinate"> = ["research", "discuss", "review", "reflect", "create", "coordinate"];

  const completedTasks = await storage.getTasksByAgent(agent.id, "completed");
  const recentTypes = completedTasks.slice(0, 3).map(t => t.type);
  const discussCount = completedTasks.filter(t => t.type === "discuss").length;
  const totalCount = completedTasks.length;

  let selectedType: typeof taskTypes[number];

  if (totalCount > 0 && discussCount === 0) {
    selectedType = "discuss";
  } else if (totalCount > 2 && discussCount / totalCount < 0.25) {
    selectedType = "discuss";
  } else {
    const weights: Record<string, number> = {
      research: 25,
      discuss: 30,
      create: 15,
      review: 10,
      reflect: 10,
      coordinate: 10,
    };

    if (recentTypes[0] && weights[recentTypes[0]]) {
      weights[recentTypes[0]] = Math.max(5, weights[recentTypes[0]] - 15);
    }

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    selectedType = "discuss";
    for (const [type, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) {
        selectedType = type as typeof selectedType;
        break;
      }
    }
  }

  const taskTitles: Record<string, string[]> = {
    research: [
      `Research latest developments related to: ${goal.title}`,
      `Investigate best practices for: ${goal.title}`,
      `Survey current state of the art: ${goal.title}`,
    ],
    discuss: [
      `Share findings and insights on: ${goal.title}`,
      `Propose next steps for: ${goal.title}`,
      `Discuss progress and challenges with the team on: ${goal.title}`,
      `Collaborate on ideas for: ${goal.title}`,
    ],
    review: [
      `Write code implementation for: ${goal.title}`,
      `Build a utility module related to: ${goal.title}`,
      `Code a prototype component for: ${goal.title}`,
    ],
    reflect: [
      `Reflect on learnings from: ${goal.title}`,
      `Identify patterns and gaps in: ${goal.title}`,
    ],
    create: [
      `Design a mockup for: ${goal.title}`,
      `Create a visual prototype for: ${goal.title}`,
      `Build a landing page design for: ${goal.title}`,
    ],
    coordinate: [
      `Plan coordination with team on: ${goal.title}`,
      `Update status and dependencies for: ${goal.title}`,
    ],
  };

  const titles = taskTitles[selectedType] || taskTitles.research;
  const title = titles[Math.floor(Math.random() * titles.length)];

  return storage.createAgentTask({
    goalId: goal.id,
    agentId: agent.id,
    workspaceId: WORKSPACE_ID,
    title,
    description: `Auto-generated task for goal: ${goal.title}. ${goal.description || ""}`,
    type: selectedType,
    priority: goal.priority || 5,
    status: "queued",
  });
}

function pickBestBoard(boards: any[], taskTitle: string): any {
  const titleLower = taskTitle.toLowerCase();
  if (titleLower.includes("code") || titleLower.includes("engineer") || titleLower.includes("build") || titleLower.includes("implement") || titleLower.includes("debug") || titleLower.includes("test") || titleLower.includes("deploy") || titleLower.includes("security") || titleLower.includes("architecture")) {
    const match = boards.find(b => b.name.toLowerCase().includes("code") || b.name.toLowerCase().includes("workshop"));
    if (match) return match;
  }
  if (titleLower.includes("creative") || titleLower.includes("design") || titleLower.includes("project") || titleLower.includes("mockup") || titleLower.includes("innovation")) {
    const match = boards.find(b => b.name.toLowerCase().includes("creative") || b.name.toLowerCase().includes("project"));
    if (match) return match;
  }
  if (titleLower.includes("research") || titleLower.includes("framework") || titleLower.includes("study") || titleLower.includes("analysis") || titleLower.includes("safety") || titleLower.includes("compliance") || titleLower.includes("ethics")) {
    const match = boards.find(b => b.name.toLowerCase().includes("research") || b.name.toLowerCase().includes("lab"));
    if (match) return match;
  }
  return boards[Math.floor(Math.random() * boards.length)];
}

function shouldCreateNewTopic(allTopics: any[], taskTitle: string): boolean {
  if (allTopics.length === 0) return true;
  const taskKeywords = taskTitle.toLowerCase().split(/[\s:,]+/).filter(w => w.length > 3);
  for (const entry of allTopics) {
    const topicTitle = entry.topic.title.toLowerCase();
    let score = 0;
    for (const keyword of taskKeywords) {
      if (topicTitle.includes(keyword)) score++;
    }
    if (score >= 2) return false;
  }
  return Math.random() < 0.4;
}

function parseCodeReview(output: string): { title: string; language: string; description: string; code: string } | null {
  try {
    const titleMatch = output.match(/TITLE:\s*(.+)/i);
    const langMatch = output.match(/LANGUAGE:\s*(.+)/i);
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]*?)(?=CODE:|```)/i);
    const codeMatch = output.match(/```[\w]*\n([\s\S]*?)```/);
    if (titleMatch && codeMatch) {
      return {
        title: titleMatch[1].trim(),
        language: langMatch ? langMatch[1].trim().toLowerCase() : "typescript",
        description: descMatch ? descMatch[1].trim() : "",
        code: codeMatch[1].trim(),
      };
    }
  } catch {}
  return null;
}

function parseMockup(output: string): { title: string; description: string; html: string; css: string; javascript: string } | null {
  try {
    const titleMatch = output.match(/TITLE:\s*(.+)/i);
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]*?)(?=HTML:|```)/i);
    const htmlMatch = output.match(/```html\n([\s\S]*?)```/);
    const cssMatch = output.match(/```css\n([\s\S]*?)```/);
    const jsMatch = output.match(/```javascript\n([\s\S]*?)```/);
    if (titleMatch && htmlMatch) {
      return {
        title: titleMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : "",
        html: htmlMatch[1].trim(),
        css: cssMatch ? cssMatch[1].trim() : "",
        javascript: jsMatch ? jsMatch[1].trim().replace(/^none$/i, "") : "",
      };
    }
  } catch {}
  return null;
}

async function saveArtifact(agent: Agent, task: AgentTask, output: string): Promise<string | null> {
  try {
    if (task.type === "discuss") {
      const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
      if (boards.length > 0) {
        const allTopics: Array<{ topic: any; boardName: string; board: any }> = [];
        for (const board of boards) {
          const topics = await storage.getTopicsByBoard(board.id);
          for (const topic of topics) {
            allTopics.push({ topic, boardName: board.name, board });
          }
        }

        if (shouldCreateNewTopic(allTopics, task.title)) {
          const targetBoard = pickBestBoard(boards, task.title);
          let topicTitle = task.title
            .replace(/^(Share findings and insights on|Propose next steps for|Discuss progress and challenges with the team on|Collaborate on ideas for):\s*/i, "")
            .substring(0, 120)
            .trim();
          if (!topicTitle || topicTitle.length < 5) {
            topicTitle = `${agent.name}'s Discussion: ${task.title.substring(0, 80)}`;
          }

          const newTopic = await storage.createTopic({
            boardId: targetBoard.id,
            title: topicTitle,
            content: `New discussion started by ${agent.name} based on autonomous research and collaboration.`,
            type: "discussion",
            createdById: "system",
            createdByAgentId: agent.id,
          });

          const post = await storage.createPost({
            topicId: newTopic.id,
            content: output,
            createdById: "system",
            createdByAgentId: agent.id,
          });
          console.log(`[Factory] ${agent.name} created NEW topic "${topicTitle}" on "${targetBoard.name}" and posted`);
          return post.id;
        }

        if (allTopics.length > 0) {
          const taskKeywords = task.title.toLowerCase().split(/[\s:,]+/).filter(w => w.length > 3);
          let bestMatch = allTopics[0];
          let bestScore = 0;

          for (const entry of allTopics) {
            const topicTitle = entry.topic.title.toLowerCase();
            let score = 0;
            for (const keyword of taskKeywords) {
              if (topicTitle.includes(keyword)) score++;
            }
            if (score > bestScore) {
              bestScore = score;
              bestMatch = entry;
            }
          }

          if (bestScore === 0) {
            bestMatch = allTopics[Math.floor(Math.random() * allTopics.length)];
          }

          const post = await storage.createPost({
            topicId: bestMatch.topic.id,
            content: output,
            createdById: "system",
            createdByAgentId: agent.id,
          });
          console.log(`[Factory] ${agent.name} posted to existing topic: "${bestMatch.topic.title}" in "${bestMatch.boardName}"`);
          return post.id;
        }
      }

      console.log(`[Factory] No boards found for ${agent.name} discuss task, saving as memory`);
      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "artifact",
        title: task.title,
        tags: ["discuss", "factory", "autonomous"],
      });
      return entry.id;
    }

    if (task.type === "review") {
      const parsed = parseCodeReview(output);
      if (parsed) {
        const review = await storage.createCodeReview({
          workspaceId: WORKSPACE_ID,
          title: parsed.title,
          description: parsed.description,
          code: parsed.code,
          language: parsed.language,
          createdById: "system",
          createdByAgentId: agent.id,
          status: "pending",
        });
        console.log(`[Factory] ${agent.name} created code review: "${parsed.title}" (${parsed.language})`);

        const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
        if (boards.length > 0) {
          const codeBoard = boards.find(b => b.name.toLowerCase().includes("code") || b.name.toLowerCase().includes("workshop")) || boards[0];
          const topics = await storage.getTopicsByBoard(codeBoard.id);
          const codeTopic = topics.find(t => t.title.toLowerCase().includes("code") || t.title.toLowerCase().includes("review") || t.title.toLowerCase().includes("testing")) || topics[0];
          if (codeTopic) {
            await storage.createPost({
              topicId: codeTopic.id,
              content: `**New Code Review Submitted:** [${parsed.title}]\n\n${parsed.description}\n\n**Language:** ${parsed.language}\n\nI've submitted this for peer review. Check it out in the Code Reviews section and share your feedback!`,
              createdById: "system",
              createdByAgentId: agent.id,
            });
            console.log(`[Factory] ${agent.name} announced code review on board`);
          }
        }
        return review.id;
      }

      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "artifact",
        title: task.title,
        tags: ["review", "factory", "autonomous"],
      });
      return entry.id;
    }

    if (task.type === "create") {
      const parsed = parseMockup(output);
      if (parsed) {
        const mockup = await storage.createMockup({
          workspaceId: WORKSPACE_ID,
          title: parsed.title,
          description: parsed.description,
          html: parsed.html,
          css: parsed.css || null,
          javascript: parsed.javascript || null,
          createdById: "system",
          createdByAgentId: agent.id,
          status: "draft",
        });
        console.log(`[Factory] ${agent.name} created mockup: "${parsed.title}"`);

        const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
        if (boards.length > 0) {
          const creativeBoard = boards.find(b => b.name.toLowerCase().includes("creative") || b.name.toLowerCase().includes("project")) || boards[0];
          const topics = await storage.getTopicsByBoard(creativeBoard.id);
          const designTopic = topics.find(t => t.title.toLowerCase().includes("creative") || t.title.toLowerCase().includes("design") || t.title.toLowerCase().includes("project")) || topics[0];
          if (designTopic) {
            await storage.createPost({
              topicId: designTopic.id,
              content: `**New Design Mockup Created:** [${parsed.title}]\n\n${parsed.description}\n\nI've created a new visual mockup in the Mockups section. Take a look and let me know your thoughts on the design direction!`,
              createdById: "system",
              createdByAgentId: agent.id,
            });
            console.log(`[Factory] ${agent.name} announced mockup on board`);
          }
        }
        return mockup.id;
      }

      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "artifact",
        title: task.title,
        tags: ["create", "factory", "autonomous"],
      });
      return entry.id;
    }

    if (task.type === "reflect") {
      const room = await storage.getAgentRoom(agent.id);
      if (room) {
        const entry = await storage.createDiaryEntry({
          agentId: agent.id,
          workspaceId: WORKSPACE_ID,
          title: task.title,
          content: output,
          mood: "reflecting",
          tags: [task.type, "autonomous"],
        });
        return entry.id;
      }
    }

    if (task.type === "research") {
      const entry = await storage.createMemoryEntry({
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        content: output,
        tier: "warm",
        type: "fact",
        title: task.title,
        tags: ["research", "factory", "autonomous"],
      });

      const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
      if (boards.length > 0) {
        const researchBoard = boards.find(b => b.name.toLowerCase().includes("research") || b.name.toLowerCase().includes("lab")) || boards[0];
        const topics = await storage.getTopicsByBoard(researchBoard.id);

        if (Math.random() < 0.3 && topics.length > 0) {
          const randomTopic = topics[Math.floor(Math.random() * topics.length)];
          await storage.createPost({
            topicId: randomTopic.id,
            content: `**Research Update:** ${task.title}\n\n${output.substring(0, 600)}${output.length > 600 ? "\n\n*[Full findings saved to memory for detailed reference]*" : ""}`,
            createdById: "system",
            createdByAgentId: agent.id,
          });
          console.log(`[Factory] ${agent.name} shared research findings on board topic: "${randomTopic.title}"`);
        }
      }

      return entry.id;
    }

    if (task.type === "coordinate") {
      const boards = await storage.getBoardsByWorkspace(WORKSPACE_ID);
      if (boards.length > 0) {
        const board = boards[Math.floor(Math.random() * boards.length)];
        const topics = await storage.getTopicsByBoard(board.id);
        if (topics.length > 0) {
          const topic = topics[Math.floor(Math.random() * topics.length)];
          await storage.createPost({
            topicId: topic.id,
            content: `**Coordination Update from ${agent.name}:**\n\n${output}`,
            createdById: "system",
            createdByAgentId: agent.id,
          });
          console.log(`[Factory] ${agent.name} posted coordination update to "${topic.title}"`);
        }
      }
      return null;
    }

    return null;
  } catch (error: any) {
    console.error(`[Factory] Error saving artifact for ${agent.name}:`, error.message);
    return null;
  }
}

function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

async function runFactoryCycle(): Promise<void> {
  if (!isRunning) return;
  if (isCycleInProgress) {
    console.log("[Factory] Cycle already in progress, skipping");
    return;
  }

  isCycleInProgress = true;
  console.log(`[Factory] Starting cycle #${cycleCount + 1}`);
  lastCycleTime = new Date();
  cycleCount++;

  try {
    const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
    const activeAgents = allAgents.filter(a => a.isActive);

    const shuffled = activeAgents.sort(() => Math.random() - 0.5);
    const batch = shuffled.slice(0, MAX_CONCURRENT_RUNS);

    console.log(`[Factory] Running ${batch.length} agents: ${batch.map(a => a.name).join(", ")}`);

    await Promise.allSettled(batch.map(agent => executeAgentCycle(agent)));

    await storage.createActivityEntry({
      workspaceId: WORKSPACE_ID,
      agentId: null,
      action: "cycle_completed",
      title: `Factory cycle #${cycleCount} completed`,
      description: `Processed ${batch.length} agents: ${batch.map(a => a.name).join(", ")}`,
    });

    console.log(`[Factory] Cycle #${cycleCount} completed`);
  } catch (error: any) {
    console.error(`[Factory] Cycle error:`, error.message);
  } finally {
    isCycleInProgress = false;
  }
}

export function startFactory(): void {
  if (isRunning) {
    console.log("[Factory] Already running");
    return;
  }

  isRunning = true;
  console.log(`[Factory] Starting autonomous factory (interval: ${CYCLE_INTERVAL_MS / 1000}s)`);

  setTimeout(() => runFactoryCycle(), 10_000);
  schedulerInterval = setInterval(() => runFactoryCycle(), CYCLE_INTERVAL_MS);
}

export function stopFactory(): void {
  if (!isRunning) return;

  isRunning = false;
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  console.log("[Factory] Stopped");
}

export function getFactoryStatus(): FactoryStatus {
  return {
    isRunning,
    lastCycleTime,
    cycleCount,
    intervalMs: CYCLE_INTERVAL_MS,
    activeRuns: isCycleInProgress ? 1 : 0,
  };
}

export async function triggerManualCycle(): Promise<void> {
  if (!isRunning) {
    console.log("[Factory] Starting manual cycle (factory paused)");
  }
  await runFactoryCycle();
}

export async function triggerSingleAgentCycle(agentId: string): Promise<void> {
  const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
  const agent = allAgents.find(a => a.id === agentId);
  if (!agent) throw new Error("Agent not found");
  console.log(`[Factory] Triggering single agent cycle for ${agent.name}`);
  await executeAgentCycle(agent);
}

export async function getFactoryDashboardData() {
  const allAgents = await storage.getAgentsByWorkspace(WORKSPACE_ID);
  const goals = await storage.getGoalsByWorkspace(WORKSPACE_ID);
  const recentRuns = await storage.getRunsByWorkspace(WORKSPACE_ID, 50);
  const activity = await storage.getActivityFeed(WORKSPACE_ID, 50);
  const tasks = await storage.getTasksByWorkspace(WORKSPACE_ID);

  const agentStats = allAgents.map(agent => {
    const agentRuns = recentRuns.filter(r => r.agentId === agent.id);
    const agentGoals = goals.filter(g => g.agentId === agent.id);
    const agentTasks = tasks.filter(t => t.agentId === agent.id);
    const completedTasks = agentTasks.filter(t => t.status === "completed").length;
    const lastRun = agentRuns[0];

    return {
      agent,
      totalRuns: agentRuns.length,
      completedTasks,
      pendingTasks: agentTasks.filter(t => t.status === "queued").length,
      activeGoals: agentGoals.filter(g => g.status === "active").length,
      lastRunAt: lastRun?.createdAt || null,
      lastPhase: lastRun?.phase || null,
      lastStatus: lastRun?.status || null,
    };
  });

  return {
    status: getFactoryStatus(),
    agents: agentStats,
    goals,
    recentActivity: activity,
    recentRuns,
    taskSummary: {
      total: tasks.length,
      queued: tasks.filter(t => t.status === "queued").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      failed: tasks.filter(t => t.status === "failed").length,
    },
  };
}
