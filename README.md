# Strawhat Simulator

An unofficial, open-source simulator for the One Piece Card Game.

> **Not affiliated with Bandai.** This is a free, non-commercial fan project. "ONE PIECE" and the
> One Piece Card Game are trademarks of their owners. Card data lives in a separate repository;
> see [docs/CARD_ASSETS.md](docs/CARD_ASSETS.md).

## Goals

1. **Rules accuracy:** match the official Comprehensive Rules, proven by automated tests.
2. **Online multiplayer:** a server runs the game, so hidden cards stay hidden.
3. **Easy updates:** new sets, errata, and banlists are data, not new code.
4. **Friendly and modern:** clean UI, deck builder, tutorial.
5. **Fast:** quick to load, light on resources.

## Status

The rules engine works, and a playable game runs in the browser: you against a simple computer
opponent, with the official cards and art from
[strawhat-card-data](https://github.com/Whysodeep1994/strawhat-card-data), on a table laid out
like the official playmat. Each player can upload a picture to use as their playmat. See [PROJECT_LOG.md](PROJECT_LOG.md) for what's done and what's next,
and [docs/RULES_COVERAGE.md](docs/RULES_COVERAGE.md) for which rules are tested.

## Project layout

| Folder            | What it holds                                                                         |
| ----------------- | ------------------------------------------------------------------------------------- |
| `packages/engine` | The rules engine: pure game logic, no graphics.                                       |
| `packages/web`    | The browser app: game board and computer player.                                      |
| `packages/server` | The public website on Cloudflare and the Play a Friend relay (see `docs/HOSTING.md`). |
| `docs`            | Contributor docs, asset policy, rules questions.                                      |
| `.github`         | Automatic checks (CI) and issue/PR templates.                                         |

## Developing

You need [Node.js 22](https://nodejs.org/) and [pnpm](https://pnpm.io/installation).

```sh
pnpm install   # download the tools
pnpm check     # format check, lint, typecheck, and tests
pnpm test      # tests only
pnpm coverage:rules  # rebuild docs/RULES_COVERAGE.md
pnpm --filter @strawhat/web dev  # play in your browser at the address it prints
pnpm build     # build everything; the game becomes packages/web/dist/strawhat-simulator.html
```

The app needs the card data next to it. Clone
[strawhat-card-data](https://github.com/Whysodeep1994/strawhat-card-data) and copy its cards,
decks and images into the app (they are not stored in this repo):

```sh
node packages/web/scripts/card-data.mjs ../strawhat-card-data
```

The single-file build loads them from a `card-data` folder beside it, so serve both from the
same place.

`pnpm check` also runs automatically before every commit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[GNU AGPL-3.0-or-later](LICENSE). Anyone may use, change, and share this code. If you run a
modified version as an online service, you must share your changes under the same license.
