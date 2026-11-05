import type { Hotspot } from './types';

/** Thrown when the response body is not a FIRMS CSV (e.g. an HTML error page sent with HTTP 200). */
export class FirmsFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirmsFormatError';
  }
}

const REQUIRED_COLUMNS = ['latitude', 'longitude', 'acq_date', 'acq_time'] as const;

/**
 * A response without a valid FIRMS header must be treated as a FAILED fetch,
 * never as a successful zero-row file. Empty = header present, zero data rows.
 */
export function validateFirmsHeader(text: string): void {
  const header = text.split(/\r?\n/, 1)[0]?.split(',').map((h) => h.trim().toLowerCase()) ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new FirmsFormatError(`bukan CSV FIRMS yang valid (kolom hilang: ${missing.join(', ')})`);
  }
}

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
  // acq_date YYYY-MM-DD, acq_time HHMM (UTC); NASA sometimes pads with spaces
  // or drops leading zeros ("  4", "615") — left-pad to 4 digits.
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const raw = time.trim();
  if (!d || !/^\d{1,4}$/.test(raw)) return null;
  const t = raw.padStart(4, '0');
  return `${d[1]}-${d[2]}-${d[3]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`;
}

/**
 * Parse a NASA FIRMS CSV by header name (handles both VIIRS and MODIS layouts).
 * Rows outside the Indonesia bbox or with unusable coordinates are dropped.
 */
export function parseFirmsCsv(text: string, srcId: string): Hotspot[] {
  validateFirmsHeader(text); // throws FirmsFormatError on non-FIRMS bodies
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iLat = col('latitude');
  const iLon = col('longitude');
  const iDate = col('acq_date');
  const iTime = col('acq_time');
  const iSat = col('satellite');
  const iConf = col('confidence');
  const iFrp = col('frp');

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
