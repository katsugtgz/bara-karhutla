import type { Hotspot } from './types';

/**
 * Unique-location helpers for live FIRMS hotspots. Satellites see the same
 * fire several times per overpass; counting detections double- and triple-
 * counts one fire. A "location" is a ~1 km cell: lat/lon rounded to 0.01°.
 * Low-confidence detections are excluded everywhere here.
 */

const HOUR_MS = 3_600_000;

/** A location counts when at least one non-low-confidence detection falls in it. */
function inWindow(h: Hotspot, earliestMs: number, nowMs: number): boolean {
  if (h.conf === 'l') return false;
  const t = Date.parse(h.t);
  return t >= earliestMs && t <= nowMs;
}

const locKey = (h: Hotspot) => `${Math.round(h.lat * 100)},${Math.round(h.lon * 100)}`;

/** Unique ~1 km locations (0.01° grid) with ≥1 non-low-confidence detection in the window. */
export function uniqueLocations(hotspots: Hotspot[], nowMs: number, windowHours: number): number {
  const earliest = nowMs - windowHours * HOUR_MS;
  const seen = new Set<string>();
  for (const h of hotspots) {
    if (!inWindow(h, earliest, nowMs)) continue;
    seen.add(locKey(h));
  }
  return seen.size;
}

/** Same filter as uniqueLocations, aggregated into step-degree bins: [lon, lat, count][]. */
export function binUnique(
  hotspots: Hotspot[],
  nowMs: number,
  windowHours: number,
  step: number,
): [number, number, number][] {
  const earliest = nowMs - windowHours * HOUR_MS;
  const bins = new Map<string, [number, number, number]>();
  for (const h of hotspots) {
    if (!inWindow(h, earliest, nowMs)) continue;
    const lon = Math.round(h.lon / step) * step;
    const lat = Math.round(h.lat / step) * step;
    const key = `${lon},${lat}`;
    const bin = bins.get(key);
    if (bin) bin[2]! += 1;
    else bins.set(key, [lon, lat, 1]);
  }
  return [...bins.values()];
}
