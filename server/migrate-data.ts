import { existsSync, renameSync, readFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";

export async function migrateDevDataToProduction() {
  const dumpPath = path.resolve(process.cwd(), "server", "dev_data_dump.sql");

  if (!existsSync(dumpPath)) {
    return;
  }

  console.log("[Migration] Found data dump, starting import...");

  try {
    execSync("which psql", { encoding: "utf-8" });
  } catch {
    console.error("[Migration] psql not available, cannot run migration. File preserved for retry.");
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("[Migration] DATABASE_URL not set, cannot run migration. File preserved for retry.");
    return;
  }

  try {
    const output = execSync(
      `psql "${process.env.DATABASE_URL}" -f "${dumpPath}" 2>&1`,
      { timeout: 180000, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
    );

    const lines = output.trim().split("\n");
    const insertedCount = lines.filter(l => l.match(/INSERT 0 [1-9]/)).length;
    const skippedCount = lines.filter(l => l === "INSERT 0 0").length;
    const errorLines = lines.filter(l => l.toLowerCase().includes("error"));

    console.log(`[Migration] Complete: ${insertedCount} new rows inserted, ${skippedCount} already existed, ${errorLines.length} errors`);

    if (errorLines.length > 0 && errorLines.length <= 10) {
      errorLines.forEach(e => console.error(`[Migration] ${e}`));
    } else if (errorLines.length > 10) {
      console.error(`[Migration] First 5 errors:`);
      errorLines.slice(0, 5).forEach(e => console.error(`[Migration] ${e}`));
    }

    renameSync(dumpPath, dumpPath + ".done");
    console.log("[Migration] Dump file renamed to .done (migration successful)");
  } catch (error: any) {
    console.error("[Migration] psql execution failed. File preserved for retry on next startup.");
    console.error("[Migration] Error:", error.message?.slice(0, 500));
  }
}
