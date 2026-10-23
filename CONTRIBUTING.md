# Contributing to Strawhat Simulator

Thanks for helping! This guide grows as the project does.

## Ground rules

- Read [PROJECT_LOG.md](PROJECT_LOG.md) first. It says what's being worked on.
- Never commit card images, logos, or official card text. See [docs/CARD_ASSETS.md](docs/CARD_ASSETS.md).
- Never copy code from closed-source simulators, including OPTCGSim.
- Every rules change needs a test that cites the Comprehensive Rules number, e.g.
  `describe("rule 6-3-1: draw phase", ...)`.
- `pnpm check` must pass. It runs automatically before each commit and on every pull request.

## Getting set up

1. Install [Node.js 22](https://nodejs.org/) and [pnpm](https://pnpm.io/installation).
2. Clone the repository and run `pnpm install`.
3. Run `pnpm check`. Everything should pass.

## Reporting a rules bug

Open an issue with the **Rules bug** template. Include the cards involved, what happened, what
should have happened, and the rule number if you know it. Confirmed reports become test
scenarios so the bug can never come back.

## Adding a new card or set

The card data format arrives in Phase 4. This section will explain it step by step then.

## Pull requests

- Keep each pull request small and focused on one thing.
- Describe what changed and how you checked it.
- Update PROJECT_LOG.md if you finish or start something on the roadmap.
