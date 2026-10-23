# Card assets policy

Strawhat Simulator shows real cards with their exact art and text, and every card uses its
official card number (for example, `OP13-001` is the real OP13-001). The project is free and
will never be monetized.

## Where card data lives

- **This repository (the engine and app) contains no official card art or card text.** Engine
  tests use made-up cards whose ids start with `TEST-`.
- **Card art, text, and stats live in a separate repository,
  [strawhat-card-data](https://github.com/Whysodeep1994/strawhat-card-data).** The app downloads
  them when it runs.

Keeping them apart means a takedown request about card assets can't remove the game code or its
history.

## Rules for contributors

1. Never commit card images, logos, or official card text to this repository.
2. Card data changes go to `strawhat-card-data`.
3. Never add paid features, ads, or anything that sells access to Bandai's intellectual property.

The `card-assets/` folder is ignored by Git for local images during development.
