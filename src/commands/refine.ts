/**
 * lb refine - Refine rough issues into implementable specs
 *
 * Lists issues with status "todo_needs_refinement", or refines a specific issue
 * by outputting a refinement prompt that guides an agent to add
 * implementation details and acceptance criteria.
 */

import { Command } from "commander";
import { ensureFresh } from "../utils/sync.js";
import {
  getCachedIssues,
  getCachedIssue,
  getDependencies,
  getBlockedIssueIds,
  getDisplayId,
  resolveIssueId,
} from "../utils/database.js";
import { formatIssueHuman, output, outputError } from "../utils/output.js";
import { isLocalOnly } from "../utils/config.js";

const REFINEMENT_PROMPT = `
## Refinement Checklist

Read the issue above carefully. Your job is to turn this rough idea into an implementable spec by updating the issue description.

Add the following sections to the description (use \`lb update <ID> -d "..."\`):

### 1. Context
- Why does this matter? What problem does it solve?
- What's the current behavior vs desired behavior?

### 2. Technical Approach
- Which files/modules need to change?
- What's the implementation strategy?
- Are there any architectural decisions to call out?

### 3. Acceptance Criteria
- Concrete, testable conditions that define "done"
- Edge cases to handle
- What should NOT change (regression guardrails)

### 4. Dependencies & Risks
- Does this depend on other work? (use \`lb dep add\` if so)
- Are there risks or unknowns? Flag them.
- Estimated complexity: small / medium / large

### 5. Subtasks (if needed)
- Break into subtasks with \`lb create "Step: ..." --parent <ID>\`
- Each subtask should be independently completable

When you're done refining, move the issue forward:
\`\`\`bash
lb update <ID> --status todo_refined
\`\`\`

This marks the issue as refined and ready to be picked up.
`;

export const refineCommand = new Command("refine")
  .description("Refine rough issues into implementable specs")
  .argument("[id]", "Issue ID to refine (omit to list all todo_needs_refinement issues)")
  .option("-j, --json", "Output as JSON")
  .option("--sync", "Force sync before listing")
  .option("--team <team>", "Team key (overrides config)")
  .action(async (id: string | undefined, options) => {
    try {
      const localOnly = isLocalOnly();

      if (!localOnly) {
        try {
          await ensureFresh(options.team, options.sync);
        } catch {
          // Continue with stale cache
        }
      }

      if (id) {
        // Refine a specific issue
        const resolvedId = resolveIssueId(id);
        const issue = getCachedIssue(resolvedId);

        if (!issue) {
          outputError(`Issue not found: ${id}`);
          process.exit(1);
        }

        if (issue.status !== "todo_needs_refinement") {
          outputError(
            `Issue ${getDisplayId(issue.id)} is "${issue.status}", not "todo_needs_refinement". ` +
              `Only todo_needs_refinement issues should be refined.`
          );
          process.exit(1);
        }

        // Show the issue details
        output(formatIssueHuman(issue, getDisplayId(issue.id)));

        // Show relationships
        const deps = getDependencies(issue.id);
        const parentDep = deps.find((d) => d.type === "parent-child");
        if (parentDep) {
          const parent = getCachedIssue(parentDep.depends_on_id);
          output(
            `\nParent: ${getDisplayId(parentDep.depends_on_id)}${parent ? `: ${parent.title}` : ""}`
          );
        }

        // Output the refinement prompt
        output(REFINEMENT_PROMPT.replace(/<ID>/g, getDisplayId(issue.id)));
      } else {
        // List all todo_needs_refinement issues
        const allIssues = getCachedIssues();
        const blockedIds = getBlockedIssueIds();
        const refinementIssues = allIssues.filter(
          (i) => i.status === "todo_needs_refinement" && !blockedIds.has(i.id)
        );

        // Sort by priority, then updated_at
        refinementIssues.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

        if (options.json) {
          output(JSON.stringify(refinementIssues, null, 2));
        } else {
          if (refinementIssues.length === 0) {
            output("No issues need refinement.");
            return;
          }

          output(`\n🔍 Issues needing refinement (${refinementIssues.length}):\n`);

          refinementIssues.forEach((issue, index) => {
            const deps = getDependencies(issue.id);
            const parentDep = deps.find((d) => d.type === "parent-child");
            const parentInfo = parentDep ? ` (↳ ${getDisplayId(parentDep.depends_on_id)})` : "";
            const labelInfo = issue.labels?.length ? ` [${issue.labels.join(", ")}]` : "";

            output(
              `${index + 1}. [P${issue.priority}] ${getDisplayId(issue.id)}: ${issue.title}${parentInfo}${labelInfo}`
            );
          });

          output(`\nRun \`lb refine <ID>\` to start refining a specific issue.\n`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
