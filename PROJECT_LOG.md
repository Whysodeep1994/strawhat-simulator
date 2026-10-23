# Project log

The living record of this project. Read it at the start of every work session, and update it
at the end. Newest entries go at the top of each section.

## Current phase

**Phase 3: Core rules engine** (in progress; first slice in review)

## Roadmap

Each phase has a check the project owner can do without reading code.

| Phase                  | Done when you can…                                                         | Status      |
| ---------------------- | -------------------------------------------------------------------------- | ----------- |
| 1. Audit and decision  | Approve the direction.                                                     | Done        |
| 2. Project setup       | Open the repo and see a green check mark on the latest change.             | Done        |
| 3. Core rules engine   | Open a coverage report listing rules sections with pass counts, all green. | In progress |
| 4. Cards and effects   | See every card in one starter deck marked "tested".                        | Not started |
| 5. Local prototype     | Play a full game in a browser, mulligan to winner, on one computer.        | Not started |
| 6. Online multiplayer  | Play a friend on two devices; their hand never shows on your screen.       | Not started |
| 7. Deck builder        | Build a deck, see an illegal card flagged, import and export a list.       | Not started |
| 8. Polish              | A new player finishes the tutorial; the app opens in under 3 seconds.      | Not started |
| 9. Release and updates | Visit a public link and see an update notice after a new version ships.    | Not started |
| 10. Card expansion     | The coverage report shows each new set at 100% tested.                     | Not started |

## Done

- 2026-10-23: Phase 3, first slice. Game state, setup and redraw, turn phases, playing
  Characters and Stages, giving DON!!, full battle (block, counter, damage, K.O.), Rush,
  Rush: Character, Double Attack, Banish, Blocker, Unblockable, defeat checks, conceding, a
  legal-moves list for the UI, hidden-information views, deck validation, the scenario test
  format, and a rules coverage report (146 of 148 core rules tested). Official rules v1.2.1 used.
- 2026-10-23: Phase 2 merged (PR #1).
- 2026-10-23: Phase 2 started. Added AGPL-3.0 license, TypeScript workspace, tests (Vitest), lint
  (ESLint), formatting (Prettier), a pre-commit check, GitHub CI, and contributor docs. First
  engine module: turn phases (rules 6-1 to 6-4-1) with 6 passing tests.
- 2026-10-23: Phase 1 audit. OPTCGSim is a closed-source Unity 6 / C# app with no license, so
  we rebuild from scratch and use it only as a behavioral reference. Never copy or decompile it.

## Next

1. Owner merges the Phase 3 first-slice pull request.
2. Phase 4: card data format in strawhat-card-data (real card numbers), effect library
   (On Play, When Attacking, On K.O., Activate: Main, Trigger, Counter events, Once Per Turn,
   end-of-turn effects), then one starter deck fully tested.

## Decisions

| Date       | Decision                                                                                                                                 | Why                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 2026-10-23 | Exact card art and text, real card numbers, stored in the separate strawhat-card-data repo.                                              | Owner's choice; a takedown can't hit the engine repo.       |
| 2026-10-23 | The engine always asks for the Counter Step, even with no counters in hand.                                                              | Skipping would leak hand information (Rules Question #2).   |
| 2026-10-23 | UI and feel modeled on Yu-Gi-Oh! Master Duel: highlight only legal plays, one-tap actions, auto-prompts for responses, quick animations. | Owner's direction: simple to play and polished.             |
| 2026-10-23 | Project name: Strawhat Simulator.                                                                                                        | Owner's choice.                                             |
| 2026-10-23 | License: AGPL-3.0-or-later.                                                                                                              | Keeps hosted forks open source.                             |
| 2026-10-23 | Stack: TypeScript, pnpm workspace, Vitest, ESLint, Prettier, GitHub CI.                                                                  | One language for engine, server, and web app; widely known. |
| 2026-10-23 | Planned: Node.js WebSocket server (authoritative), React web client.                                                                     | Server hides private info; runs in any browser.             |
| 2026-10-23 | Rebuild from scratch; OPTCGSim is reference only.                                                                                        | OPTCGSim has no source code or license.                     |

## Open decisions

- None right now.

## Known bugs

- None yet.

## Rules questions

Tracked in [docs/RULES_QUESTIONS.md](docs/RULES_QUESTIONS.md).

## Reference

- Official Comprehensive Rules: https://en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf
  (version 1.2.1, updated 2026-08-28, at the time of writing). Do not commit the PDF.
