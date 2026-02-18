# lb-cli

This repo uses **lb** for all planning and task tracking.

## CRITICAL: Task Tracking with `lb`

**DO NOT use the TodoWrite/TodoRead tools. NEVER. Use `lb` instead.**

### Before Starting ANY Work

```bash
lb sync                    # Pull latest from Linear
lb ready                   # See unblocked work
lb show LIN-XXX            # Read full description before starting
lb update LIN-XXX --status in_progress   # Claim it
```

### Planning Work

When you need to break down a task into steps, **create subtasks in lb**, not mental notes or TodoWrite:

```bash
lb create "Step 1: Do X" --parent LIN-XXX -d "Details..."
lb create "Step 2: Do Y" --parent LIN-XXX -d "Details..."
```

### During Work

```bash
# Found something that needs doing? Create an issue
lb create "Found: need to fix X" --parent LIN-XXX -d "Context..."

# Discovered a blocker or dependency?
lb update LIN-AAA --deps blocks:LIN-BBB   # AAA blocks BBB
```

### Completing Work

```bash
lb close LIN-XXX --reason "Brief summary of what was done"
```

### Labels

```bash
lb create "Fix bug" -l bug -l frontend        # Create with labels
lb update LIN-XXX --label urgent               # Add label
lb update LIN-XXX --unlabel frontend           # Remove label
lb list --label frontend                       # Filter by label
```

### Key Commands Reference

| Command                                       | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| `lb sync`                                     | Sync with Linear                      |
| `lb ready`                                    | Show unblocked issues you can work on |
| `lb list`                                     | Show all issues                       |
| `lb list --label name`                        | Filter by label                       |
| `lb show LIN-XXX`                             | Full issue details                    |
| `lb update LIN-XXX --status in_progress`      | Claim work                            |
| `lb update LIN-XXX --label name`              | Add label                             |
| `lb update LIN-XXX --unlabel name`            | Remove label                          |
| `lb close LIN-XXX --reason "why"`             | Complete work                         |
| `lb create "Title" --parent LIN-XXX -d "..."` | Create subtask                        |
| `lb create "Title" -l label`                  | Create with label                     |

### Rules

1. **NEVER use TodoWrite** - use `lb create` for subtasks instead
2. **Always `lb sync` and `lb ready`** before asking what to work on
3. **Always `lb show`** to read the full description before starting
4. **Always `lb update --status in_progress`** before starting work
5. **Always include descriptions** with context for handoff
6. **Close issues with reasons** explaining what was done

## Git Workflow

Commit atomically as you work (one logical change per commit) unless told otherwise.
