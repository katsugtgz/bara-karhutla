import { describe, expect, it } from 'vitest';
import { FirmsFormatError, inIndonesia, mapConf, parseFirmsCsv, validateFirmsHeader } from './firms';

const VIIRS_HEADER =
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight';

const VIIRS_CSV = [
  VIIRS_HEADER,
  '-2.5,113.7,344.2,1.2,1.1,2026-11-04,1830,N,high,2.0RTW,301.5,12.3,D',
  '-0.9,101.5,330.0,1.3,1.2,2026-11-04, 615,N20,nominal,2.0RTW,295.0,8.1,N',
  '1.2,99.1,322.0,1.1,1.0,2026-11-03,2359,N21,low,2.0RTW,290.0,0.0,N',
  '35.0,139.7,340.0,1.0,1.0,2026-11-04,1200,N,high,2.0RTW,300.0,5.0,D', // Tokyo: outside bbox
].join('\r\n');

const MODIS_CSV = [
  'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight',
  '-3.1,114.9,320.5,1.5,1.4,2026-11-04,0255,Terra,MODIS,85,6.1,300.0,44.2,D',
  '-2.9,115.0,315.0,1.6,1.5,2026-11-04,0255,Aqua,MODIS,45,6.1,298.0,20.0,D',
  '-2.8,115.1,310.0,1.6,1.5,2026-11-04,0255,Aqua,MODIS,10,6.1,298.0,5.0,D',
].join('\n');

describe('inIndonesia', () => {
  it('bbox filter', () => {
    expect(inIndonesia(-2.5, 113.7)).toBe(true);
    expect(inIndonesia(6.5, 141.5)).toBe(true);
    expect(inIndonesia(-11.5, 94.5)).toBe(true);
    expect(inIndonesia(-11.6, 100)).toBe(false);
    expect(inIndonesia(35, 139.7)).toBe(false);
  });
});

describe('mapConf', () => {
  it('VIIRS words', () => {
    expect(mapConf('low', true)).toBe('l');
    expect(mapConf('nominal', true)).toBe('n');
    expect(mapConf('high', true)).toBe('h');
  });
  it('MODIS 0-100', () => {
    expect(mapConf('29', false)).toBe('l');
    expect(mapConf('30', false)).toBe('n');
    expect(mapConf('79', false)).toBe('n');
    expect(mapConf('80', false)).toBe('h');
  });
});

describe('parseFirmsCsv', () => {
  it('parses VIIRS by header name, CRLF, outside-bbox dropped', () => {
    const rows = parseFirmsCsv(VIIRS_CSV, 'firms-viirs-snpp');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      lat: -2.5,
      lon: 113.7,
      t: '2026-11-04T18:30:00Z',
      sat: 'N',
      conf: 'h',
      frp: 12.3,
      src: 'firms-viirs-snpp',
    });
    expect(rows[1]!.sat).toBe('N20');
    expect(rows[1]!.conf).toBe('n');
    expect(rows[2]!.sat).toBe('N21');
    expect(rows[2]!.conf).toBe('l');
  });

  it('parses MODIS numeric confidence and Terra/Aqua', () => {
    const rows = parseFirmsCsv(MODIS_CSV, 'firms-modis');
    expect(rows.map((r) => r.conf)).toEqual(['h', 'n', 'l']);
    expect(rows.map((r) => r.sat)).toEqual(['Terra', 'Aqua', 'Aqua']);
  });

  it('acq_time tolerant: left-pads to 4 digits ("4" → 00:04, "615" → 06:15)', () => {
    const csv = [
      VIIRS_HEADER,
      '-2.5,113.7,344.2,1.2,1.1,2026-11-04,4,N,high,2.0RTW,301.5,12.3,D',
      '-2.6,113.8,344.2,1.2,1.1,2026-11-04,615,N,high,2.0RTW,301.5,12.3,D',
    ].join('\n');
    expect(parseFirmsCsv(csv, 'firms-viirs-snpp').map((r) => r.t)).toEqual([
      '2026-11-04T00:04:00Z',
      '2026-11-04T06:15:00Z',
    ]);
  });

  it('HTML error page with HTTP 200: invalid header, must throw — never zero rows', () => {
    const html = '<html><body><h1>404 Not Found</h1><p>Page not found.</p></body></html>';
    expect(() => parseFirmsCsv(html, 'x')).toThrow(FirmsFormatError);
    expect(() => validateFirmsHeader(html)).toThrow(/latitude/);
  });

  it('empty body is invalid (no header at all); header-only is valid and empty', () => {
    expect(() => parseFirmsCsv('', 'x')).toThrow(FirmsFormatError);
    expect(parseFirmsCsv(`${VIIRS_HEADER}\n`, 'x')).toEqual([]);
  });
});
