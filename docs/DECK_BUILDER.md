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

## Tournament decks from Egman Events

Egman Events collects top tournament deck lists. For now, the app links to Egman: players copy
a list there and paste it in. We are asking Egman for permission and an API so winning decks
can be listed inside the app. Until they say yes, the app does not fetch data from Egman
automatically.
