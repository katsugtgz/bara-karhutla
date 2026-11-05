/** Sky + width helpers for the /kisah/ story page. Pure, tested. */

export type SkyClass = 'sky-1' | 'sky-2' | 'sky-3' | 'sky-4';

/** Hex of each sky token (they are data — identical in light and dark mode). */
export const SKY_HEX: Record<SkyClass, string> = {
  'sky-1': '#CFDFE2',
  'sky-2': '#D9C79A',
  'sky-3': '#C47F3A',
  'sky-4': '#9E3B25',
};

/**
 * Sky class for a year, by its hotspot count relative to the busiest year.
 * Quiet years stay pale; the big fire years go sepia, then Jambi red.
 * Thresholds chosen on MODIS 2006–2025: 2015 and 2019 must land on sky-4,
 * mid years on sky-2/sky-3.
 */
export function skyClassFor(ratio: number): SkyClass {
  if (ratio < 0.12) return 'sky-1';
  if (ratio < 0.3) return 'sky-2';
  if (ratio < 0.55) return 'sky-3';
  return 'sky-4';
}

/**
 * Anybody "wdth" axis for a year headline, linear from 60 (quietest year)
 * to 150 (busiest) — type stretches with the fire (DESIGN.md).
 */
export function wdthFor(count: number, min: number, max: number): number {
  if (max <= min) return 150;
  const t = Math.min(1, Math.max(0, (count - min) / (max - min)));
  return Math.round(60 + t * 90);
}

/**
 * Column height for a 0.25° bin: log-scaled so one huge bin does not flatten
 * the rest, then pulled below-linear (^1.6) so busy bins do not drown the map.
 */
export function binHeight(count: number, maxCount: number, unit = 1.5): number {
  if (count <= 0 || maxCount <= 0) return 0;
  return unit * (Math.log1p(count) / Math.log1p(maxCount)) ** 1.6;
}

/** Relative luminance (WCAG) of the two story inks: peat #2A1D15 and light #FBEFE6. */
const PEAT_LUMINANCE = 0.0137;
const LIGHT_LUMINANCE = 0.8746;

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Which ink reads better on a sky of the given relative luminance
 * (linear-light: 0.2126 R + 0.7152 G + 0.0722 B). The sky blends continuously
 * between tokens while scrolling, so text colour follows the live value.
 */
export function inkForLuminance(skyLuminance: number): 'dark' | 'light' {
  return contrast(skyLuminance, LIGHT_LUMINANCE) > contrast(skyLuminance, PEAT_LUMINANCE) ? 'light' : 'dark';
}

/** Indonesian grouping: 3881992 → "3.881.992". */
const IDN_FORMAT = new Intl.NumberFormat('id-ID');

export function formatId(n: number): string {
  return IDN_FORMAT.format(n);
}
