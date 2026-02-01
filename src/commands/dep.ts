/**
 * lb dep - Manage dependencies between issues
 */

import { Command } from "commander";
import { createRelation, deleteRelation, updateIssueParent } from "../utils/linear.js";
import {
  getDependencies,
  getCachedIssue,
  getDatabase,
  cacheDependency,
  deleteDependency,
  getDisplayId,
  resolveIssueId,
  isLocalId,
} from "../utils/database.js";
import { output, outputError } from "../utils/output.js";
import { queueOperation } from "../utils/spawn-worker.js";
import { isLocalOnly } from "../utils/config.js";
import type { Dependency } from "../types.js";

/**
 * Get all dependencies involving an issue (both directions)
 */
function getAllDependencies(issueId: string): { outgoing: Dependency[]; incoming: Dependency[] } {
  const db = getDatabase();
  const resolvedId = resolveIssueId(issueId);

  const outgoing = db
    .query("SELECT * FROM dependencies WHERE issue_id = ?")
    .all(resolvedId) as Dependency[];
  const incoming = db
    .query("SELECT * FROM dependencies WHERE depends_on_id = ?")
    .all(resolvedId) as Dependency[];

  return { outgoing, incoming };
}

/**
 * Print dependency tree recursively
 */
function printTree(
  issueId: string,
  prefix: string = "",
  isLast: boolean = true,
  visited: Set<string> = new Set()
): void {
  if (visited.has(issueId)) {
    output(`${prefix}${isLast ? "└── " : "├── "}${issueId} (circular)`);
    return;
  }
  visited.add(issueId);

  const issue = getCachedIssue(issueId);
  const title = issue?.title || "Unknown";
  const priority = issue?.priority ?? "?";
  const status = issue?.status || "unknown";

  // Check if this issue is ready (no open blockers)
  const { incoming } = getAllDependencies(issueId);
  const blockers = incoming.filter((d) => d.type === "blocks");
  const openBlockers = blockers.filter((d) => {
    const blockerIssue = getCachedIssue(d.issue_id);
    return blockerIssue && blockerIssue.status !== "closed";
  });
  const isReady = openBlockers.length === 0 && status !== "closed";
  const readyTag = isReady ? " [READY]" : "";

  if (prefix === "") {
    // Root node
    output(`${getDisplayId(issueId)}: ${title} [P${priority}] (${status})${readyTag}`);
  } else {
    output(
      `${prefix}${isLast ? "└── " : "├── "}${getDisplayId(issueId)}: ${title} [P${priority}] (${status})${readyTag}`
    );
  }

  // Get outgoing dependencies (things this issue depends on)
  const deps = getDependencies(issueId);
  const childPrefix = prefix + (isLast ? "    " : "│   ");

  deps.forEach((dep, index) => {
    const isLastDep = index === deps.length - 1;
    printTree(dep.depends_on_id, childPrefix, isLastDep, visited);
  });
}

// Main dep command
export const depCommand = new Command("dep").description("Manage dependencies between issues");

// lb dep add
const addCommand = new Command("add")
  .description("Add a dependency between issues")
  .argument("<issue>", "Issue ID")
  .option("--blocks <id>", "This issue blocks the specified issue")
  .option("--blocked-by <id>", "This issue is blocked by the specified issue")
  .option("--related <id>", "This issue is related to the specified issue")
  .option("--parent <id>", "Set parent issue (makes this a subtask)")
  .option("--sync", "Sync immediately (block on network)")
  .action(async (issueId: string, options) => {
    try {
      const resolvedIssueId = resolveIssueId(issueId);
      const hasOption = options.blocks || options.blockedBy || options.related || options.parent;
      if (!hasOption) {
        outputError("Must specify --blocks, --blocked-by, --related, or --parent");
        process.exit(1);
      }

      const localOnly = isLocalOnly();
      const now = new Date().toISOString();

      if (options.blocks) {
        const targetId = resolveIssueId(options.blocks);
        const dep: Dependency = {
          issue_id: resolvedIssueId,
          depends_on_id: targetId,
          type: "blocks",
          created_at: now,
          created_by: "local",
        };
        if (localOnly) {
          cacheDependency(dep);
        } else if (options.sync) {
          if (isLocalId(resolvedIssueId) || isLocalId(targetId)) {
            outputError("Dependency target not synced yet.");
            process.exit(1);
          }
          await createRelation(resolvedIssueId, targetId, "blocks");
        } else {
          cacheDependency(dep);
          queueOperation("create_relation", {
            issueId: resolvedIssueId,
            relatedIssueId: targetId,
            type: "blocks",
          }, resolvedIssueId);
        }
        output(`Added: ${getDisplayId(resolvedIssueId)} blocks ${getDisplayId(targetId)}`);
      }

      if (options.blockedBy) {
        // blocked-by is inverse: target blocks this issue
        const targetId = resolveIssueId(options.blockedBy);
        const dep: Dependency = {
          issue_id: targetId,
          depends_on_id: resolvedIssueId,
          type: "blocks",
          created_at: now,
          created_by: "local",
        };
        if (localOnly) {
          cacheDependency(dep);
        } else if (options.sync) {
          if (isLocalId(resolvedIssueId) || isLocalId(targetId)) {
            outputError("Dependency target not synced yet.");
            process.exit(1);
          }
          await createRelation(targetId, resolvedIssueId, "blocks");
        } else {
          cacheDependency(dep);
          queueOperation("create_relation", {
            issueId: targetId,
            relatedIssueId: resolvedIssueId,
            type: "blocks",
          }, targetId);
        }
        output(`Added: ${getDisplayId(resolvedIssueId)} is blocked by ${getDisplayId(targetId)}`);
      }

      if (options.related) {
        const targetId = resolveIssueId(options.related);
        const dep: Dependency = {
          issue_id: resolvedIssueId,
          depends_on_id: targetId,
          type: "related",
          created_at: now,
          created_by: "local",
        };
        if (localOnly) {
          cacheDependency(dep);
        } else if (options.sync) {
          if (isLocalId(resolvedIssueId) || isLocalId(targetId)) {
            outputError("Dependency target not synced yet.");
            process.exit(1);
          }
          await createRelation(resolvedIssueId, targetId, "related");
        } else {
          cacheDependency(dep);
          queueOperation("create_relation", {
            issueId: resolvedIssueId,
            relatedIssueId: targetId,
            type: "related",
          }, resolvedIssueId);
        }
        output(`Added: ${getDisplayId(resolvedIssueId)} related to ${getDisplayId(targetId)}`);
      }

      if (options.parent) {
        const parentId = resolveIssueId(options.parent);
        const dep: Dependency = {
          issue_id: resolvedIssueId,
          depends_on_id: parentId,
          type: "parent-child",
          created_at: now,
          created_by: "local",
        };
        if (localOnly) {
          cacheDependency(dep);
        } else if (options.sync) {
          if (isLocalId(resolvedIssueId) || isLocalId(parentId)) {
            outputError("Parent issue not synced yet.");
            process.exit(1);
          }
          await updateIssueParent(resolvedIssueId, parentId);
        } else {
          cacheDependency(dep);
          queueOperation("update", {
            issueId: resolvedIssueId,
            parentId: parentId,
          }, resolvedIssueId);
        }
        output(`Added: ${getDisplayId(resolvedIssueId)} parent is ${getDisplayId(parentId)}`);
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// lb dep remove
const removeCommand = new Command("remove")
  .description("Remove a dependency between issues")
  .argument("<issue-a>", "First issue ID")
  .argument("<issue-b>", "Second issue ID")
  .option("--sync", "Sync immediately (block on network)")
  .action(async (issueA: string, issueB: string, options) => {
    try {
      const resolvedA = resolveIssueId(issueA);
      const resolvedB = resolveIssueId(issueB);
      const localOnly = isLocalOnly();

      if (localOnly) {
        deleteDependency(resolvedA, resolvedB);
      } else if (options.sync) {
        if (isLocalId(resolvedA) || isLocalId(resolvedB)) {
          outputError("Dependency target not synced yet.");
          process.exit(1);
        }
        await deleteRelation(resolvedA, resolvedB);
      } else {
        deleteDependency(resolvedA, resolvedB);
        queueOperation("delete_relation", {
          issueA: resolvedA,
          issueB: resolvedB,
        }, resolvedA);
      }
      output(`Removed dependency between ${getDisplayId(resolvedA)} and ${getDisplayId(resolvedB)}`);
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// lb dep tree
const treeCommand = new Command("tree")
  .description("Show dependency tree for an issue")
  .argument("<issue>", "Issue ID")
  .action(async (issueId: string) => {
    try {
      const issue = getCachedIssue(issueId);
      if (!issue) {
        outputError(`Issue not found: ${issueId}`);
        process.exit(1);
      }

      output(`\n🌲 Dependency tree for ${issueId}:\n`);
      printTree(issueId);
      output("");
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

depCommand.addCommand(addCommand);
depCommand.addCommand(removeCommand);
depCommand.addCommand(treeCommand);
