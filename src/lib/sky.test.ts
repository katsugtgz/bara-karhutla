import { describe, expect, it } from 'vitest';
import { SKY_HEX, binHeight, formatId, inkForLuminance, skyClassFor, wdthFor } from './sky';

describe('skyClassFor', () => {
  it('quiet years pale, fire years red', () => {
    expect(skyClassFor(0)).toBe('sky-1');
    expect(skyClassFor(0.05)).toBe('sky-1');
    expect(skyClassFor(0.2)).toBe('sky-2');
    expect(skyClassFor(0.4)).toBe('sky-3');
    expect(skyClassFor(0.6)).toBe('sky-4');
    expect(skyClassFor(1)).toBe('sky-4');
  });
});

describe('wdthFor', () => {
  it('maps count linearly onto 60–150 and clamps', () => {
    expect(wdthFor(0, 0, 100)).toBe(60);
    expect(wdthFor(100, 0, 100)).toBe(150);
    expect(wdthFor(50, 0, 100)).toBe(105);
    expect(wdthFor(-5, 0, 100)).toBe(60);
    expect(wdthFor(150, 0, 100)).toBe(150);
  });

  it('degenerate range returns max width', () => {
    expect(wdthFor(10, 10, 10)).toBe(150);
  });
});

describe('binHeight', () => {
  it('log-scales between 0 and unit, pulled below-linear', () => {
    expect(binHeight(0, 100)).toBe(0);
    expect(binHeight(100, 100)).toBeCloseTo(1.5);
    expect(binHeight(100, 100, 2)).toBeCloseTo(2);
    // log1p compresses, ^1.6 compresses further: a quarter-of-max bin stays under 60% height
    expect(binHeight(25, 100)).toBeGreaterThan(0.7);
    expect(binHeight(25, 100)).toBeLessThan(0.9);
  });
});

describe('formatId', () => {
  it('groups with dots', () => {
    expect(formatId(3881992)).toBe('3.881.992');
    expect(formatId(504000)).toBe('504.000');
  });
});

describe('inkForLuminance', () => {
  const lum = (hex: string) => {
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  it('keeps peat ink on the pale, sepia and ochre skies', () => {
    expect(inkForLuminance(lum(SKY_HEX['sky-1']))).toBe('dark');
    expect(inkForLuminance(lum(SKY_HEX['sky-2']))).toBe('dark');
    expect(inkForLuminance(lum(SKY_HEX['sky-3']))).toBe('dark');
  });
  it('switches to light ink on the red sky', () => {
    expect(inkForLuminance(lum(SKY_HEX['sky-4']))).toBe('light');
  });
});
