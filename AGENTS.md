# Kindle Display — Agent Context

## Project

A Bitcoin status display built from a jailbroken Kindle 4 (K4). The hacked Kindle
periodically pulls a greyscale screenshot from a local server, which assembles live
Bitcoin data into a webpage. Fork of
[naltatis/kindle-display](https://github.com/naltatis/kindle-display).

Two-part system:

```
+------+   update X minutes    +------+
|      |  ------------------>  |      |
|      |         wifi          |      |
|      |  <------------------  |      |
+------+    greyscale image    +------+
 kindle                         server
```

- The **server** (`server/`) assembles data, renders a webpage, and screenshots it.
- The **kindle** (`kindle/`) downloads the screenshot and paints it on the e-ink screen.

## Repository layout

```
server/            Node.js web server + data pipeline (the main codebase)
  index.js         Express app; renders the current theme from data/data.json
  data.mjs         Node data pipeline: fetches the latest block, rates, quotes,
                   fees, lightning, mempool blocks and writes data/data.json
  cron.sh          Entrypoint for cron: runs data.mjs, then screenshots the page
                   with headless firefox and converts with pngcrush
  helpers.mjs      ESM helpers (writeJSON, currency, sats2BTC) shared w/ views
  views/*.pug      Pug templates; one per theme (plain, onchain, lightning, mining)
  public/          Static assets (fonts, styles)
  data/            data.json + the generated display.png / screenshot.png
  .env             Runtime config (see .env.sample)
  Dockerfile       Optional container packaging (server + cron + firefox-esr)
kindle/            Shell scripts deployed to the Kindle
  mnt/base-us/update.sh   Downloads display.png and renders it via eips
  mnt/base-us/RUNME.sh    Init: stops framework, disables screensaver, renders
  paste-to-install.sh     One-shot installer (edit SERVER then paste on device)
README.md          Full jailbreak + setup walkthrough
```

## Server behaviour

- `server/index.js` is a single-route Express app (`GET /{:theme}`). It reads
  `data/data.json`, resolves the theme (`plain` default; `random` picks one of
  `plain`/`onchain`/`lightning`/`mining`), and renders the template with `helpers`.
- `server/data.mjs` is the data pipeline. It loads `.env` and prefers a
  local Mempool instance when configured (`MEMPOOL_BASE_URL`), falling back to
  the public mempool.space otherwise. The block height comes from the Mempool
  API (`GET /api/v1/blocks/`); the newest block is stored in full.
- `server/cron.sh` is meant to be scheduled (e.g. every 5 minutes). It runs
  `data.mjs`, then captures `http://localhost:$DISPLAY_SERVER_PORT` with headless
  Firefox at 600x800 and converts the PNG to greyscale with `pngcrush`.

## Commands

```bash
cd server
npm install
cp .env.sample .env     # adapt settings
npm start               # node index.js  (port 3030)
./cron.sh               # refresh data + regenerate display.png
```

There is no test suite and no lint/build tooling — verification is manual (view
`http://localhost:3030/display.png` or a theme route in a browser).

## Environment configuration (`server/.env`)

Key variables (see `server/.env.sample` for all with comments):

| Variable | Purpose |
|----------|---------|
| `DISPLAY_SERVER_PORT` | HTTP port (default `3030`) |
| `DISPLAY_THEME` | Default theme: `plain`, `onchain`, `lightning`, `mining`, `random` |
| `MEMPOOL_BASE_URL` | Use a local Mempool instance instead of mempool.space |
| `DISPLAY_RATE1` / `DISPLAY_RATE2` | Fiat currencies to show (USD, EUR, GBP, CHF, CAD, AUD, JPY) |

## Conventions

- **Server:** Node.js, [Express 5](https://expressjs.com/), [Pug](https://pugjs.org/)
  templates, dotenv for config. CJS (`index.js`) and ESM (`helpers.mjs`) coexist,
  so `index.js` requires `helpers.mjs` via `require('./helpers.mjs')` — keep
  matching the existing mix where adding files.
- **Data:** `data.mjs` is ESM and uses the global `fetch` to pull the JSON
  from the Mempool and Bitcoin Quotes APIs and writes `data/data.json`.
- **Shell:** server scripts use bash (`#!/bin/bash`); Kindle scripts are POSIX sh
  (`#!/bin/sh`) because they run on the e-reader.
- All paths referenced in `index.js` (`data/data.json`, `public`, `data/display.png`,
  `data/screenshot.png`) are relative to the `server/` working directory (or
  `__dirname`) — run node from `server/`.

## Credits

- [naltatis/kindle-display](https://github.com/naltatis/kindle-display)
- [mpetroff Kindle Weather Display](http://mpetroff.net/2012/09/kindle-weather-display/)
- [The Hacker's SB Developer's Guide](http://www.mobileread.com/forums/showthread.php?t=267541)

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
