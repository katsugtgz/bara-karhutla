import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '../../styles/tokens.css';
import '../../styles/base.css';
import './metode.css';
import { SiteHeader } from '../../components/SiteHeader';
import { Sourced } from '../../components/Sourced';
import { RISK_MODEL } from '../../lib/risk';
import type { SourceStatus } from '../../lib/types';

const DIHITUNG = {
  name: 'Skor Bara v0',
  status: 'dihitung' as const,
  note: 'Bobot dan ambang masih draf (v0), menunggu kalibrasi ahli.',
};

const STATUS_WORD: Record<SourceStatus, string> = {
  ok: 'ok',
  empty: 'kosong',
  stale: 'basi',
  failed: 'gagal',
};
const wibShort = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});
const SOURCE_ORDER = ['firms-viirs-snpp', 'firms-viirs-noaa20', 'firms-viirs-noaa21', 'firms-modis', 'open-meteo'];
const SOURCE_SHORT: Record<string, string> = {
  'firms-viirs-snpp': 'VIIRS S-NPP',
  'firms-viirs-noaa20': 'VIIRS NOAA-20',
  'firms-viirs-noaa21': 'VIIRS NOAA-21',
  'firms-modis': 'MODIS',
  'open-meteo': 'Cuaca',
};

interface LogLine {
  generatedAt: string;
  sources: { id: string; status: SourceStatus; rows: number | null; warning?: string }[];
}

function shortWib(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${wibShort.format(d).replace(':', '.').replace(', ', ', ')} WIB`;
}

function LogTable() {
  const [lines, setLines] = useState<LogLine[] | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/fetch-log.jsonl`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) =>
        setLines(
          text
            .split('\n')
            .filter((l) => l.trim())
            .slice(-20)
            .map((l) => JSON.parse(l) as LogLine),
        ),
      )
      .catch(() => setMissing(true));
  }, []);

  if (missing) return <p>Berkas log pengambilan data tidak ditemukan. Pipeline live belum pernah dijalankan di lingkungan ini.</p>;
  if (!lines) return <p>Memuat log…</p>;

  const cols = SOURCE_ORDER.filter((id) => lines.some((l) => l.sources.some((s) => s.id === id)));
  const warnings = [...lines]
    .reverse()
    .flatMap((l) =>
      l.sources
        .map((s) => (s.warning ? `${shortWib(l.generatedAt)} — ${SOURCE_SHORT[s.id] ?? s.id}: ${s.warning}` : null))
        .filter((w): w is string => w !== null),
    );
  return (
    <>
      <table>
        <caption className="sourced-meta" style={{ textAlign: 'start' }}>
          20 baris terakhir berkas <span className="num">data/fetch-log.jsonl</span>. Status per sumber pada saat
          pengambilan.
        </caption>
      <thead>
        <tr>
          <th scope="col">Waktu (WIB)</th>
          {cols.map((c) => (
            <th scope="col" key={c}>
              {SOURCE_SHORT[c] ?? c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.generatedAt}>
            <td className="num">{shortWib(l.generatedAt)}</td>
            {cols.map((c) => {
              const s = l.sources.find((x) => x.id === c);
              return (
                <td
                  key={c}
                  className={`num log-status-${s?.status ?? 'failed'}`}
                  title={s?.warning ?? undefined}
                >
                  {s ? STATUS_WORD[s.status] : '—'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
        </table>
      {warnings.length > 0 ? (
        <p className="log-warnings">
          {warnings.map((w) => (
            <strong key={w} className="log-warning">
              Peringatan: {w}
            </strong>
          ))}
        </p>
      ) : null}
    </>
  );
}

const w = RISK_MODEL.weights;
const t = RISK_MODEL.thresholds;
// Weights as Indonesian decimals: 0,45 / 0,30 / 0,25.
const fmtWeight = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 });

function Metode() {
  return (
    <>
      <SiteHeader current="metode" />
      <main className="page-main prose metode">
        <h1>Metode &amp; sumber</h1>
        <p>
          Skor risiko v0 dihitung oleh kode yang bisa diuji (src/lib/risk.ts), bukan oleh penilaian AI.
          Halaman ini menjelaskan rumusnya, sumber datanya, dan batasannya.
        </p>

        <section>
          <h2>Apa yang dihitung</h2>
          <p>
            Setiap wilayah dibagi ke sel grid <span className="num">0,5° × 0,5°</span> (sekitar{' '}
            <span className="num">55 × 55</span> km). Setiap sel diberi skor{' '}
            <span className="num">0–100</span> dari tiga sinyal:
          </p>
          <code className="formula">
            skor = 100 × ({' '}
            <Sourced value={fmtWeight.format(w.hotspots)} source={DIHITUNG} /> · h +{' '}
            <Sourced value={fmtWeight.format(w.dryDays)} source={DIHITUNG} /> · d +{' '}
            <Sourced value={fmtWeight.format(w.rain30)} source={DIHITUNG} /> · r )
          </code>
          <p>
            <strong>h — titik panas 24 jam.</strong> Jumlah lokasi unik (dibulatkan ke sekitar{' '}
            <span className="num">1 km</span>) di dalam sel yang memiliki sedikitnya satu deteksi panas
            bukan-keyakinan-rendah dari satelit mana pun dalam 24 jam terakhir, diskalakan dengan{' '}
            <span className="num">h = min(1, ln(1 + n) / ln(1 + 20))</span>. Lokasi dibulatkan agar satu api
            yang terdeteksi bersamaan oleh S-NPP, NOAA-20, NOAA-21, dan MODIS dihitung sekali, bukan empat
            kali. Titik panas adalah deteksi panas, bukan kebakaran terkonfirmasi.
          </p>
          <p>
            <strong>d — hari tanpa hujan.</strong> Hari berturut-turut dengan curah hujan di bawah{' '}
            <span className="num">1 mm</span> sampai kemarin, diskalakan{' '}
            <span className="num">d = min(1, hari / 14)</span>. Gambut yang kering bertahap menyimpan
            bara di bawah permukaan.
          </p>
          <p>
            <strong>r — defisit hujan 30 hari.</strong> Total curah hujan 30 hari terakhir dibandingkan{' '}
            <span className="num">150 mm</span>: <span className="num">r = clamp(1 − hujan/150, 0, 1)</span>.
          </p>

          <h3>Kelas risiko</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Kelas</th>
                <th scope="col">Rentang skor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rendah</td>
                <td className="num">
                  <Sourced value={`< ${t.rendah}`} source={DIHITUNG} />
                </td>
              </tr>
              <tr>
                <td>Sedang</td>
                <td className="num">
                  <Sourced value={`${t.rendah} – < ${t.sedang}`} source={DIHITUNG} />
                </td>
              </tr>
              <tr>
                <td>Tinggi</td>
                <td className="num">
                  <Sourced value={`${t.sedang} – < ${t.tinggi}`} source={DIHITUNG} />
                </td>
              </tr>
              <tr>
                <td>Sangat tinggi</td>
                <td className="num">
                  <Sourced value={`≥ ${t.tinggi}`} source={DIHITUNG} />
                </td>
              </tr>
            </tbody>
          </table>

          <h3>Jika ada sinyal yang hilang</h3>
          <p>
            Sinyal yang tidak tersedia tidak dianggap nol: bobotnya dibuang, dan bobot sinyal yang tersisa
            dinormalisasi ulang ke total <span className="num">1</span>. Jika ketiga sinyal hilang, skor,
            rentang, dan kelas tidak ditampilkan (tanpa data), bukan nol.
          </p>

          <h3>Ketidakpastian dan keyakinan</h3>
          <p>
            Rentang ketidakpastian: <span className="num">u = 6 + 12 × (jumlah sinyal hilang) + 6 (jika ada sumber basi/gagal)</span>,
            ditampilkan sebagai <span className="num">[skor − u, skor + u]</span> yang dipotong ke{' '}
            <span className="num">0–100</span>.
          </p>
          <p>
            Keyakinan mulai dari <em>tinggi</em>, turun satu tingkat untuk setiap sinyal yang hilang, dan
            satu tingkat lagi jika ada sumber data basi atau gagal; terendah <em>rendah</em>.
          </p>

          <h3>Dari sel ke wilayah</h3>
          <p>
            Skor wilayah adalah <span className="num">persentil ke-75</span> skor sel di wilayah itu: cukup
            banyak sel yang berisiko tinggi agar wilayah ikut naik, tanpa satu sel anomali menyeret
            seluruh wilayah.
          </p>
        </section>

        <section>
          <h2>Data yang dipakai</h2>
          <div className="table-scroll" role="region" aria-label="Tabel sumber data (bisa digeser mendatar)">
            <table>
              <thead>
                <tr>
                  <th scope="col">Sumber</th>
                  <th scope="col">Dipakai untuk</th>
                  <th scope="col">Pembaruan</th>
                  <th scope="col">Catatan</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a
                      href="https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      NASA FIRMS VIIRS S-NPP, NOAA-20, NOAA-21 (NRT)
                    </a>
                  </td>
                  <td>Titik panas 7 hari</td>
                  <td className="num">~3 jam (near real-time); pipeline ini tiap 3 jam</td>
                  <td>
                    Data terbuka NASA Earth science; atribusi diminta. Titik panas saja, punya alarm palsu.
                    Lokasi unik dihitung sekali walau terdeteksi beberapa satelit.
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      NASA FIRMS MODIS C6.1 (Terra &amp; Aqua)
                    </a>
                  </td>
                  <td>Titik panas 7 hari; arsip sejak 2000 untuk kisah 20 tahun</td>
                  <td className="num">~3 jam (near real-time)</td>
                  <td>Data terbuka NASA. Keyakinan 0–100 dipetakan ke rendah/nominal/tinggi.</td>
                </tr>
                <tr>
                  <td>
                    <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
                      Open-Meteo forecast API
                    </a>
                  </td>
                  <td>Curah hujan harian per pusat sel (30 hari terakhir)</td>
                  <td className="num">model diperbarui berkala; pipeline ini tiap 3 jam</td>
                  <td>
                    CC BY 4.0, gratis untuk non-komersial. Bukan BMKG: verifikasi terhadap data stasiun BMKG
                    belum dilakukan.
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="https://www.bmkg.go.id/" target="_blank" rel="noopener noreferrer">
                      BMKG
                    </a>
                  </td>
                  <td>Acuan curah hujan resmi (belum tersambung)</td>
                  <td>—</td>
                  <td>Untuk pembanding Open-Meteo; belum ada integrasi.</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://sipongi.gakkum.kehutanan.go.id/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      SiPongi (KLHK)
                    </a>
                  </td>
                  <td>Luas indikatif terbakar resmi (pembanding, bukan sinyal skor)</td>
                  <td className="num">mingguan</td>
                  <td>Belum tersambung ke skor; dipakai untuk pembanding kronologi.</td>
                </tr>
                <tr>
                  <td>MPeat / peatfr (Dr. Adilan Mahdiyasa)</td>
                  <td>Model kekeringan gambut (belum dipakai)</td>
                  <td>—</td>
                  <td>Menunggu izin dan lisensi dari pemilik kode sebelum diterjemahkan atau dijalankan.</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Natural Earth admin-1
                    </a>
                  </td>
                  <td>Batas wilayah dan grid sel</td>
                  <td className="num">sekali (berkas statis)</td>
                  <td>Domain publik (natural-earth-vector di GitHub); disederhanakan 8% dengan mapshaper.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Peta dasar memakai gaya Positron/Dark dari OpenFreeMap (data © OpenStreetMap kontributor),
            dengan atribusi tetap ditampilkan di peta.
          </p>
        </section>

        <section>
          <h2>Batasan yang harus diketahui</h2>
          <ul>
            <li>
              Titik panas satelit bukan kebakaran yang terkonfirmasi dan bukan bukti siapa penyebabnya.
              Data ini tidak boleh dipakai untuk menuduh pihak tertentu.
            </li>
            <li>
              Skor v0 belum diuji terhadap kejadian historis (backtesting musim 2015, 2019, 2023 belum
              dilakukan), dan bobotnya menunggu kalibrasi ahli.
            </li>
            <li>
              Deteksi near real-time memiliki alarm palsu; deteksi keyakinan rendah sengaja tidak dihitung
              ke dalam skor.
            </li>
            <li>
              Kekeringan gambut (tinggi muka air) dan prediksi model MPeat belum tersambung, padahal
              keduanya paling menentukan untuk bara bawah tanah.
            </li>
          </ul>
        </section>

        <section>
          <h2>Kesehatan pengambilan data</h2>
          <p>
            Setiap kali pipeline live berjalan (terjadwal tiap 3 jam), status tiap sumber dicatat ke berkas
            log. Gagal tidak pernah dicatat sebagai nol: sumber gagal memakai snapshot terakhir dan
            ditandai <em>basi</em>. Jika jumlah baris sumber turun tajam (di bawah 10% dari pengambilan
            sebelumnya yang substansial), status tetap dicatat tetapi diberi peringatan — umumnya tanda
            berkas terpotong dari sumbernya, bukan api yang benar-benar hilang.
          </p>
          <LogTable />
        </section>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Metode />
  </StrictMode>,
);
