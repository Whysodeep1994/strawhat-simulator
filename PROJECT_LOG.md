# Project log

The living record of this project. Read it at the start of every work session, and update it
at the end. Newest entries go at the top of each section.

## Current phase

**Phase 4: Cards and effects** (effect library merged; ST-01 card import in review).
Deck builder search and deck list import (Phase 7 logic) started early at the owner's request.
**Phase 5: Local prototype** in progress: a playable browser game against the computer.

## Roadmap

Each phase has a check the project owner can do without reading code.

| Phase                  | Done when you can…                                                         | Status      |
| ---------------------- | -------------------------------------------------------------------------- | ----------- |
| 1. Audit and decision  | Approve the direction.                                                     | Done        |
| 2. Project setup       | Open the repo and see a green check mark on the latest change.             | Done        |
| 3. Core rules engine   | Open a coverage report listing rules sections with pass counts, all green. | Done        |
| 4. Cards and effects   | See every card in one starter deck marked "tested".                        | In progress |
| 5. Local prototype     | Play a full game in a browser, mulligan to winner, on one computer.        | In progress |
| 6. Online multiplayer  | Play a friend on two devices; their hand never shows on your screen.       | Not started |
| 7. Deck builder        | Build a deck, see an illegal card flagged, import and export a list.       | Started     |
| 8. Polish              | A new player finishes the tutorial; the app opens in under 3 seconds.      | Not started |
| 9. Release and updates | Visit a public link and see an update notice after a new version ships.    | Not started |
| 10. Card expansion     | The coverage report shows each new set at 100% tested.                     | Not started |

## Done

- 2026-10-23: Engine blocks for starter decks ST-15 (Edward.Newgate), ST-16 (Uta), ST-17
  (Doflamingo): either-player targets, more costs, deck arranging, reveal-and-play, choose one,
  "at the end of this turn", "cannot add Life cards", "K.O.'d by an effect". 24 new scenarios.
- 2026-10-23: Deck builder in the app (Phase 7, early, at the owner's request). Search every card
  (name, type, effect text, card number, set, colour, card type, cost range), build and name
  decks, paste and copy lists, and save them in the browser. Decks are checked against Standard
  as you build (`checkDeck` in the engine): 50 cards, 4 copies, Leader colours, legal blocks and
  their exceptions, banned cards, restricted cards, and banned pairs, using strawhat-card-data's
  formats/standard.json from Bandai's official pages. Your own decks can be played once legal.
- 2026-10-23: Phase 5, real cards on an official-style table. The app loads cards, decks and
  art from strawhat-card-data (copied in by `packages/web/scripts/card-data.mjs`). Each side of
  the table follows the official playmat: Life on the left, Character Area on top, Leader in the
  middle with the Stage beside it, Deck and Trash on the right, DON!! deck and cost area along the
  bottom. Players can upload a picture as their playmat (kept in their browser). New home screen
  with an animated, original sea scene, a deck picker with leader art, and an opponent choice.
  Sets without an official deck list yet get a practice deck built from the set's cards.
- 2026-10-23: Phase 5, first playable prototype (packages/web). React board in the Master
  Duel style: legal plays glow, tap a card for its actions, pop-ups for turn order, redraw,
  Blocker, Counter, Trigger, and effect choices, plus a game log and a card reader. You play
  against a simple computer opponent (`chooseBotAction` in the engine) with two made-up demo
  decks. `pnpm build` also makes a single-file version of the game. The player view now
  includes each field card's current power.
- 2026-10-23: Phase 4, starter deck ST-01 (Straw Hat Crew). All 17 cards imported into
  strawhat-card-data with official text, art and card numbers, effects as data, and 43 scenarios;
  its STATUS.md shows 17 of 17 tested. The engine gained a `noBlockers` step and a `keyword`
  filter for it. The official site doesn't list how many copies of each card the deck has, so
  there is no ST-01 deck list yet.
- 2026-10-23: Deck builder logic, started early. Card search by set, colour, category, type,
  card number, free text and a cost range (for the slider), plus pasting and copying deck lists
  in the common "4xOP01-016" format. See docs/DECK_BUILDER.md.
- 2026-10-23: Phase 4 effect library merged (PR #3).
- 2026-10-23: Phase 4, effect library. Card effects are data (timing, conditions, costs,
  steps) documented in docs/CARD_EFFECTS.md. The engine now runs effects through a stack, so
  it can stop for a player's choice mid-effect: On Play, When Attacking, On Your Opponent's
  Attack, On Block, On K.O., Activate: Main, Main and Counter Events, Trigger, End of Turn,
  permanent effects, Once Per Turn, DON!! xX, optional "you may" costs. 39 new scenarios;
  random games now include effect cards.
- 2026-10-23: Phase 3 part 1 merged (PR #2).
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

1. Owner merges the ST-01 engine additions (`noBlockers`, `keyword` filter), then the ST-01
   card data pull request in strawhat-card-data. After the engine merges, point
   strawhat-card-data's engine.json at the merged main commit.
2. Find a reliable ST-01 deck list (copies per card) to add as a playable deck.
3. Add the official deck lists for ST-01 and the 11 modern starter decks (ST-15 to ST-28 picks)
   to strawhat-card-data, so the deck picker has 12 official decks.
4. Resolve Rules Questions #3 to #5 (player choices for DON!! −X and effect order).

## Decisions

| Date       | Decision                                                                                                                                 | Why                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2026-10-23 | Home screen scenery and default playmats are original art, drawn in code, not One Piece fan art.                                         | Fan art belongs to its artists; using it needs their permission.                      |
| 2026-10-23 | Uploaded playmats stay in the player's own browser.                                                                                      | Nothing to host or moderate; online play will send each player's mat with their seat. |
| 2026-10-23 | No in-app deck lists from third-party sites without their permission; players paste lists themselves.                                    | Owner's decision; we have no permission.                                              |
| 2026-10-23 | Card data tests run against an engine commit pinned in strawhat-card-data's engine.json.                                                 | A new engine change can't silently break tested cards.                                |
| 2026-10-23 | Exact card art and text, real card numbers, stored in the separate strawhat-card-data repo.                                              | Owner's choice; a takedown can't hit the engine repo.                                 |
| 2026-10-23 | The engine always asks for the Counter Step, even with no counters in hand.                                                              | Skipping would leak hand information (Rules Question #2).                             |
| 2026-10-23 | UI and feel modeled on Yu-Gi-Oh! Master Duel: highlight only legal plays, one-tap actions, auto-prompts for responses, quick animations. | Owner's direction: simple to play and polished.                                       |
| 2026-10-23 | Project name: Strawhat Simulator.                                                                                                        | Owner's choice.                                                                       |
| 2026-10-23 | License: AGPL-3.0-or-later.                                                                                                              | Keeps hosted forks open source.                                                       |
| 2026-10-23 | Stack: TypeScript, pnpm workspace, Vitest, ESLint, Prettier, GitHub CI.                                                                  | One language for engine, server, and web app; widely known.                           |
| 2026-10-23 | Planned: Node.js WebSocket server (authoritative), React web client.                                                                     | Server hides private info; runs in any browser.                                       |
| 2026-10-23 | Rebuild from scratch; OPTCGSim is reference only.                                                                                        | OPTCGSim has no source code or license.                                               |

## Open decisions

- None right now.

## Known bugs

- Performance: each action copies the whole game state and re-lists legal moves. A random
  game takes about 70 ms. Fine for now; optimize in Phase 8.

## Rules questions

Tracked in [docs/RULES_QUESTIONS.md](docs/RULES_QUESTIONS.md).

## Reference

- Official Comprehensive Rules: https://en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf
  (version 1.2.1, updated 2026-08-28, at the time of writing). Do not commit the PDF.
