/**
 * lb ready - List unblocked issues ready to work on
 */

import { Command } from "commander";
import { ensureFresh } from "../utils/sync.js";
import { getCachedIssues, getDependencies, getBlockedIssueIds } from "../utils/database.js";
import { formatReadyJson, formatIssuesListHuman, output } from "../utils/output.js";
import { getViewer } from "../utils/linear.js";

export const readyCommand = new Command("ready")
  .description("List unblocked issues ready to work on")
  .option("-j, --json", "Output as JSON")
  .option("-a, --all", "Show all ready issues (not just mine)")
  .option("--sync", "Force sync before listing")
  .option("--team <team>", "Team key (overrides config)")
  .action(async (options) => {
    try {
      // Ensure cache is fresh
      await ensureFresh(options.team, options.sync);

      // Get issues from cache
      const allIssues = getCachedIssues();

      // Filter to open issues that are not blocked
      const blockedIds = getBlockedIssueIds();
      let readyIssues = allIssues.filter((i) => i.status === "open" && !blockedIds.has(i.id));

      // Filter by assignee unless --all
      if (!options.all) {
        const viewer = await getViewer();
        readyIssues = readyIssues.filter((i) => !i.assignee || i.assignee === viewer.email);
      }

      // Sort by priority, then updated_at
      readyIssues.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      // Output
      if (options.json) {
        output(formatReadyJson(readyIssues, getDependencies));
      } else {
        output(formatIssuesListHuman(readyIssues));
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
