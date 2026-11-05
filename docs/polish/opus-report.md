# Bara UI/UX polish — audit and fixes (opus)

Base commit: `7c974d9`. Branch: `t3/bara-ui-polish`.

## How I audited

- agent-browser 0.41.2, session `polish-opus`, against `vite preview` on port 4611 with the
  same `live.json` / `fetch-log.jsonl` as the baseline.
- All three pages at 1440×900, 1024×768, 390×844 and 360×780 (the most common cheap
  Android width), light and dark, keyboard only (Tab walk with the focused element logged),
  and with `prefers-reduced-motion: reduce`.
- `agent-browser a11y` (axe-core 4.12, WCAG 2 A/AA) on every page in both colour schemes.
- Horizontal-overflow probe (`scrollWidth` vs `clientWidth`, plus the offending elements).
- Failure states forced with `network route`: `live.json` aborted, and a mocked region with
  no score.
- Contrast ratios computed for every token pair that mattered (numbers below).
- `modern-web-guidance`: read the `accessibility` and `responsive-table` guides before
  writing CSS/HTML (focus-ring contrast, `pointer: coarse` targets, skip links, focusable
  scroll regions).

## Ranked findings

Severity: **high** = broken or unreadable for some users; **medium** = clear friction or a
DESIGN.md rule broken; **low** = finish and rhythm.

| # | Finding | Where | Severity | Fixed |
|---|---|---|---|---|
| 1 | **Pages scroll sideways on 360px phones.** `<Sourced>` set `white-space: nowrap` on the whole value, so sentence-length values (risk range, Kisah 7-day count) pushed the page to 368–382px. | Pantau hero, Kisah 2026 section | high | yes `00f2f52` |
| 2 | **The 20-year map was invisible on phones.** The phone camera draws Indonesia across the middle of the screen, exactly where the centred year text sat, under a full-height 86% backing. The core visual of the story did not show on mobile. | Kisah timeline, <960px | high | yes `04ccf47` |
| 3 | **Focus ring disappears on the sky.** The 2px ember outline is 1.01:1 on `--sky-3` ('tinggi'), 2.09:1 on sky-4, 2.65:1 on mist (WCAG 1.4.11 needs 3:1). | Region select and ⓘ in the sky panel, everywhere | high | yes `f006a8f` |
| 4 | **Sources table rows broken.** MPeat and Natural Earth rows had 5 cells in a 4-column table: notes spilled into an unlabeled 5th column and the Natural Earth link sat under 'Pembaruan'. | Metode, Data yang dipakai | high | yes `13d4890` |
| 5 | **Dark-mode links fail contrast.** `--sedge` #4F6B43 on #1B1410 is 3.05:1; axe flagged every source link (55 nodes). | Metode, popovers, dark | high | yes `150a2ae` |
| 6 | **'No data' sky unreadable in dark mode.** The hatched sky-0 panel ('Memuat…', 'Risiko belum bisa dihitung') used dark-mode ink #EADFD3 on #D3D3CF: 1.14:1. | Pantau hero, dark | high | yes `ebb7c33` |
| 7 | **Ember text for status and warnings.** 'basi' cells and warning lines were ember (2.65:1, axe violation) and broke the 'ember only for hotspots + focus ring' rule. Same for the Pantau health warning and the 'belum diverifikasi' tag. | Metode log, Pantau health rows, popovers | high | yes `d1cf13b`, `c5a09ef`, `b33d065` |
| 8 | **One-finger scroll trapped by the map on phones.** The map is 62svh of a scrolling page; a swipe that lands on it pans the map instead of scrolling. | Pantau mobile | high | yes `8ea71e6` |
| 9 | **Peat diagram labels vanish in dark mode.** 'bara' and 'gambut' used `--mist`, which turns deep peat; 'muka air' inherited the water group's 0.35 opacity in both modes. | Kisah, Gambut section | medium | yes `464cae3` |
| 10 | **Kisah desktop text runs over the brightest columns.** The scrim faded on fixed 42%/62% stops, so at 1024–1280px it thinned mid-column. | Kisah desktop | medium | yes `1a2514a` |
| 11 | **Year panel flush to the screen edge on phones.** The sticky timeline is not a `.kisah-block`, so it had no 16px gutter. | Kisah mobile | medium | yes `23450fe` |
| 12 | **Bare error state.** Failed `live.json` showed one sentence pointing to 'Kesehatan data', which is not shown in that state; no heading, no retry. | Pantau | medium | yes `7ef6e9d` |
| 13 | **Small tap targets.** ⓘ 20×24, region select 30px tall, zoom 29px, popup close a 15px glyph, legend summary 20px. | Pantau, all ⓘ | medium | yes `6937e72` |
| 14 | **English map controls.** 'Zoom in', 'Zoom out', 'Toggle attribution', 'Map' on an Indonesian page. | Pantau map | medium | yes `bea21ed` |
| 15 | **No mark on the selected cell.** Picking a top cell flew to it, but nothing on the map showed which cell was selected once the popup closed. | Pantau map | medium | yes `02a0e02` |
| 16 | **Legend covers the attribution on phones.** | Pantau mobile map | medium | yes `e56d02d` |
| 17 | **Popovers inherit headline type.** On the 2015 big figures the source popover rendered in Anybody 800. | Kisah, any ⓘ inside a headline | medium | yes `8a13259` |
| 18 | **No skip link** (WCAG 2.4.1); four header stops before content on every page. | All pages | medium | yes `b9bdf93` |
| 19 | Sky panel ⓘ is dark-mode tea on a light sky (1.9:1). | Pantau hero, dark | medium | yes `54a2df1` |
| 20 | 'Sel paling berisiko' rows: one run-on line, indented 4px off the gutter, no link to the colour scale. | Pantau panel | low | yes `bd2631c` |
| 21 | Kesehatan data rows wrap mid-figure ('…9.146 titik, 3 / jam lalu'). | Pantau panel | low | yes `c5a09ef` |
| 22 | Score formula wraps inside terms, leaving '· r )' alone on phones. | Metode | low | yes `1501000` |
| 23 | ⓘ on the 2015 one-number screens scales to a 4.5rem circle that competes with the figure. | Kisah | low | yes `0ad1355` |
| 24 | Risk range wraps as 'keyakinan / tinggi. ⓘ' on 390px (follows from #1). | Pantau mobile | low | yes `c40c171` |
| 25 | Fetch effect sets state after a superseded request (react-doctor warning). | Pantau | low | yes `f156b2e` |
| 26 | Scrollable tables not keyboard-focusable. | Metode | low | yes (in `d1cf13b`) |
| 27 | axe reports peat text on Kisah as low contrast in dark mode. False positive: axe cannot see the canvas sky behind the text; the screenshots show peat on a light sky. | Kisah, dark | n/a | not a bug |
| 28 | Basemap attribution text 'Data from' is English (comes from the OpenFreeMap style). | Pantau map | low | no |
| 29 | Metode is a single 68ch column hugging the left edge at 1440px; lots of empty right side. DESIGN.md asks for left alignment, so I left it. | Metode desktop | low | no |
| 30 | Kisah's 'Bagikan halaman ini' changes its label to 'Tautan tersalin' with no live region, so screen readers may not hear it. | Kisah close | low | no |
| 31 | Inline formulas in Metode prose (`h = min(1, ln(1 + n) / …)`) can break mid-expression on phones; keeping them whole would overflow at 320px. | Metode | low | no |

### Contrast numbers used

| Pair | Ratio |
|---|---|
| ember on sky-3 / sky-4 / sky-2 / mist | 1.01 / 2.09 / 1.94 / 2.65 |
| sedge #4F6B43 on dark surface | 3.05 → new dark sedge #93B283: 7.74 |
| dark ink #EADFD3 on sky-0 | 1.14 |
| dark tea #B08B6A on sky-2 / sky-1 | 1.87 / 2.27 |
| tea #6B4423 on mist (light) | 6.97 |

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (62 tests), `npm run build`: all pass.
- `npx -y react-doctor@latest --yes --no-telemetry --blocking error`: exit 0, 0 errors,
  5 warnings (6 before `f156b2e`; the rest are in code I did not restructure:
  fetch-in-effect ×3, Kisah component size and complexity).
- axe: 0 violations on all three pages in light mode, and on Pantau and Metode in dark
  mode (Kisah dark: the canvas false positive above).
- No horizontal scroll on any page at 360px.
- Screenshots: before and after sets were captured locally with the same agent-browser
  script, `docs/polish/capture.sh`, and compared one by one. The PNGs are not committed
  (about 27 MB). To reproduce a set (needs agent-browser), run
  `npm run build && npx vite preview --port 4610` in one terminal and leave it running,
  then in a second terminal run `docs/polish/capture.sh http://localhost:4610 <out-dir>`.

## Commits

Each commit is one idea. Cherry-pick notes are listed where a commit depends on another.

| Commit | Change | User-visible effect |
|---|---|---|
| `00f2f52` | Long `<Sourced>` values wrap; ⓘ glued to the last word | No sideways scroll on 360px phones |
| `f006a8f` | Focus ring: 3px ember plus 2px ink keyline (DESIGN.md) | Keyboard focus visible on every sky colour |
| `13d4890` | Fix 5-cell rows in the sources table | Metode table columns line up |
| `d1cf13b` | Fetch log uses status dots; warnings as a tea-ruled list; tables focusable | Log readable, axe violation gone, ember rule kept |
| `150a2ae` | Dark-mode `--sedge` #93B283, new `--sedge-sky` (DESIGN.md) | Links readable in dark mode |
| `464cae3` | Peat diagram labels in stable light ink; tint only the water | 'bara', 'gambut', 'muka air' readable (needs `150a2ae`) |
| `23450fe` | 16px gutter on the mobile year panel | Year and bars no longer touch the screen edge |
| `04ccf47` | Mobile year panel split top/bottom on live-sky bands (DESIGN.md) | The 20-year map shows on phones (apply after `23450fe`) |
| `1a2514a` | Desktop scrim stops tied to the text column's edge | Story text never runs over bright columns |
| `bea21ed` | MapLibre locale in Bahasa Indonesia | 'Perbesar', 'Perkecil', 'Tutup', 'Peta' |
| `8ea71e6` | Cooperative gestures on touch screens under 960px | One finger scrolls the page; two move the map (apply after `bea21ed`) |
| `e56d02d` | Legend top-left on phones | Attribution no longer covered |
| `02a0e02` | `cells-selected` outline layer | Selected cell framed in ink on the map |
| `6937e72` | Coarse-pointer tap targets (DESIGN.md) | ⓘ, select, zoom, popup close, legend easy to hit (DESIGN.md context follows `f006a8f`) |
| `ebb7c33` | `.sky-hatch` sets peat ink | 'Risiko belum bisa dihitung' readable in dark mode |
| `7ef6e9d` | Load-failure state with 'Coba lagi' and a link to the log | A clear way forward when data fails |
| `b33d065` | 'belum diverifikasi' tag in tea | Readable tag; ember rule kept |
| `8a13259` | Popover type reset | Popovers always in the body face |
| `bd2631c` | Top cells: sky swatch, position, right-aligned score | List scans like the signal rows |
| `c5a09ef` | Health rows: name line + tea detail line; warning in ink | Five sources scan as a list |
| `1501000` | Formula terms kept whole | Formula breaks between terms on phones |
| `0ad1355` | Smaller ⓘ on the one-number screens | The figure leads, not the icon |
| `b9bdf93` | 'Langsung ke konten' skip link, `main#konten` | One Tab past the header (touches `7ef6e9d`'s markup) |
| `f156b2e` | AbortController on the Pantau fetch | No stale state after retry (needs `7ef6e9d`) |
| `c40c171` | Balanced risk range, 'dari 100' glued | Even two-line break on phones (pairs with `00f2f52`) |
| `54a2df1` | Sky-panel ⓘ follows the sky ink | ⓘ visible in dark mode |

## Tried and changed or reverted

- **Kisah big-figure ⓘ at a flat 0.4em**: on phones that made it smaller than the line
  below. Changed to `max(1.125rem, 0.4em)` before committing.
- **Mobile year bands from the snapped year sky (`--sky`)**: the canvas sky blends between
  years, so a seam showed between band and map (pale blue bands over a sepia sky). Switched
  the bands and ink to the blended `--live-sky` / `data-ink` before committing.
- **Plain `text-wrap: balance` on the risk range**: split 'dari / 100'. Added a no-break
  space before committing.
- **Opening Pantau's legend with a negative-margin summary**: the open legend grew a gap
  under 'Legenda'; removed the bottom padding when open, so the open legend is the same
  height as before (251px vs 250px).
- To test cooperative gestures I faked `(pointer: coarse)` with an init script in a
  separate throwaway session (`polish-coarse`, closed afterwards), because device emulation
  did not report a touch pointer. Every other command used `polish-opus`.
