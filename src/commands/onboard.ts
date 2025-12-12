/**
 * lb onboard - Output agent instructions
 */

import { Command } from "commander";
import { output } from "../utils/output.js";

const ONBOARD_CONTENT = `# lb (Linear-native Beads) Guide for AI Agents

This project uses **lb** for issue tracking - a Linear-backed CLI inspired by beads (bd).

## Quick Start

**Check for ready work:**
\`\`\`bash
lb ready --json
\`\`\`

**Create new issues:**
\`\`\`bash
lb create "Issue title" -t bug|feature|task|epic|chore -p 0-4 --json
lb create "Issue title" -p 1 --deps discovered-from:TEAM-123 --json
lb create "Subtask" --parent TEAM-123 --json
\`\`\`

**Claim and update:**
\`\`\`bash
lb update TEAM-42 --status in_progress --json
lb update TEAM-42 --priority 1 --json
\`\`\`

**Complete work:**
\`\`\`bash
lb close TEAM-42 --reason "Completed" --json
\`\`\`

## Key Differences from bd

- **Linear is source of truth** - issues live in Linear, not local JSONL
- **Explicit sync** - run \`lb sync\` to push/pull (no daemon)
- **Repo scoping** - uses \`repo:name\` label to filter issues per repo
- **IDs** - use Linear identifiers like \`TEAM-123\`

## Issue Types

- \`bug\` - Something broken
- \`feature\` - New functionality
- \`task\` - Work item (tests, docs, refactoring)
- \`epic\` - Large feature with subtasks
- \`chore\` - Maintenance (dependencies, tooling)

## Priorities

- \`0\` - Critical (security, data loss, broken builds)
- \`1\` - High (major features, important bugs)
- \`2\` - Medium (default, nice-to-have)
- \`3\` - Low (polish, optimization)
- \`4\` - Backlog (future ideas)

## Workflow for AI Agents

1. **Check ready work**: \`lb ready --json\` shows unblocked issues
2. **Claim your task**: \`lb update <id> --status in_progress --json\`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - \`lb create "Found bug" -p 1 --deps discovered-from:<parent-id> --json\`
5. **Complete**: \`lb close <id> --reason "Done" --json\`
6. **Sync**: \`lb sync\` (flushes changes to Linear)

## Commands

| Command | Description |
|---------|-------------|
| \`lb list\` | List all issues |
| \`lb ready\` | List unblocked issues |
| \`lb show <id>\` | Show issue details |
| \`lb create\` | Create new issue |
| \`lb update <id>\` | Update issue |
| \`lb close <id>\` | Close issue |
| \`lb sync\` | Push/pull with Linear |

## Important Rules

- Always use \`--json\` flag for programmatic use
- Link discovered work with \`--deps discovered-from:<id>\`
- Check \`lb ready\` before asking "what should I work on?"
- Run \`lb sync\` to persist changes to Linear
- Do NOT use markdown TODO lists - use lb!
`;

export const onboardCommand = new Command("onboard")
  .description("Output agent instructions for lb")
  .option("-o, --output <file>", "Write to file instead of stdout")
  .action(async (options) => {
    if (options.output) {
      const { writeFileSync } = await import("fs");
      writeFileSync(options.output, ONBOARD_CONTENT);
      output(`Written to ${options.output}`);
    } else {
      output(ONBOARD_CONTENT);
    }
  });
