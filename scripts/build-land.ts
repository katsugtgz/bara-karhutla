import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { MultiPolygon, Polygon, Position } from 'geojson';

/**
 * One-off build of public/data/indonesia-land.json: points on a 0.1° grid
 * inside Indonesian land polygons (Natural Earth 50m admin-0), for the dot-land
 * of the /kisah/ 3D scene. Raw download stays in .cache/ (not committed).
 */

const URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const STEP = 0.1;
const CACHE = resolve(process.cwd(), '.cache/ne_50m_admin_0_countries.geojson');
const OUT = resolve(process.cwd(), 'public/data/indonesia-land.json');

/** Ray-casting point-in-polygon, outer ring only (same rule as src/lib/geo.ts). */
function pointInPolygon(point: Position, polygon: Polygon): boolean {
  const ring = polygon.coordinates[0]!;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect =
      yi > point[1]! !== yj > point[1]! &&
      point[0]! < ((xj - xi) * (point[1]! - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point: Position, geom: Polygon | MultiPolygon): boolean {
  if (geom.type === 'Polygon') return pointInPolygon(point, geom);
  return geom.coordinates.some((poly) => pointInPolygon(point, { type: 'Polygon', coordinates: poly }));
}

async function fetchJson(): Promise<unknown> {
  if (existsSync(CACHE) && statSync(CACHE).size > 0) {
    console.log('cache hit:', CACHE);
    return JSON.parse(await readFile(CACHE, 'utf8'));
  }
  mkdirSync(resolve(CACHE, '..'), { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(URL, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await writeFile(CACHE, text);
      return JSON.parse(text);
    } catch (err) {
      if (attempt >= 2) throw err;
      console.log(`fetch gagal (${(err as Error).message}), coba lagi…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

interface Feat {
  properties: Record<string, unknown>;
  geometry: MultiPolygon | Polygon | null;
}

async function main() {
  const fc = (await fetchJson()) as { features: Feat[] };
  const idn = fc.features.find((f) => f.properties['ADM0_A3'] === 'IDN');
  if (!idn?.geometry) throw new Error('Fitur Indonesia (ADM0_A3=IDN) tidak ditemukan');
  const geom = idn.geometry;

  // bbox of Indonesia from its own rings
  let w = 180,
    s = 90,
    e = -180,
    n = -90;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys)
    for (const pt of poly[0]!) {
      w = Math.min(w, pt[0]!);
      e = Math.max(e, pt[0]!);
      s = Math.min(s, pt[1]!);
      n = Math.max(n, pt[1]!);
    }

  const points: [number, number][] = [];
  for (let lat = Math.ceil(s / STEP) * STEP; lat <= n; lat += STEP) {
    for (let lon = Math.ceil(w / STEP) * STEP; lon <= e; lon += STEP) {
      if (pointInGeometry([lon, lat], geom)) {
        points.push([
          Math.round(lon * 1000) / 1000,
          Math.round(lat * 1000) / 1000,
        ]);
      }
    }
  }

  const out = {
    source: {
      name: 'Natural Earth 50m admin-0 countries',
      url: URL,
      license: 'Public domain',
    },
    step: STEP,
    points,
  };
  mkdirSync(resolve(OUT, '..'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `wrote ${OUT}: ${points.length.toLocaleString('id-ID')} titik daratan (grid ${STEP}°, bbox ${w.toFixed(1)}–${e.toFixed(1)} BT, ${s.toFixed(1)}–${n.toFixed(1)} LS/LU)`,
  );
}

main();
