import type { Hotspot } from './types';

/** Indonesia bbox per ARCHITECTURE.md: lon 94.5..141.5, lat -11.5..6.5. */
export function inIndonesia(lat: number, lon: number): boolean {
  return lon >= 94.5 && lon <= 141.5 && lat >= -11.5 && lat <= 6.5;
}

const SAT_MAP: Record<string, Hotspot['sat']> = {
  N: 'N',
  'SUOMI-NPP': 'N',
  'NOAA-20': 'N20',
  N20: 'N20',
  J1: 'N20',
  'NOAA-21': 'N21',
  N21: 'N21',
  J2: 'N21',
  TERRA: 'Terra',
  AQUA: 'Aqua',
};

function mapSat(raw: string): Hotspot['sat'] {
  return SAT_MAP[raw.trim().toUpperCase()] ?? raw.trim();
}

/** VIIRS conf is low/nominal/high; MODIS conf is 0-100. */
export function mapConf(raw: string, isViirs: boolean): Hotspot['conf'] {
  const v = raw.trim();
  if (!isViirs || /^[0-9.]+$/.test(v)) {
    const n = Number(v);
    if (Number.isNaN(n)) return 'n';
    if (n < 30) return 'l';
    if (n < 80) return 'n';
    return 'h';
  }
  const lv = v.toLowerCase();
  if (lv === 'low') return 'l';
  if (lv === 'high') return 'h';
  return 'n';
}

function acqIso(date: string, time: string): string | null {
  // acq_date YYYY-MM-DD, acq_time HHMM (UTC), sometimes with spaces like "  4"
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2})(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  return `${d[1]}-${d[2]}-${d[3]}T${t[1]!.padStart(2, '0')}:${t[2]}:00Z`;
}

/**
 * Parse a NASA FIRMS CSV by header name (handles both VIIRS and MODIS layouts).
 * Rows outside the Indonesia bbox or with unusable coordinates are dropped.
 */
export function parseFirmsCsv(text: string, srcId: string): Hotspot[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iLat = col('latitude');
  const iLon = col('longitude');
  const iDate = col('acq_date');
  const iTime = col('acq_time');
  const iSat = col('satellite');
  const iConf = col('confidence');
  const iFrp = col('frp');
  if (iLat < 0 || iLon < 0 || iDate < 0 || iTime < 0) return [];

  const isViirs = header.includes('bright_ti4');
  const out: Hotspot[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const lat = Number(c[iLat]);
    const lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!inIndonesia(lat, lon)) continue;
    const t = acqIso(c[iDate] ?? '', c[iTime] ?? '');
    if (!t) continue;
    out.push({
      lat,
      lon,
      t,
      sat: iSat >= 0 ? mapSat(c[iSat] ?? '') : '',
      conf: mapConf(c[iConf] ?? '', isViirs),
      frp: iFrp >= 0 && c[iFrp] !== undefined && c[iFrp] !== '' ? Number(c[iFrp]) || 0 : 0,
      src: srcId,
    });
  }
  return out;
}
