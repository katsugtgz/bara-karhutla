import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '../../styles/tokens.css';
import '../../styles/base.css';
import { SiteHeader } from '../../components/SiteHeader';
import { RISK_MODEL } from '../../lib/risk';

/** Metode page — foundation stub. Full method documentation lands in a later phase. */
function Metode() {
  return (
    <>
      <SiteHeader current="metode" />
      <main className="page-main prose">
        <h1>Metode & sumber</h1>
        <p>
          Skor risiko v0 dihitung oleh kode yang bisa diuji, dari tiga sinyal: titik
          panas 24 jam, hari tanpa hujan berturut-turut, dan defisit hujan 30 hari.
        </p>
        <dl>
          <dt>Bobot sinyal</dt>
          <dd className="num">
            titik panas {RISK_MODEL.weights.hotspots}, hari tanpa hujan{' '}
            {RISK_MODEL.weights.dryDays}, hujan 30 hari {RISK_MODEL.weights.rain30}
          </dd>
          <dt>Kelas risiko</dt>
          <dd className="num">
            &lt;{RISK_MODEL.thresholds.rendah} rendah, {RISK_MODEL.thresholds.rendah}–
            {RISK_MODEL.thresholds.sedang} sedang, {RISK_MODEL.thresholds.sedang}–
            {RISK_MODEL.thresholds.tinggi} tinggi, ≥{RISK_MODEL.thresholds.tinggi} sangat
            tinggi
          </dd>
        </dl>
        <p>
          Bobot dan ambang ini adalah nilai draf (v0) yang menunggu kalibrasi ahli.
          Titik panas adalah deteksi panas satelit, bukan kebakaran yang terkonfirmasi.
        </p>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Metode />
  </StrictMode>,
);
