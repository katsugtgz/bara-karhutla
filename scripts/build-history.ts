import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFirmsCsv } from '../src/lib/firms.ts';
import type { HistoryFile } from '../src/lib/types.ts';

/**
 * One-off build of public/data/history.json: NASA FIRMS MODIS yearly country
 * archives for Indonesia, 2006–2025. Counts and 0.25° bins use confidence >= 30
 * (MODIS 0–29 low). 2026 is NOT in the archive (404) — the story uses live data
 * for 2026 and this script must not fabricate it.
 */

const FIRST_YEAR = 2006;
const LAST_YEAR = 2025; // 2026 not archived yet — do not add it here
const BIN = 0.25;
const CACHE = resolve(process.cwd(), '.cache');
const OUT = resolve(process.cwd(), 'public/data/history.json');

const urlFor = (year: number) =>
  `https://firms.modaps.eosdis.nasa.gov/data/country/modis/${year}/modis_${year}_Indonesia.csv`;

async function fetchText(url: string, timeoutMs = 90_000, retries = 2): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

interface Bin {
  lon: number;
  lat: number;
  count: number;
}

/** MODIS detections with conf >= 30, aggregated into 0.25° bins. */
export function binModis(text: string): { count: number; bins: Bin[] } {
  const rows = parseFirmsCsv(text, 'firms-modis'); // already bbox-filtered
  const acc = new Map<string, number>();
  let count = 0;
  for (const row of rows) {
    // mapConf maps MODIS 0-29 → 'l'; the history counts non-low only.
    if (row.conf === 'l') continue;
    count++;
    const key = `${Math.floor(row.lon / BIN)},${Math.floor(row.lat / BIN)}`;
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }
  const bins = [...acc.entries()].map(([key, n]) => {
    const [ix, iy] = key.split(',').map(Number) as [number, number];
    const round = (v: number) => Math.round(v * 100) / 100;
    return { lon: round((ix + 0.5) * BIN), lat: round((iy + 0.5) * BIN), count: n };
  });
  bins.sort((a, b) => a.lat - b.lat || a.lon - b.lon);
  return { count, bins };
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(resolve(OUT, '..'), { recursive: true });
  const years: HistoryFile['years'] = [];
  const missing: number[] = [];

  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const cached = resolve(CACHE, `modis_${year}_Indonesia.csv`);
    let text: string;
    if (existsSync(cached) && statSync(cached).size > 0) {
      text = await (await import('node:fs/promises')).readFile(cached, 'utf8');
    } else {
      process.stdout.write(`fetch ${year} … `);
      try {
        text = await fetchText(urlFor(year));
      } catch (err) {
        console.log(`GAGAL (${(err as Error).message}) — tahun dilewati, tidak diarang nol`);
        missing.push(year);
        continue;
      }
      await (await import('node:fs/promises')).writeFile(cached, text);
    }
    const { count, bins } = binModis(text);
    years.push({
      year,
      count,
      bins: bins.map((b) => [b.lon, b.lat, b.count] as [number, number, number]),
    });
    console.log(`${year}: ${count.toLocaleString('id-ID')} titik panas (conf ≥ 30), ${bins.length} bin`);
  }

  if (years.length === 0) {
    console.error('Tidak ada tahun yang berhasil dibangun — history.json tidak ditulis.');
    process.exit(1);
  }

  const history: HistoryFile = {
    source: {
      name: 'NASA FIRMS MODIS 6.1',
      url: 'https://firms.modaps.eosdis.nasa.gov/download/',
      note: 'Arsip tahunan deteksi panas MODIS untuk Indonesia (bbox 94.5–141.5 BT, 11.5 LS–6.5 LU), kepercayaan ≥ 30, bin 0,25°. Titik panas bukan kebakaran terkonfirmasi. Nilai kepercayaan MODIS (0–100) tidak setara label VIIRS — hati-hati saat membandingkan antar sensor. Tahun 2026 belum ada di arsip; cerita 2026 memakai data live.',
    },
    years,
  };
  writeFileSync(OUT, JSON.stringify(history));
  const kb = (statSync(OUT).size / 1024).toFixed(0);
  console.log(`\nwrote ${OUT} (${kb} KB), ${years.length} tahun${missing.length ? `, GAGAL: ${missing.join(', ')}` : ''}`);
}

main();
