# Card assets policy

Card images, logos, and official card text belong to Bandai and are **never** committed to
this repository or bundled in a release.

What we do instead:

1. **Images** are loaded at runtime from a source the user chooses, or from a folder on the
   user's own computer. Cards without an image show a plain text frame.
2. **Card rules** are stored as our own structured data (stats, keywords, and effects made of
   building blocks), not copied printed text.
3. **No Bandai or ONE PIECE logos** in our name, icon, screenshots, or store pages.
4. **Nothing is sold.** Donations may cover server costs only, with no paid perks tied to
   Bandai's intellectual property.
5. **Takedowns:** card data lives in its own package, so it can be removed without touching the
   engine.

The `card-assets/` folder is ignored by Git for local images during development.
