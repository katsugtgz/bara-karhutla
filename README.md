# Bara

Bara adalah pemantau peringatan dini kebakaran hutan dan lahan gambut (karhutla) di
Indonesia. Namanya dari fakta inti kebakaran gambut: bara tetap menyala di bawah tanah
walau permukaan terlihat aman.

Aturan keras:

- Titik panas satelit bukan kebakaran terkonfirmasi, dan bukan bukti siapa penyebabnya.
- Setiap angka memakai komponen sumber: nama sumber, waktu pengambilan, dan status
  verifikasi. Data yang tidak ada ditulis "tidak tersedia", bukan nol.
- Skor risiko dihitung oleh kode murni yang teruji (`src/lib/risk.ts`). Bobot dan ambang
  v0 masih draf dan menunggu kalibrasi ahli.

Menjalankan lokal (Node 24+):

```sh
npm install
npm run dev            # halaman dev
npm run fetch:live     # stub: tulis public/data/live.json kosong yang valid
npm test               # vitest
npm run typecheck      # tsc --noEmit
npm run lint           # oxlint
npm run build          # BASE_PATH=/bara-karhutla/ npm run build untuk GitHub Pages
```

Sumber data: NASA FIRMS (titik panas VIIRS/MODIS), Open-Meteo (curah hujan), dengan
rencana pembanding SiPongi, BNPB, dan BMKG (lihat `docs/RENCANA.md`).

Desain: [DESIGN.md](DESIGN.md). Arsitektur dan kontrak data:
[ARCHITECTURE.md](ARCHITECTURE.md).
