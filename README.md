# nkl.online

Personal site for Nick Larson. A scattered field of images pulled live from
[are.na](https://www.are.na/nick-larson/channels), and a bio that recombines
and degrades itself over time using [RiTa.js](https://rednoise.org/rita/).

No build step, no dependencies to install. Three files and a CDN script tag.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup. Also holds a static copy of the bio so the page reads without JavaScript. |
| `styles.css` | All styling. Browser-default sans-serif, no webfonts. |
| `script.js` | are.na fetching, tile layout and rotation, bio recombination. |
| `CNAME` | Custom domain for GitHub Pages. |
| `favicon.svg` | Favicon. Drawn as geometry, not text, so it renders the same without your fonts. Inverts in dark mode. |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon.ico` | Fallbacks for browsers that ignore SVG icons. Opaque, so they stay legible on dark browser chrome. |
| `apple-touch-icon.png` | 180×180 home-screen icon for iOS. Must be opaque — iOS renders transparency as black. |

## Running locally

Open `index.html` directly, or serve it to avoid any CORS surprises:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying to GitHub Pages

1. Push this directory to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**, select `main` and `/ (root)`.
4. Under **Custom domain**, enter `nkl.online`. The included `CNAME` file
   sets this too, so it should populate on its own.
5. Tick **Enforce HTTPS** once the certificate finishes provisioning.

**Add the domain in GitHub before touching DNS.** Pointing DNS at GitHub
while the domain is not yet claimed on a repo allows someone else to host a
site on it.

Then at your DNS provider, point the domain at GitHub:

| Type | Host | Value |
| --- | --- | --- |
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `CNAME` | `www` | `<your-username>.github.io` |

Optionally add `AAAA` records on `@` for IPv6: `2606:50c0:8000::153`,
`2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

Delete any default parking or redirect records the registrar created for
`@` or `www` first — they will conflict.

DNS can take up to 24 hours to propagate. Verify with:

```sh
dig nkl.online +noall +answer -t A
```

## How it works

### Image tiles

Images are fetched from the are.na channel set by `ARENA_CHANNEL_SLUG` in
`script.js`. Twelve tiles are scattered across a jittered grid, each checked
against the others so none is buried. Every five seconds one tile fades out
and a different block from the channel fades in, placed as far as possible
from the one that left.

Blocks listed in `PINNED_BLOCK_IDS` are never rotated out.

### Where a tile links

Resolved in this order, first match wins:

1. **A URL in the block's description on are.na** — the easiest way to set a
   link. Accepts a bare URL, a markdown `[label](url)`, or a bare `www.host`.
2. **`BLOCK_LINK_OVERRIDES`** in `script.js`, keyed by block ID.
3. **A Link block's own scraped source URL.**
4. **Instagram**, as a fallback, so no tile is a dead end.

To repoint a tile, add the URL to that block's description in are.na. No code
change needed.

### The bio

The opening clause is drawn at random from `BIO_PRIMARY_PRACTICES`; everything
after it is fixed. The bio then moves through three phases:

| Time | Behavior |
| --- | --- |
| 0–30s | A new variant every 5 seconds. |
| 30–60s | Words start swapping for words they rhyme with, and Markov-generated sentences are appended. Names and function words are held back. |
| 60s+ | All restrictions lift — any word can change, including names. |

The closing line (*Follow him on are.na or instagram*) is appended at render
time and never enters the mutating text, so it is excluded from all
recombination.

## Tuning

Constants at the top of each section in `script.js`:

| Constant | Effect |
| --- | --- |
| `TILE_COUNT` | Number of tiles on screen. |
| `TILE_MIN_SIZE` / `TILE_MAX_SIZE` | Tile size range, as a % of field width. |
| `MAX_OVERLAP` | How much tiles may overlap before a position is rejected. |
| `SWAP_EVERY_MS` | How often a tile is swapped. |
| `FADE_MS` | Crossfade duration — keep in sync with the `.tile` transition in `styles.css`. |
| `DEGRADE_AFTER_MS` | When the bio starts mutating. |
| `UNLEASH_AFTER_MS` | When every restriction lifts. |
| `RHYME_RATE` | Share of eligible words swapped per pass. |
| `EXTEND_CHANCE` | Chance a pass appends a Markov sentence. |
| `MAX_BIO_LENGTH` | Cap on bio growth, so it stays on screen. |

## Notes

- RiTa is loaded from a CDN and is about 1.5MB. Both scripts are `defer`red,
  so it never blocks first paint, and nothing depends on it for 30 seconds.
- If the are.na request fails the page still renders, with empty bordered
  tiles and a non-degrading bio.
- A `prefers-reduced-motion` rule disables tile fades for anyone who has asked
  their system to reduce animation.
