import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Stub pipeline: writes a valid, empty LiveData so the app builds and renders
 * an honest "no data" state. The real fetcher (FIRMS + Open-Meteo, snapshot
 * fallback per ARCHITECTURE.md) replaces this file later.
 */
const now = new Date().toISOString();
const live = {
  version: 1 as const,
  generatedAt: now,
  sources: [],
  hotspots: [],
  cells: [],
  regions: [],
};

const outPath = resolve(process.cwd(), 'public/data/live.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(live));
console.log(`wrote ${outPath} (stub, empty data)`);
