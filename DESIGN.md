# Bara — design system

Bara (Indonesian for "ember") is an early-warning monitor for forest and peatland fires
(karhutla) in Indonesia. The name points at the core fact of peat fires: embers keep
burning underground after the surface looks safe.

Audience: village volunteers, Manggala Agni and BPBD staff, journalists, and the curious
public, often on low-end Android phones. UI language: Bahasa Indonesia.

## The one idea: the sky is the data

People in Palangka Raya, Pekanbaru and Jambi read fire season off the sky. In 2015 it went
sepia; in September 2019 Jambi's sky turned red. Bara uses that colour as its main
visual device:

- **Monitor (`/`)**: the left panel's background is the "sky" for the selected region,
  set by its current risk class. Low risk is a humid pale sky. Very high risk is the
  Jambi red.
- **Story (`/kisah/`)**: the page background follows the sky of each year in the
  timeline. 2015 and 2019 go sepia and red; quiet years stay pale.

Everything else stays quiet, like a field instrument: one ink colour, plain rules, no
decoration.

## Colour tokens

Base palette (light):

| Token | Hex | Role |
|---|---|---|
| `--peat` | `#2A1D15` | Ink: body text, map outlines, and the land in the 3D scene. Peat-soil brown, never black. |
| `--tea` | `#6B4423` | Secondary ink, rules, muted text. The colour of Kalimantan blackwater rivers. |
| `--mist` | `#E6EAE4` | Page surface: humid morning grey-green. |
| `--ember` | `#F2611D` | Only for satellite hotspots, plus the focus ring. Used for nothing else. |
| `--sedge` | `#4F6B43` | Links and the "data OK" status. Green of intact peat-swamp forest. |

Risk and sky scale: one sequential scale, also used for the map grid cells. Always shown
with a text label, never colour alone.

| Class | Token | Hex | Text on it |
|---|---|---|---|
| Rendah | `--sky-1` | `#CFDFE2` | peat |
| Sedang | `--sky-2` | `#D9C79A` | peat |
| Tinggi | `--sky-3` | `#C47F3A` | peat |
| Sangat tinggi | `--sky-4` | `#9E3B25` | `#FBEFE6` |
| (no data) | `--sky-0` | `#D3D3CF` with diagonal hatch | peat |

Dark mode (`prefers-color-scheme: dark` plus a `data-theme` override): surface
`#1B1410` (deep peat), ink `#EADFD3`, tea `#B08B6A`, sedge `#93B283` (7.7:1 on the
surface; the light-mode sedge is only 3.05:1 there). Anything drawn on a sky colour
uses `--sedge-sky` (`#4F6B43` in both modes), because the skies stay light. The sky tokens stay the same,
because they are data, but sky-1 and sky-2 panels switch to peat text.

## Type

- **Anybody** (variable, `wdth` 50–150, `wght` 100–900), self-hosted through
  `@fontsource-variable/anybody`. Used for the wordmark, headlines, the risk sentence and
  big figures. On the story page each year's headline sets `font-variation-settings:
  "wdth"` in proportion to that year's MODIS hotspot count, so the type stretches with
  the fire. That is the type treatment.
- **Atkinson Hyperlegible Next** (variable), through
  `@fontsource-variable/atkinson-hyperlegible-next`. Body, UI, data and labels. It was
  built for legibility, which suits cheap screens in bright sun. Numbers use
  `font-variant-numeric: tabular-nums`.
- No monospace anywhere. No all-caps labels. Sentence case everywhere.

Scale in rem, from a 16 px base (classic Bringhurst-style progression):
`0.75, 0.875, 1, 1.125, 1.3125, 1.5, 2.25, 3, 3.75, 4.5, 6`.
Body line-height 1.55. Headline line-height 1.0–1.1. Measure: `max-inline-size: 68ch`
for prose. Use `text-wrap: balance` on headlines and `text-wrap: pretty` on prose.

## Layout

### Monitor `/` (desktop, at least 960 px)

```
┌──────────────────────────────────────────────────────────────────┐
│ bara        Pantau   Kisah 20 tahun   Metode & sumber            │ 48px bar, mist
├─────────────────────────┬────────────────────────────────────────┤
│ SKY PANEL (bg=sky-n)    │                                        │
│ Kalimantan Tengah ▾     │                                        │
│                         │            MapLibre map                │
│ Risiko kebakaran hari   │   grid cells filled with sky scale     │
│ ini tinggi.             │   (55% opacity), province outline in   │
│ Rentang 48–66, keyakinan│   peat, hotspots as ember dots         │
│ sedang.                 │                                        │
│─────────────────────────│                                        │
│ Sinyal yang dihitung    │                                        │
│ Titik panas 24 jam  312 ⓘ│                                       │
│ Hari tanpa hujan     9 ⓘ│                                        │
│ Hujan 30 hari    41 mm ⓘ│                                        │
│ Kedalaman gambut  belum tersedia                                 │
│─────────────────────────│                                        │
│ Kesehatan data          │                                        │
│ ● VIIRS NOAA-20  1.204 titik, 2 jam lalu                         │
│ ● VIIRS SNPP  0 titik (berkas kosong)                            │
│ ○ Open-Meteo  gagal, memakai snapshot 6 jam lalu                 │
│─────────────────────────│                                        │
│ Titik panas adalah deteksi panas satelit, bukan kebakaran        │
│ yang terkonfirmasi, dan bukan bukti siapa penyebabnya.           │
└─────────────────────────┴────────────────────────────────────────┘
  panel: 400px fixed, scrolls on its own; map fills the rest at full height
```

Mobile (below 960 px): the sky panel's sentence comes first, then the map at 62svh, then
signals and data health. Content is left-aligned throughout. 16 px side gutter.

### Story `/kisah/`

A fixed full-viewport Three.js canvas sits behind narrow text columns (about 30rem)
that scroll over it. Text blocks are left-aligned, offset to the left third on desktop
and full-width with a translucent sky backing on mobile. Years are the section markers,
and that is legitimate because the content is a real timeline. On mobile the sticky year
panel splits: year and count at the top, bar strip at the bottom, each on a backed band
of the live sky, so the hotspot map stays visible in the middle while the years scrub.

```
[canvas: Indonesia as a field of peat-brown dots, hotspots as ember particles]
  ┌──────────────┐
  │ 2015         │  ← Anybody, wdth driven by hotspot count
  │ 2,61 juta ha │
  │ ⓘ source     │
  └──────────────┘
```

### Method `/metode/`

Single prose column, 68ch, left-aligned. It covers the formula, thresholds, a data status
table, limitations, and open questions. Ordinary rules and tables, no cards.

## Components

- **`<Sourced>`**: every number on the site is wrapped in it. It shows the value plus a
  small ⓘ button that opens a native `popover` (anchored with CSS anchor positioning, and
  falling back to fixed positioning) containing the source name, link, data date or
  period, fetch time and verification status. Unverified figures carry a visible
  "belum diverifikasi" label. If a value is missing, it renders "tidak tersedia". It never
  renders 0 for missing data.
- **Region switch**: a native `<select>` styled with the tokens.
- **Status dot**: `●` sedge = ok, `●` ember-outlined = empty file, `○` tea hollow = failed
  and on snapshot. Always followed by text.
- **Touch targets**: at least 24 px everywhere; on coarse pointers 40–44 px for the ⓘ
  button (hit area grows, glyph does not), the region switch and the map controls.
- **Focus ring**: 3 px `--ember` outline at 2 px offset, with a 2 px keyline in the
  element's own ink (`box-shadow: 0 0 0 2px currentColor`) filling the gap. Ember alone
  is 1.0:1 on `--sky-3` and under 3:1 on mist; the keyline keeps the ring visible on
  every sky. Forced-colors mode drops the keyline and keeps the outline.
- Radius: 0 on panels and map, 4 px on buttons and select, 6 px on popovers. No drop
  shadows except the popover (`0 8px 24px rgb(42 29 21 / .18)`); the focus keyline is
  not a shadow.

## Motion

- Monitor: one moment on load. The sky panel starts at `--sky-0` and transitions to the
  data colour over 1.2 s (`@property`-registered colour), while the risk sentence fades
  in. Nothing else animates by itself.
- Story: scroll-scrubbed camera (GSAP ScrollTrigger + Lenis). Hotspots flicker subtly.
- `prefers-reduced-motion: reduce`: no Lenis, no scrub. Sections swap camera states with
  a 200 ms crossfade, and the flicker stops.

## Copy rules

- Plain Indonesian, active voice, sentence case.
- Keep three things distinct: *titik panas* (hotspot count), *luas indikatif terbakar*
  (indicative burned area), and *luas gambut terbakar* (peat area burned).
- Errors give direction: "Data cuaca gagal diambil pukul 09.00 WIB. Skor memakai snapshot
  terakhir (6 jam lalu)."
- Never accuse a party. Never invent victims or numbers.

## Rejected defaults (review log)

- First idea for the story page: ember particles on near-black. That is a generic
  default, so the background is now the year's sky colour over peat-brown land.
- First idea for the monitor hero: a big score number with a small label. Replaced with
  a full sentence ("Risiko kebakaran hari ini tinggi.") set in a sky-coloured panel. The
  colour is the panel, not one accented word.
- Mono data labels, uppercase eyebrows, middle-dot meta strings, a card grid: all
  dropped. Data rows are a plain definition list with hairline rules, because the rules
  separate distinct signals.
