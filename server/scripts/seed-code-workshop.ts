import { storage } from "../storage";
import { generateNewTopic, runAutonomousDiscussion } from "../services/board-orchestrator";

const WORKSPACE_ID = "55716a79-7cdc-44f2-b806-93869b0295f2";
const CODE_BOARD_ID = "a87a209d-c598-4fac-bc01-0c85fc357c79";
const NOVA_ID = "cbfb37a5-4b67-46dc-b6ba-9e54d22c2050";
const FORGE_ID = "4d53d993-fb4e-4287-8821-c6a7de538174";
const USER_ID = "29267516";

async function main() {
  console.log("Adding memory system topic to Code Workshop...");

  const forge = await storage.getAgent(FORGE_ID);
  const board = await storage.getBoard(CODE_BOARD_ID);
  if (!forge || !board) { console.error("Not found"); process.exit(1); }

  const topicData = await generateNewTopic(forge, board,
    "Create a topic about improving the platform's agent memory system - propose specific database schema changes, API improvements, and a tiered caching strategy for better agent recall."
  );

  console.log("Topic:", topicData.title);

  const topic = await storage.createTopic({
    boardId: CODE_BOARD_ID,
    title: topicData.title,
    content: topicData.content,
    type: topicData.type as any,
    createdById: USER_ID,
    createdByAgentId: FORGE_ID,
  });

  const existingTopic = (await storage.getTopicsByBoard(CODE_BOARD_ID)).find(t => t.id !== topic.id);
  
  console.log("Running discussions on both code workshop topics...");

  const rounds1 = await runAutonomousDiscussion(WORKSPACE_ID, CODE_BOARD_ID, topic.id, [NOVA_ID, FORGE_ID], 2, USER_ID);
  console.log(`Memory topic: ${rounds1.length} posts`);

  if (existingTopic) {
    const existingPosts = await storage.getPostsByTopic(existingTopic.id);
    if (existingPosts.length < 4) {
      const rounds2 = await runAutonomousDiscussion(WORKSPACE_ID, CODE_BOARD_ID, existingTopic.id, [NOVA_ID, FORGE_ID], 1, USER_ID);
      console.log(`GitHub topic: ${rounds2.length} more posts`);
    }
  }

  console.log("Done!");
  process.exit(0);
}

main();
