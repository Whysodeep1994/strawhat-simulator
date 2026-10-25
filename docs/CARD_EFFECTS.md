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

| Timing                                    | Card wording                                                                                                                                                                          | Rules   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `onPlay`                                  | [On Play]                                                                                                                                                                             | 10-2-6  |
| `whenAttacking`                           | [When Attacking]                                                                                                                                                                      | 10-2-5  |
| `onOpponentsAttack`                       | [On Your Opponent's Attack]                                                                                                                                                           | 10-2-16 |
| `onBlock`                                 | [On Block]                                                                                                                                                                            | 10-2-15 |
| `onKO`                                    | [On K.O.]                                                                                                                                                                             | 10-2-17 |
| `koByEffect`                              | "When this Character is K.O.'d by an effect" (not in battle)                                                                                                                          | 10-2-1  |
| `activateMain`                            | [Activate: Main]                                                                                                                                                                      | 10-2-2  |
| `main`                                    | [Main] on Events                                                                                                                                                                      | 10-2-3  |
| `counter`                                 | [Counter] on Events                                                                                                                                                                   | 10-2-4  |
| `trigger`                                 | [Trigger]                                                                                                                                                                             | 10-1-5  |
| `endOfYourTurn`                           | [End of Your Turn]                                                                                                                                                                    | 10-2-7  |
| `endOfOpponentsTurn`                      | [End of Your Opponent's Turn]                                                                                                                                                         | 10-2-8  |
| `permanent`                               | Always-on text, e.g. "+1000 power"                                                                                                                                                    | 8-1-3-3 |
| `characterRestedByYourEffect`             | "If a Character is rested by your effect"                                                                                                                                             | 8-1-3-1 |
| `replaceRemoval`                          | "If ... would be K.O.'d ..., ... instead"                                                                                                                                             | 8-1-3-4 |
| `donReturned`                             | "When 2 or more DON!! cards on your field are returned ..."                                                                                                                           | 8-1-3-1 |
| `becomesRested`                           | "When this Character becomes rested" (attack, block, cost or effect)                                                                                                                  | 8-1-3-1 |
| `koByOpponentsEffect`                     | "When this Character is K.O.'d by your opponent's effect"                                                                                                                             | 10-2-1  |
| `characterRemovedByOpponent`              | "When your Character is removed ... by your opponent's effect"                                                                                                                        | 8-1-3-1 |
| `onOpponentsBlock`                        | "When your opponent activates [Blocker]"                                                                                                                                              | 8-1-3-1 |
| `drawOutsideDrawPhase`                    | "When you draw a card outside of your Draw Phase"                                                                                                                                     | 8-1-3-1 |
| `lifeAddedToHand`                         | "When a card is added to your hand from your Life"                                                                                                                                    | 8-1-3-1 |
| `lifeBecomesZero`                         | "When your number of Life cards becomes 0"                                                                                                                                            | 8-1-3-1 |
| `triggerActivated`                        | "When a [Trigger] activates" (either player's)                                                                                                                                        | 8-1-3-1 |
| `restedByOpponentsCharacter`              | "When this Character becomes rested by your opponent's Character's effect"                                                                                                            |
| `characterKOd`                            | "When a Character is K.O.'d" (either player's, any K.O.)                                                                                                                              | 8-1-3-1 |
| `opponentCharacterReturned`               | "When your opponent's Character is returned to the owner's hand by your effect"                                                                                                       | 8-1-3-1 |
| `battleKOReplacement`                     | Set up by `replaceBattleKO`: "If any of your Characters would be K.O.'d in battle during this turn, you may ... instead"                                                              | 8-1-3-4 |
| `opponentActivatesEvent`                  | "When your opponent activates an Event" (main or counter)                                                                                                                             | 8-1-3-1 |
| `eventActivated`                          | "When you activate an Event" (you play an Event's [Main] or [Counter])                                                                                                                | 8-1-3-1 |
| `opponentActivatesTrigger`                | "When your opponent activates a [Trigger]"                                                                                                                                            | 8-1-3-1 |
| `startOfYourTurn`                         | "This effect can be activated at the start of your turn" (after the Refresh Phase, before the Draw Phase)                                                                             | 6-2-1   |
| `lifeCardRemoved`                         | "When a card is removed from your or your opponent's Life cards" (damage, costs and effects)                                                                                          | 8-1-3-1 |
| `handTrashedByOwnEffect`                  | "When a card is trashed from your hand by your {Navy} type card's effect": `cardFilter` is for the card whose effect trashed them; `draw` with `"perPrevious": true` draws 1 per card | 8-1-3-1 |
| `opponentPlaysCharacter`                  | "When your opponent plays a Character with a base cost of 8 or more" (`cardFilter` is for the played card)                                                                            | 8-1-3-1 |
| `opponentPlaysCharacterByCharacterEffect` | "When your opponent plays a Character using a Character's effect"                                                                                                                     | 8-1-3-1 |

Add `"oncePerTurn": true` for [Once Per Turn] and `"optional": true` for "you may".

`characterRemovedByOpponent` effects set `removed`, a filter for which of your Characters they
watch: `{ "type": "Straw Hat Crew" }` for "when your {Straw Hat Crew} type Character is removed from
the field by your opponent's effect". K.O., return to hand or deck, trash, and moving to Life all count.

`donReturned` effects set `returnedAtLeast` for "when 2 or more DON!! cards on your field are
returned to your DON!! deck"; they trigger when one DON!! −X cost returns at least that many.

A permanent effect with `"zone": "hand"` works while the card is in your hand. Use it with
`costChange` for "give this card in your hand −3 cost":

```json
{
  "timing": "permanent",
  "zone": "hand",
  "conditions": [{ "count": { "side": "opponent", "filter": { "basePowerAtLeast": 8000 } } }],
  "steps": [{ "do": "costChange", "target": { "side": "this" }, "amount": -3 }]
}
```

### Replacement effects

`replaceRemoval` effects say what they protect in `replaces`. Paying the effect's `costs`
replaces the removal; declining lets it happen (rule 8-1-3-4-1). For "If your Character [Bonk
Punch] would be K.O.'d by an effect, you may trash this Character instead":

```json
{
  "timing": "replaceRemoval",
  "replaces": { "side": "self", "filter": { "name": "Bonk Punch" }, "removal": "ko" },
  "optional": true,
  "costs": [{ "trashThis": true }],
  "steps": []
}
```

`replaces` fields: `side` (`"self"` for your cards matching `filter`, `"this"` for the card
itself), `removal` (`"ko"`, or `"remove"` for any removal from the field by K.O. or return), and
`byOpponent: true` for "by your opponent's effect". Removals by effects only, unless the effect sets
`battle: true` for wording that also covers a K.O. in battle ("If this Character would be K.O.'d"),
or `battleOnly: true` for "If this Character would be K.O.'d in battle".
The effect's steps can use the target `{ "side": "that" }` for the saved card ("give that Character
−1000 power instead").

## Conditions

`donAtLeast` ([DON!! xX]), `yourTurn`, `opponentsTurn`, `lifeAtMost`, `lifeAtLeast`,
`opponentLifeAtMost`, `opponentLifeAtLeast`, `leaderHasType`, `charactersAtLeast`, `handAtMost`, `deckTopMatches`
(a filter for the top card of your deck, for "Reveal 1 card from the top of your deck. If that
card is..."), `donOnFieldAtLeast` and `donOnFieldAtMost` ("if you have 8 or more DON!! cards on
your field", counting active, rested and given DON!!), `playedThisTurn` ("if this Character was
played on this turn"), plus:

| Condition                                        | Card wording                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `{ "leaderIs": "Buggy" }`                        | "If your Leader is [Buggy]"                                                                               |
| `{ "anyOf": [ ... ] }`                           | "If your Leader has the {X} type or is [Y]"                                                               |
| `{ "count": {...}, "atLeast": 2 }`               | "If you have 2 or more Characters with a base cost of 5 or more"                                          |
| `{ "donRestedAtLeast": 6 }`                      | "If you have 6 or more rested DON!! cards"                                                                |
| `{ "restedCardsAtLeast": 6 }`                    | "If you have 6 or more rested cards" (DON!! and field cards)                                              |
| `{ "leaderTypeIncludes": "Whitebeard Pirates" }` | "If your Leader's type includes "Whitebeard Pirates""                                                     |
| `{ "lifeAtMostOpponents": true }`                | "If the number of your Life cards is equal to or less than your opponent's"                               |
| `{ "leaderMulticolored": true }`                 | "If your Leader is multicolored"                                                                          |
| `{ "opponentDonOnFieldAtLeast": 5 }`             | "If your opponent has 5 or more DON!! cards on their field"                                               |
| `{ "givenDonAtLeast": 3 }`                       | "If you have a total of 3 or more given DON!! cards"                                                      |
| `{ "leaderAttribute": "Slash" }`                 | "If your Leader has the <Slash> attribute"                                                                |
| `{ "opponentHandAtLeast": 6 }`                   | "If your opponent has 6 or more cards in their hand"                                                      |
| `{ "handTrashedByEffectThisTurn": true }`        | "During the turn in which a card in your hand is trashed by an effect"                                    |
| `{ "donOnFieldAtMostOpponents": true }`          | "If the number of DON!! cards on your field is equal to or less than the number on your opponent's field" |
| `{ "thisPowerAtLeast": 7000 }`                   | "If this Character has 7000 power or more"                                                                |
| `{ "opponentHasMoreDon": true }`                 | "If your opponent has more DON!! cards on their field than you"                                           |
| `{ "handAtLeast": 5 }`                           | "If you have 5 or more cards in your hand"                                                                |
| `{ "trashAtLeast": 10 }`                         | "If you have 10 or more cards in your trash"                                                              |
| `{ "thisRested": true }`                         | "If this Character is rested"                                                                             |
| `{ "not": { ... } }`                             | True when the nested condition doesn't hold                                                               |
| `{ "opponentLeaderAttribute": "Slash" }`         | "If your opponent's Leader has the <Slash> attribute"                                                     |
| `{ "charactersTotalCostAtLeast": 5 }`            | "If the total cost of your Characters is 5 or more"                                                       |
| `{ "charactersFewerThanOpponentBy": 2 }`         | "If the number of your Characters is at least 2 less than the number of your opponent's Characters"       |
| `{ "lifeLessThanOpponents": true }`              | "If you have less Life cards than your opponent"                                                          |
| `{ "donFewerThanOpponentBy": 2 }`                | "If the number of DON!! cards on your field is at least 2 less than the number on your opponent's field"  |
| `{ "totalLifeAtLeast": 5 }`                      | "If you and your opponent have a total of 5 or more Life cards"                                           |
| `{ "opponentRestedCardsAtLeast": 5 }`            | "If your opponent has 5 or more rested cards" (DON!! and field cards)                                     |
| `{ "leaderColorIncludes": "blue" }`              | "If your Leader's colors include blue"                                                                    |
| `{ "attackerMatches": {...} }`                   | "If that Character has the <Slash> attribute": a filter for the card attacking now                        |
| `{ "thisActive": true }`                         | "If this Character is active"                                                                             |
| `{ "attackingLeader": true }`                    | "When this Leader attacks your opponent's Leader": the attack's target is a Leader                        |
| `{ "battledCharacterThisTurn": true }`           | "If this Leader battles your opponent's Character during this turn"                                       |

`count` takes `side` (`"self"` or `"opponent"`), an optional `zone` (default `"characters"`;
`"field"` is the Leader, Characters and Stage)
and `filter`, and `atLeast` (default 1) and/or `atMost`. "If you do not have 5 Characters with a
cost of 5 or more" is `{ "count": { "side": "self", "filter": { "costAtLeast": 5 } }, "atMost": 4 }`.

## Costs

`restDon` (①), `donMinus` (DON!! −X; add `"orMore": true` for "you may return 1 or more DON!!
cards", where the player picks how many), `trashFromHand` (with an optional `filter`, e.g.
`{ "trashFromHand": 1, "filter": { "type": "FILM" } }`), `handToDeckTop` (place cards from your
hand at the top of your deck), `handToDeckBottom` (at the bottom, in the order picked), `returnOwnCharacter` (return your Characters to your hand; an optional `filter`, e.g.
`{ "notThis": true }` for "other than this Character"), `revealFromHand` ("reveal 2 cards with a
type including ... from your hand"; they stay in hand, with an optional `filter`),
`restOwn` (rest 1 of your active Leader, Characters or Stage matching a filter, e.g.
`{ "restOwn": { "name": "Uta" } }`), `restThis`, `trashThis` ("trash this Character", not a K.O.), `lifeToHand` (add Life cards to
your hand; `"from": "topOrBottom"` lets the player take the bottom one), `trashLife` (trash from
the top of your Life), `lifeFaceUp` (turn the top Life card face-up; it must be face-down),
`lifeFaceDown` (turn a face-up Life card face-down; both take `"from": "topOrBottom"` to let the
player pick the end), `trashFromDeckTop` (trash cards from the top of your deck), `oneOf` (a list
of costs the player pays one of, e.g. "rest your Leader or 1 of your DON!! cards":
`{ "oneOf": [{ "restOwn": { "category": "leader" } }, { "restDon": 1 }] }`),
`trashToDeckBottom` (place cards from your trash at the bottom of your deck), `returnGivenDon`
("return N of your currently given DON!! cards to your cost area rested"; the player picks which
cards), `toDeckBottom` ("place 1 of your Characters at the bottom of your deck"; `"zone": "stage"` for
Stages, optional `filter`, `"side": "any"` for "place 1 Character with a cost of 2 or less at the
bottom of the owner's deck", either player's), `trashToDeck` ("return 20 cards from your trash to your deck and shuffle
it"), `koOwnCharacter` ("K.O. 1 of your Characters", optional `filter`), `trashOwnCharacter` ("trash 1
of your Characters", not a K.O.; `"zone": "stage"` trashes your Stage, e.g. "1 [The Ark Noah] from
your field"), `playFromHand` ("play 1
[Kotori] from your hand"; the value is a filter),
and `characterToLife` ("add 1 of your Characters with ... to the top of your Life cards
face-up": `{ "characterToLife": 1, "filter": {...}, "faceUp": true }`), `thisToDeckBottom` ("place
this card ... at the bottom of your deck"), `activeLeaderPower` ("give your 1 active Leader −5000
power during this turn"; the Leader must be active), and `returnActiveDon` ("return 2 of your
active DON!! cards to your DON!! deck"; rested ones can't pay it). `returnOwnCharacter` takes
`"to": "deckBottom"` for "place 1 of your Characters ... at the bottom of your deck", and
`trashToDeckBottom` takes a `filter`. `restCards` is "rest 2 of your cards": active DON!! in the cost area or
your Leader, Characters, or Stage; the player picks the field cards and the rest are DON!!.
`returnThis` is "return this Character to the owner's hand".

Face-up Life cards are open to both players (rule 3-10-2-1): `viewFor` shows them in `life`, and
a card is face-down again once it leaves the Life area.

## Targets

`{ "side": "self" | "opponent" | "this" | "any" | "chosen", "zone": "leader" | "characters" | "leaderOrCharacters" | "stage", "filter": {...}, "count": 1, "upTo": true }`

`"chosen"` means the cards the previous targeting step picked, for "that Character": "negate the
effect of up to 1 of your opponent's Characters. Then, if that Character has a cost of 4 or less,
K.O. it" is a `grantStatus` step followed by `{ "do": "ko", "target": { "side": "chosen", "filter":
{ "costAtMost": 4 } } }`.

`"totalPowerAtMost": 4000` is for "K.O. up to 2 of your opponent's Characters with a total power of
4000 or less": the picked cards' power must add up to at most that.

`"that"` means the cards the previous targeting step picked ("that card gains an additional +2000"),
or the card a replacement effect saves. `totalPowerAtMost` limits the picked cards' total power ("up to
2 ... with a total power of 4000 or less").

`"any"` means either player's cards, for wording like "return up to 1 Character with a cost of 4
or less" that doesn't say whose. Add `"chooser": "opponent"` when your opponent picks ("your
opponent returns 1 of their active Characters"). `"side": "that"` also covers
"the selected Character" ("Then, the selected Character will not become active ...").

Filters: `category`, `costAtMost`, `costAtLeast`, `powerAtMost`, `powerAtLeast`, `type`, `name`,
`nameIncludes`, `notType`, `color`, `rested`, `costAtMostOpponentLife` ("a cost equal to or less than the
number of your opponent's Life cards"), `notThis`, `hasTrigger`, `keyword` (for example
`{ "keyword": "blocker" }` for "[Blocker] Characters"), and:

- `baseCostAtMost`, `baseCostAtLeast`, `basePowerAtMost`, `basePowerAtLeast`: printed values
  ("base cost", "base power"). `costAtMost` and friends read the current cost and power.
- `notName`: "other than [X]".
- `costAtMostTotalLife`: "a cost equal to or less than the total of your and your opponent's Life cards".
- `typeIncludes`: a type containing some text, e.g. `"Baroque Works"`.
- `notTypeIncludes`: no type containing that text, e.g. `"Roger Pirates"` for Characters without a type including "Roger Pirates".
- `attribute`: the printed attribute includes this, e.g. `"Slash"` (cards set `attribute`).
- `anyOf`: a list of filters, any of which may match ("{Cross Guild} type or ...").
- `noBaseEffect`: "with no base effect", a card without card text (rule 2-8-5): no effects and
  no keywords.
- `noCounter`: "Character cards without a Counter".
- `notType`: not of this type. "If the only Characters on your field are {X} type Characters" is
  `{ "count": { "side": "self", "filter": { "notType": "X" } }, "atMost": 0 }`.

`name`, `notName`, `nameIncludes` and the `leaderIs` condition also match a card's `aliases`
("Also treat this card's name as [Tony Tony.Chopper] according to the rules").

When there's no real choice (for example, exactly one valid target and no "up to"), the engine
picks automatically, so players are only asked about meaningful decisions.

## Keywords

Besides the printed keywords, `canAttackActive` means "this Character can also attack your
opponent's active Characters". Grant it with `grantKeyword` in a `permanent` effect for
conditional wording such as "[DON!! x2] This Character can also attack...".

## Steps

| Step                             | What it does                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draw`                           | Draw cards.                                                                                                                                                                                                                                                   |
| `powerUp`                        | Change power (negative for "−"), for the turn or the battle. With `perPrevious`, the amount counts once for every card the previous step moved ("+1000 for every card trashed").                                                                              |
| `negateOnPlay`                   | "[On Play] effects are negated" for `self` or `opponent`.                                                                                                                                                                                                     |
| `grantKeyword`                   | Give [Rush], [Blocker], [Double Attack], and so on.                                                                                                                                                                                                           |
| `ko`                             | K.O. Characters.                                                                                                                                                                                                                                              |
| `rest` / `setActive`             | Rest or set active.                                                                                                                                                                                                                                           |
| `returnToHand`                   | Return to the owner's hand.                                                                                                                                                                                                                                   |
| `returnToDeckBottom`             | Place at the bottom of the owner's deck.                                                                                                                                                                                                                      |
| `noBlockers`                     | "Your opponent cannot activate [Blocker]" when the target attacks.                                                                                                                                                                                            |
| `giveRestedDon`                  | Give rested DON!! from the cost area.                                                                                                                                                                                                                         |
| `addDon`                         | Add DON!! from the DON!! deck, active or rested.                                                                                                                                                                                                              |
| `setDonActive`                   | Set rested DON!! as active.                                                                                                                                                                                                                                   |
| `trashFromHand`                  | You trash cards from your hand (optional `filter`).                                                                                                                                                                                                           |
| `opponentTrashesFromHand`        | Your opponent trashes cards from their hand.                                                                                                                                                                                                                  |
| `searchDeck`                     | Look at the top cards, add matching ones to hand, rest to the bottom. `"rest": "trash"` trashes the rest; `"rest": "topOrBottom"` lets the player put the rest at the top or bottom in any order. `"to": "play"` plays the card instead ("play up to 1 ..."). |
| `playFromHand` / `playFromTrash` | Play a card for free.                                                                                                                                                                                                                                         |
| `lifeToHand` / `deckToLife`      | Move cards between Life, hand, and deck (`lifeToHand` takes `fromBottom`).                                                                                                                                                                                    |
| `trashLife`                      | Trash the top of your (`"side": "self"`) or the opponent's Life.                                                                                                                                                                                              |
| `arrangeLife`                    | Look at the top Life card of either player; place it top or bottom.                                                                                                                                                                                           |
| `characterToLife`                | Add a Character to the top or bottom of its owner's Life; `faceUp` for face-up.                                                                                                                                                                               |
| `lifeToDeckTop`                  | Look at all your Life; place 1 on top of your deck, the rest back in any order.                                                                                                                                                                               |
| `trashCharacter`                 | Trash Characters from the field. Not a K.O., so no [On K.O.].                                                                                                                                                                                                 |
| `addThisToHand`                  | [Trigger] only: add this card to your hand.                                                                                                                                                                                                                   |
| `playThis`                       | Play this card: a [Trigger] card, or this card from the trash (e.g. [On K.O.]). `rested` plays it rested.                                                                                                                                                     |
| `handToDeckTop`                  | Place cards from your hand at the top of your deck.                                                                                                                                                                                                           |
| `trashToHand`                    | Add up to `count` matching cards from your trash to your hand.                                                                                                                                                                                                |
| `arrangeDeckTop`                 | Look at the top `look` cards and put them back on top in any order; with `bottom`, any can go to the bottom instead. The player answers with the cards in order, top first.                                                                                   |
| `playFromDeckTop`                | "You may play" the top card of your deck if it matches; `rested` plays it rested; `must` plays it without asking.                                                                                                                                             |
| `noLifeToHand`                   | "You cannot add Life cards to your hand using your own effects during this turn."                                                                                                                                                                             |
| `chooseOne`                      | "Choose one": `options` are `{ "label", "steps" }`; `"chooser": "opponent"` for "your opponent chooses". The player answers with `{ "type": "chooseOne", "option": index }`.                                                                                  |
| `restOpponentDon`                | Rest up to `count` of your opponent's active DON!! cards.                                                                                                                                                                                                     |
| `atEndOfTurn`                    | The nested steps happen at the end of this turn.                                                                                                                                                                                                              |
| `handToDeckBottom`               | Place cards from your hand at the bottom of your deck.                                                                                                                                                                                                        |
| `handToLife`                     | "Add up to 1 card from your hand to the top of your Life cards." Optional `filter`, `fromTrash` ("from your hand or trash"), `onlyTrash` ("from your trash") and `faceUp`.                                                                                    |
| `trashFaceUpLife`                | Trash all of your face-up Life cards.                                                                                                                                                                                                                         |
| `trashDeckTop`                   | Trash cards from the top of your deck.                                                                                                                                                                                                                        |
| `revealedToDeckTop`              | Place the cards revealed by a `revealFromHand` cost at the top of your deck.                                                                                                                                                                                  |
| `setBasePower`                   | "[Leader]'s base power becomes 7000", with an optional `duration`. `leaderBase` copies your Leader's base power.                                                                                                                                              |
| `grantCounter`                   | Permanent only: matching Character cards in your hand have +`amount` Counter.                                                                                                                                                                                 |
| `moveGivenDon`                   | "Give up to 1 of your currently given DON!! cards to ...": the player picks where it comes from, then the target.                                                                                                                                             |
| `replaceBattleKO`                | Sets up the card's own `battleKOReplacement` effect (`effect` is its index) for the rest of the turn.                                                                                                                                                         |
| `deckTopToBottom`                | Place cards from the top of your deck at the bottom.                                                                                                                                                                                                          |
| `copyPower`                      | "This Character's base power becomes the same as the selected Character's power during this turn."                                                                                                                                                            |
| `reorderLife`                    | Look at all of your (`side`) Life cards and place them back in any order.                                                                                                                                                                                     |
| `allLifeFaceDown`                | Turn all of your Life cards face-down.                                                                                                                                                                                                                        |
| `trashLifeDownTo`                | "Trash cards from the top of your Life cards until you have 1 Life card."                                                                                                                                                                                     |
| `playRested`                     | In a `permanent` effect: "Your Character cards are played rested."                                                                                                                                                                                            |
| `trashFromDeck`                  | Trash cards from the top of your deck; `perPrevious` for "the same number of cards as you did from your hand".                                                                                                                                                |
| `winGame`                        | "You win the game."                                                                                                                                                                                                                                           |
| `if`                             | Only do the nested steps if the conditions hold.                                                                                                                                                                                                              |
| `redirectAttack`                 | "Change the target of the attack to ..." the chosen card.                                                                                                                                                                                                     |
| `grantStatus`                    | "Cannot attack", "cannot be K.O.'d ...", and so on. See below.                                                                                                                                                                                                |
| `costChange`                     | Change cost (negative for "−"), for the turn or as a permanent effect.                                                                                                                                                                                        |
| `trashThis`                      | "Then, trash this Stage": trash the effect's own card. Not a K.O.                                                                                                                                                                                             |
| `handDownTo`                     | "Trash cards from your hand until you have 5 cards"; `both` for "you and your opponent".                                                                                                                                                                      |
| `trashToDeckBottom`              | `side` places `count` cards from their trash at the bottom of their deck, in the order they pick.                                                                                                                                                             |
| `handCostChange`                 | In a permanent effect on the field: "The cost of playing {X} cards from your hand will be reduced by 1" (`filter`, `amount`).                                                                                                                                 |
| `swapBasePower`                  | "Select 2 ... Swap the base power of the selected cards with each other": 2 cards from `target`, or 1 from `target` and 1 from `with`.                                                                                                                        |
| `opponentDonMinus`               | "Your opponent returns 1 DON!! card from their field to their DON!! deck".                                                                                                                                                                                    |
| `koImmunity`                     | Permanent: "This Character cannot be K.O.'d by effects of your opponent's Characters with 5000 base power or less" (`from` is the filter for those cards).                                                                                                    |
| `handToDeckShuffle`              | "Your opponent returns all cards in their hand to their deck and shuffles their deck. Then, your opponent draws 5 cards" (`side`, `draw`).                                                                                                                    |
| `cannotAttackLeader`             | "You cannot attack a Leader during this turn." Characters can still be attacked.                                                                                                                                                                              |
| `dealDamage`                     | "Deal 1 damage to your opponent": Life to hand with a [Trigger] check, or the game is won at 0 Life. `"side": "self"` is "you take 1 damage".                                                                                                                 |
| `extraTurn`                      | "Take an extra turn after this one."                                                                                                                                                                                                                          |
| `playFromLifeTop`                | "Reveal 1 card from the top of your Life cards. If that card is ..., you may play that card."                                                                                                                                                                 |
| `noCharacterDonActive`           | "You cannot set DON!! cards as active using Character effects during this turn": later `setDonActive` steps on Characters do nothing.                                                                                                                         |
| `lookAtOpponentDeckTop`          | "Look at 1 card from the top of your opponent's deck." Only the player looking sees it.                                                                                                                                                                       |
| `guessCost`                      | "Choose a cost and reveal 1 card from the top of your opponent's deck. If the revealed card has the chosen cost, ...": the nested `steps` happen on a match. The card stays on top.                                                                           |
| `restrictAttackTargets`          | "This Leader cannot attack your opponent's Characters with a base cost of 7 or less during this turn": `filter` is for the targets it can't attack.                                                                                                           |
| `notPlayableByEffects`           | A permanent effect with `"zone": "hand"`: "This card in your hand cannot be played by effects." It can still be played from the hand.                                                                                                                         |
| `activateEventFromHand`          | "Activate up to 1 ... Event from your hand": its [Main] resolves without paying its cost. `filter` picks which Events.                                                                                                                                        |
| `nextPlayCostChange`             | "The next time you play [Trafalgar Law] from your hand during this turn, the cost will be reduced by 2": `filter` and `amount`; it's used up by the next matching play.                                                                                       |
| `noDrawByOwnEffects`             | "You cannot draw cards using your own effects during this turn": later `draw` steps do nothing.                                                                                                                                                               |
| `freezeOpponentDon`              | "Up to `count` of your opponent's rested DON!! cards will not become active in your opponent's next Refresh Phase."                                                                                                                                           |

`powerUp` and `costChange` take `perTrash: 4` for "+X for every 4 cards in your trash", or
`perCount` (a `count`-style `{ "side", "zone", "filter" }`) for "for every {Straw Hat Crew} type
card on your field".
`powerUp` and `costChange` take `perTrash: 4` for "+X for every 4 cards in your trash" (add
`trashFilter` to count only some cards, e.g. `{ "category": "event" }` for "every 2 Events in
your trash"), and `perRestedDon: 3` for "for every 3 of your rested DON!! cards".

Durations (`duration` on `negateOnPlay`, `powerUp`, `grantKeyword`, `grantStatus`, `costChange`, `noBlockers`):
`"turn"` (the default), `"battle"`, and `"opponentsNextTurn"` for "until the end of your
opponent's next turn" or "... next End Phase".

Statuses for `grantStatus`: `cannotAttack`, `cannotBlock` ("your opponent cannot activate
[Blocker]" on a chosen Character), `cannotBeKOdInBattle`, `cannotBeKOdByEffects`,
`cannotBeKOdByOpponentsEffects`, `cannotBeKOdInBattleByLeaders`, `cannotBeKOdByNonSpecialCharacters` ("cannot be K.O.'d by
effects of Characters without the <Special> attribute"), `cannotBeKOdInBattleBySlash` ("cannot be K.O.'d in
battle by <Slash> attribute cards"), `cannotBeRestedByOpponentsEffects` (unlike
`cannotBeRested`, the card can still attack and block), `noRefresh` (it stays rested through its owner's next Refresh
Phase, whatever the `duration`), `cannotBeRested` (it
can't attack, block, or be rested by costs or effects), and `negated` ("negate the effect of ..."):
a negated card's effects and printed keywords stop working (rule 8-2).

Step options:

- `rest` takes `"stayRested": true` for "and that Character will not become active in your
  opponent's next Refresh Phase", and `"ifYouDo": [steps]` for "you may rest ...: If you do,
  ..." (use `"upTo": true` on its target so the player can decline).
- `playFromHand` and `playFromTrash` take `"rested": true` for "play ... rested", and `"ifYouDo":
[steps]` for "If you do, draw 1 card" (only if a card was played).
- `lifeToHand` takes `"from": "topOrBottom"` for "add 1 card from the top or bottom of your Life
  cards to your hand".
- `playFromHand` and `playFromTrash` take `"rested": true` for "play ... rested".
- `playFromTrash` takes `"sameNameAsTrashed": true` for "the same card name as the trashed card"
  (the card trashed from the hand to pay the effect's cost).
- `playFromHand` takes `"orTrash": true` for "from your hand or trash", and
  `"differentColor": true` for "a different color than the returned Character" (the cards the
  previous removal step moved).
- `searchDeck` takes `"play": true` for "look at 5 cards ... and play up to 1 ...": the picked
  Character or Stage is played (with `rested` if it says so) and the rest go to the bottom.
- `handToDeckBottom` takes `"side": "opponent"` for "your opponent must place 1 card from their
  hand at the bottom of their deck" (they pick).
- `playThis` on a Stage's [Trigger] plays the Stage.
- `handToDeckTop` takes `"topOrBottom": true` for "place 2 cards from your hand at the top or bottom of
  your deck in any order".
- `trashToDeckBottom` takes a `filter` ("your opponent places 3 Events from their trash ...").
- `characterToLife` takes `"top": true` for "add it to the top of your Life cards" (no choice of the bottom).
- `atEndOfTurn` remembers the cards picked or played before it, so its steps can use `{ "side": "that" }`
  for "place the Character played by this effect at the bottom of the owner's deck at the end of this turn".
- `trashAtLeast` takes a `filter` ("if you have 4 or more Events in your trash").
- The `giveActiveDon` cost takes a `filter` ("give 1 active DON!! to 1 of your [Silvers Rayleigh]"); later
  steps' `{ "side": "that" }` is the card given the DON!!.
- `addDon` takes `"side": "opponent"` for "your opponent adds 1 DON!! card from their DON!! deck".
- `restOwnDon` takes `"ifYouDo": [steps]` for "you may rest 1 of your DON!! cards: If you do, ...".
- `trashFromHand` takes `"ifYouDo": [steps]` for "you may trash 1 card from your hand. If you do, ..."
  (with `"upTo": true`).

A Leader with [Blocker] can block like a Character.

`powerUp` takes `perTrash: 4` for "+X power for every 4 cards in your trash".

`searchDeck` takes `"to": "lifeFaceUp"` for "add ... to the top of your Life cards face-up".

### Game rules on a card

Some Leaders change the rules of the game. Write them as steps in a `permanent` effect:

- `faceUpLifeToDeckBottom`: "Your face-up Life cards are placed at the bottom of your deck
  instead of being added to your hand, according to the rules" (damage only; no [Trigger] check).
- `winOnDeckOut`: "when your deck is reduced to 0, you win the game instead of losing".
- `deckOnlyType` (`"type": "East Blue"`): "you can only include {East Blue} type cards in your
  deck". `checkDeck` flags other cards.

Each block is tested in `packages/engine/scenarios/effects/` using made-up `TEST-` cards.
