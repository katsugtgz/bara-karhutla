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
npm run fetch:live     # pipeline live: ambil FIRMS + Open-Meteo, tulis public/data/live.json
npm test               # vitest
npm run typecheck      # tsc --noEmit
npm run lint           # oxlint
npm run build          # BASE_PATH=/bara-karhutla/ npm run build untuk GitHub Pages
```

Pipeline live (`scripts/fetch-live.ts`, dijalankan CI tiap 3 jam):

- Sumber: NASA FIRMS (4 umpan CSV 7 hari) dan Open-Meteo (curah hujan per pusat sel,
  100 koordinat per batch URL).
- Snapshot sebelumnya dicari dengan urutan: `PREVIOUS_LIVE_URL` **dulu** (di CI berkas
  `live.json` lokal tidak ada/tidak tepercaya), lalu `public/data/live.json` lokal. Jika
  keduanya tidak ada (mis. URL 404, HTTP 500, JSON tidak valid), pipeline tetap berjalan —
  sumber gagal ditandai `failed` dan sinyalnya `null`, tidak pernah nol.
- Respon FIRMS tanpa header CSV yang valid (mis. halaman galat HTML dengan HTTP 200)
  dianggap gagal, bukan berkas kosong. Kosong hanya jika header ada tanpa baris data.
- Hasil ditulis ke `public/data/live.json` (minified); satu baris status per eksekusi
  ke `public/data/fetch-log.jsonl` (500 baris terakhir disimpan).
- Kegagalan sumber tidak mengubah kode keluar; eksekusi gagal (exit 1) hanya untuk
  kesalahan pemrograman.
- `FIRMS_BASE_OVERRIDE` env dapat dipakai untuk menguji kegagalan sumber (arahkan ke
  basis palsu); default tidak berubah.

Sumber data: NASA FIRMS (titik panas VIIRS/MODIS), Open-Meteo (curah hujan), dengan
rencana pembanding SiPongi, BNPB, dan BMKG (lihat `docs/RENCANA.md`).

Desain: [DESIGN.md](DESIGN.md). Arsitektur dan kontrak data:
[ARCHITECTURE.md](ARCHITECTURE.md).
