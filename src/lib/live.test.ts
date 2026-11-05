import { describe, expect, it } from 'vitest';
import {
  assignHotspotsToCells,
  hotspotsFromSource,
  missingWeather,
  openMeteoUrls,
  signalFreshness,
  pickCompleteWindow,
  reduceWeather,
  reusePrevLive,
  roundHotspot,
  staleWeatherByCell,
  suddenDropWarning,
} from './live';
import type { Hotspot } from './types';

const CELL = { id: 'kalteng:0:0', bbox: [110, 0, 110.5, 0.5] as [number, number, number, number] };
const NOW = Date.parse('2026-11-05T09:00:00Z');
const hs = (t: string, conf: Hotspot['conf'] = 'n', lon = 110.2, lat = 0.2, src = 'firms-viirs-snpp'): Hotspot => ({
  lat,
  lon,
  t,
  sat: 'N',
  conf,
  frp: 12.3,
  src,
});

describe('assignHotspotsToCells', () => {
  it('24h window boundary: exactly 24h old counts, 24h+1min does not', () => {
    const inside = [
      hs('2026-11-04T09:00:00Z'), // exactly 24h
      hs('2026-11-04T09:01:00Z'), // 23h59m
    ];
    const counts = assignHotspotsToCells(inside, [CELL], NOW);
    expect(counts.get(CELL.id)).toEqual({ hotspots24h: 1, hotspots7d: 1 }); // same ~1 km spot
    const counts2 = assignHotspotsToCells([hs('2026-11-04T08:59:00Z')], [CELL], NOW);
    expect(counts2.get(CELL.id)).toEqual({ hotspots24h: 0, hotspots7d: 1 });
  });

  it('low confidence excluded; future timestamps excluded; outside cells ignored', () => {
    const rows = [
      hs('2026-11-05T00:00:00Z', 'l'),
      hs('2026-11-05T00:00:00Z', 'h'),
      hs('2026-11-05T00:00:00Z', 'n', 100, 0),
      hs('2026-11-06T00:00:00Z'),
    ];
    const counts = assignHotspotsToCells(rows, [CELL], NOW);
    expect(counts.get(CELL.id)).toEqual({ hotspots24h: 1, hotspots7d: 1 });
  });

  it('same fire seen by two satellites ≈ same spot counts once (unique ~1 km locations)', () => {
    const rows = [
      hs('2026-11-05T00:00:00Z', 'n', 110.2, 0.2, 'firms-viirs-snpp'),
      hs('2026-11-05T00:10:00Z', 'n', 110.2, 0.2, 'firms-viirs-noaa20'),
      hs('2026-11-05T00:20:00Z', 'n', 110.204, 0.204, 'firms-modis'), // < 0.01° away → same key
    ];
    expect(assignHotspotsToCells(rows, [CELL], NOW).get(CELL.id)).toEqual({ hotspots24h: 1, hotspots7d: 1 });
  });

  it('spots ~2 km apart are distinct locations', () => {
    const rows = [
      hs('2026-11-05T00:00:00Z', 'n', 110.2, 0.2),
      hs('2026-11-05T00:00:00Z', 'n', 110.22, 0.2), // ≈2.2 km east
    ];
    expect(assignHotspotsToCells(rows, [CELL], NOW).get(CELL.id)).toEqual({ hotspots24h: 2, hotspots7d: 2 });
  });

  it('same spot on two UTC dates: 7d counts 2, 24h counts 1', () => {
    const rows = [
      hs('2026-11-05T00:00:00Z', 'n'),
      hs('2026-11-02T00:00:00Z', 'n'),
    ];
    expect(assignHotspotsToCells(rows, [CELL], NOW).get(CELL.id)).toEqual({ hotspots24h: 1, hotspots7d: 2 });
  });

  it('location with only low-confidence detections counts nowhere', () => {
    const rows = [
      hs('2026-11-05T00:00:00Z', 'l'),
      hs('2026-11-04T00:00:00Z', 'l'),
    ];
    expect(assignHotspotsToCells(rows, [CELL], NOW).get(CELL.id)).toBeUndefined();
  });
});

describe('openMeteoUrls', () => {
  const center = (i: number): [number, number] => [110 + i * 0.5, 0 + i * 0.5];

  it('batches at 100 coordinates per URL', () => {
    const urls = openMeteoUrls(Array.from({ length: 107 }, (_, i) => center(i)));
    expect(urls).toHaveLength(2);
    expect(new URL(urls[0]!).searchParams.get('latitude')!.split(',')).toHaveLength(100);
    expect(new URL(urls[0]!).searchParams.get('longitude')!.split(',')).toHaveLength(100);
    expect(new URL(urls[1]!).searchParams.get('latitude')!.split(',')).toHaveLength(7);
    expect(urls[0]).toContain('https://api.open-meteo.com/v1/forecast?daily=precipitation_sum');
  });

  it('single coordinate → one URL; empty → no URL', () => {
    expect(openMeteoUrls([[110, 0]])).toHaveLength(1);
    expect(openMeteoUrls([])).toEqual([]);
  });

  it('pure: same centers → identical URLs', () => {
    const cs = Array.from({ length: 55 }, (_, i) => center(i));
    expect(openMeteoUrls(cs)).toEqual(openMeteoUrls(cs));
  });
});

describe('suddenDropWarning', () => {
  it('flags a drop below 10% of a substantial previous fetch', () => {
    expect(suddenDropWarning(1204, 'ok', 90)).toBe('Jumlah baris turun tajam dari 1204 ke 90; periksa sumber.');
  });

  it('no warning above the 10% floor, small feeds, or when previous fetch was not ok', () => {
    expect(suddenDropWarning(1204, 'ok', 200)).toBeNull(); // exactly 10% → not a drop
    expect(suddenDropWarning(499, 'ok', 10)).toBeNull(); // threshold needs ≥500
    expect(suddenDropWarning(900, 'empty', 10)).toBeNull();
    expect(suddenDropWarning(null, 'ok', 10)).toBeNull();
  });
});

describe('pickCompleteWindow + reduceWeather', () => {
  const dates = Array.from({ length: 32 }, (_, i) => {
    const d = new Date(Date.parse('2026-10-05T00:00:00Z') + i * 86_400_000);
    return d.toISOString().slice(0, 10);
  }); // 2026-10-05 .. 2026-11-05 (last = today, Jakarta)

  it('excludes today and future, keeps last 30 complete days', () => {
    const vals = dates.map((_, i) => i);
    const win = pickCompleteWindow(dates, vals, '2026-11-05');
    expect(win).toHaveLength(30);
    expect(win[0]).toBe(1); // 2026-10-06
    expect(win[29]).toBe(30); // 2026-11-04 = yesterday
  });

  it('rain30 sums 30 days, dryDays counts consecutive <1mm ending yesterday', () => {
    const daily = [...Array(29).fill(0), 40]; // 29 dry days then a wet day
    const r = reduceWeather(daily);
    expect(r.rain30).toBe(40);
    expect(r.dryDays).toBe(0); // yesterday was wet
    const r2 = reduceWeather([...Array(12).fill(0.4), ...Array(17).fill(3)]);
    expect(r2.rain30).toBeCloseTo(0.4 * 12 + 3 * 17, 5);
    expect(r2.dryDays).toBe(0);
  });

  it('dryDays stops at first wet day walking backward; exactly 0.99 counts as dry', () => {
    const daily = [5, 0.9, 0, 2, 0.99];
    expect(reduceWeather(daily).dryDays).toBe(1); // 0.99 dry, then a 2mm day stops the walk
  });

  it('null handling: ≤5 missing days keeps rain30; missing day breaks dry streak to null', () => {
    const withGaps = [...Array(26).fill(1.2), ...Array(4).fill(null)];
    const r = reduceWeather(withGaps);
    expect(r.rain30).toBeCloseTo(26 * 1.2, 5);
    expect(r.dryDays).toBeNull(); // yesterday unknown
    const tooMany = [...Array(20).fill(1), ...Array(10).fill(null)];
    expect(reduceWeather(tooMany).rain30).toBeNull();
  });

  it('empty window: both signals null, never zero', () => {
    expect(reduceWeather([])).toEqual({ rain30: null, dryDays: null });
  });
});

describe('stale merge', () => {
  const prevCells = [
    { id: 'kalteng:0:0', weather: { rain30: 41.5, dryDays: 9, daily: [0, 41.5] } },
    { id: 'riau:1:2', weather: missingWeather() },
  ];

  it('weather reused verbatim from snapshot, never zeroed', () => {
    const map = staleWeatherByCell(prevCells);
    expect(map.get('kalteng:0:0')).toEqual({ rain30: 41.5, dryDays: 9, daily: [0, 41.5] });
    expect(map.get('missing')).toBeUndefined();
  });

  it('hotspots filtered by source id', () => {
    const rows = [hs('2026-11-04T00:00:00Z', 'n', 110, 0, 'firms-modis'), hs('2026-11-04T00:00:00Z', 'n', 111, 1, 'firms-viirs-snpp')];
    expect(hotspotsFromSource(rows, 'firms-modis')).toHaveLength(1);
    expect(hotspotsFromSource(rows, 'firms-modis')[0]!.src).toBe('firms-modis');
  });

  it('failed source without snapshot: nulls, not zeros', () => {
    const w = missingWeather();
    expect(w.rain30).toBeNull();
    expect(w.dryDays).toBeNull();
    expect(w.daily).toEqual([]);
  });

  it('reusePrevLive keeps old fetchedAt and rows from the previous run', () => {
    const prev = {
      version: 1,
      generatedAt: '2026-11-05T03:00:00Z',
      sources: [
        {
          id: 'firms-viirs-snpp',
          name: 'NASA FIRMS VIIRS S-NPP (NRT)',
          url: 'https://example.invalid/x.csv',
          status: 'ok',
          fetchedAt: '2026-11-05T03:00:00Z',
          attemptedAt: '2026-11-05T03:00:00Z',
          rows: 2,
        },
      ],
      hotspots: [
        hs('2026-11-04T00:00:00Z', 'n', 110, 0, 'firms-viirs-snpp'),
        hs('2026-11-04T00:00:00Z', 'n', 112, -2, 'firms-modis'),
      ],
      cells: prevCells,
      regions: [],
    };
    const reused = reusePrevLive(prev, 'firms-viirs-snpp');
    expect(reused.record?.fetchedAt).toBe('2026-11-05T03:00:00Z');
    expect(reused.hotspots).toHaveLength(1);
    expect(reused.weatherByCell.get('kalteng:0:0')?.dryDays).toBe(9);
    // a previously failed source must not be resurrected
    const prevFailed = { ...prev, sources: [{ ...prev.sources[0]!, status: 'failed', fetchedAt: null, rows: null }] };
    expect(reusePrevLive(prevFailed, 'firms-viirs-snpp').hotspots).toHaveLength(0);
    // garbage input is safe
    expect(reusePrevLive(null, 'firms-modis').record).toBeNull();
  });
});

describe('roundHotspot', () => {
  it('leans the payload: 4 decimals for coordinates, 1 for FRP', () => {
    const r = roundHotspot({ ...hs('2026-11-04T00:00:00Z'), lat: -1.234567, lon: 113.987654, frp: 12.344444 });
    expect(r.lat).toBe(-1.2346);
    expect(r.lon).toBe(113.9877);
    expect(r.frp).toBe(12.3);
  });
});

describe('signalFreshness', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
  it('trusts fresh and empty feeds', () => {
    expect(
      signalFreshness(
        [
          { id: 'firms-modis', status: 'empty', fetchedAt: ago(0) },
          { id: 'open-meteo', status: 'ok', fetchedAt: ago(0) },
        ],
        now,
      ),
    ).toEqual({ hotspots: true, weather: true });
  });
  it('treats a day-old satellite snapshot as missing, not as zero hotspots', () => {
    const r = signalFreshness(
      [
        { id: 'firms-viirs-snpp', status: 'stale', fetchedAt: ago(30) },
        { id: 'firms-modis', status: 'failed', fetchedAt: null },
        { id: 'open-meteo', status: 'stale', fetchedAt: ago(30) },
      ],
      now,
    );
    expect(r).toEqual({ hotspots: false, weather: true });
  });
  it('accepts a recent stale satellite snapshot and rejects old weather', () => {
    const r = signalFreshness(
      [
        { id: 'firms-viirs-snpp', status: 'stale', fetchedAt: ago(5) },
        { id: 'open-meteo', status: 'stale', fetchedAt: ago(49) },
      ],
      now,
    );
    expect(r).toEqual({ hotspots: true, weather: false });
  });
});
