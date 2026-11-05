/**
 * Story figures for /kisah/, taken exactly from docs/RENCANA.md ("Bagian B",
 * tabel kronologi dan tabel sumber). Every number carries its source and
 * verification status. All web-sourced figures were only read from search
 * result summaries on 4 November 2026 — hence "belum diverifikasi" — and must
 * be re-checked against the full pages before public release.
 */

export type VerifyStatus = 'terverifikasi' | 'belum diverifikasi' | 'dihitung';

export interface StorySource {
  name: string;
  url?: string;
  period: string;
  status: VerifyStatus;
  note?: string;
}

export interface StoryFigure {
  id: string;
  year: number;
  label: string;
  /** Display-ready Indonesian value, or null when there is no number to show. */
  value: string | null;
  unit?: string;
  source: StorySource;
}

export const sources = {
  inilah2006: {
    name: 'Inilah.com mengutip KLHK',
    url: 'https://www.inilah.com/adu-data-karhutla-prabowo-vs-jokowi-vs-sby',
    period: '2006',
    status: 'belum diverifikasi',
    note: 'Perlu dicek langsung ke publikasi KLHK "Dua Dasawarsa Indonesia Memantau Kebakaran Hutan dan Lahan".',
  },
  datasatu2015: {
    name: 'SiPongi via Datasatu',
    url: 'https://datasatu.com/lingkungan/2820839/rekor-karhutla-2015-lahan-indonesia-terbakar-hingga-jutaan-hektare',
    period: '2015',
    status: 'belum diverifikasi',
  },
  pantauGambut: {
    name: 'Pantau Gambut',
    url: 'https://pantaugambut.id/pelajari/sejarah',
    period: '2016–2019',
    status: 'belum diverifikasi',
  },
  fgmi2019: {
    name: 'FGMI IAGI',
    url: 'https://fgmi.iagi.or.id/berita/berita-dunia-geosaintis/rekam-jejak-kebakaran-hutan-di-indonesia/',
    period: '2019',
    status: 'belum diverifikasi',
  },
  kompas2023: {
    name: 'Kompaspedia',
    url: 'https://kompaspedia.kompas.id/baca/paparan-topik/jejak-kebakaran-hutan-dan-lahan-di-indonesia',
    period: '2023',
    status: 'belum diverifikasi',
    note: 'Konteks kejadian, tanpa angka luas yang bisa dipakai.',
  },
  sipongi2026: {
    name: 'SiPongi (KLHK)',
    url: 'https://sipongi.gakkum.kehutanan.go.id/indikasi-luas-kebakaran',
    period: 'Jan–Jul 2026',
    status: 'belum diverifikasi',
    note: 'Perbandingan resmi SiPongi antar tahun.',
  },
  zonaUtara2026: {
    name: 'Zona Utara mengutip CELIOS',
    url: 'https://zonautara.com/2026/11/04/tagihan-karhutla-2026-hingga-rp565-triliun-dari-hutan-terbakar-sampai-biaya-berobat/',
    period: 's.d. Okt 2026',
    status: 'belum diverifikasi',
  },
  mediaKompeten: {
    name: 'Media Kompeten via SiPongi',
    url: 'https://www.mediakompeten.co.id/luas-kebakaran-hutan-indonesia',
    period: '2015–Okt 2026',
    status: 'belum diverifikasi',
    note: 'Belum dipastikan metode hitungnya sama dengan angka tahunan SiPongi.',
  },
  bpkDki: {
    name: 'BPK RI (luas Provinsi DKI Jakarta)',
    url: 'https://jakarta.bpk.go.id/pemerintah-provinsi-dki-jakarta/',
    period: '2015 (perbandingan)',
    status: 'dihitung',
    note: 'Perhitungan sendiri: 2,61 juta ha = 26.100 km²; DKI Jakarta 661,52 km² → ≈ 39 kali. Angka dasar 2015 masih belum diverifikasi.',
  },
} satisfies Record<string, StorySource>;

export const figures = {
  luas2006: {
    id: 'luas-2006',
    year: 2006,
    label: 'Luas terbakar 2006',
    value: '3.881.992',
    unit: 'ha',
    source: sources.inilah2006,
  },
  luas2015: {
    id: 'luas-2015',
    year: 2015,
    label: 'Luas indikatif terbakar 2015',
    value: '2,61 juta',
    unit: 'ha',
    source: sources.datasatu2015,
  },
  rugi2015: {
    id: 'rugi-2015',
    year: 2015,
    label: 'Perkiraan kerugian ekonomi 2015',
    value: 'Rp220 triliun',
    source: sources.datasatu2015,
  },
  ispa2015: {
    id: 'ispa-2015',
    year: 2015,
    label: 'Kasus ISPA akibat asap 2015',
    value: '504.000',
    unit: 'kasus',
    source: sources.datasatu2015,
  },
  skala2015: {
    id: 'skala-2015',
    year: 2015,
    label: 'Skala 2,61 juta ha',
    value: '≈ 39 kali',
    unit: 'luas DKI Jakarta',
    source: sources.bpkDki,
  },
  luas2019Fgmi: {
    id: 'luas-2019-fgmi',
    year: 2019,
    label: 'Luas terbakar 2019 (luas indikatif)',
    value: 'lebih dari 850 ribu',
    unit: 'ha',
    source: sources.fgmi2019,
  },
  gambut2019Pg: {
    id: 'gambut-2019-pg',
    year: 2019,
    label: 'Luas gambut terbakar 2019',
    value: '711.927',
    unit: 'ha',
    source: sources.pantauGambut,
  },
  luas2026Jul: {
    id: 'luas-2026-jul',
    year: 2026,
    label: 'Luas terbakar Jan–Jul 2026',
    value: '202.004',
    unit: 'ha',
    source: sources.sipongi2026,
  },
  luas2026Okt: {
    id: 'luas-2026-okt',
    year: 2026,
    label: 'Luas terbakar sampai Oktober 2026',
    value: '≈ 1,92 juta',
    unit: 'ha',
    source: sources.zonaUtara2026,
  },
  rugi2026: {
    id: 'rugi-2026',
    year: 2026,
    label: 'Perkiraan kerugian 2026',
    value: 'Rp565 triliun',
    source: sources.zonaUtara2026,
  },
  akumulasi: {
    id: 'akumulasi-2015-2026',
    year: 2026,
    label: 'Akumulasi 2015–Oktober 2026',
    value: '≈ 8,35 juta',
    unit: 'ha',
    source: sources.mediaKompeten,
  },
} satisfies Record<string, StoryFigure>;

/** Figures whose main value is a burned area — used by the 20-year timeline. */
export const areaFiguresByYear: Record<number, StoryFigure> = {
  2006: figures.luas2006,
  2015: figures.luas2015,
  2019: figures.luas2019Fgmi,
};
