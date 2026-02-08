import { existsSync, renameSync } from "fs";
import { execSync } from "child_process";
import path from "path";

export async function migrateDevDataToProduction() {
  const dumpPath = path.resolve(process.cwd(), "server", "dev_data_dump.sql");

  if (!existsSync(dumpPath)) {
    return;
  }

  console.log("[Migration] Found data dump, running psql import...");

  try {
    const result = execSync(
      `psql "${process.env.DATABASE_URL}" -f "${dumpPath}" 2>&1 | tail -5`,
      { timeout: 120000, encoding: "utf-8" }
    );
    console.log("[Migration] psql output (last lines):", result.trim());

    renameSync(dumpPath, dumpPath + ".done");
    console.log("[Migration] Complete. Dump file renamed to .done");
  } catch (error: any) {
    console.error("[Migration] psql failed:", error.message?.slice(0, 500));
    try {
      renameSync(dumpPath, dumpPath + ".done");
    } catch {}
  }
}
