# Writing a scenario

A scenario sets up a game position, plays some actions, and checks the result. Every rules
ruling and every confirmed rules bug should become a scenario, so it can never break again.

Scenarios live in `packages/engine/scenarios/` as JSON files and run with `pnpm test`.

## Example

```json
{
  "name": "[Double Attack] deals 2 damage",
  "rules": ["10-1-2-1", "7-1-4-1-1-3"],
  "setup": {
    "p1": { "characters": ["TEST-DOUBLE"] }
  },
  "actions": [
    {
      "type": "attack",
      "player": "p1",
      "attacker": "p1.characters.0",
      "target": "p2.leader"
    },
    { "type": "pass", "player": "p2" }
  ],
  "expect": { "p2.life": 2, "p2.hand": 2 }
}
```

## Fields

- **`rules`**: the Comprehensive Rules numbers this checks. They feed the
  [coverage report](RULES_COVERAGE.md).
- **`setup`**: the position. Unless you say otherwise it is turn 3, `p1`'s Main Phase, both
  Leaders are `TEST-LEADER` (5000 power), each deck has 20 filler cards and each Life area 4.
  - Per player: `leader`, `characters`, `stage`, `hand`, `trash`, `deck`, `life`, `don`
    (`active`, `rested`, `deck`), `turnsTaken`, `lifeFaceUp` (how many top Life cards start face-up).
  - A Character can be just a card id, or `{ "card": "...", "rested": true, "don": 2, "playedThisTurn": true }`.
  - `deck` and `life` take a number of filler cards or a list of card ids, top card first.
- **`actions`**: played in order. Point at cards with paths like `p1.hand.0`, `p2.leader`, or
  `p1.characters.2`. Add `"illegal": true` to check that an action is refused.
- **`expect`**: paths into the game state. Zones compare by card count (`"p2.life": 3`). Other
  examples: `"p1.characters.0.rested": true`, `"winner": "p1"`, `"prompt.kind": "counter"`, and
  `"legal.p1.attack": 2` (how many attacks `p1` could legally declare). `.power` and `.cost` on a
  card read its current values after DON!! and effects (`"p1.leader.power": 7000`).

Test cards are in `packages/engine/test/fixtures/test-cards.ts`.
