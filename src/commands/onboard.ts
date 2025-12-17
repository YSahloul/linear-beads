/**
 * lb onboard - Output agent instructions
 */

import { Command } from "commander";
import { output } from "../utils/output.js";

// Instructions that should be added to AGENTS.md
const AGENTS_MD_CONTENT = `## CRITICAL: Task Tracking with \`lb\`

**DO NOT use built-in todo/task tracking tools. Use \`lb\` instead.**

This repo uses \`lb\` for issue tracking. All tasks live in Linear. The \`lb\` CLI is your todo list - not your built-in task tools.

### First Time Setup

If \`lb\` hasn't been initialized in this repo:
\`\`\`bash
lb init          # Initialize lb
lb onboard       # Get instructions for AGENTS.md setup
\`\`\`

Add \`.lb\` and \`AGENTS.md\` to \`.git/info/exclude\` (NOT .gitignore - these are local-only).

### Before Starting ANY Work

\`\`\`bash
lb sync                    # Pull latest from Linear
lb ready                   # See unblocked work
lb show LIN-XXX            # Read full description before starting
lb update LIN-XXX --status in_progress   # Claim it
\`\`\`

### Planning Work

When you need to break down a task into steps, **create subtasks in lb**, not mental notes or TodoWrite:

\`\`\`bash
# Break down a task into subtasks
lb create "Step 1: Do X" --parent LIN-XXX -d "Details..."
lb create "Step 2: Do Y" --parent LIN-XXX -d "Details..."
lb create "Step 3: Do Z" --parent LIN-XXX -d "Details..."
\`\`\`

### During Work

\`\`\`bash
# Found something that needs doing? Create an issue, don't just remember it
lb create "Found: need to fix X" --parent LIN-XXX -d "Context..."

# Discovered a blocker or dependency?
lb update LIN-AAA --deps blocks:LIN-BBB   # AAA blocks BBB
\`\`\`

### Completing Work

\`\`\`bash
lb close LIN-XXX --reason "Brief summary of what was done"
\`\`\`

### Creating Good Issues

Always include \`-d "description"\` with:
- What needs to be done and WHY
- Relevant file paths or code references  
- Any constraints or acceptance criteria
- Enough context for another agent to pick it up

\`\`\`bash
# Good
lb create "Fix race condition in model refresh" -d "chatModels.refresh() can be called multiple times concurrently causing state corruption. Add mutex. See src/lib/stores/stores/llmProvider.ts:297"

# Bad
lb create "Fix bug"
\`\`\`

### Issue Types

\`\`\`bash
lb create "Title" -t task     # Default - general work
lb create "Title" -t bug      # Bug fix
lb create "Title" -t feature  # New feature
lb create "Title" -t epic     # Large initiative with subtasks
lb create "Title" -t chore    # Maintenance/cleanup
\`\`\`

### Key Commands Reference

| Command | Purpose |
|---------|---------|
| \`lb sync\` | Sync with Linear |
| \`lb ready\` | Show unblocked issues you can work on |
| \`lb list\` | Show all issues |
| \`lb show LIN-XXX\` | Full issue details |
| \`lb update LIN-XXX --status in_progress\` | Claim work |
| \`lb update LIN-XXX --status open\` | Unclaim/pause work |
| \`lb close LIN-XXX --reason "why"\` | Complete work |
| \`lb create "Title" --parent LIN-XXX -d "..."\` | Create subtask |
| \`lb update LIN-XXX --deps blocks:LIN-YYY\` | Add dependency |

### Rules

1. **NEVER use built-in task tools** - use \`lb create\` for subtasks instead
2. **Always \`lb sync\` and \`lb ready\`** before asking what to work on
3. **Always \`lb show\`** to read the full description before starting
4. **Always \`lb update --status in_progress\`** before starting work
5. **Create subtasks in lb** when breaking down work, not mental notes
6. **Always include descriptions** with context for handoff
7. **Close issues with reasons** explaining what was done`;

const ONBOARD_CONTENT = `# lb Onboard

This repo uses \`lb\` for Linear-backed issue tracking.

## Your Task

**Add the following to this repo's AGENTS.md file** (create it if it doesn't exist).
This ensures all future agents know to use \`lb\`:

---

${AGENTS_MD_CONTENT}

---

## Git Workflow

Commit atomically as you work (one logical change per commit) unless told otherwise.

Don't commit AGENTS.md or .lb - they're in .git/info/exclude for a reason.

---

After adding the above to AGENTS.md, run \`lb sync\` then \`lb ready\` to find work.
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
