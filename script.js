// ---------------------------------------------------------------
// CONFIG — set this to your are.na channel slug to pull live images.
// e.g. if your channel URL is are.na/nick-larson/homepage-feed,
// the slug is "homepage-feed".
// Leave blank to render empty bordered tiles (matches the sketch).
// ---------------------------------------------------------------
const ARENA_CHANNEL_SLUG = 'nkl-online';

// Number of squares to scatter across the field each load.
const TILE_COUNT = 12;

// ---------------------------------------------------------------
// BLOCK LINK OVERRIDES — force specific are.na blocks to open a
// specific URL when clicked, regardless of block class or scraped
// source. Useful for Image blocks (which have no source.url) or to
// point a Link block somewhere other than what it auto-scraped.
// Find a block's ID from its are.na URL, e.g.
// are.na/block/47853400 -> id 47853400.
// ---------------------------------------------------------------
const BLOCK_LINK_OVERRIDES = {
  48222961: 'https://digitalcommons.risd.edu/cgi/viewcontent.cgi?article=1832&context=masterstheses',
  16501236: 'https://www.instagram.com/nkl.nkl.nkl.nkl.nkl/',
  48226283: 'https://www.holo.mg/shop/holo-3/',
  48226282: 'https://www.holo.mg/shop/holo-3/',
  48226281: 'https://www.holo.mg/shop/holo-3/',
  16500854: 'https://publications.risd.edu/grad-show-2022-graphic-design/nick-larson',
  16500974: 'https://publications.risd.edu/grad-show-2022-graphic-design/nick-larson',
  16500977: 'https://publications.risd.edu/grad-show-2022-graphic-design/nick-larson',
  16497967: 'https://publications.risd.edu/grad-show-2022-graphic-design/nick-larson',
  16500776: 'https://portals.risd.gd/gallery.html',
  16826109: 'https://www.are.na/nick-larson/channels',
  10076707: 'https://www.are.na/nick-larson/channels',
  6319859: 'https://www.are.na/nick-larson/channels',
  17028884: 'https://www.are.na/nick-larson/channels',
  10278312: 'https://www.are.na/nick-larson/channels',
  10278300: 'https://www.are.na/nick-larson/channels',
};

// ---------------------------------------------------------------
// PINNED BLOCKS — are.na block IDs that should always be included
// among the tiles on every load, instead of being subject to the
// random shuffle/selection.
// ---------------------------------------------------------------
const PINNED_BLOCK_IDS = [48222961, 16501236];

// ---------------------------------------------------------------
// FALLBACK LINK — any block with no override above and no scraped
// source URL of its own points here, so every tile is clickable.
// ---------------------------------------------------------------
const DEFAULT_BLOCK_LINK = 'https://www.instagram.com/nkl.nkl.nkl.nkl.nkl/';

// ---------------------------------------------------------------
// DESCRIPTION LINKS — put a URL in a block's description on are.na
// and the tile opens it. This takes precedence over everything else,
// so a block can be repointed from are.na without touching the code.
// Accepts a bare URL, a markdown [label](url), or a bare www.host.
// ---------------------------------------------------------------
function extractUrlFromDescription(description) {
  if (!description || typeof description !== 'string') return null;

  // Markdown-style link first, so the URL is taken rather than the label.
  const markdown = description.match(/\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)\s*\)/i);
  if (markdown) return cleanUrl(markdown[1]);

  const bare = description.match(/https?:\/\/[^\s<>"'`\])]+/i);
  if (bare) return cleanUrl(bare[0]);

  // A host written without a scheme, e.g. "www.example.com/page".
  const noScheme = description.match(/(?:^|\s)(www\.[^\s<>"'`\])]+)/i);
  if (noScheme) return cleanUrl(`https://${noScheme[1]}`);

  return null;
}

// Trims sentence punctuation that commonly trails a pasted URL.
function cleanUrl(url) {
  const trimmed = url.replace(/[.,;:!?]+$/, '');
  return trimmed.length > 8 ? trimmed : null;
}

// Fisher–Yates shuffle — returns a new shuffled array, doesn't mutate input.
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// How much one tile's footprint is allowed to overlap another's before
// it counts as "hidden" and gets re-rolled. Measured as intersection
// area / smaller-tile area, in 0-100% coordinate space (an approximation
// that ignores rotation, which is fine at these rotation angles).
const MAX_OVERLAP = 0.35;

// Tile size range, as a percentage of the field's width.
const TILE_MIN_SIZE = 10;
const TILE_MAX_SIZE = 18;

function overlapRatio(a, b) {
  const ax2 = a.left + a.size;
  const ay2 = a.top + a.size;
  const bx2 = b.left + b.size;
  const by2 = b.top + b.size;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.top, b.top));
  const interArea = ix * iy;
  const smallerArea = Math.min(a.size * a.size, b.size * b.size);
  return smallerArea > 0 ? interArea / smallerArea : 0;
}

// Generates a fresh, dramatically-scattered layout every call: a loose
// jittered grid (so tiles still roughly cover the field instead of
// clumping) with wide-range random size and rotation on top. Every tile
// is kept fully within the 0-100% field bounds, and each new tile is
// re-rolled (up to a few tries) if it would end up mostly buried under
// an already-placed one.
function generateSlots(count) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ r, c });
  }

  const placed = [];

  shuffle(cells)
    .slice(0, count)
    .forEach(({ r, c }) => {
      const cellTop = r * cellH;
      const cellLeft = c * cellW;

      let best = null;
      const attempts = 25;
      for (let i = 0; i < attempts; i++) {
        // Shrink size a bit on later attempts so a spot is easier to find.
        const shrink = i > 12 ? 0.85 : 1;
        const size = rand(TILE_MIN_SIZE, TILE_MAX_SIZE) * shrink;
        const maxTop = Math.max(cellH - size, 0);
        const maxLeft = Math.max(cellW - size, 0);
        const top = Math.min(cellTop + rand(0, maxTop), 100 - size);
        const left = Math.min(cellLeft + rand(0, maxLeft), 100 - size);
        const candidate = { top, left, size };

        const worstOverlap = placed.reduce(
          (max, p) => Math.max(max, overlapRatio(candidate, p)),
          0
        );

        if (worstOverlap <= MAX_OVERLAP) {
          best = candidate;
          break;
        }
        // Keep the least-bad option seen so far as a fallback.
        if (!best || worstOverlap < best._overlap) {
          best = { ...candidate, _overlap: worstOverlap };
        }
      }

      placed.push(best);
    });

  // Kept as numbers so the swap logic can do geometry against them;
  // they're formatted into percentages at render time.
  return placed.map(({ top, left, size }) => ({
    top,
    left,
    size,
    rot: rand(-40, 40),
  }));
}

// Finds a spot for an incoming tile that is well clear of the tiles
// already on screen, and as far as possible from where the outgoing
// tile was — so the new block reads as arriving somewhere new rather
// than quietly replacing something in place.
function pickNewSlot(occupied, avoid) {
  const attempts = 60;
  const valid = [];
  let fallback = null;

  for (let i = 0; i < attempts; i++) {
    const size = rand(TILE_MIN_SIZE, TILE_MAX_SIZE);
    const candidate = {
      top: rand(0, 100 - size),
      left: rand(0, 100 - size),
      size,
    };

    const worstOverlap = occupied.reduce(
      (max, p) => Math.max(max, overlapRatio(candidate, p)),
      0
    );

    if (worstOverlap <= MAX_OVERLAP) {
      valid.push(candidate);
    } else if (!fallback || worstOverlap < fallback._overlap) {
      fallback = { ...candidate, _overlap: worstOverlap };
    }
  }

  const centerDist = c => {
    if (!avoid) return 0;
    const dx = c.left + c.size / 2 - (avoid.left + avoid.size / 2);
    const dy = c.top + c.size / 2 - (avoid.top + avoid.size / 2);
    return Math.sqrt(dx * dx + dy * dy);
  };

  const chosen = valid.length
    ? valid.reduce((a, b) => (centerDist(b) > centerDist(a) ? b : a))
    : fallback;

  return { ...chosen, rot: rand(-40, 40) };
}

// ---------------------------------------------------------------
// TILE ROTATION — every few seconds one tile fades out and a
// different block fades in where it was. Pinned blocks are never
// rotated out, so their links stay reachable.
// ---------------------------------------------------------------

// How often a tile is swapped for a different block.
const SWAP_EVERY_MS = 5000;
// Fade duration; must match the CSS transition on .tile.
const FADE_MS = 600;

// Live state for the rotation: the fixed grid of positions, what is
// currently in each one, and the full set of blocks to draw from.
let tileSlots = [];
let activeTiles = [];
let tilePool = [];

function createTileElement(data, slot) {
  const tile = document.createElement('div');
  tile.className = 'tile is-entering';
  tile.style.top = `${slot.top}%`;
  tile.style.left = `${slot.left}%`;
  tile.style.width = `${slot.size}%`;
  tile.style.aspectRatio = '1 / 1';
  tile.style.transform = `rotate(${slot.rot}deg)`;

  if (data && data.url) {
    // Link blocks (e.g. an are.na block pointing at an external page)
    // get wrapped in an anchor so the tile opens that page on click.
    const wrapper = data.href
      ? document.createElement('a')
      : document.createElement('div');
    if (data.href) {
      wrapper.href = data.href;
      wrapper.target = '_blank';
      wrapper.rel = 'noopener';
    }
    wrapper.className = 'tile-inner';

    const img = document.createElement('img');
    img.src = data.url;
    img.loading = 'lazy';
    img.alt = '';
    wrapper.appendChild(img);

    tile.appendChild(wrapper);
  }

  return tile;
}

// Drops the .is-entering class on the next frame so the opacity
// transition actually runs instead of being applied instantly.
function fadeIn(tile) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => tile.classList.remove('is-entering'));
  });
}

function buildTiles(tiles) {
  const field = document.getElementById('tile-field');
  field.innerHTML = '';

  tileSlots = generateSlots(TILE_COUNT);
  activeTiles = [];

  tileSlots.forEach((slot, i) => {
    const data = tiles[i] || null;
    const tile = createTileElement(data, slot);
    field.appendChild(tile);
    fadeIn(tile);
    activeTiles.push({ el: tile, data });
  });
}

// Swaps a single tile: pick a slot holding a non-pinned block, fade
// that tile out, and fade in an unused block from the pool in its
// place with a fresh rotation.
function swapOneTile() {
  const field = document.getElementById('tile-field');
  if (!field || !tilePool.length || !activeTiles.length) return;

  // Slots eligible to be emptied — pinned blocks stay put.
  const eligible = activeTiles
    .map((t, i) => i)
    .filter(i => {
      const data = activeTiles[i].data;
      return !data || !PINNED_BLOCK_IDS.includes(data.id);
    });
  if (!eligible.length) return;

  // Blocks not currently on screen anywhere.
  const onScreen = new Set(
    activeTiles.map(t => t.data && t.data.id).filter(Boolean)
  );
  const available = tilePool.filter(t => !onScreen.has(t.id));
  if (!available.length) return;

  const slotIndex = eligible[Math.floor(Math.random() * eligible.length)];
  const incoming = available[Math.floor(Math.random() * available.length)];

  // Place the newcomer against every tile that is staying, and push it
  // away from the slot being vacated.
  const staying = tileSlots.filter((_, i) => i !== slotIndex);
  const slot = pickNewSlot(staying, tileSlots[slotIndex]);
  const outgoing = activeTiles[slotIndex].el;

  outgoing.classList.add('is-leaving');
  setTimeout(() => outgoing.remove(), FADE_MS);

  const tile = createTileElement(incoming, slot);
  field.appendChild(tile);
  fadeIn(tile);

  tileSlots[slotIndex] = slot;
  activeTiles[slotIndex] = { el: tile, data: incoming };
}

function startTileRotation() {
  if (tilePool.length <= TILE_COUNT) return;
  setInterval(swapOneTile, SWAP_EVERY_MS);
}

async function loadArenaImages() {
  if (!ARENA_CHANNEL_SLUG) {
    buildTiles([]);
    return;
  }

  try {
    // Fetch more blocks than we need — the channel may include Text/Link
    // blocks with no image, so we over-fetch and take the first N that
    // actually resolve to an image.
    const res = await fetch(
      `https://api.are.na/v2/channels/${ARENA_CHANNEL_SLUG}/contents?per=50`
    );
    if (!res.ok) throw new Error(`are.na request failed: ${res.status}`);
    const data = await res.json();

    const candidates = (data.contents || [])
      // Any block class (Image, Link, Media, Attachment...) can carry an
      // image preview — don't restrict to class === 'Image'.
      .filter(block => block.image)
      .map(block => ({
        id: block.id,
        url:
          block.image.display?.url ||
          block.image.large?.url ||
          block.image.original?.url ||
          block.image.square?.url,
        // Precedence: a URL in the block's are.na description wins, so
        // links can be managed from are.na directly; then a manual
        // override from the list above; then whatever a Link block
        // scraped; and finally Instagram, so no tile is a dead end.
        href:
          extractUrlFromDescription(block.description) ??
          BLOCK_LINK_OVERRIDES[block.id] ??
          (block.class === 'Link' ? block.source?.url : null) ??
          DEFAULT_BLOCK_LINK,
      }))
      .filter(t => t.url);

    // Pinned blocks always make it in; the remaining slots are filled
    // from a shuffle of everything else, so the rest of the field
    // still changes on every reload.
    const pinned = candidates.filter(t => PINNED_BLOCK_IDS.includes(t.id));
    const rest = candidates.filter(t => !PINNED_BLOCK_IDS.includes(t.id));
    const fillCount = Math.max(TILE_COUNT - pinned.length, 0);
    const tiles = shuffle([...pinned, ...shuffle(rest).slice(0, fillCount)]);

    // Everything the channel returned stays available, so the rotation
    // has blocks to bring in that aren't already on screen.
    tilePool = candidates;

    buildTiles(tiles);
    startTileRotation();
  } catch (err) {
    console.warn('are.na fetch failed, rendering empty tiles.', err);
    buildTiles([]);
  }
}

// ---------------------------------------------------------------
// BIO MAD-LIBS — randomly select bio variations on page load
// ---------------------------------------------------------------
const BIO_PRIMARY_PRACTICES = [
  "the relationship between automation and intention.",
  "the relationship between automation and attention.",
  "automation and recombination.",
  "the order of language and it's significance on meaning.",
  "relationships between humans and technology.",
  "recombination, automation, and knowledge production.",
  "recombination and automation.",
  "systems of reproduction and control.",
  "combinatorial systems and automation.",
  "language, meaning, and order.",
  "the relationship between control and automation.",
  "degradation of information over time.",
  "the effects of translation on information.",
  "hyperreality and attention.",
  "mixed metaphors and multiple meanings.",
  "the inherent overdetermination of contemporary reality.",
  "the absurdity that arises when humans submit to technology.",
  "using technology for unproductive means.",
];

// The link is marked in the plain text with two private-use sentinel
// characters rather than real HTML. They carry no letters, so the rhyme
// pass steps straight over them — the words *inside* the link are free
// to mutate like any others, while the anchor itself survives and stays
// clickable no matter what the text decays into.
const LINK_OPEN = '';
const LINK_CLOSE = '';
const LINK_HREF = 'https://aac.risd.edu/';

const BIO_MIDDLE =
  'His practice holds signs and symbols in productive ambiguity; tracing ' +
  'the tension between humanity and technology, and the relationship ' +
  'between authorship and control.';
const BIO_FACULTY =
  'He is a faculty member at Rhode Island School of Design, where he ' +
  `teaches ${LINK_OPEN}Art and Computation${LINK_CLOSE}.`;
const BIO_CLOSING =
  'He is from Massachusetts, currently living and working in Rhode Island.';

function bioFrom(practice) {
  return (
    `Nick Larson is an artist and designer working with ${practice} ` +
    `${BIO_MIDDLE} ${BIO_FACULTY} ${BIO_CLOSING}`
  );
}

function stripSentinels(s) {
  return s.split(LINK_OPEN).join('').split(LINK_CLOSE).join('');
}

// ---------------------------------------------------------------
// CODA — a fixed closing line, appended at render time only. It is
// never part of the mutating bio string, so the Markov chain is not
// trained on it, the rhyme pass never sees it, and generated
// sentences are always inserted above it rather than after it.
// ---------------------------------------------------------------
const ARENA_PROFILE_URL = 'https://www.are.na/nick-larson/channels';
const INSTAGRAM_URL = 'https://www.instagram.com/nkl.nkl.nkl.nkl.nkl/';

const BIO_CODA_HTML =
  '<span class="bio-coda">Follow him on ' +
  `<a href="${ARENA_PROFILE_URL}" target="_blank" rel="noopener">are.na</a>` +
  ' or ' +
  `<a href="${INSTAGRAM_URL}" target="_blank" rel="noopener">instagram</a>.` +
  '</span>';

function getRandomBio() {
  const practice =
    BIO_PRIMARY_PRACTICES[
      Math.floor(Math.random() * BIO_PRIMARY_PRACTICES.length)
    ];
  return bioFrom(practice);
}

function escapeHTML(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Renders plain bio text to HTML, turning the sentinel-marked span back
// into the RISD anchor — whatever its wording has degraded into — and
// pinning the untouched coda to the end.
function renderBio(text) {
  const html = escapeHTML(text);
  const open = `<a href="${LINK_HREF}" target="_blank" rel="noopener">`;
  const body = html
    .split(LINK_OPEN).join(open)
    .split(LINK_CLOSE).join('</a>');
  return body + BIO_CODA_HTML;
}

// ---------------------------------------------------------------
// RiTa DEGRADATION — after a delay the bio starts rewriting itself:
// words are swapped for words they rhyme with, and new sentences are
// generated by a Markov chain trained on every bio variant.
// ---------------------------------------------------------------

// How long the bio behaves itself before it starts coming apart.
const DEGRADE_AFTER_MS = 30000;
// How often it mutates once it has started.
const DEGRADE_EVERY_MS = 2500;
// Chance any given eligible word is swapped for a rhyme each pass.
const RHYME_RATE = 0.08;
// Chance a pass appends a new Markov-generated sentence.
const EXTEND_CHANCE = 0.4;
// Stop growing past this many characters so the box stays on screen.
const MAX_BIO_LENGTH = 1400;
// At 60s every restriction lifts: no protected words, no length floor.
// Names, function words and the link text all become swappable.
const UNLEASH_AFTER_MS = 60000;

// Words this length or shorter are skipped. Set to 0 at 60s, at which
// point even "a" and "he" are eligible.
let rhymeMinLength = 3;

// Emptied at 60s so nothing is off-limits.
let rhymeProtected = new Set([
  'nick', 'larson', 'rhode', 'island', 'massachusetts', 'risd',
  'art', 'and', 'computation', 'design', 'school',
  'is', 'a', 'an', 'the', 'he', 'his', 'in', 'of', 'at', 'to', 'on',
  'for', 'with', 'from', 'where', 'that', 'when', 'it', 'its',
]);

function liftAllRestrictions() {
  rhymeMinLength = 0;
  rhymeProtected = new Set();
}

let rhymeCache = null;
let bioMarkov = null;
// Words already sent for an async rhyme lookup, so each is asked once.
const rhymeLookupsInFlight = new Set();

function ritaReady() {
  return typeof RiTa !== 'undefined' && RiTa;
}

// Trains the Markov chain on every possible bio variant, so generated
// sentences recombine across all of them rather than echoing one.
function buildMarkov() {
  if (!ritaReady()) return null;
  try {
    const markov = RiTa.markov(2);
    // Sentinels are stripped so generated sentences never carry a stray
    // half of a link marker into the text.
    BIO_PRIMARY_PRACTICES.forEach(p =>
      markov.addText(stripSentinels(bioFrom(p)))
    );
    return markov;
  } catch (err) {
    console.warn('RiTa markov build failed', err);
    return null;
  }
}

// RiTa.rhymes() is async, so lookups are resolved up front and cached;
// the mutation passes themselves stay synchronous. Every word in the
// corpus is cached regardless of length or protection, because the
// protections all lift at 60s and short words become eligible then.
async function buildRhymeCache() {
  if (!ritaReady()) return {};
  const corpus = stripSentinels(BIO_PRIMARY_PRACTICES.map(bioFrom).join(' '));
  const words = [
    ...new Set((corpus.match(/[A-Za-z']+/g) || []).map(w => w.toLowerCase())),
  ];

  const cache = {};
  try {
    const results = await Promise.all(
      words.map(w => RiTa.rhymes(w).catch(() => []))
    );
    words.forEach((w, i) => {
      cache[w] = results[i] && results[i].length ? results[i] : [];
    });
  } catch (err) {
    console.warn('RiTa rhyme cache failed', err);
  }
  return cache;
}

// Rhyme swaps introduce words that were never in the corpus. Without
// this the text would stop evolving once the original vocabulary was
// used up, so unknown words are looked up in the background and become
// swappable on a later pass.
function lazyCacheRhymes(word) {
  if (!ritaReady() || !rhymeCache) return;
  if (word in rhymeCache || rhymeLookupsInFlight.has(word)) return;
  rhymeLookupsInFlight.add(word);
  RiTa.rhymes(word)
    .then(r => {
      rhymeCache[word] = r && r.length ? r : [];
    })
    .catch(() => {
      rhymeCache[word] = [];
    });
}

function matchCapitalization(original, replacement) {
  return /^[A-Z]/.test(original)
    ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
    : replacement;
}

function rhymePass(text) {
  if (!rhymeCache) return text;
  return text.replace(/[A-Za-z']+/g, word => {
    const lower = word.toLowerCase();
    if (lower.length <= rhymeMinLength || rhymeProtected.has(lower)) {
      return word;
    }
    if (Math.random() > RHYME_RATE) return word;
    const rhymes = rhymeCache[lower];
    if (!rhymes) {
      // Never seen this word — queue it for the next pass.
      lazyCacheRhymes(lower);
      return word;
    }
    if (!rhymes.length) return word;
    const pick = rhymes[Math.floor(Math.random() * rhymes.length)];
    return matchCapitalization(word, pick);
  });
}

function markovExtend(text) {
  if (!bioMarkov || text.length > MAX_BIO_LENGTH) return text;
  try {
    const sentence = bioMarkov.generate();
    return sentence ? `${text} ${sentence}` : text;
  } catch (err) {
    return text;
  }
}

function initializeBio() {
  const bioElement = document.querySelector('.bio');
  if (!bioElement) return;

  let currentBio = getRandomBio();
  bioElement.innerHTML = renderBio(currentBio);

  // Phase 1 — swap in a whole new variant every 5s.
  const cycleInterval = setInterval(() => {
    currentBio = getRandomBio();
    bioElement.innerHTML = renderBio(currentBio);
  }, 5000);

  // Prepare RiTa in the background while phase 1 is still running, so
  // the switch to phase 2 is instant.
  if (!ritaReady()) {
    console.warn('RiTa not loaded — bio will keep cycling without degrading.');
    return;
  }

  bioMarkov = buildMarkov();
  buildRhymeCache().then(cache => {
    rhymeCache = cache;
  });

  // Phase 2 (30s) — stop cycling, start mutating the text in place,
  // with names and function words still held back.
  setTimeout(() => {
    clearInterval(cycleInterval);
    setInterval(() => {
      currentBio = rhymePass(currentBio);
      if (Math.random() < EXTEND_CHANCE) currentBio = markovExtend(currentBio);
      bioElement.innerHTML = renderBio(currentBio);
    }, DEGRADE_EVERY_MS);
  }, DEGRADE_AFTER_MS);

  // Phase 3 (60s) — every restriction lifts. Any word can go.
  setTimeout(liftAllRestrictions, UNLEASH_AFTER_MS);
}

// Initialize bio and tiles on page load
initializeBio();
loadArenaImages();
