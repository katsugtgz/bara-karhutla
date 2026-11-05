import type { MultiPolygon, Polygon, Position } from 'geojson';

/** Ray-casting point-in-polygon for a GeoJSON Polygon (outer ring only; regions here have no meaningful holes). */
export function pointInPolygon(point: Position, polygon: Polygon): boolean {
  const ring = polygon.coordinates[0]!;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect =
      yi > point[1]! !== yj > point[1]! &&
      point[0]! < ((xj - xi) * (point[1]! - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(point: Position, geom: Polygon | MultiPolygon): boolean {
  if (geom.type === 'Polygon') return pointInPolygon(point, geom);
  return geom.coordinates.some((poly) => pointInPolygon(point, { type: 'Polygon', coordinates: poly }));
}

export interface GridCell {
  id: string;
  row: number;
  col: number;
  bbox: [number, number, number, number]; // [w, s, e, n]
  center: [number, number]; // [lon, lat]
}

/** Cut a 0.5° grid over a bbox [w, s, e, n]. Col 0 at the west edge, row 0 at the south edge. */
export function makeGrid(regionId: string, bbox: [number, number, number, number], step = 0.5): GridCell[] {
  const [w, s, e, n] = bbox;
  const cells: GridCell[] = [];
  for (let row = 0; s + row * step < n; row++) {
    for (let col = 0; w + col * step < e; col++) {
      const x0 = w + col * step;
      const y0 = s + row * step;
      cells.push({
        id: `${regionId}:${row}:${col}`,
        row,
        col,
        bbox: [x0, y0, Math.min(x0 + step, e), Math.min(y0 + step, n)],
        center: [x0 + step / 2, y0 + step / 2],
      });
    }
  }
  return cells;
}
