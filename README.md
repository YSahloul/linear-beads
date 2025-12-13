# linear-beads (lb)

Linear-backed issue tracking for AI agents.

## Install

**Download a binary** from [releases](https://github.com/nikvdp/linear-beads/releases) and put it in your PATH.

**Or with bun:**
```bash
bun install -g github:nikvdp/linear-beads
```

## Setup

```bash
# Authenticate with Linear (get key at https://linear.app/settings/api)
lb auth

# In your project
cd your-project
lb init
```

## Tell your agent

Add this to your project's AGENTS.md or CLAUDE.md:

```
This project uses lb for issue tracking. Run `lb onboard` and follow the instructions.
```

Your agent will run `lb onboard`, which outputs everything it needs to set up AGENTS.md and start using `lb`.

## License

MIT
