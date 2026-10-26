# Hosting the public website

Anyone can play Strawhat Simulator at a public link, without claude.ai. The site runs free on
Cloudflare as one Worker (`wrangler.jsonc`, code in `packages/server`):

- **The game** is served as static files: the built app from `packages/web/dist`, with the card
  data and images copied in at build time.
- **Play a Friend** goes through a small relay at `/rooms/<name>`. Each online game gets its own
  room (a Durable Object) that passes the two players' notes between them, the same way the
  claude.ai live room does. The app finds the relay by asking `/rooms`; on claude.ai it keeps
  using the live room instead. See `packages/server/src/hub.ts` and `packages/web/src/relay.ts`.

Official card art and text still never enter this repository. The build downloads them from
[strawhat-card-data](https://github.com/Whysodeep1994/strawhat-card-data) into git-ignored
folders and converts the images to WebP (about 230 MB for the whole site).

## How it updates

Cloudflare watches the `main` branch of this repository. Every merge rebuilds and republishes the
site with the newest card data, in about five minutes. A change to strawhat-card-data alone does
not trigger a rebuild; use **Retry build** on the latest build in the Cloudflare dashboard (or
merge any simulator change) to pick it up.

## First-time setup (done once, by the owner)

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. In the dashboard open **Workers & Pages**, choose **Create application**, then **Import a
   repository**.
3. Connect your GitHub account and pick `strawhat-simulator`. GitHub asks which repositories
   Cloudflare may see; choosing just this one is enough.
4. On the setup page:
   - **Project name:** `strawhat-simulator` (it must match `name` in `wrangler.jsonc`).
   - **Build command:** `pnpm site`
   - **Deploy command:** `npx wrangler deploy` (the default).
   - Leave the root directory empty.
5. Choose **Save and Deploy**. When the build finishes, the site is at
   `https://strawhat-simulator.<your-account>.workers.dev`.

Everything used fits Cloudflare's free plan: static files are free and unlimited, the relay uses
a few requests per move (100,000 a day are free), and rooms sleep while players think.

## Building and testing on your own computer

```sh
CARD_DATA_DIR=../strawhat-card-data pnpm site   # or plain `pnpm site` to download the card data
pnpm --filter @strawhat/server dev              # serves the site and relay at http://localhost:8787
```

Open the address in two browser windows and use Play a Friend to play yourself.
