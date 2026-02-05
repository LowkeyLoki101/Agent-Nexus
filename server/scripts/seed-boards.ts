import { seedAndStartDiscussions } from "../services/board-orchestrator";

const WORKSPACE_ID = "55716a79-7cdc-44f2-b806-93869b0295f2";
const NOVA_ID = "cbfb37a5-4b67-46dc-b6ba-9e54d22c2050";
const FORGE_ID = "4d53d993-fb4e-4287-8821-c6a7de538174";
const USER_ID = "29267516";

async function main() {
  console.log("Starting board seeding with Nova and Forge...");
  console.log("This will create boards, topics, and autonomous AI discussions.");
  console.log("Using OpenAI API to generate real agent posts...\n");

  try {
    const results = await seedAndStartDiscussions(
      WORKSPACE_ID,
      [NOVA_ID, FORGE_ID],
      USER_ID
    );

    console.log("\nSeeding complete!");
    console.log(`Created ${results.boards.length} boards`);
    console.log(`Created ${results.topics.length} topics`);
    console.log(`Generated ${results.rounds.length} autonomous posts`);

    for (const round of results.rounds) {
      console.log(`  [${round.agentName}] posted in topic ${round.topicId.slice(0, 8)}...`);
    }

    process.exit(0);
  } catch (error: any) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
}

main();
