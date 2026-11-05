# Rencana Web App Deteksi Dini Karhutla

Dokumen ini adalah rencana langkah demi langkah untuk membangun web app pemantau risiko kebakaran hutan dan lahan (karhutla) di Indonesia. Tujuannya preventif: mendeteksi risiko sebelum api membesar, dengan data live yang jelas sumbernya. Ini adalah saran awal, bukan resep baku, dan perlu divalidasi dengan ahli.

## Ringkasan untuk Agen AI

Bagian ini adalah konteks utama. Baca dulu sebelum mengerjakan fase mana pun.

- Produk: web app pemantau risiko karhutla Indonesia dengan data live, ditambah halaman scrollytelling 3D tentang sejarah kebakaran 20 tahun.
- Pengguna: pembuat adalah orang awam gambut, tapi berpengalaman dengan AI agent dan MCP. Jelaskan istilah teknis dengan bahasa sederhana.
- Bahasa antarmuka dan penjelasan: Indonesia.
- Aturan keras 1: setiap angka harus punya sumber, tahun, dan waktu pengambilan. Jika data tidak ada, katakan tidak tahu, jangan mengarang.
- Aturan keras 2: hotspot satelit bukan kebakaran terkonfirmasi, dan bukan bukti siapa penyebabnya.
- Aturan keras 3: skor risiko dihitung oleh kode yang bisa diuji. AI menjelaskan hasilnya, tidak menentukan sendiri.
- Aturan keras 4: kode MATLAB milik Dr. Adilan Mahdiyasa hanya dipakai setelah ada izin dan lisensi jelas.
- Status data: angka kronologi 2007 sampai 2014 belum terisi, dan angka 2006 perlu dicek ke publikasi KLHK.
- Urutan kerja: Fase 1 sampai 6 untuk sistem pemantauan, lalu Bagian Akurasi dan Ketahanan, lalu Bagian Scrollytelling 3D, lalu Sumber dan Langkah Pertama.
- Format output yang diminta dari agen: ringkas, bertahap, dan setiap langkah diakhiri dengan cara memverifikasinya.

## Tujuan dan Prinsip

- Preventif, bukan reaktif: tampilkan sinyal risiko lebih awal.
- Grounded: setiap angka punya sumber, timestamp, dan tautan asal.
- Jujur soal batas data: titik panas satelit bukan kebakaran terkonfirmasi.
- AI sebagai pembaca dan penjelas, bukan penentu. Skor risiko dihitung oleh kode yang bisa diuji.
- Sederhana dulu, lalu bertahap menambah kecanggihan.

## Fase 1: Fondasi Data Live (minggu 1-2)

1. Tentukan wilayah awal yang kecil, misalnya Kalimantan Tengah atau Riau, supaya mudah divalidasi.
2. Tarik data hotspot dari NASA FIRMS (VIIRS dan MODIS) lewat API mereka.
3. Tarik data cuaca dan curah hujan dari BMKG atau sumber terbuka lain.
4. Tarik data karhutla resmi dari SiPongi dan data bencana dari BNPB atau PetaBencana sebagai pembanding.
5. Simpan semua data mentah beserta waktu pengambilan. Jika pengambilan gagal, catat sebagai gagal, jangan dianggap nol.
6. Tampilkan di peta interaktif (misalnya Leaflet) dengan label sumber dan waktu pembaruan.

## Fase 2: Memahami Repo Dr. Adilan Mahdiyasa (minggu 2-3)

1. Hubungi Dr. Adilan Mahdiyasa (dosen matematika ITB) untuk izin memakai atau mengadaptasi kodenya, serta menanyakan lisensi repo.
2. Minta AI agent membaca kode MATLAB per bagian dan menjelaskannya dalam bahasa biasa: apa input, apa proses, apa output.
3. Tulis catatan: variabel apa saja yang dipakai (misalnya tinggi muka air gambut, curah hujan, kelembapan) dan dari mana data aslinya.
4. Jangan langsung percaya terjemahan AI. Anggap ini draf yang harus diuji.

## Fase 3: Terjemahan ke Python dan Validasi (minggu 3-5)

1. Terjemahkan logika inti MATLAB ke Python (atau R, karena paket peatfr sudah berbasis R) secara bertahap, satu fungsi per satu.
2. Siapkan satu set data contoh, jalankan di MATLAB (atau minta output dari repo), lalu jalankan di Python.
3. Bandingkan hasilnya. Jika selisihnya kecil dan bisa dijelaskan, terjemahan dianggap valid. Jika tidak, perbaiki.
4. Tulis unit test otomatis supaya hasil tetap konsisten saat kode diubah.
5. Alternatif jika terjemahan sulit: jalankan model sebagai layanan terpisah dan panggil dari web app.

## Fase 4: Skor Risiko dan Peringatan Dini (minggu 5-7)

1. Gabungkan sinyal: hotspot terbaru, curah hujan rendah berhari-hari, kedalaman dan kekeringan gambut, serta prediksi dari model.
2. Hitung skor risiko per wilayah, misalnya per kabupaten atau per grid, dengan rumus yang transparan dan terdokumentasi.
3. Tentukan ambang peringatan bersama ahli, dan uji dengan data historis untuk melihat berapa banyak alarm palsu.
4. Tambahkan fitur peringatan, misalnya notifikasi atau ringkasan harian untuk relawan dan pihak desa.

## Fase 5: Lapisan Agen AI dan MCP (minggu 7-9)

1. Bungkus sumber data sebagai tool lewat MCP supaya agen bisa memanggilnya dengan terstruktur.
2. Agen bertugas: mengambil data terbaru, menjalankan fungsi perhitungan risiko, lalu menjelaskan hasilnya dalam bahasa Indonesia sederhana, lengkap dengan sumber dan batasannya.
3. Wajibkan agen selalu menyertakan timestamp dan tautan sumber di setiap jawaban.
4. Larang agen mengarang angka. Jika data tidak tersedia, agen harus bilang tidak tahu.
5. Simpan log setiap panggilan agen supaya bisa diaudit.

## Fase 6: Rilis Terbatas dan Umpan Balik (minggu 9-12)

1. Deploy web app (misalnya lewat layanan hosting gratis) dan jadwalkan pembaruan data berkala.
2. Uji coba dengan sekelompok kecil: relawan, komunitas peduli lingkungan, atau perangkat desa.
3. Kumpulkan umpan balik soal kejelasan, akurasi, dan alarm palsu.
4. Ajak Dr. Adilan atau peneliti lain meninjau metodenya sebelum dipublikasikan luas.

## Risiko dan Cara Mengatasinya

- Alarm palsu terlalu banyak: orang berhenti percaya. Atasi dengan ambang yang diuji dan penjelasan yang jujur.
- Data satelit terlambat atau hilang: tampilkan waktu pembaruan terakhir dan jangan sembunyikan kegagalan.
- Hotspot bukan bukti kebakaran atau penyebabnya: jangan menuduh pihak tertentu berdasarkan peta saja.
- Terjemahan model tidak akurat: selalu validasi terhadap output asli.
- Izin dan lisensi kode: minta persetujuan dan cantumkan atribusi yang jelas.
- AI mengarang: batasi peran agen dan wajibkan sumber di setiap klaim.

## Sumber Data yang Disarankan

- NASA FIRMS: titik panas satelit near real-time.
- BMKG: cuaca, curah hujan, dan data hotspot.
- SiPongi (KLHK): data resmi karhutla Indonesia.
- BNPB dan PetaBencana: kejadian bencana.
- Paket peatfr dan model MPeat dari Dr. Adilan Mahdiyasa sebagai acuan logika gambut.

## Bagian A: Meningkatkan Akurasi dan Ketahanan

Akurasi sistem baru bisa dipercaya setelah diuji pada data masa lalu, dan ketahanannya baru terbukti saat satu sumber data mati. Ini saran awal yang perlu ditinjau ahli.

### 1. Validasi dengan data historis (backtesting)

- Jalankan sistem pada data tahun-tahun lalu, misalnya musim kering 2015, 2019, dan 2023.
- Cek apakah skor risiko naik sebelum kebakaran besar terjadi, dan berapa hari lebih awal.
- Hitung alarm palsu dan kebakaran yang terlewat, lalu laporkan angkanya apa adanya.
- Bandingkan dengan baseline sederhana, misalnya hanya memakai jumlah hotspot, untuk membuktikan model memberi nilai tambah.

### 2. Tambah sumber data yang berbeda jenis

- Tinggi muka air gambut dari stasiun pemantau, karena gambut kering lebih mudah terbakar dan menyimpan bara.
- Indeks kekeringan dan prakiraan hujan musiman dari BMKG.
- Citra Sentinel-2 untuk memetakan area bekas terbakar setelah kejadian.
- Laporan warga dan patroli desa sebagai konfirmasi lapangan.
- Peta kedalaman gambut dan tutupan lahan sebagai konteks tetap.

### 3. Tampilkan ketidakpastian

- Tampilkan rentang risiko, misalnya tinggi dengan keyakinan sedang, bukan satu angka tunggal.
- Beri label jelas: hotspot satelit bukan kebakaran terkonfirmasi.
- Tampilkan umur data di setiap panel, misalnya diperbarui 3 jam lalu.

### 4. Bangun ketahanan sistem

- Sediakan sumber cadangan untuk setiap jenis data, dan beralih otomatis saat sumber utama gagal.
- Simpan snapshot terakhir yang valid, dan beri tanda jika datanya basi.
- Pantau kesehatan pipeline: peringatan jika data berhenti masuk atau tiba-tiba turun tidak wajar.
- Catat semua langkah dalam log supaya hasil bisa ditelusuri dan diaudit.

### 5. Libatkan ahli dan pengguna asli

- Minta tinjauan metode dari Dr. Adilan Mahdiyasa atau peneliti gambut lain.
- Uji ambang peringatan bersama BPBD, relawan desa, dan komunitas lokal.
- Kumpulkan umpan balik setiap musim kering dan perbaiki model berdasarkan itu.

## Bagian B: Scrollytelling 3D dengan Three.js, Dua Dekade Karhutla

Halaman web ini bercerita lewat scroll: pengunjung menggulir, kamera 3D bergerak di atas peta Indonesia, dan tiap section menampilkan satu babak sejarah kebakaran dari sekitar 2006 sampai 2026. Tujuannya membuat data terasa, lalu mengarahkan pengunjung ke pemantauan live dan pencegahan.

### Teknologi yang disarankan

- Three.js untuk adegan 3D: globe atau peta relief Indonesia, titik hotspot sebagai partikel, dan asap sebagai efek partikel.
- GSAP ScrollTrigger atau Lenis untuk menghubungkan posisi scroll dengan gerakan kamera dan animasi.
- Data hotspot historis dari NASA FIRMS (arsip tahunan sejak 2000) untuk titik-titik di peta.
- Teks dan angka di setiap section diambil dari satu berkas data (JSON) yang mencantumkan sumber dan tahun.
- Siapkan versi ringan untuk ponsel, karena adegan 3D berat bagi perangkat lama.

### Struktur section scroll

1. Pembuka: Indonesia dari angkasa, hotspot berkedip di Sumatra dan Kalimantan, dengan pertanyaan: berapa kali ini terjadi dalam 20 tahun?
2. Mengapa gambut mudah terbakar: kamera turun ke lahan gambut, menjelaskan bara yang menyimpan api di bawah tanah.
3. Timeline kronologi: lompat per tahun besar, dengan angka luas terbakar, dampak, dan peta hotspot tahun itu (tabel di bawah).
4. Kebakaran 2015 sebagai puncak: 2,61 juta hektare, kerugian ekonomi sekitar Rp220 triliun, dan sekitar 504.000 kasus infeksi saluran pernapasan akut (sumber: SiPongi dan Kemenhut).
5. Setelah 2015: pembentukan Badan Restorasi Gambut, tetapi kebakaran besar kembali pada 2019.
6. Sekarang, 2026: data live, dan perbandingan dengan tahun-tahun sebelumnya.
7. Penutup: apa yang bisa dilakukan, dan tautan ke peta pemantauan live serta sistem peringatan dini.

### Anekdot untuk section gambut: pom bensin dan pabrik korek

Judul section yang disarankan: Bukan cuma siapa yang menyulut, tapi kenapa semuanya mudah terbakar.

Teks anekdot untuk halaman web:

> Bayangkan sebuah pom bensin meledak, dan di sebelahnya ada pabrik korek api. Semua orang sibuk bertanya, siapa yang menyalakan apinya? Padahal pertanyaan yang lebih penting, kenapa dua hal itu dibiarkan bersebelahan? Gambut yang dikeringkan adalah pom bensinnya, api adalah koreknya. Menghukum penyulut itu perlu, tapi kalau gambutnya tetap kering, percikan berikutnya cuma soal waktu.

Catatan untuk agen AI: anekdot ini adalah analogi tentang sebab langsung dan sebab struktural, bukan klaim fakta tentang pelaku tertentu. Jangan dipakai untuk menuduh pihak mana pun, dan jangan dipakai untuk menyiratkan bahwa pelaku pembakaran tidak bersalah. Letakkan di section 2 (Mengapa gambut mudah terbakar), lalu lanjutkan dengan data kondisi gambut yang bersumber.

### Hook psikologi untuk membuat scroll lebih menarik

Tujuannya membuat pengunjung terus menggulir dan benar-benar paham, bukan sekadar terkesan. Prinsip psikologi di bawah ini saran desain, bukan jaminan hasil, dan sebaiknya diuji dengan pengguna asli. Referensi riset yang disebut perlu dicek ke sumber aslinya sebelum dikutip di halaman publik.

| Hook | Cara kerja | Penerapan di halaman karhutla |
| --- | --- | --- |
| Information gap (kesenjangan informasi) | Orang penasaran saat tahu ada informasi yang belum mereka miliki. Tunjukkan hal yang familiar, lalu sembunyikan cara kerjanya. | Mulai dengan satu titik api kecil di peta dan pertanyaan: kenapa api ini tidak padam walau hujan turun? Jawabannya baru muncul di section gambut: bara menyimpan api di bawah tanah. |
| Kognitif fluensi (cognitive fluency) | Informasi yang mudah dicerna terasa lebih benar dan lebih menyenangkan. Konsep abstrak jadi mudah saat dianimasikan, seperti rumus F = ma. Rujukan: Norbert Schwarz dkk., riset sekitar 1999 tentang teks yang mudah dibaca terasa lebih benar (perlu dicek ke sumber asli, termasuk nama dan tahunnya). | Animasikan penampang gambut sebagai spons yang mengering. Pakai kalimat pendek, satu ide per layar, huruf besar dan kontras tinggi. Hindari dinding teks. |
| Efek Zeigarnik dan open loop | Pertanyaan yang belum terjawab terus mengganggu pikiran dan mendorong orang melanjutkan. | Di akhir tiap section, ajukan pertanyaan yang dijawab section berikutnya, misalnya: tahun 2015 terparah, tapi apa yang terjadi setelahnya? |
| Progressive disclosure | Informasi dibuka bertahap supaya tidak membebani. Beban kognitif yang rendah menjaga perhatian. | Satu angka besar per layar, detail dan sumber muncul saat diklik atau di-hover. |
| Skala dibuat terasa (making numbers tangible) | Angka sangat besar sulit dibayangkan, perbandingan konkret membuatnya terasa. | Ubah 2,61 juta hektare menjadi perbandingan yang bisa dibayangkan, misalnya berapa kali luas Jakarta. Hitung dan cek dulu perbandingannya sebelum dipakai. |
| Identifiable victim effect | Orang lebih tergerak oleh satu cerita konkret daripada statistik massal. | Sisipkan satu kisah nyata dan bersumber, misalnya satu desa atau satu satwa terdampak. Jangan mengarang tokoh. |
| Rasa kendali dan harapan | Pesan yang hanya menakutkan membuat orang menghindar. Tawaran tindakan yang realistis membuat orang bertindak. | Akhiri dengan hal yang bisa dilakukan pengunjung, misalnya memantau peta live, berbagi, atau mendukung restorasi gambut. |
| Umpan balik multisensori | Gerak, suara, dan interaksi kecil meningkatkan keterlibatan. | Efek partikel asap yang bereaksi pada scroll dan suara latar halus yang bisa dimatikan. Sediakan opsi kurangi gerak untuk pengguna yang sensitif. |

Catatan untuk agen AI: terapkan hook ini untuk memperjelas, bukan untuk memanipulasi. Jangan membesar-besarkan angka demi dramatis, jangan mengarang cerita korban, dan pastikan efek 3D tetap bisa dipakai di ponsel lama serta tidak mengganggu aksesibilitas.

### Data kronologi awal (perlu diverifikasi sebelum tayang)

| Tahun | Kejadian utama | Angka | Sumber |
| --- | --- | --- | --- |
| 2006 | Tahun kebakaran besar pada era El Nino, tercatat dalam publikasi KLHK dua dekade pemantauan | 3.881.992 ha terbakar, sekitar 1,14 juta ha di antaranya gambut | Inilah.com mengutip KLHK |
| 2015 | Kebakaran terparah, kabut asap lintas negara | Sekitar 2,61 juta ha terbakar, kerugian sekitar Rp220 triliun, sekitar 504.000 kasus ISPA | [SiPongi via Datasatu](https://datasatu.com/lingkungan/2820839/rekor-karhutla-2015-lahan-indonesia-terbakar-hingga-jutaan-hektare) |
| 2016 | Pembentukan Badan Restorasi Gambut setelah 2015 | Perlu dilengkapi | [Pantau Gambut](https://pantaugambut.id/pelajari/sejarah) |
| 2019 | Kebakaran besar kembali, asap menyebar ke negara tetangga | Lebih dari 850 ribu ha terbakar, 42% di lahan gambut; sumber lain menyebut 711.927 ha gambut | [FGMI IAGI](https://fgmi.iagi.or.id/berita/berita-dunia-geosaintis/rekam-jejak-kebakaran-hutan-di-indonesia/) dan [Pantau Gambut](https://pantaugambut.id/pelajari/sejarah) |
| 2023 | Kebakaran saat El Nino, termasuk kawasan Gunung Arjuno | Perlu dilengkapi | [Kompaspedia](https://kompaspedia.kompas.id/baca/paparan-topik/jejak-kebakaran-hutan-dan-lahan-di-indonesia) |
| 2026 | Januari-Juli: 202.004 ha, naik 47% dari 2019 dan 80% dari 2023; sampai Oktober sekitar 1,92 juta ha | Perbandingan resmi SiPongi | [SiPongi](https://sipongi.gakkum.kehutanan.go.id/indikasi-luas-kebakaran) |
| 2015 sampai Oktober 2026 | Akumulasi seluruh periode | Sekitar 8,35 juta ha | [Media Kompeten via SiPongi](https://www.mediakompeten.co.id/luas-kebakaran-hutan-indonesia) |

Catatan penting: angka antar sumber bisa berbeda karena metode hitungnya berbeda, misalnya luas indikatif versus luas gambut saja. Dari periode 2006 sampai 2014, baru angka 2006 yang terisi, dan angkanya perlu dicek langsung ke publikasi KLHK Dua Dasawarsa Indonesia Memantau Kebakaran Hutan dan Lahan. Tahun 2007 sampai 2014 masih perlu dicari dari arsip SiPongi, KLHK, dan Global Forest Watch sebelum bagian timeline dibangun. Jumlah kejadian yang tepat dalam 20 tahun juga belum bisa dipastikan, jadi jangan tampilkan satu angka tanpa sumber.

### Prinsip konten

- Setiap angka punya sumber dan tahun yang bisa diklik.
- Bedakan luas indikatif, luas gambut, dan jumlah hotspot, jangan dicampur.
- Hindari menuduh pihak tertentu berdasarkan peta hotspot saja.
- Akhiri dengan ajakan bertindak yang realistis, bukan hanya angka yang menakutkan.

## Daftar Sumber dan Status Verifikasi

Diperiksa lewat pencarian web pada 4 November 2026. Yang berstatus belum diverifikasi hanya dibaca dari ringkasan hasil pencarian, bukan dari halaman penuh, jadi cek ulang sebelum dipakai di halaman publik.

| Sumber | Dipakai untuk | Status |
| --- | --- | --- |
| [SiPongi Kemenhut](https://sipongi.gakkum.kehutanan.go.id/indikasi-luas-kebakaran) | Perbandingan luas karhutla 2026 dengan 2019, 2023, dan 2025 | Belum diverifikasi, dari ringkasan pencarian |
| [Datasatu](https://datasatu.com/lingkungan/2820839/rekor-karhutla-2015-lahan-indonesia-terbakar-hingga-jutaan-hektare) | Angka 2015: 2,61 juta ha, Rp220 triliun, 504.000 kasus ISPA | Belum diverifikasi, dari ringkasan pencarian |
| [FGMI IAGI](https://fgmi.iagi.or.id/berita/berita-dunia-geosaintis/rekam-jejak-kebakaran-hutan-di-indonesia/) | Angka 2019: lebih dari 850 ribu ha, 42% gambut | Belum diverifikasi, dari ringkasan pencarian |
| [Pantau Gambut](https://pantaugambut.id/pelajari/sejarah) | Badan Restorasi Gambut dan angka gambut 2019 | Belum diverifikasi, dari ringkasan pencarian |
| [Inilah.com mengutip KLHK](https://www.inilah.com/adu-data-karhutla-prabowo-vs-jokowi-vs-sby) | Angka 2006: 3.881.992 ha | Belum diverifikasi, perlu dicek ke publikasi KLHK |
| [Media Kompeten](https://www.mediakompeten.co.id/luas-kebakaran-hutan-indonesia) | Akumulasi 2015 sampai Oktober 2026: sekitar 8,35 juta ha | Belum diverifikasi, dari ringkasan pencarian |
| [Kompaspedia](https://kompaspedia.kompas.id/baca/paparan-topik/jejak-kebakaran-hutan-dan-lahan-di-indonesia) | Konteks kebakaran 2023 | Belum diverifikasi, dari ringkasan pencarian |
| [Zona Utara mengutip CELIOS](https://zonautara.com/2026/11/04/tagihan-karhutla-2026-hingga-rp565-triliun-dari-hutan-terbakar-sampai-biaya-berobat/) | Sekitar 1,92 juta ha terbakar sampai Oktober 2026 dan kerugian sampai Rp565 triliun | Belum diverifikasi, dari ringkasan pencarian |

## Pertanyaan Terbuka

- Berapa luas karhutla per tahun untuk 2007 sampai 2014?
- Berapa jumlah kejadian kebakaran besar dalam 20 tahun, dan apa definisinya?
- Apa lisensi repo MATLAB Dr. Adilan Mahdiyasa, dan apakah beliau mengizinkan adaptasi?
- Apakah angka 1,92 juta ha dan 8,35 juta ha memakai metode hitung yang sama dengan angka tahunan SiPongi?

## Langkah Pertama Hari Ini

1. Daftar API key NASA FIRMS (gratis).
2. Pilih satu wilayah percontohan.
3. Buat peta sederhana yang menampilkan hotspot 24 jam terakhir dengan label sumber dan waktu.
4. Kirim pesan sopan ke Dr. Adilan untuk memperkenalkan ide ini dan menanyakan izin.
