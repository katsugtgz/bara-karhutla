import type { MultiPolygon, Polygon } from 'geojson';

export type SourceStatus = 'ok' | 'empty' | 'failed' | 'stale';

export interface SourceRecord {
  id: string; // 'firms-viirs-snpp' | 'firms-viirs-noaa20' | 'firms-viirs-noaa21' | 'firms-modis' | 'open-meteo'
  name: string; // 'NASA FIRMS VIIRS S-NPP (NRT)'
  url: string; // exact URL fetched
  status: SourceStatus; // empty = fetched fine, zero rows; failed = request error; stale = failed, using previous snapshot
  fetchedAt: string | null; // ISO time of the last successful fetch
  attemptedAt: string; // ISO time of this attempt
  rows: number | null; // rows after Indonesia filter; null if unknown
  error?: string;
}

export interface Hotspot {
  // compact, one per detection
  lat: number;
  lon: number;
  t: string; // ISO UTC acquisition time from acq_date + acq_time
  sat: 'N' | 'N20' | 'N21' | 'Terra' | 'Aqua' | string;
  conf: 'l' | 'n' | 'h'; // VIIRS low/nominal/high; MODIS 0–29 l, 30–79 n, 80–100 h
  frp: number; // MW
  src: string; // SourceRecord.id
}

export interface CellWeather {
  rain30: number | null; // mm, sum of last 30 complete days
  dryDays: number | null; // consecutive days ending yesterday with precip < 1 mm
  daily: number[]; // last 30 daily sums, oldest first
}

export type RiskClass = 'rendah' | 'sedang' | 'tinggi' | 'sangat-tinggi';
export type Confidence = 'tinggi' | 'sedang' | 'rendah';

export interface CellRisk {
  id: string; // `${regionId}:${row}:${col}`
  regionId: string;
  bbox: [number, number, number, number]; // [w, s, e, n]
  hotspots24h: number; // non-low-confidence detections in cell, last 24h
  hotspots7d: number;
  weather: CellWeather;
  score: number | null; // 0–100
  range: [number, number] | null;
  cls: RiskClass | null;
  confidence: Confidence;
  missing: string[]; // signal names that were unavailable
}

export type RegionId = 'kalteng' | 'riau' | 'sumsel';

export interface RegionSummary {
  id: RegionId;
  name: string; // 'Kalimantan Tengah'
  score: number | null; // 75th percentile of cell scores
  range: [number, number] | null;
  cls: CellRisk['cls'];
  confidence: CellRisk['confidence'];
  hotspots24h: number;
  hotspots7d: number;
  medianDryDays: number | null;
  medianRain30: number | null;
}

export interface LiveData {
  version: 1;
  generatedAt: string;
  sources: SourceRecord[];
  hotspots: Hotspot[]; // Indonesia bbox, last 7 days (all confidences)
  cells: CellRisk[];
  regions: RegionSummary[];
}

export interface RegionsFile {
  // public/data/regions.json
  source: { name: string; url: string; license: string };
  regions: {
    id: RegionSummary['id'];
    name: string;
    geometry: MultiPolygon | Polygon;
    cells: {
      id: string;
      row: number;
      col: number;
      bbox: [number, number, number, number];
      center: [number, number];
    }[];
  }[];
}

export interface HistoryFile {
  // public/data/history.json
  source: { name: string; url: string; note: string };
  years: {
    year: number;
    count: number; // MODIS detections conf >= 30 inside Indonesia
    bins: [number, number, number][]; // [lon, lat, count], 0.25° bins
  }[];
}
