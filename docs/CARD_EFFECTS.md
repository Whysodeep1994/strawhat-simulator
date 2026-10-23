# Card effects reference

Card effects are written as data, not code. Each card lists its effects, and each effect is a
**timing** plus **conditions**, **costs**, and **steps** made from the building blocks below.
Most new cards need only data. If a card needs a block that doesn't exist yet, open an issue.

## An example

An effect worded "[DON!! x1] [When Attacking] [Once Per Turn] ①: K.O. up to 1 of your
opponent's Characters with a cost of 3 or less" is written as:

```json
{
  "timing": "whenAttacking",
  "conditions": [{ "donAtLeast": 1 }],
  "oncePerTurn": true,
  "costs": [{ "restDon": 1 }],
  "steps": [
    { "do": "ko", "target": { "side": "opponent", "filter": { "costAtMost": 3 }, "upTo": true } }
  ]
}
```

## Timings

| Timing               | Card wording                       | Rules   |
| -------------------- | ---------------------------------- | ------- |
| `onPlay`             | [On Play]                          | 10-2-6  |
| `whenAttacking`      | [When Attacking]                   | 10-2-5  |
| `onOpponentsAttack`  | [On Your Opponent's Attack]        | 10-2-16 |
| `onBlock`            | [On Block]                         | 10-2-15 |
| `onKO`               | [On K.O.]                          | 10-2-17 |
| `activateMain`       | [Activate: Main]                   | 10-2-2  |
| `main`               | [Main] on Events                   | 10-2-3  |
| `counter`            | [Counter] on Events                | 10-2-4  |
| `trigger`            | [Trigger]                          | 10-1-5  |
| `endOfYourTurn`      | [End of Your Turn]                 | 10-2-7  |
| `endOfOpponentsTurn` | [End of Your Opponent's Turn]      | 10-2-8  |
| `permanent`          | Always-on text, e.g. "+1000 power" | 8-1-3-3 |

Add `"oncePerTurn": true` for [Once Per Turn] and `"optional": true` for "you may".

## Conditions

`donAtLeast` ([DON!! xX]), `yourTurn`, `opponentsTurn`, `lifeAtMost`, `lifeAtLeast`,
`opponentLifeAtMost`, `opponentLifeAtLeast`, `leaderHasType`, `charactersAtLeast`, `handAtMost`.

## Costs

`restDon` (①), `donMinus` (DON!! −X), `trashFromHand`, `restThis`, `returnGivenDon` ("return N of your
currently given DON!! cards to your cost area rested"; the player picks which cards).

## Targets

`{ "side": "self" | "opponent" | "this", "zone": "leader" | "characters" | "leaderOrCharacters" | "stage", "filter": {...}, "count": 1, "upTo": true }`

Filters: `category`, `costAtMost`, `costAtLeast`, `powerAtMost`, `powerAtLeast`, `type`, `name`,
`nameIncludes`, `color`, `rested`, `costAtMostOpponentLife` ("a cost equal to or less than the number of
your opponent's Life cards"), `notThis`, `hasTrigger`, `keyword` (for example
`{ "keyword": "blocker" }` for "[Blocker] Characters").

When there's no real choice (for example, exactly one valid target and no "up to"), the engine
picks automatically, so players are only asked about meaningful decisions.

## Keywords

Besides the printed keywords, `canAttackActive` means "this Character can also attack your
opponent's active Characters". Grant it with `grantKeyword` in a `permanent` effect for
conditional wording such as "[DON!! x2] This Character can also attack...".

## Steps

| Step                             | What it does                                                          |
| -------------------------------- | --------------------------------------------------------------------- |
| `draw`                           | Draw cards.                                                           |
| `powerUp`                        | Change power (negative for "−"), for the turn or the battle.          |
| `negateOnPlay`                   | "[On Play] effects are negated" for `self` or `opponent`.             |
| `grantKeyword`                   | Give [Rush], [Blocker], [Double Attack], and so on.                   |
| `ko`                             | K.O. Characters.                                                      |
| `rest` / `setActive`             | Rest or set active.                                                   |
| `returnToHand`                   | Return to the owner's hand.                                           |
| `returnToDeckBottom`             | Place at the bottom of the owner's deck.                              |
| `noBlockers`                     | "Your opponent cannot activate [Blocker]" when the target attacks.    |
| `giveRestedDon`                  | Give rested DON!! from the cost area.                                 |
| `addDon`                         | Add DON!! from the DON!! deck, active or rested.                      |
| `setDonActive`                   | Set rested DON!! as active.                                           |
| `trashFromHand`                  | You trash cards from your hand.                                       |
| `opponentTrashesFromHand`        | Your opponent trashes cards from their hand.                          |
| `searchDeck`                     | Look at the top cards, add matching ones to hand, rest to the bottom. |
| `playFromHand` / `playFromTrash` | Play a card for free.                                                 |
| `lifeToHand` / `deckToLife`      | Move cards between Life, hand, and deck.                              |
| `playThis`                       | [Trigger] only: play this card.                                       |
| `if`                             | Only do the nested steps if the conditions hold.                      |

`powerUp` takes `perTrash: 4` for "+X power for every 4 cards in your trash".

Each block is tested in `packages/engine/scenarios/effects/` using made-up `TEST-` cards.
