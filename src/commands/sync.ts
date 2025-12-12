/**
 * lb sync - Sync with Linear
 */

import { Command } from "commander";
import { fullSync } from "../utils/sync.js";
import { output } from "../utils/output.js";

export const syncCommand = new Command("sync")
  .description("Sync with Linear (push pending changes, pull latest)")
  .option("--team <team>", "Team key (overrides config)")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    try {
      const result = await fullSync(options.team);

      if (options.json) {
        output(JSON.stringify({
          pushed: result.pushed,
          pulled: result.pulled,
        }, null, 2));
      } else {
        if (result.pushed.success > 0 || result.pushed.failed > 0) {
          output(`Pushed: ${result.pushed.success} succeeded, ${result.pushed.failed} failed`);
        }
        output(`Pulled: ${result.pulled} issues`);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
