/**
 * lb onboard - Output agent instructions
 */

import { Command } from "commander";
import { output } from "../utils/output.js";

// Instructions that should be added to AGENTS.md / CLAUDE.md
const AGENTS_MD_CONTENT = `## CRITICAL: Task Tracking with \`lb\`

> **STOP. READ THIS CAREFULLY.**
>
> **DO NOT use your built-in todo/task tracking tools for this repo.**
> **No todo lists, no task trackers, no scratchpads - ONLY \`lb\`.**
>
> Need to track subtasks or steps? Create subissues:
> \`\`\`bash
> lb create "Step 1: ..." --parent LIN-XXX
> lb create "Step 2: ..." --parent LIN-XXX
> \`\`\`
>
> \`lb\` IS your todo list. There is no other.

This repo uses \`lb\` for all task management. All tasks live in Linear.

### Issue Pipeline

Every issue flows through these statuses:

\`\`\`
needs_refinement → ai_ready → todo → in_progress → in_review → done
\`\`\`

| Status | Meaning |
|--------|---------|
| \`needs_refinement\` | Rough idea, needs implementation details |
| \`ai_ready\` | Refined with details, waiting for human review |
| \`todo\` | Approved and ready to work on (shown by \`lb ready\`) |
| \`in_progress\` | Actively being worked on |
| \`in_review\` | PR open, waiting for human review |
| \`done\` | Merged and complete |

### Two Paths Into the Pipeline

**Human writes a rough story:**
1. Human creates issue → status \`needs_refinement\`
2. Agent runs \`lb refine\` to find issues needing refinement
3. Agent runs \`lb refine ID\` to see the issue + refinement checklist
4. Agent adds implementation details, acceptance criteria, technical approach
5. Agent moves to \`ai_ready\`: \`lb update ID --status ai_ready\`
6. Human reviews, approves → moves to \`todo\`
7. Agent picks up from \`lb ready\` → normal coding flow

**Agent discovers a bug/issue while working:**
1. Agent creates issue with full context → goes straight to \`todo\`
   \`\`\`bash
   lb create "Found: race condition in auth" --discovered-from LIN-XXX -d "Details..."
   \`\`\`
2. Shows up in \`lb ready\` immediately for any agent to pick up

### Coding Workflow

1. \`lb sync\` → \`lb ready\` - Find unblocked \`todo\` work
2. \`lb update ID --status in_progress\` - Claim it
3. Create a worktree: \`git worktree add ../worktree-ID ID-short-desc\`
4. Code in the worktree, commit as you go
5. Open PR, then: \`lb update ID --status in_review\`
6. Human merges → \`lb close ID --reason "why"\`

**All coding happens in worktrees**, never directly on main.

### Dependencies & Blocking

\`lb\` tracks relationships between issues. \`lb ready\` only shows unblocked issues.

\`\`\`bash
# This issue blocks another
lb create "Must do first" --blocks LIN-123

# This issue is blocked by another
lb create "Depends on auth" --blocked-by LIN-100

# Found while working on another issue
lb create "Found: race condition" --discovered-from LIN-50 -d "Details..."

# General relation (doesn't block)
lb create "Related work" --related LIN-200

# Manage deps after creation
lb dep add LIN-A --blocks LIN-B
lb dep remove LIN-A LIN-B
lb dep tree LIN-A
\`\`\`

### Labels

Labels are arbitrary tags that flow through to Linear. They are **auto-created** if they don't already exist.

\`\`\`bash
lb create "Fix login bug" -l bug -l frontend
lb update LIN-XXX --label urgent
lb update LIN-XXX --unlabel frontend
lb list --label frontend
\`\`\`

### Planning Work (SUBISSUES, NOT BUILT-IN TODOS)

When you need to break down a task, **create subissues in lb**:

\`\`\`bash
lb create "Step 1: Do X" --parent LIN-XXX -d "Details..."
lb create "Step 2: Do Y" --parent LIN-XXX -d "Details..."
lb create "Step 3: Do Z" --parent LIN-XXX --blocked-by LIN-YYY
\`\`\`

### Key Commands

| Command | Purpose |
|---------|---------|
| \`lb sync\` | Sync with Linear |
| \`lb ready\` | Show unblocked \`todo\` issues |
| \`lb refine\` | List issues needing refinement |
| \`lb refine ID\` | Show issue + refinement checklist |
| \`lb blocked\` | Show blocked issues with blockers |
| \`lb show ID\` | Full issue details + relationships |
| \`lb create "Title" -d "..."\` | Create issue (defaults to \`todo\`) |
| \`lb create "Title" -l label\` | Create with label |
| \`lb create "Title" --parent ID\` | Create subtask |
| \`lb update ID --status in_progress\` | Claim work |
| \`lb update ID --status in_review\` | PR opened |
| \`lb update ID --status ai_ready\` | Refinement done |
| \`lb update ID --label name\` | Add label |
| \`lb update ID --unlabel name\` | Remove label |
| \`lb list --status todo\` | Filter by status |
| \`lb list --label name\` | Filter by label |
| \`lb close ID --reason "why"\` | Mark done |
| \`lb dep add ID --blocks OTHER\` | Add dependency |
| \`lb dep tree ID\` | Show dependency tree |

### Rules

1. **NEVER use built-in task/todo tools** - ONLY \`lb\`
   - Not for planning, not for tracking, not for anything
   - Your memory can be wiped - \`lb\` tickets are persistent
   - If you need subtasks: \`lb create "..." --parent LIN-XXX\`
   - There is NO exception to this rule
2. **Always \`lb sync\` then \`lb ready\`** before asking what to work on
3. **Always \`lb show\`** to read the full description before starting
4. **Always work in a worktree**, never directly on main
5. **Set \`in_review\` when opening a PR**, not \`done\`
6. **Link discovered work** with \`--discovered-from\`
7. **Include descriptions** with enough context for handoff
8. **Close with reasons** explaining what was done

### Critical for AI Agents: Memory is Ephemeral

**Your memory can be wiped at any time.** Offload everything to \`lb\` tickets:
- Design decisions, context, research findings
- Implementation notes and code snippets
- Blockers and dependencies
- "Where I left off" checkpoints

**\`lb\` is your persistent brain.** Your memory is cache, \`lb\` is database.
`;

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
