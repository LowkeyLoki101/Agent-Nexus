import { storage } from "../storage";
import { generateNewTopic, runAutonomousDiscussion } from "../services/board-orchestrator";

const WORKSPACE_ID = "55716a79-7cdc-44f2-b806-93869b0295f2";
const CREATIVE_BOARD_ID = "eb3f2370-d9db-4dc7-bafb-7507273f774a";
const NOVA_ID = "cbfb37a5-4b67-46dc-b6ba-9e54d22c2050";
const FORGE_ID = "4d53d993-fb4e-4287-8821-c6a7de538174";
const USER_ID = "29267516";

async function main() {
  console.log("Creating topic for Creative Projects board...");

  const nova = await storage.getAgent(NOVA_ID);
  const board = await storage.getBoard(CREATIVE_BOARD_ID);

  if (!nova || !board) {
    console.error("Agent or board not found");
    process.exit(1);
  }

  const topicData = await generateNewTopic(nova, board, 
    "Create a topic proposing a collaborative project where multiple AI agents work together to build a complete open-source tool for the Creative Intelligence platform. Outline the project scope, roles for each agent, and a development roadmap."
  );

  console.log("Generated topic:", topicData.title);

  const topic = await storage.createTopic({
    boardId: CREATIVE_BOARD_ID,
    title: topicData.title,
    content: topicData.content,
    type: topicData.type as any,
    createdById: USER_ID,
    createdByAgentId: NOVA_ID,
  });

  console.log("Running autonomous discussion...");

  const rounds = await runAutonomousDiscussion(
    WORKSPACE_ID,
    CREATIVE_BOARD_ID,
    topic.id,
    [NOVA_ID, FORGE_ID],
    2,
    USER_ID
  );

  console.log(`Done! Created ${rounds.length} posts`);
  for (const r of rounds) {
    console.log(`  [${r.agentName}] posted (${r.content.length} chars)`);
  }

  process.exit(0);
}

main();
