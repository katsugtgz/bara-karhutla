import type { CellRisk, Confidence, RiskClass } from './types';

export const RISK_MODEL = {
  version: 'v0',
  weights: { hotspots: 0.45, dryDays: 0.3, rain30: 0.25 },
  thresholds: { rendah: 25, sedang: 50, tinggi: 75 },
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function classify(score: number): RiskClass {
  if (score < 25) return 'rendah';
  if (score < 50) return 'sedang';
  if (score < 75) return 'tinggi';
  return 'sangat-tinggi';
}

export interface ScoreInput {
  hotspots24h: number | null;
  dryDays: number | null;
  rain30: number | null;
  anySourceStale: boolean;
}

export interface ScoreResult {
  score: number | null;
  range: [number, number] | null;
  cls: RiskClass | null;
  confidence: Confidence;
  missing: string[];
}

/** Risk score v0 (see /metode/): transparent draft weights awaiting expert calibration. */
export function scoreCell(input: ScoreInput): ScoreResult {
  const missing: string[] = [];
  const terms: { weight: number; value: number }[] = [];
  const { hotspots24h, dryDays, rain30, anySourceStale } = input;

  if (hotspots24h === null) {
    missing.push('hotspots24h');
  } else {
    terms.push({
      weight: RISK_MODEL.weights.hotspots,
      value: Math.min(1, Math.log1p(Math.max(0, hotspots24h)) / Math.log1p(20)),
    });
  }
  if (dryDays === null) {
    missing.push('dryDays');
  } else {
    terms.push({ weight: RISK_MODEL.weights.dryDays, value: Math.min(1, Math.max(0, dryDays) / 14) });
  }
  if (rain30 === null) {
    missing.push('rain30');
  } else {
    terms.push({ weight: RISK_MODEL.weights.rain30, value: clamp(1 - Math.max(0, rain30) / 150, 0, 1) });
  }

  // Confidence: start tinggi, drop one level per missing signal, one more if sources are stale.
  const level = Math.max(0, 2 - missing.length - (anySourceStale ? 1 : 0));
  const confidence: Confidence = level === 2 ? 'tinggi' : level === 1 ? 'sedang' : 'rendah';

  if (terms.length === 0) return { score: null, range: null, cls: null, confidence, missing };

  const weightSum = terms.reduce((s, t) => s + t.weight, 0);
  const raw = terms.reduce((s, t) => s + (t.weight / weightSum) * t.value, 0);
  const score = Math.round(100 * raw);
  const u = 6 + 12 * missing.length + (anySourceStale ? 6 : 0);
  return {
    score,
    range: [Math.max(0, score - u), Math.min(100, score + u)],
    cls: classify(score),
    confidence,
    missing,
  };
}

/** Linear-interpolation percentile of a list of numbers (values sorted internally). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new RangeError('percentile of empty list');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (rank - lo);
}

const CONF_ORDER: Confidence[] = ['rendah', 'sedang', 'tinggi'];

export interface RegionStats {
  score: number | null;
  range: [number, number] | null;
  cls: RiskClass | null;
  confidence: Confidence;
  hotspots24h: number;
  hotspots7d: number;
  medianDryDays: number | null;
  medianRain30: number | null;
}

/** Region summary: 75th percentile of cell scores; medians of weather; sums of hotspots. */
export function summarizeRegion(
  cells: Pick<CellRisk, 'score' | 'range' | 'confidence' | 'hotspots24h' | 'hotspots7d' | 'weather'>[],
): RegionStats {
  const scored = cells.filter((c) => c.score !== null);
  const lows = scored.map((c) => c.range![0]);
  const highs = scored.map((c) => c.range![1]);

  let confidence: Confidence = 'rendah';
  if (cells.length > 0) {
    // Most common cell confidence; ties go to the lower level.
    const counts = new Map<Confidence, number>();
    for (const c of cells) counts.set(c.confidence, (counts.get(c.confidence) ?? 0) + 1);
    let best = 0;
    for (const conf of CONF_ORDER) {
      const n = counts.get(conf) ?? 0;
      if (n > best) {
        best = n;
        confidence = conf;
      }
    }
  }

  const median = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length === 0 ? null : percentile(v, 50);
  };

  const score = scored.length === 0 ? null : percentile(scored.map((c) => c.score!), 75);
  return {
    score,
    range: scored.length === 0 ? null : [percentile(lows, 75), percentile(highs, 75)],
    cls: score === null ? null : classify(score),
    confidence,
    hotspots24h: cells.reduce((s, c) => s + c.hotspots24h, 0),
    hotspots7d: cells.reduce((s, c) => s + c.hotspots7d, 0),
    medianDryDays: median(cells.map((c) => c.weather.dryDays)),
    medianRain30: median(cells.map((c) => c.weather.rain30)),
  };
}
