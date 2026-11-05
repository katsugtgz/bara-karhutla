import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '../../styles/tokens.css';
import '../../styles/base.css';
import { SiteHeader } from '../../components/SiteHeader';
import { Sourced } from '../../components/Sourced';
import { RISK_MODEL } from '../../lib/risk';

/** Pantau page — foundation stub. The monitor UI (map, live signals) lands in a later phase. */
function Pantau() {
  return (
    <>
      <SiteHeader current="pantau" />
      <main className="page-main">
        <h1>Pantau</h1>
        <p className="prose">
          Peta pemantau dan sinyal live akan tampil di sini. fondasi: rumus skor, kontrak
          data, dan komponen sumber sudah siap dan teruji.
        </p>
        <dl>
          <dt>Bobot rumus skor v0</dt>
          <dd className="num">
            titik panas {RISK_MODEL.weights.hotspots}, hari tanpa hujan{' '}
            {RISK_MODEL.weights.dryDays}, hujan 30 hari {RISK_MODEL.weights.rain30}
          </dd>
        </dl>
        <p>
          <Sourced
            value={null}
            source={{
              name: 'Data live (contoh)',
              status: 'dihitung',
              note: 'Nilai contoh: pipeline live belum dijalankan, jadi angkanya belum tersedia.',
            }}
          />
        </p>
        <p>
          Titik panas adalah deteksi panas satelit, bukan kebakaran yang terkonfirmasi,
          dan bukan bukti siapa penyebabnya.
        </p>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pantau />
  </StrictMode>,
);
