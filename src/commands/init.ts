/**
 * lb init - Initialize lb in current repository
 *
 * Creates .lb/ directory, generates .lb/config.jsonc with detected
 * team/repo settings, ensures Linear scoping (project or label),
 * and performs initial sync.
 */

import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import {
  getDbPath,
  getApiKey,
  getRepoLabel,
  getRepoName,
  getRepoScope,
  getRepoConfigPath,
  useLabelScope,
  useProjectScope,
  type RepoScopeMode,
} from "../utils/config.js";
import { getTeamId, ensureRepoLabel, ensureRepoProject } from "../utils/linear.js";
import { fullSync } from "../utils/sync.js";
import { output } from "../utils/output.js";

export const initCommand = new Command("init")
  .description("Initialize lb in current repository")
  .option("--force", "Re-initialize even if .lb/ already exists")
  .option(
    "--scope <mode>",
    "How to scope issues to this repo: project (recommended), label, or both",
    "project"
  )
  .action(async (options) => {
    try {
      output("Initializing lb in current directory...\n");

      // Check if already initialized
      const dbPath = getDbPath();
      const lbDir = dirname(dbPath);

      if (existsSync(lbDir) && !options.force) {
        output("✓ Already initialized (.lb/ exists)");
        output("\nUse --force to re-initialize");
        return;
      }

      // Validate scope option
      const validScopes: RepoScopeMode[] = ["label", "project", "both"];
      const scope: RepoScopeMode = validScopes.includes(options.scope) ? options.scope : "project";

      // Verify API key
      try {
        getApiKey();
        output("✓ Linear API key found");
      } catch (error) {
        output("✗ No Linear API key configured");
        output("\nRun 'lb auth' first to configure your API key");
        output("Or set LINEAR_API_KEY environment variable");
        process.exit(1);
      }

      // Get/detect team
      const teamId = await getTeamId();
      const team = await getTeamInfo(teamId);
      output(`✓ Team: ${team.name} (${team.key})`);

      // Get repo name (auto-detected from git remote or directory name)
      const repoName = getRepoName() || "unknown";

      // Create .lb/ directory
      if (!existsSync(lbDir)) {
        mkdirSync(lbDir, { recursive: true });
      }

      // Generate .lb/config.jsonc if it doesn't exist (or --force)
      const configPath = getRepoConfigPath();
      if (!existsSync(configPath) || options.force) {
        const configContent = [
          "{",
          `  // Linear team key`,
          `  "team_key": "${team.key}",`,
          "",
          `  // Repo name (detected from git remote)`,
          `  "repo_name": "${repoName}",`,
          "",
          `  // How issues are scoped to this repo in Linear`,
          `  // "project" = uses a Linear Project named "${repoName}" (recommended)`,
          `  // "label" = uses a repo:${repoName} label`,
          `  // "both" = uses both project and label`,
          `  "repo_scope": "${scope}"`,
          "}",
          "",
        ].join("\n");

        writeFileSync(configPath, configContent, "utf-8");
        output(`✓ Config: ${configPath}`);
      } else {
        output(`✓ Config exists: ${configPath} (kept)`);
      }

      // Ensure repo scoping in Linear based on chosen mode
      output(`✓ Repo scoping: ${scope}`);

      if (scope === "label" || scope === "both") {
        const repoLabel = getRepoLabel();
        await ensureRepoLabel(teamId);
        output(`✓ Repo label: ${repoLabel}`);
      }

      if (scope === "project" || scope === "both") {
        await ensureRepoProject(teamId);
        output(`✓ Repo project: ${repoName}`);
      }

      // Initial sync
      const result = await fullSync();
      output(`✓ Synced ${result.pulled} issues`);
      output("✓ Exported to .lb/issues.jsonl");

      // Success!
      output("\nlb initialized!");
      output(`\n  Team:    ${team.name} (${team.key})`);
      output(`  Repo:    ${repoName}`);
      output(`  Scoping: ${scope}`);
      output("");
      output("Recommended .gitignore entries:");
      output("");
      output("  .lb/cache.db");
      output("  .lb/cache.db-shm");
      output("  .lb/cache.db-wal");
      output("  .lb/issues.jsonl");
      output("");
      output("Do NOT gitignore .lb/config.jsonc — it should be tracked.");
      output("");
      output("Add this to your AGENTS.md or CLAUDE.md:");
      output("");
      output("  This project uses lb for issue tracking.");
      output("  Run `lb onboard` and follow the instructions.");
      output("");
      output("Then your agent will set up the rest.");
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Get team info for display
 */
async function getTeamInfo(teamId: string): Promise<{ name: string; key: string }> {
  const { getGraphQLClient } = await import("../utils/graphql.js");
  const client = getGraphQLClient();

  const query = `
    query GetTeam($id: String!) {
      team(id: $id) {
        id
        key
        name
      }
    }
  `;

  const result = await client.request<{
    team: { id: string; key: string; name: string };
  }>(query, { id: teamId });

  return result.team;
}
