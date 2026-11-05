import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '../../styles/tokens.css';
import '../../styles/base.css';
import { SiteHeader } from '../../components/SiteHeader';

/** Kisah page — foundation stub. The Three.js scrollytelling timeline lands in a later phase. */
function Kisah() {
  return (
    <>
      <SiteHeader current="kisah" />
      <main className="page-main">
        <h1>Kisah 20 tahun</h1>
        <p className="prose">
          Kronologi kebakaran hutan dan gambut Indonesia, tahun demi tahun, dengan latar
          langit tiap tahun. Setiap angka akan membawa sumber dan status verifikasinya.
        </p>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Kisah />
  </StrictMode>,
);
