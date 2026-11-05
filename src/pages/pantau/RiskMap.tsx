import { useEffect, useRef, useState } from 'react';
import { Map as MlMap, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type LngLatLike, type MapLayerMouseEvent, type MapMouseEvent } from 'maplibre-gl';
// MapLibre 6 locates its worker next to its own module, which breaks once bundled.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { CellRisk, LiveData, RegionsFile } from '../../lib/types';

setWorkerUrl(workerUrl);

const SKY_HEX: Record<string, string> = {
  rendah: '#CFDFE2',
  sedang: '#D9C79A',
  tinggi: '#C47F3A',
  'sangat-tinggi': '#9E3B25',
};
const NO_DATA = '#D3D3CF';
const TEA = '#6B4423';
const PEAT = '#2A1D15';
const INK_DARK = '#EADFD3'; // dark-mode ink: outlines must stay visible on the dark basemap
const EMBER = '#F2611D';
const POSITRON = 'https://tiles.openfreemap.org/styles/positron';
const DARK = 'https://tiles.openfreemap.org/styles/dark';

/** MapLibre's control labels and screen-reader names, in Bahasa Indonesia. */
const LOCALE_ID: Record<string, string> = {
  'Map.Title': 'Peta',
  'Popup.Close': 'Tutup',
  'NavigationControl.ZoomIn': 'Perbesar',
  'NavigationControl.ZoomOut': 'Perkecil',
  'NavigationControl.ResetBearing': 'Kembalikan arah utara',
  'AttributionControl.ToggleAttribution': 'Tampilkan atau sembunyikan atribusi',
  'AttributionControl.MapFeedback': 'Masukan untuk peta',
  'CooperativeGesturesHandler.WindowsHelpText': 'Tekan Ctrl sambil menggulir untuk memperbesar peta',
  'CooperativeGesturesHandler.MacHelpText': 'Tekan ⌘ sambil menggulir untuk memperbesar peta',
  'CooperativeGesturesHandler.MobileHelpText': 'Geser peta dengan dua jari',
};

const fmt = new Intl.NumberFormat('id-ID');
const fmt1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const n = (v: number | null) => (v === null ? 'tidak tersedia' : fmt.format(v));
const n1 = (v: number | null) => (v === null ? 'tidak tersedia' : fmt1.format(v));
const MISSING_LABEL: Record<string, string> = {
  hotspots24h: 'titik panas 24 jam',
  dryDays: 'hari tanpa hujan',
  rain30: 'hujan 30 hari',
};

type Region = RegionsFile['regions'][number];

interface Refs {
  live: LiveData | null;
  region: Region | null;
  selected: string | null;
  onSelectCell: (id: string) => void;
  openPopup?: (id: string, lngLat?: LngLatLike) => void;
}

function cellHtml(cell: CellRisk): string {
  const missing = cell.missing.map((m) => MISSING_LABEL[m] ?? m);
  const skor =
    cell.score === null
      ? 'Skor tidak bisa dihitung'
      : `Skor ${fmt.format(cell.score)} — ${cell.cls?.replace('-', ' ')} (rentang ${fmt.format(cell.range![0])}–${fmt.format(cell.range![1])} dari 100, keyakinan ${cell.confidence})`;
  return [
    `<p><strong>${skor}</strong></p>`,
    `<p>Titik panas 24 jam: ${n(cell.hotspots24h)} · 7 hari: ${n(cell.hotspots7d)}</p>`,
    `<p>Hari tanpa hujan: ${n(cell.weather.dryDays)} · Hujan 30 hari: ${n1(cell.weather.rain30)} mm</p>`,
    `<p>Sinyal kurang: ${missing.length ? missing.join(', ') : 'tidak ada'}</p>`,
    `<p>Sel 0,5° × 0,5°. Titik panas bukan kebakaran terkonfirmasi.</p>`,
  ].join('');
}

function cellFc(region: Region, cells: CellRisk[]) {
  const byId = new Map(cells.map((c) => [c.id, c]));
  return {
    type: 'FeatureCollection' as const,
    features: region.cells.map((c) => {
      const [w, s, e, nn] = c.bbox;
      return {
        type: 'Feature' as const,
        properties: { id: c.id, cls: byId.get(c.id)?.cls ?? '' },
        geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, nn], [w, nn], [w, s]]] },
      };
    }),
  };
}

function hotspotFc(live: LiveData) {
  const nowMs = Date.parse(live.generatedAt);
  return {
    type: 'FeatureCollection' as const,
    features: live.hotspots.map((h) => ({
      type: 'Feature' as const,
      properties: { low: h.conf === 'l', ageH: (nowMs - Date.parse(h.t)) / 3_600_000 },
      geometry: { type: 'Point' as const, coordinates: [h.lon, h.lat] },
    })),
  };
}

/**
 * Basemap labels: the OpenFreeMap styles prefer English (`name_en`). Use the
 * Indonesian name, falling back to the local OSM name, which in Indonesia is
 * already Indonesian ("Kalimantan Barat", not "West Kalimantan"). Text fields
 * that are not a place name (road refs, housenumbers) stay untouched.
 */
const ID_LABEL = ['coalesce', ['get', 'name:id'], ['get', 'name']];

function preferIndonesianLabels(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const tf = (layer.layout as Record<string, unknown> | undefined)?.['text-field'];
    if (tf === undefined) continue;
    const text = JSON.stringify(tf);
    if (!/name/.test(text) || /ref|housenumber/.test(text) || text === JSON.stringify(ID_LABEL)) continue;
    map.setLayoutProperty(layer.id, 'text-field', ID_LABEL as never);
  }
}

/** Outline filter for the selected cell ('' matches nothing). */
const selectedFilter = (id: string | null) => ['==', ['get', 'id'], id ?? ''];

/** Add layers once per style load; update existing sources with setData. */
function applySources(map: MlMap, live: LiveData | null, region: Region | null, dark: boolean, selected: string | null) {
  if (!region || !live) return;
  const cells = cellFc(region, live.cells);
  const geom = { type: 'Feature' as const, properties: {}, geometry: region.geometry };
  const spots = hotspotFc(live);
  if (!map.getSource('cells')) map.addSource('cells', { type: 'geojson', data: cells });
  else (map.getSource('cells') as GeoJSONSource).setData(cells);
  if (!map.getSource('region')) map.addSource('region', { type: 'geojson', data: geom });
  else (map.getSource('region') as GeoJSONSource).setData(geom);
  if (!map.getSource('hotspots')) map.addSource('hotspots', { type: 'geojson', data: spots });
  else (map.getSource('hotspots') as GeoJSONSource).setData(spots);

  const layers: unknown[] = [
    {
      id: 'cells-fill',
      type: 'fill',
      source: 'cells',
      paint: {
        'fill-color': ['match', ['get', 'cls'], ...Object.entries(SKY_HEX).flat(), NO_DATA],
        'fill-opacity': ['case', ['==', ['get', 'cls'], ''], dark ? 0.3 : 0.4, dark ? 0.38 : 0.55],
      },
    },
    {
      id: 'cells-outline',
      type: 'line',
      source: 'cells',
      paint: { 'line-color': dark ? INK_DARK : TEA, 'line-opacity': 0.35, 'line-width': 0.5 },
    },
    {
      // The cell picked on the map or in "Sel paling berisiko": a heavy ink frame.
      id: 'cells-selected',
      type: 'line',
      source: 'cells',
      filter: selectedFilter(selected),
      paint: { 'line-color': dark ? INK_DARK : PEAT, 'line-width': 3 },
    },
    {
      id: 'region-outline',
      type: 'line',
      source: 'region',
      paint: { 'line-color': dark ? INK_DARK : PEAT, 'line-width': 1.5 },
    },
    {
      id: 'hotspots-older',
      type: 'circle',
      source: 'hotspots',
      filter: ['all', ['!', ['get', 'low']], ['>', ['get', 'ageH'], 24]],
      paint: { 'circle-color': EMBER, 'circle-radius': 2, 'circle-opacity': 0.45 },
    },
    {
      id: 'hotspots-24h',
      type: 'circle',
      source: 'hotspots',
      filter: ['all', ['!', ['get', 'low']], ['<=', ['get', 'ageH'], 24]],
      paint: {
        'circle-color': EMBER,
        'circle-radius': 3.5,
        'circle-opacity': 0.95,
        'circle-stroke-width': 1,
        'circle-stroke-color': PEAT,
      },
    },
  ];
  for (const layer of layers as { id: string }[]) {
    if (!map.getLayer(layer.id)) map.addLayer(layer as never);
  }
}

export interface RiskMapProps {
  live: LiveData | null;
  region: Region | null;
  regionName: string;
  selected: string | null;
  /** Incremented on "Sel paling berisiko" clicks; a map click alone must not fly. */
  flyToken: number;
  onSelectCell: (id: string) => void;
}

/** One MapLibre instance for the component's lifetime; layers re-attach after style loads. */
export function RiskMap({ live, region, regionName, selected, flyToken, onSelectCell }: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const refs = useRef<Refs>({ live, region, selected, onSelectCell });
  const darkRef = useRef(window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Keep the map's closures reading fresh values without recreating it.
  useEffect(() => {
    refs.current.live = live;
    refs.current.region = region;
    refs.current.selected = selected;
    refs.current.onSelectCell = onSelectCell;
  }, [live, region, selected, onSelectCell]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const styleUrl = window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : POSITRON;
    const map = new MlMap({
      container,
      style: styleUrl,
      center: [113, -1.2],
      zoom: 4.3,
      attributionControl: { compact: true },
      locale: LOCALE_ID,
      // On phones the map fills 62svh of a scrolling page: one finger must
      // scroll the page, two fingers move the map. Desktop keeps plain gestures.
      cooperativeGestures: window.matchMedia('(pointer: coarse) and (max-width: 959px)').matches,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    // Holder object (not a React ref): the map owns the popup, map.remove() is the real cleanup.
    const popup: { current: Popup | null } = { current: null };
    const openPopup = (id: string, lngLat?: LngLatLike) => {
      const cell = refs.current.live?.cells.find((c) => c.id === id);
      if (!cell) return;
      const center = refs.current.region?.cells.find((c) => c.id === id)?.center;
      popup.current?.remove();
      popup.current = new Popup({ closeButton: true, maxWidth: '300px' })
        .setLngLat(lngLat ?? { lng: center?.[0] ?? 0, lat: center?.[1] ?? 0 })
        .setHTML(cellHtml(cell))
        .addTo(map);
    };
    refs.current.openPopup = openPopup;

    const onStyleData = () => {
      if (map.isStyleLoaded()) {
        applySources(map, refs.current.live, refs.current.region, darkRef.current, refs.current.selected);
        preferIndonesianLabels(map);
      }
    };
    const onLoad = () => {
      applySources(map, refs.current.live, refs.current.region, darkRef.current, refs.current.selected);
      preferIndonesianLabels(map);
      setReady(true);
    };
    const onCellClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') {
        refs.current.onSelectCell(id);
        openPopup(id, e.lngLat);
      }
    };
    const onMapClick = (e: MapMouseEvent) => {
      if (map.queryRenderedFeatures(e.point, { layers: ['cells-fill'] }).length === 0) popup.current?.remove();
    };
    const onEnter = () => (map.getCanvas().style.cursor = 'pointer');
    const onLeave = () => (map.getCanvas().style.cursor = '');
    map.on('styledata', onStyleData);
    map.on('load', onLoad);
    map.on('click', 'cells-fill', onCellClick);
    map.on('click', onMapClick);
    map.on('mouseenter', 'cells-fill', onEnter);
    map.on('mouseleave', 'cells-fill', onLeave);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = (e: MediaQueryListEvent) => {
      darkRef.current = e.matches; // setStyle reloads layers; applySources repaints with the new palette
      map.setStyle(e.matches ? DARK : POSITRON);
    };
    mq.addEventListener('change', onScheme);
    return () => {
      mq.removeEventListener('change', onScheme);
      map.off('styledata', onStyleData);
      map.off('load', onLoad);
      map.off('click', 'cells-fill', onCellClick);
      map.off('click', onMapClick);
      map.off('mouseenter', 'cells-fill', onEnter);
      map.off('mouseleave', 'cells-fill', onLeave);
      popup.current?.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Data or region changed: refresh sources (no-op before the map is ready).
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && live) applySources(map, live, region, darkRef.current, refs.current.selected);
  }, [ready, live, region]);

  // Selection changed (map click, list click, or region switch clearing it).
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && map.getLayer('cells-selected')) map.setFilter('cells-selected', selectedFilter(selected) as never);
  }, [ready, selected]);

  // Region changed: fit to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !region) return;
    let w = 180, s = 90, e = -180, nn = -90;
    for (const c of region.cells) {
      w = Math.min(w, c.bbox[0]);
      s = Math.min(s, c.bbox[1]);
      e = Math.max(e, c.bbox[2]);
      nn = Math.max(nn, c.bbox[3]);
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.fitBounds(
      [
        [w, s],
        [e, nn],
      ],
      { padding: 24, duration: reduced ? 0 : 600 },
    );
  }, [ready, region]);

  // "Sel paling berisiko" click: fly to the cell and open its popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selected || !live) return;
    const cell = live.cells.find((c) => c.id === selected);
    if (!cell) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [w, s, e, nn] = cell.bbox;
    map.fitBounds(
      [
        [w, s],
        [e, nn],
      ],
      { padding: 64, maxZoom: 8, duration: reduced ? 0 : 600 },
    );
    refs.current.openPopup?.(cell.id);
  }, [flyToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="map-el"
      role="application"
      aria-label={`Peta risiko dan titik panas, ${regionName}`}
    />
  );
}
