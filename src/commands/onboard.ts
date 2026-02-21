/**
 * lb onboard - Set up auth and init for a repo.
 *
 * Agent instructions are handled by the opencode-lb plugin, which injects
 * them dynamically on every session start and after compaction. No more
 * static AGENTS.md content — the plugin is the single source of truth.
 */

import { Command } from "commander";
import { existsSync } from "fs";
import { dirname } from "path";
import { output } from "../utils/output.js";
import { getDbPath, getApiKey } from "../utils/config.js";

export const onboardCommand = new Command("onboard")
  .description("Set up lb auth and init for this repo")
  .option("--team <team>", "Team key (overrides config)")
  .action(async (options) => {
    try {
      // Step 1: Check auth
      let hasAuth = false;
      try {
        getApiKey();
        hasAuth = true;
      } catch {
        // No API key configured
      }

      if (!hasAuth) {
        output("No Linear API key found. Running `lb auth`...\n");
        const { execSync } = await import("child_process");
        execSync("lb auth", { stdio: "inherit" });
        output("");
      }

      // Step 2: Check init
      const dbPath = getDbPath();
      const lbDir = dirname(dbPath);

      if (!existsSync(lbDir)) {
        output("No .lb/ directory found. Running `lb init`...\n");
        const { execSync } = await import("child_process");
        const initCmd = options.team ? `lb init --team ${options.team}` : "lb init";
        execSync(initCmd, { stdio: "inherit" });
        output("");
      }

      if (hasAuth && existsSync(dirname(getDbPath()))) {
        output("lb is already set up. Run `lb sync` then `lb ready` to find work.");
      } else {
        output("lb setup complete. Run `lb sync` then `lb ready` to find work.");
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
