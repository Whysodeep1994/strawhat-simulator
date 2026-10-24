# Deck builder

The deck builder screens come with the app (roadmap Phases 5 and 7). The logic behind them is
already in the engine, so it is tested before any screen exists.

## Searching for cards

`searchCards(catalog, search)` returns the matching cards in card number order. Every field
is optional, and a card must match every field that is set.

| Field        | Example                  | What it does                                               |
| ------------ | ------------------------ | ---------------------------------------------------------- |
| `id`         | `"op13-1"`, `"OP13 001"` | Card number search; partial numbers list every match.      |
| `sets`       | `["OP13", "ST01"]`       | Only cards from these sets.                                |
| `colors`     | `["red", "green"]`       | Cards with at least one of these colours.                  |
| `categories` | `["character"]`          | Leader, Character, Event, or Stage.                        |
| `types`      | `["Straw Hat Crew"]`     | Cards with at least one of these types.                    |
| `cost`       | `{ min: 4, max: 6 }`     | The cost range slider; leaves out cards with no cost.      |
| `text`       | `"zoro"`                 | Free text across name, card number, and types.             |
| `leader`     | `"OP13-001"`             | Only cards that can go in this Leader's deck (rule 5-1-2). |

`searchOptions(catalog)` lists the sets, colours, categories, and types that exist, and the
lowest and highest cost, so the menus and the slider always match the cards available.

## Importing and exporting deck lists

`parseDeckList(catalog, text)` reads the plain-text lists that One Piece deck sites copy out,
one card per line:

```text
1xOP13-001
4xOP13-002
4 x OP01-016
OP05-060 x2
```

Headings such as `Leader` or `Characters (36)`, blank lines, and lines starting with `//` or
`#` are skipped. Alternate-art numbers such as `OP01-016_p1` fall back to the base card. It
returns the Leader, the 50 cards, and a list of problems by line number. Run `validateDeck` on
the result before playing.

`formatDeckList({ leader, deck })` writes a deck back out in the same format, so players can
share decks with other sites.

## Formats: Standard legality

`checkDeck(catalog, format, leader, deck)` lists every reason a deck can't be played in a
format, in plain words ("Nami (OP01-016) is banned in Standard"). An empty list means the deck
is legal. `copyLimit(format, catalog, cardId)` says how many copies a card may have: 0 when
it's banned or its block has rotated out, otherwise 4 or its restricted limit.

A format is data (`DeckFormat`). Standard comes from strawhat-card-data's
`formats/standard.json`, copied from Bandai's official regulation pages. It holds:

- `deckSize` and `maxCopies` (50 and 4).
- `legalBlocks`: the block icons allowed this season, e.g. `[2, 3, 4, 5, "X"]`.
- `alwaysLegal`: card numbers that are legal whatever their block (reprints, Super Parallel Rares).
- `treatedAsBlock`: card numbers Bandai treats as a newer block, e.g. `"ST01-011": 4`.
- `banned`, `restricted` (card number → copies), and `bannedPairs`.

Parallel prints such as `OP01-016_p1` follow their card number's rules. Without a format file
the app checks the base rules only (rule 5-1-2).

## In the app

The home screen's **My decks** has **Build a deck**. The builder searches every card by name,
type, effect text, card number, set, colour, card type, type, and a two-handle cost slider. Tap a
Leader first; the library then shows only cards that Leader can use, Standard-legal ones first.
Sort the library by card number, cost, power, card type or attribute, low to high or high
to low. Point at a card to see its art enlarged with every printed detail (card number,
rarity, cost, power, counter, attribute, types, block, effect text) in the right-hand panel;
on a touch screen, press and hold a card. Decks save in the browser as you go, and a deck can be played once it's legal in Standard.
Starter decks are played as printed, even where their cards have rotated out of Standard.
