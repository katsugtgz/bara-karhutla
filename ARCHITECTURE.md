# Bara — architecture and data contracts

Read DESIGN.md first. The product brief (Indonesian) is in docs/RENCANA.md.

## Stack (latest stable, pinned exact in package.json)

- Node 24+ LTS in CI (uses native TS type stripping for scripts: `node scripts/x.ts`)
- Vite 8, React 19.3, TypeScript (latest `typescript` on npm), `@vitejs/plugin-react`
- Multi-page app (no router): `index.html` (Pantau), `kisah/index.html` (Kisah),
  `metode/index.html` (Metode). Each page has its own entry in `src/pages/*/main.tsx`.
  Vite `base` comes from env `BASE_PATH` (default `/`); CI sets `/bara-karhutla/`.
- Plain modern CSS (no Tailwind): `src/styles/tokens.css`, `src/styles/base.css`,
  `@layer reset, tokens, base, components, pages;`, oklch allowed, container queries.
- Map: `maplibre-gl` v5+, basemap style `https://tiles.openfreemap.org/styles/positron`
  (dark mode: `.../styles/dark`), attribution kept.
- Story: `three`, `gsap` (ScrollTrigger), `lenis`.
- Tests: `vitest`. Lint: `oxlint`. React health: `react-doctor` in CI.
- Fonts: `@fontsource-variable/anybody`, `@fontsource-variable/atkinson-hyperlegible-next`.

## Directory layout

```
src/
  lib/risk.ts            pure risk scoring (+ risk.test.ts)
  lib/firms.ts           FIRMS CSV parse + Indonesia filter (+ firms.test.ts)
  lib/geo.ts             grid + point-in-polygon helpers (+ geo.test.ts)
  lib/time.ts            Indonesian relative time ("3 jam lalu"), WIB formatting
  lib/types.ts           shared types for every JSON contract below
  components/Sourced.tsx  value + popover with provenance
  components/SiteHeader.tsx
  pages/pantau/…  pages/kisah/…  pages/metode/…
  content/chronology.ts  story figures, each with source + verification status
scripts/
  fetch-live.ts          run by CI every 3h → public/data/live.json
  build-regions.ts       one-off → public/data/regions.json (committed)
  build-history.ts       one-off → public/data/history.json + indonesia-land.json (committed)
public/data/*.json
```

## Data contracts (src/lib/types.ts must match exactly)

```ts
type SourceStatus = 'ok' | 'empty' | 'failed' | 'stale';

interface SourceRecord {
  id: string;               // 'firms-viirs-snpp' | 'firms-viirs-noaa20' | 'firms-viirs-noaa21' | 'firms-modis' | 'open-meteo'
  name: string;             // 'NASA FIRMS VIIRS S-NPP (NRT)'
  url: string;              // exact URL fetched
  status: SourceStatus;     // empty = fetched fine, zero rows; failed = request error; stale = failed, using previous snapshot
  fetchedAt: string | null; // ISO time of the last successful fetch
  attemptedAt: string;      // ISO time of this attempt
  rows: number | null;      // rows after Indonesia filter; null if unknown
  error?: string;
}

interface Hotspot {          // compact, one per detection
  lat: number; lon: number;
  t: string;                 // ISO UTC acquisition time from acq_date + acq_time
  sat: 'N' | 'N20' | 'N21' | 'Terra' | 'Aqua' | string;
  conf: 'l' | 'n' | 'h';     // VIIRS low/nominal/high; MODIS 0–29 l, 30–79 n, 80–100 h
  frp: number;               // MW
  src: string;               // SourceRecord.id
}

interface CellWeather {
  rain30: number | null;     // mm, sum of last 30 complete days
  dryDays: number | null;    // consecutive days ending yesterday with precip < 1 mm
  daily: number[];           // last 30 daily sums, oldest first
}

interface CellRisk {
  id: string;                // `${regionId}:${row}:${col}`
  regionId: string;
  bbox: [number, number, number, number]; // [w, s, e, n]
  hotspots24h: number | null; // unique ~1 km (0.01°) locations with ≥1 non-low-confidence detection, last 24h; null = satellite data too old
  hotspots7d: number | null;  // unique (location, UTC date) pairs, last 7 days
  weather: CellWeather;
  score: number | null;      // 0–100
  range: [number, number] | null;
  cls: 'rendah' | 'sedang' | 'tinggi' | 'sangat-tinggi' | null;
  confidence: 'tinggi' | 'sedang' | 'rendah';
  missing: string[];         // signal names that were unavailable
}

interface RegionSummary {
  id: 'kalteng' | 'riau' | 'sumsel';
  name: string;              // 'Kalimantan Tengah'
  score: number | null;      // 75th percentile of cell scores
  range: [number, number] | null;
  cls: CellRisk['cls'];
  confidence: CellRisk['confidence'];
  hotspots24h: number | null; hotspots7d: number | null; // null if any cell is unknown
  medianDryDays: number | null; medianRain30: number | null;
}

interface LiveData {
  version: 1;
  generatedAt: string;
  sources: SourceRecord[];
  hotspots: Hotspot[];       // Indonesia bbox, last 7 days (all confidences)
  cells: CellRisk[];
  regions: RegionSummary[];
}

interface RegionsFile {      // public/data/regions.json
  source: { name: string; url: string; license: string };
  regions: { id: RegionSummary['id']; name: string; geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon;
             cells: { id: string; row: number; col: number; bbox: [number,number,number,number]; center: [number, number] }[] }[];
}

interface HistoryFile {      // public/data/history.json
  source: { name: string; url: string; note: string };
  years: { year: number; count: number;            // MODIS detections conf >= 30 inside Indonesia
           bins: [number, number, number][] }[];   // [lon, lat, count], 0.25° bins
}
```

## Risk score v0 (src/lib/risk.ts). Transparent, documented on /metode/

Per grid cell of 0.5°:

```
h = min(1, ln(1 + hotspots24h) / ln(1 + 20))        // hotspot signal
d = min(1, dryDays / 14)                             // consecutive dry days
r = clamp(1 - rain30 / 150, 0, 1)                    // 30-day rainfall deficit
score = round(100 * (0.45 h + 0.30 d + 0.25 r))
classes: <25 rendah, 25–<50 sedang, 50–<75 tinggi, >=75 sangat-tinggi
```

- Missing signal: drop it, renormalise the remaining weights, add the signal to `missing`,
  and widen the uncertainty. If no signal is available, score, range and cls are null.
- Uncertainty half-width `u = 6 + 12 * missing.length + (stale ? 6 : 0)`.
  `range = [max(0, score - u), min(100, score + u)]`.
- Confidence: start at 'tinggi'. Drop one level for each missing signal, and one level if
  any data source is stale or failed. Floor at 'rendah'.
- The weights and thresholds are draft values (v0) awaiting expert calibration. Say this
  in the UI and in /metode/.
- Exported as pure functions: `scoreCell(input)`, `classify(score)`, `summarizeRegion(cells)`.
  `RISK_MODEL = { version: 'v0', weights, thresholds }` exported for display.

## Live pipeline (scripts/fetch-live.ts)

1. Fetch the 7-day CSVs (no API key needed) from
   `https://firms.modaps.eosdis.nasa.gov/data/active_fire/`:
   - `suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_7d.csv`
   - `noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_7d.csv`
   - `noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_7d.csv`
   - `modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_7d.csv`
   Use the 7d files, and filter to the Indonesia bbox `lon 94.5..141.5, lat -11.5..6.5`.
   VIIRS header: `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight`.
   MODIS header has `brightness,...,confidence(0-100),...`. Parse by header name, not position.
2. Fetch Open-Meteo for every cell centre in regions.json, batched at 100 coordinates
   per request with comma-separated `latitude`/`longitude`:
   `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=precipitation_sum&past_days=31&forecast_days=1&timezone=Asia%2FJakarta`.
   It returns an array when given several coordinates. Use only complete past days.
3. Each fetch has a 30 s timeout and 2 retries with backoff. If a source fails, load the
   previous `live.json` (local file first, then `PREVIOUS_LIVE_URL` env if set) and reuse
   that source's previous rows (hotspots filtered by `src`, weather per cell), marking it
   `stale`. A failure is never recorded as zero.
4. Compute cells and regions with src/lib/risk.ts. Write `public/data/live.json`
   (minified). Also append one line to `public/data/fetch-log.jsonl`: the generatedAt
   time plus source statuses, keeping the last 500 lines.
5. Freshness: reused (stale) data is trusted only while young. Satellite data older than
   6 h and weather older than 48 h count as *missing* signals (null), never as numbers,
   because old hotspots would read as "0 in the last 24 h" (`signalFreshness` in
   src/lib/live.ts).
6. A FIRMS response without the FIRMS header (e.g. an HTML error page with HTTP 200) is a
   failed fetch, not an empty file. A feed whose rows drop below 10% of a previous ≥500
   gets a `warning`.
7. Exit code 0 even if sources fail. The JSON tells the truth. Exit non-zero only on a
   programming error.

## CI/CD (.github/workflows)

- `ci.yml` (push and PR): `npm ci`, `npm run typecheck`, `npm run lint` (oxlint),
  `npm test`, `npx -y react-doctor@latest --yes --no-telemetry --blocking error`, then
  `npm run build`.
- `deploy.yml` (push to main, `schedule: cron '17 */3 * * *'`, workflow_dispatch):
  checkout, setup-node 24, `npm ci`, `node scripts/fetch-live.ts` with
  `PREVIOUS_LIVE_URL=https://<owner>.github.io/bara-karhutla/data/live.json`,
  `npm test`, react-doctor gate, `BASE_PATH=/bara-karhutla/ npm run build`, then
  `actions/upload-pages-artifact` and `actions/deploy-pages`. Live data is not committed
  back to git; each deploy fetches fresh data.
- Use the latest major versions of the actions (`actions/checkout`,
  `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`,
  `actions/deploy-pages`). Check them with `gh api repos/actions/<name>/releases/latest`.
