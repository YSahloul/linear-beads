# linear-beads (lb)

[Linear](https://linear.app/)-backed issue tracking for AI agents. Inspired by [beads](https://github.com/steveyegge/beads).

`lb` gives you beads-style issue tracking with Linear as the backend. Your issues live in Linear where you can see them, but agents interact through a fast CLI with JSON output, background sync, and dependency tracking. Backward-compatible interop (import/export) with [beads](https://github.com/steveyegge/beads) issues.jsonl.

## Quickstart

Tell your agent:

> Run `lb onboard`

That's it. The agent will walk you through setup (install, auth, etc.) and configure itself to use `lb` for task tracking.

## Install

```bash
bun install -g github:YSahloul/linear-beads
```

## Issue Pipeline

Every issue flows through 6 statuses:

```
needs_refinement → ai_ready → todo → in_progress → in_review → done
```

| Status             | Meaning                                        |
| ------------------ | ---------------------------------------------- |
| `needs_refinement` | Rough idea, needs implementation details       |
| `ai_ready`         | Refined with details, waiting for human review |
| `todo`             | Approved and ready to work on (`lb ready`)     |
| `in_progress`      | Actively being worked on                       |
| `in_review`        | PR open, waiting for human review              |
| `done`             | Merged and complete                            |

These map directly to Linear workflow states with the same names.

## Two Paths Into the Pipeline

### Path 1: Human writes a rough story

1. Human creates issue in Linear or via `lb create` → status `needs_refinement`
2. Agent runs `lb refine` to find issues needing refinement
3. Agent runs `lb refine <ID>` to see the issue + a structured refinement checklist
4. Agent adds implementation details, acceptance criteria, technical approach
5. Agent moves to `ai_ready`: `lb update <ID> --status ai_ready`
6. Human reviews, approves → moves to `todo`
7. Agent picks up from `lb ready` → normal coding flow

### Path 2: Agent discovers a bug while working

1. Agent creates issue with full context → goes straight to `todo`
   ```bash
   lb create "Found: race condition in auth" --discovered-from TEAM-123 -d "Details..."
   ```
2. Shows up in `lb ready` immediately for any agent to pick up

## Coding Workflow

```bash
lb sync                                           # Refresh from Linear
lb ready                                          # Find unblocked todo work
lb update TEAM-123 --status in_progress           # Claim it
git worktree add ../worktree-123 TEAM-123-desc    # Create worktree
# ... code in the worktree, commit as you go ...
gh pr create                                      # Open PR
lb update TEAM-123 --status in_review             # Signal PR is ready
# Human merges
lb close TEAM-123 --reason "Implemented feature"  # Mark done
```

All coding happens in worktrees, never directly on main.

## Commands

### Core workflow

| Command          | Purpose                            |
| ---------------- | ---------------------------------- |
| `lb sync`        | Sync with Linear                   |
| `lb ready`       | Show unblocked `todo` issues       |
| `lb refine`      | List issues needing refinement     |
| `lb refine <ID>` | Show issue + refinement checklist  |
| `lb blocked`     | Show blocked issues with blockers  |
| `lb show <ID>`   | Full issue details + relationships |

### Issue operations

| Command                               | Purpose                           |
| ------------------------------------- | --------------------------------- |
| `lb create "Title" -d "..."`          | Create issue (defaults to `todo`) |
| `lb create "Title" -l label`          | Create with label                 |
| `lb create "Title" --parent <ID>`     | Create subtask                    |
| `lb update <ID> --status in_progress` | Claim work                        |
| `lb update <ID> --status ai_ready`    | Refinement done                   |
| `lb update <ID> --status in_review`   | PR opened                         |
| `lb update <ID> --label name`         | Add label                         |
| `lb update <ID> --unlabel name`       | Remove label                      |
| `lb close <ID> --reason "why"`        | Mark done                         |
| `lb list --status todo`               | Filter by status                  |
| `lb list --label name`                | Filter by label                   |

### Dependencies

| Command                                  | Purpose                        |
| ---------------------------------------- | ------------------------------ |
| `lb create "..." --blocks <ID>`          | This blocks another issue      |
| `lb create "..." --blocked-by <ID>`      | This is blocked by another     |
| `lb create "..." --discovered-from <ID>` | Found while working on another |
| `lb dep add <A> --blocks <B>`            | Add dependency after creation  |
| `lb dep remove <A> <B>`                  | Remove dependency              |
| `lb dep tree <ID>`                       | Show dependency tree           |

### Setup

| Command      | Purpose                                           |
| ------------ | ------------------------------------------------- |
| `lb onboard` | Output agent instructions for CLAUDE.md/AGENTS.md |
| `lb auth`    | Authenticate with Linear API                      |
| `lb init`    | Initialize `.lb/` directory and sync              |
| `lb whoami`  | Verify connection                                 |

## Labels

Labels are arbitrary tags that flow through to Linear. They are auto-created in Linear if they don't already exist.

```bash
lb create "Fix login bug" -l bug -l frontend
lb update TEAM-123 --label urgent
lb update TEAM-123 --unlabel frontend
lb list --label frontend                    # Filter by label (AND logic)
```

Configure default labels applied to all new issues in `.lb/config.jsonc`:

```jsonc
{
  "default_labels": ["my-project"],
}
```

## Repo Scoping (Label vs Project)

By default, `lb` uses Linear labels to scope issues to a repository (e.g., `repo:my-project`). You can also use Linear Projects for scoping, or both.

Add to `.lb/config.jsonc`:

```jsonc
{
  "repo_scope": "label", // "label" (default), "project", or "both"
}
```

| Mode      | Description                                            |
| --------- | ------------------------------------------------------ |
| `label`   | Uses `repo:name` labels (default, backward compatible) |
| `project` | Uses Linear Projects - one project per repo            |
| `both`    | Uses both labels and projects                          |

### Migrating from Labels to Projects

```bash
lb migrate to-project --dry-run   # Preview changes
lb migrate to-project             # Migrate (keeps labels)
lb migrate to-project --remove-label  # Migrate and remove repo label
```

## Offline & Local-Only Modes

`lb` works offline and can run entirely without Linear.

### Offline Mode

When you lose internet connectivity, `lb` continues working:

- All reads work from local SQLite cache
- Writes queue in an outbox and sync when you're back online
- `lb sync` shows a friendly message instead of failing

### Local-Only Mode

For pure local usage (no Linear backend), add to `.lb/config.jsonc`:

```jsonc
{
  "local_only": true,
}
```

In local-only mode:

- `lb sync` is disabled
- `lb create` generates LOCAL-001, LOCAL-002, etc. IDs
- All commands work from local SQLite only
- Great for AI-only workflows or trying out lb without Linear

## Architecture

`lb` uses a local-first architecture:

- **SQLite** for fast local reads and the outbox queue
- **Background sync worker** pushes queued writes to Linear via GraphQL
- **JSONL export** for git-tracked issue snapshots (compatible with beads)
- All reads are instant (local cache), writes are async (outbox → Linear)

## License

MIT
