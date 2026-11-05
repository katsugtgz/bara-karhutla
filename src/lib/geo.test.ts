import { describe, expect, it } from 'vitest';
import { makeGrid, pointInGeometry } from './geo';
import type { MultiPolygon, Polygon } from 'geojson';

const square: Polygon = {
  type: 'Polygon',
  coordinates: [[[100, -2], [102, -2], [102, 0], [100, 0], [100, -2]]],
};

describe('pointInGeometry', () => {
  it('inside and outside a polygon', () => {
    expect(pointInGeometry([101, -1], square)).toBe(true);
    expect(pointInGeometry([103, -1], square)).toBe(false);
    expect(pointInGeometry([100, 0.1], square)).toBe(false);
  });

  it('multipolygon', () => {
    const multi: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        square.coordinates,
        [[[110, 0], [111, 0], [111, 1], [110, 1], [110, 0]]],
      ],
    };
    expect(pointInGeometry([110.5, 0.5], multi)).toBe(true);
    expect(pointInGeometry([105, -1], multi)).toBe(false);
  });
});

describe('makeGrid', () => {
  it('cuts a 0.5° grid with ids, bboxes and centers', () => {
    const cells = makeGrid('kalteng', [108, -4, 110, -2]);
    expect(cells).toHaveLength(16); // 4 cols x 4 rows
    expect(cells[0]).toMatchObject({
      id: 'kalteng:0:0',
      row: 0,
      col: 0,
      bbox: [108, -4, 108.5, -3.5],
      center: [108.25, -3.75],
    });
    const last = cells[cells.length - 1]!;
    expect(last.id).toBe('kalteng:3:3');
    expect(last.bbox).toEqual([109.5, -2.5, 110, -2]);
  });
});
