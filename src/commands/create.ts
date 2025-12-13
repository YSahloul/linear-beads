/**
 * lb create - Create a new issue
 */

import { Command } from "commander";
import { queueOutboxItem } from "../utils/database.js";
import { createIssue, getTeamId } from "../utils/linear.js";
import { formatIssueJson, formatIssueHuman, output } from "../utils/output.js";
import { spawnWorkerIfNeeded } from "../utils/spawn-worker.js";
import type { IssueType, Priority } from "../types.js";

export const createCommand = new Command("create")
  .description("Create a new issue")
  .argument("<title>", "Issue title")
  .option("-d, --description <desc>", "Issue description")
  .option("-t, --type <type>", "Issue type (bug, feature, task, epic, chore)", "task")
  .option("-p, --priority <priority>", "Priority (0-4, 0 is highest)", "2")
  .option("--parent <id>", "Parent issue ID")
  .option("--deps <deps>", "Dependencies (comma-separated, e.g., 'discovered-from:TEAM-123')")
  .option("-j, --json", "Output as JSON")
  .option("--sync", "Sync immediately (block on network)")
  .option("--team <team>", "Team key (overrides config)")
  .action(async (title: string, options) => {
    try {
      const priority = parseInt(options.priority) as Priority;
      if (priority < 0 || priority > 4) {
        console.error("Priority must be 0-4");
        process.exit(1);
      }

      const validTypes = ["bug", "feature", "task", "epic", "chore"];
      if (!validTypes.includes(options.type)) {
        console.error(`Type must be one of: ${validTypes.join(", ")}`);
        process.exit(1);
      }

      const issueType = options.type as IssueType;

      if (options.sync) {
        // Sync mode: create directly in Linear
        const teamId = await getTeamId(options.team);
        const issue = await createIssue({
          title,
          description: options.description,
          priority,
          issueType,
          teamId,
          parentId: options.parent,
        });

        if (options.json) {
          output(formatIssueJson(issue));
        } else {
          output(formatIssueHuman(issue));
        }
      } else {
        // Queue mode: add to outbox and spawn background worker
        queueOutboxItem("create", {
          title,
          description: options.description,
          priority,
          issueType,
          parentId: options.parent,
        });

        // Spawn background worker if not already running
        spawnWorkerIfNeeded();

        // Return a placeholder response immediately
        const placeholder = {
          id: "pending",
          title,
          description: options.description,
          status: "open" as const,
          priority,
          issue_type: issueType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (options.json) {
          output(formatIssueJson(placeholder));
        } else {
          output(`Queued: ${title}`);
          output("Background sync started");
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
