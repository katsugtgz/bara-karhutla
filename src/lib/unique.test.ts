import { describe, expect, it } from 'vitest';
import type { Hotspot } from './types';
import { binUnique, uniqueLocations } from './unique';

const NOW = Date.parse('2026-11-05T12:00:00Z');

const hs = (lat: number, lon: number, t: string, conf: Hotspot['conf'] = 'n', sat = 'N'): Hotspot => ({
  lat,
  lon,
  t,
  sat,
  conf,
  frp: 0,
  src: 'test',
});

const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString().replace('.000Z', 'Z');

describe('uniqueLocations', () => {
  it('two satellites seeing the same spot count once', () => {
    const spots = [hs(-2, 110, hoursAgo(1), 'n', 'N'), hs(-2, 110, hoursAgo(2), 'h', 'N20')];
    expect(uniqueLocations(spots, NOW, 24)).toBe(1);
  });

  it('locations 2 km apart count twice', () => {
    const spots = [hs(-2.0, 110, hoursAgo(1)), hs(-2.018, 110, hoursAgo(1))];
    expect(uniqueLocations(spots, NOW, 24)).toBe(2);
  });

  it('low-confidence detections are excluded', () => {
    expect(uniqueLocations([hs(-2, 110, hoursAgo(1), 'l')], NOW, 24)).toBe(0);
    // a low-confidence detection on an otherwise confirmed location does not add one
    const spots = [hs(-2, 110, hoursAgo(1), 'h'), hs(-2, 110, hoursAgo(1), 'l')];
    expect(uniqueLocations(spots, NOW, 24)).toBe(1);
  });

  it('detections outside the window are excluded', () => {
    const spots = [hs(-2, 110, hoursAgo(167)), hs(-3, 111, hoursAgo(169))];
    expect(uniqueLocations(spots, NOW, 168)).toBe(1);
  });
});

describe('binUnique', () => {
  it('aggregates unique locations into step bins', () => {
    const spots = [
      hs(-2.0, 110.0, hoursAgo(1)),
      hs(-2.018, 110.0, hoursAgo(1)), // same 0.25° bin, distinct location
      hs(-2.0, 110.1, hoursAgo(1), 'l'), // low confidence: ignored entirely
    ];
    expect(binUnique(spots, NOW, 24, 0.25)).toEqual([[110, -2, 2]]);
  });

  it('respects the confidence filter and window', () => {
    const spots = [hs(-2, 110, hoursAgo(200), 'h'), hs(-2, 110, hoursAgo(1), 'l')];
    expect(binUnique(spots, NOW, 168, 0.25)).toEqual([]);
  });
});
