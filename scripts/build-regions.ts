/**
 * One-off: build public/data/regions.json from Natural Earth admin-1.
 * - filter Indonesia, keep 3 pilot provinces
 * - mapshaper -simplify 8% keep-shapes
 * - snap each region bbox to the shared 0.5° grid, keep cells whose centre
 *   falls inside the (simplified) polygon
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { makeGrid, pointInGeometry } from '../src/lib/geo.ts';
import type { RegionId, RegionsFile } from '../src/lib/types.ts';

const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
const CACHE = resolve(process.cwd(), '.cache');
const RAW = resolve(CACHE, 'ne_10m_admin_1.geojson');
const PICKED = resolve(CACHE, 'id3.geojson');
const SIMPLIFIED = resolve(CACHE, 'id3-simplified.geojson');
const OUT = resolve(process.cwd(), 'public/data/regions.json');

const REGIONS: { id: RegionId; neName: string; name: string }[] = [
  { id: 'kalteng', neName: 'Kalimantan Tengah', name: 'Kalimantan Tengah' },
  { id: 'riau', neName: 'Riau', name: 'Riau' },
  { id: 'sumsel', neName: 'Sumatera Selatan', name: 'Sumatera Selatan' },
];

const snap = (v: number, dir: 'floor' | 'ceil') => {
  const f = Math.floor(v * 2) / 2;
  return dir === 'floor' ? f : f === v ? v : f + 0.5;
};

function bboxOf(geom: Polygon | MultiPolygon): [number, number, number, number] {
  const rings =
    geom.type === 'Polygon' ? [geom.coordinates[0]!] : geom.coordinates.map((p) => p[0]!);
  let w = 180, s = 90, e = -180, n = -90;
  for (const ring of rings)
    for (const [x, y] of ring) {
      w = Math.min(w, x!); s = Math.min(s, y!); e = Math.max(e, x!); n = Math.max(n, y!);
    }
  return [w, s, e, n];
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(resolve(OUT, '..'), { recursive: true });

if (!exists(RAW)) {
  console.log(`downloading ${NE_URL} …`);
  const res = await fetch(NE_URL, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  writeFileSync(RAW, Buffer.from(await res.arrayBuffer()));
}

function exists(p: string): boolean {
  try { readFileSync(p); return true; } catch { return false; }
}

type Admin1Props = { name?: string; admin?: string };
const fc = JSON.parse(readFileSync(RAW, 'utf8')) as {
  features: Feature<MultiPolygon | Polygon, Admin1Props>[];
};
const picked = REGIONS.map((r) => {
  const f = fc.features.find(
    (f) =>
      (f.properties?.admin === 'Indonesia' || f.properties?.admin === 'ID') &&
      (f.properties?.name ?? '').toLowerCase() === r.neName.toLowerCase(),
  );
  if (!f) {
    const idNames = fc.features
      .filter((f) => f.properties?.admin === 'Indonesia')
      .map((f) => f.properties?.name)
      .join(', ');
    throw new Error(`region "${r.neName}" not found. Indonesia names: ${idNames}`);
  }
  return { ...f, properties: { name: r.neName, regionId: r.id } };
});
writeFileSync(PICKED, JSON.stringify({ type: 'FeatureCollection', features: picked }));

console.log('simplifying with mapshaper …');
execFileSync(
  'npx',
  ['-y', 'mapshaper', PICKED, '-simplify', '8%', 'keep-shapes', '-clean',
   '-o', 'precision=0.001', 'format=geojson', SIMPLIFIED],
  { stdio: 'inherit' },
);

const simp = JSON.parse(readFileSync(SIMPLIFIED, 'utf8')) as {
  features: Feature<MultiPolygon | Polygon, { regionId: string }>[];
};

const out: RegionsFile = {
  source: {
    name: 'Natural Earth admin-1 states provinces (1:10m, simplified 8%)',
    url: NE_URL,
    license: 'Public domain (naturalearthdata.com)',
  },
  regions: REGIONS.map((r) => {
    const f = simp.features.find((f) => f.properties.regionId === r.id)!;
    const [w, s, e, n] = bboxOf(f.geometry);
    const bbox: [number, number, number, number] = [snap(w, 'floor'), snap(s, 'floor'), snap(e, 'ceil'), snap(n, 'ceil')];
    const cells = makeGrid(r.id, bbox).filter((c) => pointInGeometry(c.center, f.geometry));
    console.log(`${r.name}: bbox ${bbox.join(', ')} → ${cells.length} sel 0,5°`);
    return {
      id: r.id,
      name: r.name,
      geometry: f.geometry,
      cells: cells.map(({ id, row, col, bbox, center }) => ({ id, row, col, bbox, center })),
    };
  }),
};

writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${OUT} (minified, ${(Math.round(JSON.stringify(out).length / 1024))} kB)`);
