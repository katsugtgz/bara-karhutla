import { useEffect, useRef, useState } from 'react';
import { SiteHeader } from '../../components/SiteHeader';
import { Sourced } from '../../components/Sourced';
import { areaFiguresByYear, figures, sources } from '../../content/chronology';
import { formatId } from '../../lib/sky';
import type { Hotspot, HistoryFile } from '../../lib/types';
import { uniqueLocations } from '../../lib/unique';
import { KisahScene, type SceneRefs, type SceneSection } from './scene';
import { PeatDiagram } from './PeatDiagram';
import { YearStrip } from './YearStrip';
import './kisah.css';

const HISTORY_SOURCE = {
  name: 'NASA FIRMS MODIS 6.1 (history.json)',
  url: 'https://firms.modaps.eosdis.nasa.gov/download/',
  period: '2006–2025',
  status: 'dihitung' as const,
  note: 'Dihitung dari arsip tahunan MODIS Indonesia, kepercayaan ≥ 30, bin 0,25°. Titik panas bukan kebakaran terkonfirmasi dan bukan bukti siapa penyebabnya.',
};

/** Burned-area line for a year — only years with a sourced figure get a link. */
function areaForYear(year: number): { text: string; url: string } | null {
  const f = areaFiguresByYear[year];
  if (!f) return null;
  return { text: `Luas terbakar ${year}: ${f.value}${f.unit ? ` ${f.unit}` : ''}`, url: f.source.url ?? '' };
}

interface LiveFile {
  generatedAt: string | null;
  hotspots: Hotspot[];
}

/**
 * Section state: camera preset, the column state (`year`) its sky should hold
 * while on screen. Sky: opening stays calm sky-1; peat goes sepia; 2015 and
 * 2019 use their own year sky (sky-4); 2026 shows live columns under the
 * 7-day weekly-equivalent sky-2; the close returns to sky-1.
 */
const SECTION_SPECS: Pick<SceneSection, 'preset' | 'year' | 'sky'>[] = [
  { preset: 'wide', year: 'all', sky: 'sky-1' },
  { preset: 'kalteng', sky: 'sky-2' },
  { preset: 'tilt' },
  { preset: 'west2015', year: 2015 },
  { preset: 'wide', year: 2019 },
  { preset: 'wide', year: 'live', sky: 'sky-2' },
  { preset: 'wide', sky: 'sky-1' },
];

function Kisah() {
  const skyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const countWrapRef = useRef<HTMLSpanElement>(null);
  const areaTextRef = useRef<HTMLSpanElement>(null);
  const areaLinkRef = useRef<HTMLAnchorElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const [bundle, setBundle] = useState<{
    history: HistoryFile;
    land: [number, number][];
    live: LiveFile | null;
    liveCount: number | null;
  } | null>(null);
  const [dataFailed, setDataFailed] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [shared, setShared] = useState<'idle' | 'ok' | 'gagal'>('idle');

  // History + land + live data, fetched once. Land dots are decorative: if
  // they fail, the story still runs without them. History failing hides the
  // canvas. Live has a 4 s timeout and never fails the bundle — the scene's
  // bin index is built with (or without) live data in one pass.
  useEffect(() => {
    let alive = true;
    const getJson = <T,>(url: string, signal?: AbortSignal) =>
      fetch(url, { signal }).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`HTTP ${r.status}`))));
    const historyP = getJson<HistoryFile>(`${import.meta.env.BASE_URL}data/history.json`);
    const landP = getJson<{ points: [number, number][] }>(`${import.meta.env.BASE_URL}data/indonesia-land.json`)
      .then((d) => d.points)
      .catch(() => [] as [number, number][]);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const liveP = getJson<{ generatedAt?: string; hotspots?: unknown[] }>(
      `${import.meta.env.BASE_URL}data/live.json`,
      ctrl.signal,
    )
      .then((d) =>
        Array.isArray(d.hotspots) && d.hotspots.length > 0
          ? { generatedAt: d.generatedAt ?? null, hotspots: d.hotspots as Hotspot[] }
          : null,
      )
      .catch(() => null);
    Promise.all([historyP, landP, liveP])
      .then(([history, land, live]) => {
        clearTimeout(timer);
        if (alive) setBundle({ history, land, live, liveCount: live ? uniqueLocations(live.hotspots, Date.now(), 168) : null });
      })
      .catch(() => {
        clearTimeout(timer);
        if (alive) setDataFailed(true);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  // Mount the scene once data is in; full dispose on unmount.
  useEffect(() => {
    if (!bundle || !canvasRef.current || !timelineRef.current) return;
    const refs: SceneRefs = {
      skyEl: skyRef.current!,
      stickyEl: stickyRef.current!,
      yearEl: yearRef.current!,
      countWrap: countWrapRef.current!,
      areaTextEl: areaTextRef.current!,
      areaLinkEl: areaLinkRef.current!,
      stripEl: stripRef.current!,
    };
    const sections = SECTION_SPECS.map((spec, i) => ({ ...spec, el: sectionRefs.current[i]! }));
    const scene = new KisahScene({
      canvas: canvasRef.current,
      land: bundle.land,
      history: bundle.history,
      live: bundle.live,
      refs,
      sections,
      timelineEl: timelineRef.current,
      areaForYear,
      onWebglUnavailable: () => setWebglFailed(true),
    });
    return () => scene.dispose();
  }, [bundle]);

  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        setShared('ok');
        return;
      }
      throw new Error('no navigator.share');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setShared('ok');
      } catch {
        setShared('gagal');
      }
    }
  };

  const years = bundle?.history.years ?? [];
  const live = bundle?.live ?? null;
  const liveCount = bundle?.liveCount ?? null;
  const liveStatus: 'loading' | 'ok' | 'unavailable' = bundle
    ? bundle.live
      ? 'ok'
      : 'unavailable'
    : dataFailed
      ? 'unavailable'
      : 'loading';

  return (
    <div className="kisah">
      <div ref={skyRef} className={`kisah-sky sky-1${webglFailed || dataFailed ? ' is-visible' : ''}`} aria-hidden />
      <canvas ref={canvasRef} className={`kisah-canvas${webglFailed || dataFailed ? ' is-off' : ''}`} aria-hidden />

      <SiteHeader current="kisah" />

      <main className="kisah-main" id="konten" tabIndex={-1}>
        {/* 1 — Pembuka */}
        <section ref={(el) => void (sectionRefs.current[0] = el)} className="kisah-section">
          <div className="kisah-block">
            <h1>Dua dekade karhutla</h1>
            <p className="prose">
              Sejak 2006, satelit NASA mencatat titik panas di atas Indonesia hampir setiap
              tahun. Sebagian tahun langit di atas Palangka Raya, Pekanbaru, dan Jambi berubah
              warna.
            </p>
            <p className="kisah-question">
              Berapa kali ini terjadi dalam 20 tahun? Jawabannya tidak sesederhana satu angka.
            </p>
            <p className="kisah-note">
              Titik panas adalah deteksi panas satelit, bukan kebakaran yang terkonfirmasi, dan
              bukan bukti siapa penyebabnya.
            </p>
          </div>
        </section>

        {/* 2 — Gambut */}
        <section ref={(el) => void (sectionRefs.current[1] = el)} className="kisah-section">
          <div className="kisah-block">
            <h2>Bukan cuma siapa yang menyulut, tapi kenapa semuanya mudah terbakar.</h2>
            <p className="prose">
              Gambut adalah lapisan bahan organik tebal yang menyerap air seperti spons. Selama
              muka airnya tinggi, gambut sulit terbakar. Begitu dikeringkan — oleh saluran
              drainase atau musim kering panjang — spons itu kering dari atas ke bawah.
            </p>
            <p className="prose">
              Api di gambut tidak hanya menyala di permukaan. Ia merayap di bawah tanah,
              bersembunyi berhari-hari, lalu muncul kembali di tempat lain.
            </p>
            <blockquote>
              <p>
                Bayangkan sebuah pom bensin meledak, dan di sebelahnya ada pabrik korek api.
                Semua orang sibuk bertanya, siapa yang menyalakan apinya? Padahal pertanyaan
                yang lebih penting, kenapa dua hal itu dibiarkan bersebelahan? Gambut yang
                dikeringkan adalah pom bensinnya, api adalah koreknya. Menghukum penyulut itu
                perlu, tapi kalau gambutnya tetap kering, percikan berikutnya cuma soal waktu.
              </p>
            </blockquote>
            <p className="kisah-note">
              Analogi tentang sebab langsung dan sebab struktural — bukan klaim tentang pelaku
              tertentu.
            </p>
            <PeatDiagram />
          </div>
        </section>

        {/* 3 — Timeline 20 tahun (sticky, scrub per tahun) */}
        <section ref={(el) => void (sectionRefs.current[2] = el)} className="kisah-section">
          <div ref={timelineRef} className="kisah-timeline">
            <div ref={stickyRef} className="kisah-timeline-sticky sky-1">
              <h2 className="visually-hidden">20 tahun dalam titik panas</h2>
              <p className="kisah-kicker">20 tahun dalam titik panas</p>
              <div ref={yearRef} className="kisah-year">
                2006
              </div>
              <p className="kisah-count">
                <span ref={countWrapRef} className="num">
                  <Sourced value="—" unit="titik panas MODIS" source={HISTORY_SOURCE} />
                </span>
              </p>
              <p className="kisah-area">
                <span ref={areaTextRef}>Luas terbakar: belum ada angka terverifikasi</span>{' '}
                <a ref={areaLinkRef} className="kisah-area-link" href="#" target="_blank" rel="noopener noreferrer" hidden>
                  sumber
                </a>
              </p>
              <div ref={stripRef}>
                <YearStrip years={years.map((y) => ({ year: y.year, count: y.count }))} />
              </div>
              <p className="kisah-note">
                {dataFailed
                  ? 'Data historis gagal dimuat. Muat ulang halaman untuk mencoba lagi.'
                  : 'Gulir perlahan untuk menyusuri tahun demi tahun.'}
              </p>
            </div>
          </div>
        </section>

        {/* 4 — 2015: puncak, satu angka per layar */}
        <section ref={(el) => void (sectionRefs.current[3] = el)} className="kisah-section">
          <div className="kisah-block kisah-screen sky-4">
            <p className="kisah-kicker">2015: puncak dua dekade</p>
            <p className="kisah-big num">
              <Sourced value={figures.luas2015.value} unit={figures.luas2015.unit} source={figures.luas2015.source} />
            </p>
            <p className="kisah-sub">
              <Sourced
                value={`${figures.skala2015.value} ${figures.skala2015.unit}`}
                source={figures.skala2015.source}
              />
            </p>
          </div>
          <div className="kisah-block kisah-screen sky-4">
            <p className="kisah-big num">
              <Sourced value={figures.rugi2015.value} source={figures.rugi2015.source} />
            </p>
            <p className="kisah-sub">{figures.rugi2015.label.toLowerCase()}.</p>
          </div>
          <div className="kisah-block kisah-screen sky-4">
            <p className="kisah-big num">
              <Sourced value={figures.ispa2015.value} unit={figures.ispa2015.unit} source={figures.ispa2015.source} />
            </p>
            <p className="kisah-sub">infeksi saluran pernapasan akut akibat asap.</p>
          </div>
          <div className="kisah-block">
            <p className="kisah-question">2015 yang terparah. Lalu apa yang berubah setelahnya?</p>
          </div>
        </section>

        {/* 5 — Setelah 2015 */}
        <section ref={(el) => void (sectionRefs.current[4] = el)} className="kisah-section">
          <div className="kisah-block">
            <h2>Setelah 2015</h2>
            <p className="prose">
              2016: pemerintah membentuk{' '}
              <Sourced value="Badan Restorasi Gambut" source={{ ...sources.pantauGambut, period: '2016' }} /> untuk
              memulihkan lahan gambut yang rusak.
            </p>
            <p className="prose">
              Tapi kebakaran besar kembali pada 2019:{' '}
              <Sourced value={figures.luas2019Fgmi.value} unit={figures.luas2019Fgmi.unit} source={figures.luas2019Fgmi.source} />{' '}
              terbakar, 42% di antaranya di lahan gambut.
            </p>
            <p className="prose">
              Sumber lain mencatat{' '}
              <Sourced value={figures.gambut2019Pg.value} unit={figures.gambut2019Pg.unit} source={figures.gambut2019Pg.source} />{' '}
              gambut terbakar. Dua angka ini berbeda karena metodenya berbeda: luas indikatif
              terbakar dibandingkan dengan luas gambut saja — keduanya dipakai, bukan digabung.
            </p>
            <p className="kisah-question">Kalau restorasi berjalan, kenapa 2019 terbakar lagi?</p>
          </div>
        </section>

        {/* 6 — 2026, sekarang */}
        <section ref={(el) => void (sectionRefs.current[5] = el)} className="kisah-section">
          <div className="kisah-block">
            <h2>2026: yang terjadi sekarang</h2>
            <p className="prose">
              Januari–Juli 2026:{' '}
              <Sourced value={figures.luas2026Jul.value} unit={figures.luas2026Jul.unit} source={figures.luas2026Jul.source} />{' '}
              terbakar — naik 47% dari periode yang sama 2019 dan 80% dari 2023.
            </p>
            <p className="prose">
              Sampai Oktober 2026:{' '}
              <Sourced value={figures.luas2026Okt.value} unit={figures.luas2026Okt.unit} source={figures.luas2026Okt.source} />, dengan
              perkiraan kerugian{' '}
              <Sourced value={figures.rugi2026.value} source={figures.rugi2026.source} />.
            </p>
            <p className="prose">
              Akumulasi 2015–Oktober 2026:{' '}
              <Sourced value={figures.akumulasi.value} unit={figures.akumulasi.unit} source={figures.akumulasi.source} />.
            </p>
            <p className="prose">
              Sebagai konteks:{' '}
              <Sourced value="El Nino 2023" source={sources.kompas2023} />; kebakaran mencakup
              antara lain kawasan Gunung Arjuno.
            </p>
            <p className="prose kisah-live">
              {liveStatus === 'ok' && live ? (
                <Sourced
                  value={liveCount === null ? null : formatId(liveCount)}
                  unit="lokasi titik panas dalam 7 hari terakhir"
                  source={{
                    name: 'live.json (NASA FIRMS NRT)',
                    url: 'https://firms.modaps.eosdis.nasa.gov/',
                    period: '7 hari terakhir',
                    fetchedAt: live.generatedAt,
                    status: 'dihitung',
                    note:
                      'Lokasi unik ±1 km dengan sedikitnya satu deteksi bukan-keyakinan-rendah dari satelit NASA FIRMS mana pun. Titik panas bukan kebakaran terkonfirmasi.',
                  }}
                />
              ) : liveStatus === 'loading' ? (
                'Data live sedang dimuat…'
              ) : (
                <>
                  Data live belum tersedia. Cek{' '}
                  <a href={import.meta.env.BASE_URL}>halaman Pantau</a> untuk status terkini.
                </>
              )}
            </p>
          </div>
        </section>

        {/* 7 — Penutup */}
        <section ref={(el) => void (sectionRefs.current[6] = el)} className="kisah-section">
          <div className="kisah-block">
            <h2>Apa yang bisa dilakukan</h2>
            <p className="prose">
              Pemantauan dini memberi waktu untuk bersiap — untuk relawan desa, Manggala Agni,
              dan BPBD. Metode dan batas data dijelaskan terbuka di halaman metode.
            </p>
            <ul className="kisah-actions">
              <li>
                <a className="kisah-action-primary" href={import.meta.env.BASE_URL}>
                  Pantau peta live
                </a>
              </li>
              <li>
                <button type="button" className="kisah-action" onClick={() => void share()}>
                  {shared === 'ok' ? 'Tautan tersalin' : shared === 'gagal' ? 'Gagal menyalin tautan' : 'Bagikan halaman ini'}
                </button>
              </li>
              <li>
                <a className="kisah-action" href="https://pantaugambut.id" target="_blank" rel="noopener noreferrer">
                  Ikut mendukung restorasi gambut
                </a>
              </li>
              <li>
                <a className="kisah-action" href={`${import.meta.env.BASE_URL}metode/`}>
                  Metode dan sumber
                </a>
              </li>
            </ul>
            <p className="kisah-note">
              Angka di halaman ini diperiksa lewat pencarian web pada 4 November 2026 dan
              berstatus belum diverifikasi kecuali disebut lain. Detail sumber ada di halaman
              Metode dan sumber.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Kisah;
