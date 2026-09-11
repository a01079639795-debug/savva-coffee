# SAVVA | سافا — savvacoffee

A bilingual (English / Arabic) production site for **SAVVA**, a specialty coffee
house in Madinah, Saudi Arabia. Static HTML, CSS and vanilla JS — no framework,
no runtime dependencies, no build tooling beyond Node.

---

## Run it

```bash
node build.js && node tools/serve.js
```

Then open <http://localhost:4173>. `build.js` regenerates `index.html`,
`ar/index.html`, the map files and the menu sprite; `tools/serve.js` is a
dev-only static server (not deployed).

**Before deploying, set the real domain** — it feeds canonical URLs, hreflang
alternates, Open Graph and the sitemap:

```bash
SITE_URL=https://your-domain.example node build.js
```

Without it the build prints a warning and falls back to `https://savvacoffee.sa`.

Deploy the repository root as-is to any static host — a domain root, or a
project path such as `https://<user>.github.io/<repo>/`. Every URL inside the
pages is relative to the page, so nothing needs configuring beyond `SITE_URL`
(set it to the full address, path included). Nothing is server-rendered.

To check a project-path deploy locally:
`node tools/serve.js --base=/savva/`, then open <http://localhost:4173/savva/>.

---

## Structure

```
index.html                 built — English
ar/index.html              built — Arabic (RTL)
src/content.js             every word, price, fact and review, in both languages
src/template.js            the page renderer shared by both editions
src/menu-art.js            the menu drawings (one per item without a photo)
src/map-data.json          the streets and buildings around SAVVA, from OpenStreetMap
src/map-svg.js             draws that data flat, for the collapsed map card
build.js                   all of the above → the two pages + generated assets
assets/css/savva.css       design tokens and all styling
assets/js/savva.js         navigation, reveals, the signature sequence, the map card
assets/js/savva-cup.js     the Savva Melon cup in WebGL, fetched as its section nears
assets/js/savva-map.js     the 3D map in WebGL, fetched as the location card nears
assets/data/savva-map.json built — the map data the 3D scene loads
assets/img/savva-map.svg   built — the flat map
assets/img/menu-art.svg    built — the menu drawings as one sprite
assets/img/                brand photography, the logo lockup, the ornament
tools/                     dev-only: static server, map fetcher, SVG optimiser, colour probe
```

Both pages come from one content model, so the Arabic edition can never fall
behind the English one. **Edit `src/content.js`, then re-run `build.js`** — never
edit the generated files directly.

---

## Where the brand came from

Nothing here was invented. Each decision traces to SAVVA's own material.

### Colour

Sampled from the brand's own assets, not guessed:

| Token | Value | Sampled from |
| --- | --- | --- |
| `--color-primary` | `#7F8265` | The Instagram avatar (`#808366`) and the story-highlight covers (`#828269`, `#7D8262`) — the same olive as the paper cups |
| `--color-secondary` | `#E3D2BB` | The wordmark lettering, and the type colour in the printed menu PDF (`#E0D1B5`) |

`tools/probe.html` is the sampler that produced those figures — open it through
the dev server to re-run it against the images in `assets/img/`.

Everything else in the palette (`--olive-300…900`, `--cream-300…500`,
`--ink-700…900`) is a lighter or darker step of those two, so no colour on the
site is one the brand does not already own. The menu section sits on
`--olive-700` rather than the lighter olive specifically so cream type clears
4.5:1 contrast on that large field. The signature sequence tints its stage
with each drink's own tone, sampled from SAVVA's photographs of it.

### The logo

`assets/img/savva-lockup.svg`, `savva-wordmark.svg` and `savva-arabic.svg` are
the **real lockup**, lifted as vector outlines from SAVVA's own menu PDF — not
traced, not redrawn. `ornament-cup.svg` is the brand's line-drawn glass carafe
from the same file. The lockup and wordmark are inlined at build time so they
take the surrounding text colour; the carafe stays an `<img>` because it is
decorative, single-toned and 25 kB.

### Type

The printed menu is set in **Bell MT** (product names), **Bahnschrift** (prices)
and **Ubuntu Arabic**. The web faces were chosen to sit in the same register:

- **Fraunces** — display Latin. Its SOFT and WONK axes carry the swelling,
  slightly retro character of the SAVVA wordmark.
- **Archivo** — Latin text, UI and all numerals; a DIN-adjacent grotesque in
  the spirit of Bahnschrift, with tabular figures for prices.
- **Amiri** — Arabic display. A naskh serif, the natural counterpart to an
  editorial Latin serif.
- **IBM Plex Sans Arabic** — Arabic text and UI; humanist, like Ubuntu Arabic.

Arabic is never letter-spaced and never upper-cased; it carries its own
line-height (`1.95` body, `1.28` display) and its own kicker sizing. Those
switches live in one `:root:lang(ar), [dir="rtl"]` block in the stylesheet.

### Facts

| | Source |
| --- | --- |
| Address (English and Arabic), hours, phone, plus code, coordinates, rating, review count | The Google Maps listing for "سافا savva" |
| The three guest reviews | The same listing — quoted verbatim, read 2026-09-11 |
| Streets, buildings, parks, landmark names on the map | OpenStreetMap (© OpenStreetMap contributors, ODbL) |
| Positioning line, city, tagline, handle | Instagram `@savva_cafe` |
| Every menu item, price and calorie figure | The SAVVA menu PDF's own text layer, extracted in both scripts |
| Photography | SAVVA's own Instagram posts; the Madini Cookies card SAVVA posted to its Google Maps listing |
| Photographs of the room and the front | Guests' photos on the same Google Maps listing, credited by name on the page |

Four English spellings are corrected from the print file where the Arabic
confirms the intended product — `FLAT WAIT` → Flat White, `WAIT MOCAH` → White
Mocha, `ICE WAIT MOCHA` → Ice White Mocha, `CHEEESECAKE` → Cheesecake. Arabic
names are reproduced exactly as printed.

The Google rating is shown as a **stated fact attributed to Google**, and is
deliberately *not* marked up as `aggregateRating`: self-hosted markup of a
third party's aggregate is against Google's structured-data policy.

---

## Motion

Three levels, all switched off under `prefers-reduced-motion: reduce`.

1. **Micro** — link underlines that retract, buttons that fill from below,
   images that drift on hover, the navigation underline.
2. **Story** — masked line-by-line heading reveals, section fades, and a light
   scroll parallax written to a `--py` custom property so CSS keeps ownership
   of the transform.
3. **Signature** — the pinned *pour* sequence, the 3D cup, and the flight
   into the map. Used three times on the whole page, on purpose.

All scroll work runs through a single `requestAnimationFrame`-throttled handler,
which re-syncs on `visibilitychange` so a page loaded in a background tab is
never left mid-state.

---

## The pour

Three signature drinks, one pinned scene. Each stands in an arched window —
SAVVA's photograph at close to its native size, rather than a 640 px export
blown up edge to edge — on a field of the drink's own colour: matcha green,
melon amber, hibiscus red. `savva.js` sets `--stage` to the active drink's
tone and the stage fades between them. The arch and the name sit side by side
on desktop (mirrored in Arabic) and stack on a phone.

## The cup

One section, `#ritual`, carries a single real drink — **Savva Melon**, read out
of the `signature` list by key so its name, line, price and calorie figure can
never drift from the menu — as the page's product hero, in real 3D.

`assets/js/savva-cup.js` draws it in raw WebGL with no library, so the site
keeps its zero-dependency rule. It is about 29 kB and is fetched only as the
section comes within reach, so the first screen never waits on it. The model
is built from SAVVA's own photographs: the tapered clear PET cup with its
rolled rim and flat snap lid, the peach slush packed up under it (colours
sampled from the photos), and the green print — the brand's own wordmark SVG
with COFFEE beneath it, wrapped round the cylinder where SAVVA prints it.

- **Materials.** The slush is lit with a soft wrap and a little light carried
  through it. The plastic reflects a small studio (two tall softboxes and a
  top light) by Fresnel, with a cold-drink frost and condensation beads.
- **Motion.** The scroll driver in `savva.js` still owns the progress and
  writes `--t`, `--enter`, `--dom`, `--name` and `--exit` on the section; the
  cup reads them and eases towards them. It rises out of depth turning, comes
  round until the print faces the viewer as it takes the room, straightens
  from its lean, and recedes as its name lands. A slow float sits underneath,
  and a fine pointer moves the camera a few degrees.
- **Layout.** The photograph stays in the DOM as the slot the cup is sized to
  and centred on; an off-axis projection keeps the cup head-on wherever that
  slot sits, in either language.
- **Fallbacks.** Without WebGL, if the context is lost, without JS, or with
  Save-Data on, the photograph composition ships instead, moved by the same
  scalars. Under `prefers-reduced-motion` the cup renders one still frame per
  scroll. Devices reporting four cores or fewer, and small screens, get fewer
  facets, no condensation and a lower pixel ratio.

## The menu

Every line carries a picture, so a guest can see what each name *is*:

- **SAVVA's own photograph** of the item where one exists and the item is
  certain — Matcha Berry and Savva Melon (captioned by name on SAVVA's post),
  Hibiscus Slush Savva and the Halloumi Sandwich. `photo` on the item in
  `content.js` crops the square around the drink itself.
- **A drawing** of that kind of drink or dish everywhere else
  (`src/menu-art.js`): the vessel it is served in and the colours of what is
  in it — the clear SAVVA cup with its green print for cold drinks, ceramic,
  glass, the cezve, the V60, the slices. They are drawings on purpose: a stock
  photograph of some other café's latte would be a false picture of SAVVA's.
  The menu note says so in both languages.

Adding a `photo` to any item replaces its drawing; nothing else changes. On
wide screens a category is set in two columns, like the printed menu.

## The gallery

Justified bands. Every photograph in a band shares one height and keeps
its own proportions, so each band fills the width exactly — nothing overlaps
and nothing is left hanging. On a phone the bands dissolve into a two-column
grid. `band` on each entry in `content.js` says which band it is in.

The first band is the room: the lounge under its arched windows, a coffee on
the lounge table, a tray of drinks. SAVVA's Instagram has no photograph of the
inside, so these are guests' photos from the Google Maps listing; `by` holds
the contributor's name and the page credits them under the gallery. The front
at night, beside the address in *Visit*, is credited the same way. Neither is
the night facade other SAVVA sites open with.

## The location card

`#savva-3d-location` is SAVVA on the real map.

- **The data** is OpenStreetMap's: every road, building footprint, park and
  mosque within about 2.6 km, fetched once by `tools/fetch-map.js` and baked
  into `src/map-data.json` — local metres around SAVVA's Google Maps
  coordinates, simplified and rounded (36 kB). The labels are real names from
  the same data, in both scripts: Sultana Road, King Abdullah Road, Khalid Bin
  Al Waleed Road, Masjid al-Qiblatayn, Uthman ibn Affan's Farm & Well. One
  13-hectare outline mis-tagged as a building is left out, and the bake says
  so. OSM has no heights here, so block height is a drawing convention read
  off the footprint, not a survey.
- **Collapsed**, the card is a small plate that tilts toward the pointer on a
  spring: the city's arterials drawn flat (`assets/img/savva-map.svg`), a
  pulse where SAVVA stands, the name, the address and an open/closed pill read
  from the published hours in Saudi time.
- **Opened**, it springs to full size and `assets/js/savva-map.js` (raw
  WebGL, fetched as the card nears) takes over from exactly the flat map's
  framing: the camera dives into Bir Uthman, turning to face Sultana Road and
  al-Qiblatayn, while the side streets draw outward from SAVVA and the blocks
  rise. The pin lands on the real coordinates and a small plate comes up
  beside it — name, address in the page's language, open now or not,
  *Directions* and *Google Maps*. Drag turns the map.
- **No request to any map service** is made by any of this. Google's own map
  still loads inside the card only if the visitor presses *Show Google Maps
  here*. The OpenStreetMap credit sits on the card wherever the map shows.
- **Fallbacks.** Without WebGL or on Save-Data the flat map opens pitched back
  with the same pin and plate. Without JS the card ships open and still.
  Under `prefers-reduced-motion` it opens straight to the final view.

Re-fetch the map with `node tools/fetch-map.js`, then rebuild.

## Guest reviews

Three five-star reviews by Google Local Guides, quoted verbatim from SAVVA's
listing in the Arabic they were written in, on both editions — nothing is
translated or reworded on a guest's behalf. Google shows each one cut short
with "…", and the quote stops exactly there. The verified aggregate (4.7
across 729 reviews) sits above them as one line. To change them, edit
`guestQuotes` in `src/content.js` — the format is in the comment above it.

---

## Notes

- **Images** are SAVVA's own Instagram posts, in two sizes. `assets/img/` holds
  Instagram's 640 px export; where the original post is larger (896–3072 px), a
  sharper copy under the same name sits in `assets/img/hd/`, 896–1280 px wide.
  The build reads both widths into a `srcset`, and each use of a photo says how
  wide it is drawn (`SIZES` in `src/template.js`), so a phone or a dense screen
  takes the sharp copy while a small frame keeps the light one. The two reel
  covers, `coffee-pour-cups` and `matcha-berry-melon`, exist only at 360 × 640.
  Put a file in `hd/` and the next build uses it.
- **Without JavaScript** the page is fully readable: every menu category shows
  at once, the signature drinks stack vertically, and nothing stays hidden
  behind a reveal.
