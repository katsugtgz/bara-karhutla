import { describe, expect, it } from 'vitest';
import { classify, percentile, scoreCell, summarizeRegion } from './risk';

describe('scoreCell', () => {
  it('humid quiet cell scores 0 rendah', () => {
    const r = scoreCell({ hotspots24h: 0, dryDays: 0, rain30: 150, anySourceStale: false });
    expect(r.score).toBe(0);
    expect(r.cls).toBe('rendah');
    expect(r.confidence).toBe('tinggi');
  });

  it('peak signals score 100 sangat-tinggi', () => {
    const r = scoreCell({ hotspots24h: 20, dryDays: 14, rain30: 0, anySourceStale: false });
    expect(r.score).toBe(100);
    expect(r.cls).toBe('sangat-tinggi');
  });

  it('class boundaries', () => {
    // h=0, r=0 (rain 150mm): score = round(100 * d * 0.3)
    const dry = (dryDays: number) =>
      scoreCell({ hotspots24h: 0, dryDays, rain30: 150, anySourceStale: false });
    expect(classify(24.9)).toBe('rendah');
    expect(classify(25)).toBe('sedang');
    expect(classify(49.9)).toBe('sedang');
    expect(classify(50)).toBe('tinggi');
    expect(classify(74.9)).toBe('tinggi');
    expect(classify(75)).toBe('sangat-tinggi');
    expect(dry(14).score).toBe(30); // full dry weight, round()
    expect(dry(11.6).score).toBe(25);
  });

  it('missing rain renormalises weights, lowers confidence, widens range', () => {
    const r = scoreCell({ hotspots24h: 20, dryDays: 14, rain30: null, anySourceStale: false });
    expect(r.score).toBe(100); // (0.45 + 0.30) renormalised to 1
    expect(r.missing).toEqual(['rain30']);
    expect(r.confidence).toBe('sedang');
    expect(r.range).toEqual([82, 100]); // u = 6 + 12
  });

  it('all signals missing gives null score and rendah confidence', () => {
    const r = scoreCell({ hotspots24h: null, dryDays: null, rain30: null, anySourceStale: false });
    expect(r.score).toBeNull();
    expect(r.range).toBeNull();
    expect(r.cls).toBeNull();
    expect(r.confidence).toBe('rendah');
    expect(r.missing).toEqual(['hotspots24h', 'dryDays', 'rain30']);
  });

  it('stale sources lower confidence and widen range', () => {
    const clean = scoreCell({ hotspots24h: 0, dryDays: 0, rain30: 150, anySourceStale: false });
    const stale = scoreCell({ hotspots24h: 0, dryDays: 0, rain30: 150, anySourceStale: true });
    expect(clean.confidence).toBe('tinggi');
    expect(stale.confidence).toBe('sedang');
    expect(stale.range![1] - stale.range![0]).toBeGreaterThan(
      clean.range![1] - clean.range![0],
    );
  });

  it('range clamps to 0..100', () => {
    const r = scoreCell({ hotspots24h: 0, dryDays: 0, rain30: 150, anySourceStale: true });
    expect(r.range![0]).toBe(0);
    expect(r.range![1]).toBeLessThanOrEqual(100);
    const top = scoreCell({ hotspots24h: 20, dryDays: 14, rain30: 0, anySourceStale: true });
    expect(top.range![1]).toBe(100);
    expect(top.range![0]).toBeGreaterThanOrEqual(0);
  });
});

describe('percentile', () => {
  it('linear interpolation', () => {
    expect(percentile([10, 20, 30, 40], 75)).toBe(32.5);
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
    expect(percentile([7], 75)).toBe(7);
  });
});

describe('summarizeRegion', () => {
  const cell = (score: number, range: [number, number] = [score, score], confidence = 'tinggi') => ({
    score,
    range,
    confidence: confidence as 'tinggi',
    hotspots24h: 1,
    hotspots7d: 2,
    weather: { rain30: 100, dryDays: 3, daily: [] as number[] },
  });

  it('p75 of scores with linear interpolation', () => {
    const s = summarizeRegion([cell(10), cell(20), cell(30), cell(40)]);
    expect(s.score).toBe(32.5);
    expect(s.cls).toBe('sedang');
  });

  it('range is p75 of lows to p75 of highs; sums and medians', () => {
    const mk = (score: number, low: number, high: number) => cell(score, [low, high]);
    const s = summarizeRegion([mk(10, 4, 16), mk(20, 14, 26), mk(30, 24, 36), mk(40, 34, 46)]);
    expect(s.range).toEqual([26.5, 38.5]); // p75 of lows = 26.5, p75 of highs = 38.5
    expect(s.hotspots24h).toBe(4);
    expect(s.hotspots7d).toBe(8);
    expect(s.medianDryDays).toBe(3);
    expect(s.medianRain30).toBe(100);
  });

  it('confidence is most common, ties go lower', () => {
    const tied = summarizeRegion([
      cell(10, [10, 10], 'tinggi'),
      cell(20, [20, 20], 'tinggi'),
      cell(30, [30, 30], 'sedang'),
      cell(40, [40, 40], 'sedang'),
      cell(50, [50, 50], 'rendah'),
    ]);
    expect(tied.confidence).toBe('sedang'); // tinggi 2 vs sedang 2: tie goes lower
    expect(
      summarizeRegion([
        cell(10, [10, 10], 'tinggi'),
        cell(20, [20, 20], 'sedang'),
        cell(30, [30, 30], 'rendah'),
      ]).confidence,
    ).toBe('rendah'); // 1-1-1 tie: lowest wins
  });

  it('all-null cells give null score and rendah', () => {
    const s = summarizeRegion([
      {
        score: null,
        range: null,
        confidence: 'rendah',
        hotspots24h: 0,
        hotspots7d: 0,
        weather: { rain30: null, dryDays: null, daily: [] },
      },
    ]);
    expect(s.score).toBeNull();
    expect(s.cls).toBeNull();
    expect(s.confidence).toBe('rendah');
    expect(s.medianDryDays).toBeNull();
  });
});

describe('summarizeRegion hotspot totals', () => {
  const cell = (h: number | null) => ({
    score: 10,
    range: [4, 16] as [number, number],
    confidence: 'tinggi' as const,
    hotspots24h: h,
    hotspots7d: h,
    weather: { rain30: 100, dryDays: 1, daily: [] },
  });
  it('sums known counts', () => {
    expect(summarizeRegion([cell(2), cell(3)]).hotspots24h).toBe(5);
  });
  it('is unknown, not smaller, when any cell count is unknown', () => {
    expect(summarizeRegion([cell(2), cell(null)]).hotspots24h).toBeNull();
  });
});
