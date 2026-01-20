/**
 * lb onboard - Output agent instructions
 */

import { Command } from "commander";
import { output } from "../utils/output.js";

// Instructions that should be added to AGENTS.md
const AGENTS_MD_CONTENT = `## CRITICAL: Task Tracking with \`lb\`

> **STOP. READ THIS CAREFULLY.**
>
> **DO NOT use TodoWrite, TodoRead, or ANY built-in todo/task tracking tools.**
> **NEVER. Not even "just this once." Not even for "quick notes."**
>
> If you need to track subtasks or intermediate steps, create \`lb\` subissues:
> \`\`\`bash
> lb create "Step 1: ..." --parent LIN-XXX
> lb create "Step 2: ..." --parent LIN-XXX
> \`\`\`
>
> Your built-in todo tools are DISABLED for this repo. Use \`lb\` or nothing.

This repo uses \`lb\` for issue tracking. All tasks live in Linear. The \`lb\` CLI is your todo list.

### Quick Start

\`\`\`bash
lb sync                    # Pull latest from Linear
lb ready                   # See unblocked work (issues with no blockers)
lb show LIN-XXX            # Read full description before starting
lb update LIN-XXX --status in_progress   # Claim it
\`\`\`

### Dependencies & Blocking

\`lb\` tracks relationships between issues. \`lb ready\` only shows unblocked issues.

\`\`\`bash
# This issue blocks another (other can't start until this is done)
lb create "Must do first" --blocks LIN-123

# This issue is blocked by another (can't start until other is done)
lb create "Depends on auth" --blocked-by LIN-100

# Found a bug while working on LIN-50? Link it
lb create "Found: race condition" --discovered-from LIN-50 -d "Details..."

# General relation (doesn't block)
lb create "Related work" --related LIN-200

# Manage deps after creation
lb dep add LIN-A --blocks LIN-B
lb dep remove LIN-A LIN-B
lb dep tree LIN-A          # Visualize dependency tree
\`\`\`

**Dependency types:**
- \`--blocks ID\` - This issue must finish before ID can start
- \`--blocked-by ID\` - This issue can't start until ID finishes
- \`--related ID\` - Soft link, doesn't block progress
- \`--discovered-from ID\` - Found while working on ID (creates relation)

### Planning Work (USE THIS INSTEAD OF BUILT-IN TODOS)

When you need to break down a task into steps, **create subissues in lb** - NOT built-in todos:

\`\`\`bash
# WRONG: Using built-in todos (DON'T DO THIS)
# TodoWrite([{content: "Step 1", status: "pending"}, ...])

# RIGHT: Create lb subissues
lb create "Step 1: Do X" --parent LIN-XXX -d "Details..."
lb create "Step 2: Do Y" --parent LIN-XXX -d "Details..."
lb create "Step 3: Do Z" --parent LIN-XXX --blocked-by LIN-YYY  # If order matters
\`\`\`

This keeps all work visible in Linear and preserves context across sessions.

### Workflow

1. \`lb ready\` - Find unblocked work
2. \`lb update ID --status in_progress\` - Claim it
3. Work on it
4. Found new issue? \`lb create "Found: X" --discovered-from ID\`
5. \`lb close ID --reason "Done"\`

### Viewing Issues

\`\`\`bash
lb list                    # All issues
lb list --status open      # Filter by status
lb ready                   # Unblocked issues ready to work
lb blocked                 # Blocked issues (shows what's blocking them)
lb show LIN-XXX            # Full details with all relationships
\`\`\`

### Key Commands

| Command | Purpose |
|---------|---------|
| \`lb sync\` | Sync with Linear |
| \`lb ready\` | Show unblocked issues |
| \`lb blocked\` | Show blocked issues with blockers |
| \`lb show ID\` | Full issue details + relationships |
| \`lb create "Title" -d "..."\` | Create issue |
| \`lb create "Title" --parent ID\` | Create subtask |
| \`lb create "Title" --blocked-by ID\` | Create blocked issue |
| \`lb update ID --status in_progress\` | Claim work |
| \`lb close ID --reason "why"\` | Complete work |
| \`lb dep add ID --blocks OTHER\` | Add blocking dependency |
| \`lb dep tree ID\` | Show dependency tree |

### Rules

1. **NEVER use built-in task/todo tools (TodoWrite, TodoRead, etc.)** 
   - Not for planning, not for tracking, not for anything
   - If you need subtasks: \`lb create "..." --parent LIN-XXX\`
   - If you need to track steps: create subissues
   - There is NO exception to this rule
2. **Always \`lb sync\` then \`lb ready\`** before asking what to work on
3. **Always \`lb show\`** to read the full description before starting
4. **Link discovered work** with \`--discovered-from\` to maintain context graph
5. **Include descriptions** with enough context for handoff
6. **Close with reasons** explaining what was done

### Why No Built-in Todos?

- Built-in todos disappear between sessions
- Other agents/humans can't see them
- Work gets lost or duplicated
- Linear is the single source of truth

When you use \`lb\` subissues instead:
- Work persists across sessions
- Other agents can pick up where you left off
- Progress is visible to humans in Linear
- Dependencies are tracked properly`;

const ONBOARD_CONTENT = `# lb Onboard

This repo uses \`lb\` for Linear-backed issue tracking.

## Your Task

Add the following to your agent instruction file:
- **Claude Code**: CLAUDE.md
- **Other tools** (OpenCode, Cursor, etc.): AGENTS.md

Append to the file if it exists, create it if it doesn't.

---

${AGENTS_MD_CONTENT}

---

After adding the above, run \`lb sync\` then \`lb ready\` to find work.
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
