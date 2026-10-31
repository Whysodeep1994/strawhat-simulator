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
| 6. Online multiplayer  | Play a friend on two devices; their hand never shows on your screen.       | In progress |
| 7. Deck builder        | Build a deck, see an illegal card flagged, import and export a list.       | Started     |
| 8. Polish              | A new player finishes the tutorial; the app opens in under 3 seconds.      | Not started |
| 9. Release and updates | Visit a public link and see an update notice after a new version ships.    | Not started |
| 10. Card expansion     | The coverage report shows each new set at 100% tested.                     | Not started |

## Done

- 2026-10-31: EB-05 is out and legal. All 61 EB-05 cards were already in the game; the last
  missing effect now works: Gloriosa (EB05-052) "If you would take damage, you may trash this
  Character instead" (new engine step `trashInsteadOfDamage`, asked as a yes/no; it stops the
  whole damage, even at 0 Life). The computer only uses it at 1 Life or less. The title screen
  shows a small "EB-05 is now available for play!" note.
- 2026-10-31: Matchup Lab (a user's idea). A new title menu mode: pick deck A and deck B, and the
  computer plays them against each other 100 to 5,000 times on background helpers (Web Workers).
  It shows each deck's win rate with a margin of error, going first vs second, and deck A's "win
  rate when drawn" for every card. "Find better cards" tries "−1 card, +1 card" swaps (cards that
  did badly out, cards that did well or up to 5 picked cards in), 200 games each, then replays the
  best 5 with the full game count and marks a swap "Better" only when it beats luck. A swap can be
  saved as a new deck. Results depend on the computer player, and the screen says so.
- 2026-10-31: Every move is about 90 times faster. applyAction copied the whole card catalog
  (2,850 cards) on every move; the catalog never changes, so it is now shared. A computer vs
  computer game takes about 30 ms instead of 4 s.
- 2026-10-29: Searched cards are revealed (rule 11-2-1). When an effect picks a card from the
  deck for a condition ("reveal up to 1 {Straw Hat Crew} type card and add it to your hand"),
  the card is held up in the middle of the table for 3 seconds for both players, then goes to
  the hand. The computer waits while it shows, and online the friend sees it too. Plain draws and
  searches with no condition stay hidden.
- 2026-10-29: Online games check that both pages run the same version of the game and card data.
  A page left open from before an update played its own moves the old way (its Counters still
  went to the Leader) and its game drifted from its partner's. Now both players are told to
  refresh and start a new game.
- 2026-10-29: Counters from hand now power up the card being attacked (they used to go to the
  Leader). Counter Events that pick a card start with the attacked card picked. The Counter Step
  no longer skips itself when you have no counters: you press Take the hit (or Continue).
- 2026-10-28: Player Development, a new title menu mode with two tracks. New Player: seven short
  lessons, then a guided game with a Luffy starter deck (ST-01, ST-18 or ST-21) against
  Edward.Newgate's all-red ST-15. A coach explains each decision, suggests a move (glowing green,
  with a Do it for me button) and why, and explains each rule the first time it happens. Pro
  Drills: your own deck against any deck, with live coaching on (matchup and board tips before
  each of your turns, advice when attacked) or off; either way the game ends with a report of each
  error, its turn and why. All rule-based, in packages/web/src/coach\*.ts and tutor.ts, using only
  what the player can see. Training games have no clock. Pro Drills keep each state as they go,
  since replaying a 120-move game takes about 6 seconds.
- 2026-10-28: A clearer, bigger game board (Master Duel style), from the owner's notes while
  playing a friend. Your hand is now a fanned tray along the bottom of the screen, partly hidden
  until you point at it; the card you point at lifts and grows, and the mouse wheel scrolls a long
  hand (phones keep the hand under the mat). With the hand gone from beside the mat, your mat and
  cards are about 10% bigger on wide screens, and the opponent's mat is drawn a little smaller, as
  if across the table. Attacks draw an arrow from the attacker to its target (and follow the
  pointer while you choose). Being attacked shows "You're being attacked!" with both powers, how
  much power you still need, what happens if it hits, counter values on your hand cards, a
  "Take the hit" button and a red glow around the screen. The player whose turn it is has their
  mat lit up with a "Your turn"/"Their turn" tag, and a banner sweeps across at each new turn.
  "Opponent is thinking..." with bouncing dots shows whenever the computer or your friend is
  deciding. Choosing cards in a window now marks selected cards with a green tick and asks what
  will happen ("Trash Nefeltari Vivi?", "Add Nami to your hand?") before the "Yes" button, and
  attacking or replacing a Character asks first ("Attack Kuzan (6000) with Zoro (5000)?").
  Then, on wide screens: the opponent's hand peeks down from the top edge (with an "N in hand"
  count), the turn panel and clocks moved into the side bar, the move history folds away with a
  "Hide moves" button (remembered in this browser), and the mats spread across the freed middle,
  so cards are bigger again (your Leader 87 to 100 pixels wide at 1600x900).
- 2026-10-27: "Look at the top N cards" searches now show all N cards. The owner saw OP01-016
  Nami (look at 5) show only 3: the effect did look at 5, but the window listed only the cards you
  could take. Now every looked-at card is shown, cards you can't take are darkened and can't be
  clicked, and a search with no matches still shows the cards ("Look, then continue") instead of
  skipping the window. Covers all 212 search cards (they share one `searchDeck` step) and online
  play. Card-data scenarios ST11-001-other-on-top and OP08-115-counter now answer that window.
- 2026-10-27: Fixed a freeze reported by the owner. With OP13-001 Monkey.D.Luffy as Leader, its
  "[On Your Opponent's Attack] rest any number of DON!!" asks "how many?" as a choose-one
  decision, and the board had no window for choose-one decisions, so the game waited for an
  answer you couldn't give. The board now shows a "Choose one" window, face-down choices (picking
  from the opponent's hand) can be clicked, and every kind of decision must have status text, so
  TypeScript flags a new kind with no UI. The computer also can't stall the game any more: if its
  move fails, or it makes 300 moves in a row, it passes or ends its turn, then tries any other
  legal move. Checked with computer-vs-computer games over every deck.
- 2026-10-26: Public website (owner chose Cloudflare). The whole game, card data included, can
  be published free as one Cloudflare Worker that rebuilds on every merge, and Play a Friend works
  there through a small relay instead of claude.ai's live rooms. Setup steps: docs/HOSTING.md.
- 2026-10-26: Play a Friend (Phase 6, first version). One player creates a game and gets a short
  code; the friend types it to join. It runs on claude.ai's live rooms in the published app, so
  there is no server to host or pay for. Both computers build the game from the same decks and
  seed, and only the moves travel; a reloaded page rejoins and catches up. Known limit: the
  friend's hidden cards are in your browser's memory (never on screen), so it relies on trust.
- 2026-10-26: Card backs. Settings has a card back picker for each side: the classic back, six
  designs drawn for this app (Grand Line, Straw Hat, Jolly Roger, Wanted Poster, Treasure Map,
  Ship's Helm), or an uploaded picture. Saved in the browser, like playmats.
- 2026-10-24: Engine blocks for set OP-12: "when a card is trashed from your hand by your own
  effect", "when your opponent plays a Character" (also "using a Character's effect"), "cannot attack
  Characters with a base cost of 7 or less", "cannot be played by effects", activating an Event from
  the hand, "the next time you play ...", "you cannot draw cards using your own effects", "cannot be
  K.O.'d in battle by <Slash> cards", three new conditions, and small options on `trashAtLeast`,
  `giveActiveDon`, `addDon`, `restOwnDon` and `draw`.
- 2026-10-24: Engine blocks for set OP-11: "at the start of your turn" effects, "when a card is
  removed from your or your opponent's Life cards", "when your opponent activates a [Trigger]",
  "choose a cost and reveal" (`guessCost`), "look at 1 card from the top of your opponent's deck",
  "cannot be K.O.'d by effects of Characters without <Special>", "cannot be rested by your
  opponent's effects", four new conditions, and small options on `handToDeckTop`,
  `trashToDeckBottom`, `characterToLife` and `atEndOfTurn`.
- 2026-10-24: Engine blocks for set OP-10: "when you activate an Event", the total cost of your
  Characters, "at least 2 fewer Characters", "less Life cards than your opponent", returning this
  Character to hand as a cost, "would be K.O.'d in battle" replacements, playing the top Life card,
  "you cannot set DON!! cards as active using Character effects", and "your opponent's rested
  DON!! will not become active in their next Refresh Phase". 14 new effect scenarios.
- 2026-10-26: Fixed a computer loop found while testing the 1905-card data with 280
  computer-vs-computer games across all 70 decks. OP10-030 Smoker's [Activate: Main] has no cost
  and no [Once Per Turn], so the computer used it again and again in one turn, and each use added
  another copy of its "cannot set DON!! as active" lock. The lock is now added once, and the
  computer skips [Activate: Main] effects that would change nothing. New test in bot.test.ts.
- 2026-10-25: Fixed main after the PR #30 merge. The merge commit dropped the EB-03 to PRB-02
  blocks (opponentHandToDeckBottom, activateEventFromTrash, setPowerToZero, draw perCount,
  faceUpLifeAtLeast, charactersFewerThanOpponent, trashAtLeast trashFilter) and typecheck failed.
  Redid the merge with both sides kept.
- 2026-10-25: Fixed a freeze found while testing the 979-card data (OP-06 and OP-14 added).
  Playing OP14-090 Mr.1 (Daz.Bonez) hung the game: its "if there is a Character with a cost of 0
  or 8 or more" check re-worked every other Character's cost inside each cost, which grows
  exponentially. Grants are now worked out once per lookup. New test in permanent-effects.test.ts.
- 2026-10-24: Prototype fixes found while testing the 518-card data (EB-01, EB-02, full OP-09,
  ST-31 to 36) with 84 computer-vs-computer games across every deck. The computer froze on "K.O.
  up to 2 Characters with a total power of 4000 or less" because it picked over the limit; it now
  keeps to the total, and the choose dialog shows the running total and won't confirm past it.
  Sets with several Leaders now get one practice deck per Leader with a unique id (they shared
  one before, which confused the home screen). Still slow: late-game moves with ST-30 take about
  0.1 to 0.4 s, from permanent effects re-checking each other (see Known bugs).
- 2026-10-23: Engine blocks for set OP-09: "negate the effect of" (a `negated` status that also
  turns off printed keywords), "that Character" targets, "total power of 4000 or less", "your
  Character cards are played rested", "cannot be K.O.'d in battle by Leaders", trashing cards from
  the deck, placing hand cards at the deck bottom as a cost, adding a hand card to Life, "If you do"
  after playing a card, taking Life from the top or bottom, "K.O.'d by your opponent's effect",
  "removed from the field by your opponent's effect", "when your opponent activates [Blocker]",
  "you win the game", and DON!!, hand and total Life comparisons. 24 new effect scenarios.
- 2026-10-23: Engine blocks for starter decks ST-15 (Edward.Newgate), ST-16 (Uta), ST-17
  (Doflamingo): either-player targets, more costs, deck arranging, reveal-and-play, choose one,
  "at the end of this turn", "cannot add Life cards", "K.O.'d by an effect". 24 new scenarios.
- 2026-10-23: Deck builder sorting and card preview (owner's request). Sort the library by
  card number, cost, power, card type or attribute in either direction. Pointing at a card shows
  its art enlarged and all its printed details on the right; press and hold on touch screens.
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
- Performance: permanent effects with conditions that count cards by power or cost (for example
  ST-30) still re-work grants on every top-level check, so a move with a full board takes about
  25 ms. Grants are cached within one lookup (2026-10-25); caching per game state would go further.

## Rules questions

Tracked in [docs/RULES_QUESTIONS.md](docs/RULES_QUESTIONS.md).

## Reference

- Official Comprehensive Rules: https://en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf
  (version 1.2.1, updated 2026-08-28, at the time of writing). Do not commit the PDF.
