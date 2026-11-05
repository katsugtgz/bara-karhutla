import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '../../styles/tokens.css';
import '../../styles/base.css';
import './vendor-maplibre.css';
import './monitor.css';
import { SiteHeader } from '../../components/SiteHeader';
import { Sourced } from '../../components/Sourced';
import { relativeId, formatWib } from '../../lib/time';
import type { LiveData, RegionId, RegionsFile, SourceRecord } from '../../lib/types';
import { RiskMap } from './RiskMap';

const SKY_CLASS: Record<string, string> = {
  rendah: 'sky-1',
  sedang: 'sky-2',
  tinggi: 'sky-3',
  'sangat-tinggi': 'sky-4',
};
const SKY_N: Record<string, number> = { rendah: 1, sedang: 2, tinggi: 3, 'sangat-tinggi': 4 };
const CLASS_WORD: Record<string, string> = {
  rendah: 'rendah',
  sedang: 'sedang',
  tinggi: 'tinggi',
  'sangat-tinggi': 'sangat tinggi',
};
const SIGNAL_WORD: Record<string, string> = {
  hotspots24h: 'titik panas 24 jam',
  dryDays: 'hari tanpa hujan',
  rain30: 'hujan 30 hari',
};

const fmt = new Intl.NumberFormat('id-ID');
const fmt1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const HOTSPOT_NOTE =
  'Lokasi unik ±1 km dengan sedikitnya satu deteksi bukan-keyakinan-rendah dari satelit mana pun. Satu api bisa terdeteksi beberapa satelit; dihitung sekali.';
const METODE_URL = `${import.meta.env.BASE_URL}metode/`;
const SCORE_SOURCE = {
  name: 'Skor Bara v0',
  url: METODE_URL,
  status: 'dihitung' as const,
  note: 'Bobot dan ambang masih draf, menunggu kalibrasi ahli.',
};

function readInitialRegion(regions: RegionsFile | null): RegionId {
  try {
    const v = new URLSearchParams(window.location.search).get('wilayah');
    if (v && regions?.regions.some((r) => r.id === v)) return v as RegionId;
  } catch {
    /* private mode etc. — fall through to default */
  }
  return 'kalteng';
}

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));

function cellLabel(cell: { center: [number, number] }, score: number | null, cls: string | null) {
  const [lon, lat] = cell.center;
  const pos = `Sel ${fmt1.format(Math.abs(lat))}° ${lat < 0 ? 'LS' : 'LU'} ${fmt1.format(lon)}° BT`;
  const skor = score === null ? 'skor tidak bisa dihitung' : `skor ${fmt.format(Math.round(score))}, ${CLASS_WORD[cls ?? ''] ?? 'tanpa kelas'}`;
  return { pos, skor };
}

export function Pantau() {
  const [live, setLive] = useState<LiveData | null>(null);
  const [regionsFile, setRegionsFile] = useState<RegionsFile | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [regionId, setRegionId] = useState<RegionId>('kalteng');
  const [selected, setSelected] = useState<string | null>(null);
  const [flyToken, setFlyToken] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 960px)').matches);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const on = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    // Abort on unmount or a newer retry, so a late response never lands.
    const ctrl = new AbortController();
    const { signal } = ctrl;
    Promise.all([
      fetch(`${base}data/live.json`, { signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch(`${base}data/regions.json`, { signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ])
      .then(([jLive, jRegions]: [LiveData, RegionsFile]) => {
        if (signal.aborted) return;
        setLive(jLive);
        setRegionsFile(jRegions);
        setRegionId(readInitialRegion(jRegions));
      })
      .catch(() => {
        if (!signal.aborted) setError(true);
      });
    return () => ctrl.abort();
  }, [attempt]);

  const retry = () => {
    setError(false);
    setAttempt((a) => a + 1);
  };

  const region = regionsFile?.regions.find((r) => r.id === regionId) ?? null;
  const summary = live?.regions.find((r) => r.id === regionId) ?? null;

  const chooseRegion = (id: RegionId) => {
    setRegionId(id);
    setSelected(null);
    try {
      history.replaceState(null, '', `${window.location.pathname}?wilayah=${id}`);
    } catch {
      /* ignore */
    }
  };

  const chooseCell = (id: string) => {
    setSelected(id);
    setFlyToken((t) => t + 1);
  };

  const topCells = useMemo(() => {
    if (!live || !region) return [];
    const cellById = byId(region.cells);
    return live.cells
      .filter((c) => c.regionId === regionId && c.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.hotspots24h ?? 0) - (a.hotspots24h ?? 0))
      .slice(0, 5)
      .map((c) => ({ cell: c, meta: cellById.get(c.id) }));
  }, [live, region, regionId]);

  const firms = live?.sources.filter((s) => s.id.startsWith('firms')) ?? [];
  const firmsFetchedAt = firms.reduce<string | null>(
    (acc, s) => (s.fetchedAt && (!acc || s.fetchedAt > acc) ? s.fetchedAt : acc),
    null,
  );
  const om = live?.sources.find((s) => s.id === 'open-meteo') ?? null;
  const firmsSource = {
    name: 'NASA FIRMS (VIIRS S-NPP, NOAA-20, NOAA-21, MODIS C6.1)',
    url: 'https://firms.modaps.eosdis.nasa.gov/',
    fetchedAt: firmsFetchedAt,
  };
  const omSource = { name: 'Open-Meteo forecast API', url: 'https://open-meteo.com/', fetchedAt: om?.fetchedAt ?? null };

  const missingSignals = useMemo(() => {
    if (!live || !summary || summary.score !== null) return [];
    const set = new Set<string>();
    for (const c of live.cells) if (c.regionId === regionId) for (const m of c.missing) set.add(m);
    return [...set].map((m) => SIGNAL_WORD[m] ?? m);
  }, [live, summary, regionId]);

  return (
    <>
      <SiteHeader current="pantau" />
      {error ? (
        <main className="load-error" id="konten" tabIndex={-1}>
          <section className="hero sky-panel sky-hatch">
            <h1 className="risk-sentence">Data live belum bisa dimuat.</h1>
            <p className="risk-range">
              Risiko hari ini tidak ditampilkan, karena Bara tidak menebak tanpa data. Periksa sambungan
              internet, lalu coba lagi.
            </p>
            <p className="load-error-actions">
              <button type="button" className="load-error-retry" onClick={retry}>
                Coba lagi
              </button>
              <a href={`${METODE_URL}#kesehatan`}>Lihat log pengambilan data</a>
            </p>
          </section>
        </main>
      ) : (
        <main className="monitor" id="konten" tabIndex={-1}>
          <SkyHero
            regionsFile={regionsFile}
            regionId={regionId}
            onChooseRegion={chooseRegion}
            live={live}
            summary={summary}
            nowMs={nowMs}
            missingSignals={missingSignals}
          />

          <div className="map-wrap">
            <RiskMap
              live={live}
              region={region}
              regionName={region?.name ?? 'Indonesia'}
              selected={selected}
              flyToken={flyToken}
              onSelectCell={(id) => setSelected(id)}
            />
            <details className="legend" key={wide ? 'wide' : 'narrow'} open={wide}>
              <summary>Legenda</summary>
              <p className="legend-head">Risiko per sel 0,5°</p>
              {(['rendah', 'sedang', 'tinggi', 'sangat-tinggi'] as const).map((cls) => (
                <div className="legend-row" key={cls}>
                  <span className={`swatch ${SKY_CLASS[cls]}`} style={{ background: `var(--sky-${SKY_N[cls]})` }} />
                  <span>{CLASS_WORD[cls]}</span>
                </div>
              ))}
              <div className="legend-row">
                <span className="swatch sky-hatch" style={{ background: 'var(--sky-0)' }} />
                <span>tanpa data</span>
              </div>
              <p className="legend-head">Titik panas satelit</p>
              <div className="legend-row">
                <span className="swatch hot-24" />
                <span>titik panas 24 jam</span>
              </div>
              <div className="legend-row">
                <span className="swatch hot-old" />
                <span>1–7 hari lalu</span>
              </div>
            </details>
          </div>

          <section className="panel">
            <Signals summary={summary} firmsSource={firmsSource} omSource={omSource} />

            <h2>Sel paling berisiko</h2>
            {topCells.length === 0 ? (
              <p>Belum ada sel dengan skor. Data live mungkin belum termuat.</p>
            ) : (
              <ol className="topcell-list">
                {topCells.map(({ cell, meta }) => (
                  <li key={cell.id}>
                    <button
                      type="button"
                      className="topcell-btn"
                      aria-current={selected === cell.id ? 'true' : undefined}
                      onClick={() => chooseCell(cell.id)}
                    >
                      <TopCellLabel
                        {...cellLabel(
                          meta ?? { center: [(cell.bbox[0] + cell.bbox[2]) / 2, (cell.bbox[1] + cell.bbox[3]) / 2] },
                          cell.score,
                          cell.cls,
                        )}
                        sky={cell.cls ? (SKY_N[cell.cls] ?? 0) : 0}
                      />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <h2>Kesehatan data</h2>
            {live === null ? <p>Memuat…</p> : live.sources.map((s) => <HealthRow key={s.id} rec={s} />)}

            <p className="disclaimer">
              Titik panas adalah deteksi panas satelit, bukan kebakaran yang terkonfirmasi, dan bukan bukti
              siapa penyebabnya.
            </p>
          </section>
        </main>
      )}
    </>
  );
}

/** One row of "Sel paling berisiko": the cell's sky colour, where it is, its score. */
function TopCellLabel({ pos, skor, sky }: { pos: string; skor: string; sky: number }) {
  return (
    <>
      <span className="topcell-swatch" style={{ background: `var(--sky-${sky})` }} aria-hidden="true" />
      <span>{pos}</span>
      <span className="topcell-score">{skor}</span>
    </>
  );
}

interface SignalsProps {
  summary: LiveData['regions'][number] | null;
  firmsSource: { name: string; url: string; fetchedAt: string | null };
  omSource: { name: string; url: string; fetchedAt: string | null };
}

function Signals({ summary, firmsSource, omSource }: SignalsProps) {
  return (
    <>
      <h2>Sinyal yang dihitung</h2>
      <dl>
        <div className="signal-row">
          <dt>Titik panas 24 jam</dt>
          <dd>
            <Sourced
              value={summary && summary.hotspots24h !== null ? fmt.format(summary.hotspots24h) : null}
              unit="titik"
              source={{
                ...firmsSource,
                period: '24 jam terakhir, semua satelit, dalam sel wilayah ini',
                note: HOTSPOT_NOTE,
              }}
            />
          </dd>
        </div>
        <div className="signal-row">
          <dt>Titik panas 7 hari</dt>
          <dd>
            <Sourced
              value={summary && summary.hotspots7d !== null ? fmt.format(summary.hotspots7d) : null}
              unit="titik"
              source={{ ...firmsSource, period: '7 hari terakhir, lokasi–tanggal unik', note: HOTSPOT_NOTE }}
            />
          </dd>
        </div>
        <div className="signal-row">
          <dt>Hari tanpa hujan (median sel)</dt>
          <dd>
            <Sourced
              value={summary?.medianDryDays == null ? null : fmt.format(Math.round(summary.medianDryDays))}
              unit="hari"
              source={{ ...omSource, period: '30 hari terakhir' }}
            />
          </dd>
        </div>
        <div className="signal-row">
          <dt>Hujan 30 hari (median sel)</dt>
          <dd>
            <Sourced
              value={summary?.medianRain30 == null ? null : fmt1.format(summary.medianRain30)}
              unit="mm"
              source={{ ...omSource, period: '30 hari terakhir' }}
            />
          </dd>
        </div>
        <div className="signal-row">
          <dt>Kekeringan gambut (tinggi muka air)</dt>
          <dd>
            <Sourced
              value="belum tersedia"
              source={{ name: 'Stasiun tinggi muka air gambut', note: 'Data stasiun tinggi muka air gambut belum tersambung.' }}
            />
          </dd>
        </div>
        <div className="signal-row">
          <dt>Prediksi model MPeat</dt>
          <dd>
            <Sourced
              value="belum tersedia"
              source={{ name: 'MPeat / peatfr (Dr. Adilan Mahdiyasa)', note: 'Menunggu izin dan lisensi dari pemilik kode.' }}
            />
          </dd>
        </div>
      </dl>
    </>
  );
}

interface SkyHeroProps {
  regionsFile: RegionsFile | null;
  regionId: RegionId;
  onChooseRegion: (id: RegionId) => void;
  live: LiveData | null;
  summary: LiveData['regions'][number] | null;
  nowMs: number;
  missingSignals: string[];
}

/** Sky-coloured panel: region switch, risk sentence, fetch time, staleness warning. */
function SkyHero({ regionsFile, regionId, onChooseRegion, live, summary, nowMs, missingSignals }: SkyHeroProps) {
  const stale = live ? nowMs - Date.parse(live.generatedAt) > 6 * 3_600_000 : false;
  const skyNum = summary?.cls ? (SKY_N[summary.cls] ?? 0) : 0;
  const skyClass = summary?.cls ? SKY_CLASS[summary.cls] : null;
  return (
    <section
      className={`hero sky-panel ${skyClass ?? 'sky-hatch'}`}
      style={{ '--sky': `var(--sky-${skyNum})` } as CSSProperties}
    >
      <div className="region-row">
        <label className="region-label">
          Wilayah{' '}
          <select
            className="region-select"
            value={regionId}
            onChange={(e) => onChooseRegion(e.target.value as RegionId)}
            aria-label="Pilih wilayah"
          >
            {(regionsFile?.regions ?? [{ id: 'kalteng' as const, name: 'Kalimantan Tengah' }]).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {summary === null ? (
        <>
          <h1 className="risk-sentence">Memuat data risiko…</h1>
          <p className="risk-fetch">Data diambil dari NASA FIRMS dan Open-Meteo.</p>
        </>
      ) : summary.score === null ? (
        <>
          <h1 className="risk-sentence">Risiko belum bisa dihitung.</h1>
          <p className="risk-range">Data {missingSignals.join(' dan ') || 'sinyal'} tidak tersedia.</p>
        </>
      ) : (
        <>
          <h1 className="risk-sentence">Risiko kebakaran hari ini {CLASS_WORD[summary.cls ?? '']}.</h1>
          <p className="risk-range">
            <Sourced
              value={`Rentang ${fmt.format(Math.round(summary.range![0]))}–${fmt.format(
                Math.round(summary.range![1]),
              )} dari\u00A0100, keyakinan ${summary.confidence}.`}
              source={SCORE_SOURCE}
            />
          </p>
        </>
      )}
      {live ? (
        <p className="risk-fetch">
          Data diambil {relativeId(live.generatedAt, nowMs)} ({formatWib(live.generatedAt)}).
        </p>
      ) : null}
      {stale && live ? (
        <p className="risk-stale">
          Data ini sudah lebih dari 6 jam. Pembaruan terjadwal mungkin gagal; cek Kesehatan data di bawah.
        </p>
      ) : null}
    </section>
  );
}

function HealthRow({ rec }: { rec: SourceRecord }) {
  const count = rec.rows === null ? null : fmt.format(rec.rows);
  const unit = rec.id === 'open-meteo' ? 'sel cuaca' : 'titik';
  let detail: string;
  if (rec.status === 'ok') detail = `${count} ${unit}, ${relativeId(rec.fetchedAt)}`;
  else if (rec.status === 'empty') detail = `berkas kosong (0 ${unit}), ${relativeId(rec.fetchedAt)}`;
  else if (rec.status === 'stale') detail = `gagal, memakai snapshot ${relativeId(rec.fetchedAt)}`;
  else detail = 'gagal, tidak ada snapshot.';
  const dot = rec.status === 'ok' ? 'dot' : rec.status === 'empty' ? 'dot dot-empty' : 'dot dot-failed';
  // Name on its own line, status underneath: five sources scan as a list
  // instead of five run-on sentences that wrap mid-figure.
  return (
    <p className="health-row">
      <span className={dot} aria-hidden="true" />
      <span>
        <span className="health-name">{rec.name}</span>
        <span className="health-detail">
          {detail}
          {rec.warning ? <strong className="health-warning"> Peringatan: {rec.warning}</strong> : null}
        </span>
      </span>
    </p>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pantau />
  </StrictMode>,
);
