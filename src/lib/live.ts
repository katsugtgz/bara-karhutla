import type { CellWeather, Hotspot, LiveData, SourceRecord } from './types';

export interface CellCounts {
  hotspots24h: number;
  hotspots7d: number;
}

/**
 * Count UNIQUE ~1 km locations per grid cell (bbox assignment).
 *
 * One fire is often detected by several satellites (S-NPP, NOAA-20, NOAA-21,
 * MODIS); counting raw rows inflates hotspots ×3–4. A location counts once:
 * lat/lon rounded to 0.01° (≈1.1 km). hotspots24h = locations with at least
 * one non-low-confidence detection in the last 24 h; hotspots7d = unique
 * (location, UTC date) pairs over the 7-day window. Low-confidence ('l')
 * detections never count — kept for the map, too noisy for scoring.
 */
export function assignHotspotsToCells(
  hotspots: Hotspot[],
  cells: { id: string; bbox: [number, number, number, number] }[],
  nowMs: number,
): Map<string, CellCounts> {
  const s24 = new Map<string, Set<string>>();
  const s7 = new Map<string, Set<string>>();
  const keyOf = (h: Hotspot) => `${Math.round(h.lat * 100)}:${Math.round(h.lon * 100)}`;
  for (const h of hotspots) {
    if (h.conf === 'l') continue;
    const t = Date.parse(h.t);
    if (Number.isNaN(t) || t > nowMs) continue;
    const ageH = (nowMs - t) / 3_600_000;
    if (ageH > 24 * 7) continue;
    for (const c of cells) {
      const [w, s, e, n] = c.bbox;
      if (h.lon < w || h.lon > e || h.lat < s || h.lat > n) continue;
      const key = keyOf(h);
      let a = s24.get(c.id);
      if (!a) s24.set(c.id, (a = new Set()));
      let b = s7.get(c.id);
      if (!b) s7.set(c.id, (b = new Set()));
      if (ageH <= 24) a.add(key);
      b.add(`${key}|${h.t.slice(0, 10)}`);
      break;
    }
  }
  const counts = new Map<string, CellCounts>();
  for (const id of new Set([...s24.keys(), ...s7.keys()])) {
    counts.set(id, { hotspots24h: s24.get(id)!.size, hotspots7d: s7.get(id)!.size });
  }
  return counts;
}

/** From a daily series (aligned with `dates`, timezone-fixed), keep the last `n` complete days strictly before `todayIso`, oldest first. */
export function pickCompleteWindow(
  dates: string[],
  values: (number | null)[],
  todayIso: string,
  n = 30,
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < dates.length; i++) {
    if (dates[i]! < todayIso) out.push(values[i] ?? null);
  }
  return out.slice(-n);
}

export interface WeatherReduction {
  rain30: number | null; // mm, sum; null when more than 5 of the 30 days are missing
  dryDays: number | null; // consecutive days ending yesterday with precip < 1 mm; null if a missing day breaks the streak before a wet day ends it
}

/** Reduce a 30-day window (oldest first, null = day missing). Never fabricates a zero: missing days are unknown. */
export function reduceWeather(daily: (number | null)[]): WeatherReduction {
  const known = daily.filter((v) => v !== null);
  const missing = daily.length - known.length;
  const rain30 =
    missing > 5 || daily.length === 0
      ? null
      : Math.round(known.reduce((s, v) => s + v!, 0) * 10) / 10;
  let dryDays: number | null = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const v = daily[i];
    if (v === undefined || v === null) {
      dryDays = null;
      break;
    }
    if (v >= 1) break;
    dryDays += 1;
  }
  if (daily.length === 0) dryDays = null;
  return { rain30, dryDays };
}

/** Cell weather reused verbatim from a previous snapshot — never zeroed. */
export function staleWeatherByCell(prevCells: { id: string; weather: CellWeather }[]): Map<string, CellWeather> {
  return new Map(prevCells.map((c) => [c.id, c.weather]));
}

/** Hotspots of one source, reused from a previous snapshot. */
export function hotspotsFromSource(hotspots: Hotspot[], srcId: string): Hotspot[] {
  return hotspots.filter((h) => h.src === srcId);
}

/** Weather when a source failed with no snapshot: every signal unknown, never zero. */
export function missingWeather(): CellWeather {
  return { rain30: null, dryDays: null, daily: [] };
}

/** Score uncertainty must widen when any source is stale or failed. */
export function anySourceStale(sources: Pick<SourceRecord, 'status'>[]): boolean {
  return sources.some((s) => s.status === 'stale' || s.status === 'failed');
}

/**
 * Sudden-drop guard: FIRMS feeds sometimes come back short (partial file) and
 * the drop must be visible. Applies when the previous snapshot was ok with a
 * substantial row count (≥ 500) and the new fetch has under 10% of that.
 */
export function suddenDropWarning(prevRows: number | null, prevStatus: string, nowRows: number): string | null {
  if (prevStatus !== 'ok' || prevRows === null || prevRows < 500) return null;
  if (nowRows >= prevRows * 0.1) return null;
  return `Jumlah baris turun tajam dari ${prevRows} ke ${nowRows}; periksa sumber.`;
}

export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Batched Open-Meteo URLs, ≤ `perBatch` coordinates each (API limit 100).
 * Pure: same centers → same URLs, so it is directly testable.
 */
export function openMeteoUrls(centers: [number, number][], perBatch = 100): string[] {
  const urls: string[] = [];
  for (let i = 0; i < centers.length; i += perBatch) {
    const batch = centers.slice(i, i + perBatch);
    urls.push(
      `${OPEN_METEO_BASE}?daily=precipitation_sum&past_days=31&forecast_days=1&timezone=Asia%2FJakarta` +
        `&latitude=${batch.map((c) => c[1]).join(',')}&longitude=${batch.map((c) => c[0]).join(',')}`,
    );
  }
  return urls;
}

/** Hotspot payload stays lean: coordinates to 4 decimals, FRP to 1. */
export function roundHotspot(h: Hotspot): Hotspot {
  return {
    ...h,
    lat: Math.round(h.lat * 10_000) / 10_000,
    lon: Math.round(h.lon * 10_000) / 10_000,
    frp: Math.round(h.frp * 10) / 10,
  };
}

/** Merge result for one run: previous snapshot reused only for the failed sources. */
export function reusePrevLive(prev: unknown, srcId: string): { record: SourceRecord | null; hotspots: Hotspot[]; weatherByCell: Map<string, CellWeather> } {
  const live = prev as LiveData | null;
  if (!live || live.version !== 1 || !Array.isArray(live.sources)) {
    return { record: null, hotspots: [], weatherByCell: new Map() };
  }
  const record = live.sources.find((s) => s.id === srcId) ?? null;
  const hotspots = record && record.status !== 'failed' ? hotspotsFromSource(live.hotspots ?? [], srcId) : [];
  const weatherByCell = staleWeatherByCell(live.cells ?? []);
  return { record, hotspots, weatherByCell };
}

/** Max age of reused data before its signal counts as missing instead of as a number. */
export const MAX_AGE_HOURS = { hotspots: 6, weather: 48 } as const;

/**
 * Whether each signal can still be trusted. A stale snapshot is fine for a few
 * hours, but older satellite data would read as "no hotspots in the last 24 h"
 * and older rain data shifts the dry-day streak, so both become null (missing).
 */
export function signalFreshness(
  sources: Pick<SourceRecord, 'id' | 'status' | 'fetchedAt'>[],
  nowMs: number,
): { hotspots: boolean; weather: boolean } {
  const fresh = (s: Pick<SourceRecord, 'status' | 'fetchedAt'>, maxH: number) => {
    if (s.status === 'ok' || s.status === 'empty') return true;
    if (s.status !== 'stale' || !s.fetchedAt) return false;
    const ageH = (nowMs - Date.parse(s.fetchedAt)) / 3_600_000;
    return Number.isFinite(ageH) && ageH <= maxH;
  };
  return {
    hotspots: sources.some((s) => s.id.startsWith('firms') && fresh(s, MAX_AGE_HOURS.hotspots)),
    weather: sources.some((s) => s.id === 'open-meteo' && fresh(s, MAX_AGE_HOURS.weather)),
  };
}
