/**
 * Live pipeline (runs in CI every 3 h): fetch FIRMS 7-day CSVs + Open-Meteo
 * daily rain, score cells with src/lib/risk.ts, write public/data/live.json
 * (minified) and append to public/data/fetch-log.jsonl.
 *
 * Failure policy (ARCHITECTURE.md): a failed source reuses the previous
 * snapshot and is marked 'stale'; with no snapshot at all its signals are
 * null — never zero. Exit code 0 even when sources fail; exit 1 only on a
 * programming error (uncaught bug in this script).
 *
 * Env: PREVIOUS_LIVE_URL (checked FIRST — in CI the local live.json is not
 * trustworthy), FIRMS_BASE_OVERRIDE (testing only: alternate FIRMS base URL).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assignHotspotsToCells,
  anySourceStale,
  missingWeather,
  openMeteoUrls,
  pickCompleteWindow,
  reduceWeather,
  reusePrevLive,
  roundHotspot,
  signalFreshness,
  suddenDropWarning,
} from '../src/lib/live.ts';
import { parseFirmsCsv } from '../src/lib/firms.ts';
import { scoreCell, summarizeRegion } from '../src/lib/risk.ts';
import type {
  CellRisk,
  CellWeather,
  Hotspot,
  LiveData,
  RegionId,
  RegionSummary,
  RegionsFile,
  SourceRecord,
} from '../src/lib/types.ts';

const FIRMS_DEFAULT = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/';
const FIRMS_SOURCES = [
  { id: 'firms-viirs-snpp', name: 'NASA FIRMS VIIRS S-NPP (NRT)', path: 'suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_7d.csv' },
  { id: 'firms-viirs-noaa20', name: 'NASA FIRMS VIIRS NOAA-20 (NRT)', path: 'noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_7d.csv' },
  { id: 'firms-viirs-noaa21', name: 'NASA FIRMS VIIRS NOAA-21 (NRT)', path: 'noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_7d.csv' },
  { id: 'firms-modis', name: 'NASA FIRMS MODIS C6.1 (NRT)', path: 'modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_7d.csv' },
] as const;
const OPEN_METEO = { id: 'open-meteo', name: 'Open-Meteo forecast API' };
const DATA = resolve(process.cwd(), 'public/data');
const LIVE = resolve(DATA, 'live.json');
const LOG = resolve(DATA, 'fetch-log.jsonl');
const REGIONS = resolve(DATA, 'regions.json');
const TIMEOUT_MS = 30_000;
const RETRIES = 2;

async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

/**
 * Previous live.json. Order: PREVIOUS_LIVE_URL first (CI has no trustworthy
 * local file), then public/data/live.json (local dev). A 404, an HTTP 500,
 * or invalid JSON is logged and skipped — the pipeline runs on without a
 * snapshot (failed sources become 'failed', their signals null, never zero).
 */
async function loadPrevLive(): Promise<LiveData | null> {
  const tryParse = (text: string): LiveData | null => {
    try {
      const j = JSON.parse(text);
      return j?.version === 1 && Array.isArray(j?.sources) ? (j as LiveData) : null;
    } catch {
      return null;
    }
  };
  const url = process.env.PREVIOUS_LIVE_URL;
  if (url) {
    try {
      console.log(`memuat snapshot sebelumnya dari ${url} …`);
      const fromUrl = tryParse(await fetchText(url));
      if (fromUrl) return fromUrl;
      console.log('snapshot sebelumnya dari URL tidak valid, mencoba berkas lokal …');
    } catch (err) {
      console.log(`snapshot sebelumnya tidak bisa diambil (${String(err)}), mencoba berkas lokal …`);
    }
  }
  try {
    if (existsSync(LIVE)) return tryParse(readFileSync(LIVE, 'utf8'));
  } catch {
    /* fall through: run without a snapshot */
  }
  return null;
}

interface SourceResult {
  record: SourceRecord;
  hotspots: Hotspot[];
  weatherByCell?: Map<string, CellWeather>;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const nowMs = Date.parse(generatedAt);

  const regionsFile: RegionsFile = JSON.parse(readFileSync(REGIONS, 'utf8'));
  const allCells = regionsFile.regions.flatMap((r) => r.cells);

  const results: SourceResult[] = [];
  const prev = await loadPrevLive();
  const prevRec = (id: string): SourceRecord | null => prev?.sources.find((s) => s.id === id) ?? null;

  const firmsBase = process.env.FIRMS_BASE_OVERRIDE?.replace(/\/$/, '') || FIRMS_DEFAULT;

  for (const src of FIRMS_SOURCES) {
    const url = `${firmsBase}/${src.path}`;
    const base = { id: src.id, name: src.name, url, attemptedAt: generatedAt };
    try {
      const text = await fetchText(url);
      // parseFirmsCsv throws on a body without a valid FIRMS header (e.g. an
      // HTML error page served with HTTP 200) — caught below as a failure.
      const hotspots = parseFirmsCsv(text, src.id).map(roundHotspot);
      const hasRows = text.split(/\r?\n/).filter((l) => l.trim()).length > 1;
      results.push({
        hotspots,
        record: {
          ...base,
          status: hasRows ? 'ok' : 'empty',
          fetchedAt: generatedAt,
          rows: hotspots.length,
          warning: suddenDropWarning(prevRec(src.id)?.rows ?? null, prevRec(src.id)?.status ?? '', hotspots.length) ?? undefined,
        },
      });
    } catch (err) {
      const reused = reusePrevLive(prev, src.id);
      if (reused.record) {
        results.push({
          hotspots: reused.hotspots.map(roundHotspot),
          record: {
            ...base,
            status: 'stale',
            fetchedAt: reused.record.fetchedAt,
            rows: reused.hotspots.length,
            error: `pengambilan gagal (${String(err)}), memakai snapshot sebelumnya`,
          },
        });
      } else {
        results.push({
          hotspots: [],
          record: { ...base, status: 'failed', fetchedAt: null, rows: null, error: String(err) },
        });
      }
    }
  }

  // Open-Meteo: all cell centres, 100 coordinates per request. Any failed
  // batch fails the whole source (reuse snapshot) — fresh and missing cells
  // are never mixed silently.
  const urls = openMeteoUrls(allCells.map((c) => c.center));
  const weatherByCell = new Map<string, CellWeather>();
  try {
    if (urls.length === 0) throw new Error('tidak ada sel dalam regions.json');
    const todayJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(nowMs);
    const texts = await Promise.all(urls.map((u) => fetchText(u)));
    const parsed = texts.flatMap((text) => {
      const j = JSON.parse(text);
      return Array.isArray(j) ? j : [j];
    }) as { daily?: { time?: string[]; precipitation_sum?: (number | null)[] } }[];
    if (parsed.length < allCells.length) throw new Error(`Open-Meteo mengembalikan ${parsed.length} dari ${allCells.length} lokasi`);
    for (let i = 0; i < allCells.length; i++) {
      const loc = parsed[i];
      const time = loc?.daily?.time ?? [];
      const precip = loc?.daily?.precipitation_sum ?? [];
      const window = pickCompleteWindow(time, precip, todayJakarta);
      const { rain30, dryDays } = reduceWeather(window);
      weatherByCell.set(allCells[i]!.id, { rain30, dryDays, daily: window as number[] });
    }
    results.push({
      hotspots: [],
      weatherByCell,
      record: {
        id: OPEN_METEO.id,
        name: OPEN_METEO.name,
        url: urls[0]!,
        status: 'ok',
        fetchedAt: generatedAt,
        attemptedAt: generatedAt,
        rows: weatherByCell.size,
        note: urls.length > 1 ? `${urls.length} batch URL per 100 sel` : undefined,
      },
    });
  } catch (err) {
    const reused = reusePrevLive(prev, OPEN_METEO.id);
    if (reused.record && reused.weatherByCell.size > 0) {
      results.push({
        hotspots: [],
        weatherByCell: reused.weatherByCell,
        record: {
          id: OPEN_METEO.id,
          name: OPEN_METEO.name,
          url: urls[0] ?? OPEN_METEO_BASE_URL,
          status: 'stale',
          fetchedAt: reused.record.fetchedAt,
          attemptedAt: generatedAt,
          rows: reused.weatherByCell.size,
          error: `pengambilan gagal (${String(err)}), memakai snapshot sebelumnya`,
        },
      });
    } else {
      for (const c of allCells) weatherByCell.set(c.id, missingWeather());
      results.push({
        hotspots: [],
        weatherByCell,
        record: {
          id: OPEN_METEO.id, name: OPEN_METEO.name, url: urls[0] ?? OPEN_METEO_BASE_URL,
          status: 'failed', fetchedAt: null, attemptedAt: generatedAt, rows: null, error: String(err),
        },
      });
    }
  }

  // Cells + regions. hotspots24h/7d count unique ~1 km locations (dedup across
  // satellites), not raw detections.
  const hotspots: Hotspot[] = results.flatMap((r) => r.hotspots);
  const countsByCell = assignHotspotsToCells(hotspots, allCells, nowMs);
  const stale = anySourceStale(results.map((r) => r.record));
  const usable = signalFreshness(results.map((r) => r.record), nowMs);
  if (!usable.hotspots) console.log('data titik panas terlalu lama atau tidak ada: sinyal titik panas dihitung hilang');
  if (!usable.weather) console.log('data cuaca terlalu lama atau tidak ada: sinyal cuaca dihitung hilang');

  const cells: CellRisk[] = [];
  for (const region of regionsFile.regions) {
    for (const cell of region.cells) {
      const found = countsByCell.get(cell.id) ?? { hotspots24h: 0, hotspots7d: 0 };
      // Unknown, not zero, when no satellite data is fresh enough (see signalFreshness).
      const counts = usable.hotspots ? found : { hotspots24h: null, hotspots7d: null };
      const weather = usable.weather
        ? (results.find((r) => r.record.id === OPEN_METEO.id)?.weatherByCell?.get(cell.id) ?? missingWeather())
        : missingWeather();
      const scored = scoreCell({
        hotspots24h: counts.hotspots24h,
        dryDays: weather.dryDays,
        rain30: weather.rain30,
        anySourceStale: stale,
      });
      cells.push({
        id: cell.id,
        regionId: region.id,
        bbox: cell.bbox,
        hotspots24h: counts.hotspots24h,
        hotspots7d: counts.hotspots7d,
        weather,
        ...scored,
      });
    }
  }

  const regions: RegionSummary[] = regionsFile.regions.map((r) => ({
    id: r.id as RegionId,
    name: r.name,
    ...summarizeRegion(cells.filter((c) => c.regionId === r.id)),
  }));

  const live: LiveData = { version: 1, generatedAt, sources: results.map((r) => r.record), hotspots, cells, regions };
  writeFileSync(LIVE, JSON.stringify(live));

  // fetch-log.jsonl: one line per run, keep the last 500.
  const logLine = JSON.stringify({
    generatedAt,
    sources: results.map((r) => ({ id: r.record.id, status: r.record.status, rows: r.record.rows, warning: r.record.warning })),
  });
  let lines: string[] = [];
  try {
    lines = readFileSync(LOG, 'utf8').split('\n').filter((l) => l.trim());
  } catch {
    if (prev) {
      // seed the log from the snapshot we recovered
      lines = [JSON.stringify({ generatedAt: prev.generatedAt, sources: prev.sources.map((s) => ({ id: s.id, status: s.status, rows: s.rows })) })];
    }
  }
  lines.push(logLine);
  writeFileSync(LOG, lines.slice(-500).join('\n') + '\n');

  // Short human summary.
  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
  for (const r of results) {
    const rec = r.record;
    const rows = rec.rows === null ? 'jumlah tidak diketahui' : `${fmt(rec.rows)} baris`;
    console.log(`${rec.name}: ${rec.status} (${rows})${rec.error ? ` — ${rec.error}` : ''}${rec.warning ? ` — PERINGATAN: ${rec.warning}` : ''}`);
  }
  for (const r of regions) {
    const skor = r.score === null ? 'tidak bisa dihitung' : `${Math.round(r.score)} (${r.cls}), rentang ${Math.round(r.range![0])}–${Math.round(r.range![1])}, keyakinan ${r.confidence}`;
    console.log(`${r.name}: skor ${skor}, ${r.hotspots24h === null ? 'tidak diketahui' : fmt(r.hotspots24h)} titik panas 24 jam`);
  }
  console.log(`total: ${fmt(hotspots.length)} titik panas, ${fmt(cells.length)} sel → ${LIVE}`);
}

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// Exit 0 even when sources fail (the JSON tells the truth); exit 1 only on a
// programming error in this script.
main().catch((err) => {
  console.error('kesalahan program (pipeline):', err);
  process.exit(1);
});
