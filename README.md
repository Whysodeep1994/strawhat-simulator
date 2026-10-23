# Strawhat Simulator

An unofficial, open-source simulator for the One Piece Card Game.

> **Not affiliated with Bandai.** This is a fan project. "ONE PIECE" and the One Piece Card Game
> are trademarks of their owners. This repository contains no card images, logos, or official
> card text; see [docs/CARD_ASSETS.md](docs/CARD_ASSETS.md).

## Goals

1. **Rules accuracy:** match the official Comprehensive Rules, proven by automated tests.
2. **Online multiplayer:** a server runs the game, so hidden cards stay hidden.
3. **Easy updates:** new sets, errata, and banlists are data, not new code.
4. **Friendly and modern:** clean UI, deck builder, tutorial.
5. **Fast:** quick to load, light on resources.

## Status

Early setup. See [PROJECT_LOG.md](PROJECT_LOG.md) for what's done and what's next.

## Project layout

| Folder            | What it holds                                    |
| ----------------- | ------------------------------------------------ |
| `packages/engine` | The rules engine: pure game logic, no graphics.  |
| `docs`            | Contributor docs, asset policy, rules questions. |
| `.github`         | Automatic checks (CI) and issue/PR templates.    |

## Developing

You need [Node.js 22](https://nodejs.org/) and [pnpm](https://pnpm.io/installation).

```sh
pnpm install   # download the tools
pnpm check     # format check, lint, typecheck, and tests
pnpm test      # tests only
```

`pnpm check` also runs automatically before every commit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[GNU AGPL-3.0-or-later](LICENSE). Anyone may use, change, and share this code. If you run a
modified version as an online service, you must share your changes under the same license.
