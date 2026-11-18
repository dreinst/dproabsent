# Uji beban

Alat untuk mengukur server saat ratusan crew login dan absen hampir bersamaan. Tidak butuh paket npm, cukup Node (ditulis untuk Node 26 di host VPS, sudah dicoba dengan Node 24).

- `siapkan.mjs` menghasilkan SQL pengisi database uji: N crew bernomor `62899xxxxxxx` dengan satu password, 1 acara aktif (id 900001), dan 1 sesi yang sedang berjalan (id 900001, mulai 5 menit sebelum SQL dijalankan, selesai 6 jam sesudahnya).
- `jalankan.mjs` menjalankan N crew virtual. Tiap crew memakai satu koneksi keep-alive sendiri (seperti satu HP) dan berurutan melakukan `POST /api/login`, `GET /`, lalu `POST /api/absen` (MASUK) dengan foto unik dan lokasi di dalam radius.
- `foto-dasar.jpg` adalah JPEG 720x540 kualitas 65 (41 KB). Tiap crew mengirim salinannya yang disisipi segmen COM berisi byte acak tepat setelah SOI, jadi hashnya berbeda tapi sharp tetap mengolahnya sungguhan.

## Jangan memakai database produksi

Pakai database uji tersendiri dan instance aplikasi uji tersendiri (kontainer lain) dengan `FOTO_DIR` tersendiri. SQL dari `siapkan.mjs` menolak jalan kalau database berisi akun selain `62899...`. Kunci Redis otomatis diberi awalan nama database (`dproabsent:<nama_db>:`), jadi instance uji yang memakai Redis yang sama dengan produksi tidak saling mengganggu selama nama databasenya berbeda.

## Langkah di VPS

1. Buat database uji kosong yang skemanya sama dengan produksi (yang dibaca dari produksi hanya skemanya):

   ```sh
   createdb dproabsent_uji_beban
   pg_dump -s --no-owner <database_produksi> | psql -v ON_ERROR_STOP=1 -d dproabsent_uji_beban
   ```

2. Isi database uji:

   ```sh
   node scripts/uji-beban/siapkan.mjs --n=500 > /tmp/siapkan.sql
   psql -v ON_ERROR_STOP=1 -d dproabsent_uji_beban -f /tmp/siapkan.sql
   ```

   Opsi: `--n` (bawaan 500), `--password` (bawaan `ujibeban123`), `--lat`, `--lng`, `--radius` (bawaan titik Malang, 300 m). Jalankan ulang SQL yang sama untuk memajukan jam sesi.

3. Jalankan image baru sebagai instance uji dengan `DATABASE_URL` ke database uji, `FOTO_DIR` kosong tersendiri, dan `REDIS_URL` kalau ingin menguji jalur Redis. Tambahkan `CLUSTER_LAPOR_DETIK=10` supaya tiap worker mencatat jumlah koneksi dan permintaannya, jadi pembagian round-robin terlihat di log.

4. Jalankan uji beban dari host (ulangi dengan N dan ramp berbeda, lalu bandingkan baris JSON-nya). Kontainer Coolify biasanya tidak membuka port ke host, jadi pakai IP kontainer di jaringan Docker:

   ```sh
   UJI=http://$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' <kontainer_uji> | cut -d' ' -f1):3000
   node scripts/uji-beban/jalankan.mjs --url=$UJI --n=50 --ramp=5 | tee -a hasil-uji.txt
   node scripts/uji-beban/jalankan.mjs --url=$UJI --n=300 --ramp=30 | tee -a hasil-uji.txt
   node scripts/uji-beban/jalankan.mjs --url=$UJI --n=500 --ramp=10 | tee -a hasil-uji.txt
   grep ^JSON hasil-uji.txt
   ```

   Opsi lain: `--awal` (nomor crew pertama, bawaan 1), `--password`, `--sesi` (bawaan 900001), `--lat`, `--lng`, `--foto` (JPEG lain sebagai dasar), `--batas` (batas waktu per permintaan dalam detik, bawaan 60). URL `https://` juga bisa, misalnya domain uji lewat proxy. Untuk N di atas 900, naikkan dulu `ulimit -n`.

## Membaca hasil

```
langkah    jumlah  kode status                 p50     p95     p99    maks  (ms)
login         200  200:200                    23      36      45      53
halaman       200  200:200                     3       6       9      10
absen         200  200:200                    23      34      44      48
lengkap 200/200 crew, total 10.0 dtk
JSON {"waktu":"...","n":200,"ramp":10,"total_detik":10,"lengkap":200,"login":{...},"halaman":{...},"absen":{...}}
```

- `jumlah` adalah banyaknya permintaan di langkah itu. Crew yang gagal di satu langkah tidak lanjut ke langkah berikutnya.
- `kode status` menghitung jawaban per kode HTTP. Galat jaringan tercatat dengan namanya, misalnya `ECONNRESET` atau `BATAS_WAKTU`. Contoh pesan gagal ditampilkan di bawah barisnya.
- Latensi dihitung dari permintaan dikirim sampai seluruh jawaban diterima.
- Contoh di atas dari Mac (bukan VPS), hanya untuk memastikan alatnya benar.

## Perlu diingat

- Semua crew virtual datang dari satu IP. Pembatas login mengunci IP setelah 40 kali gagal dalam 15 menit. Kalau login gagal massal (misalnya password tidak cocok dengan `siapkan.mjs`), percobaan berikutnya ikut ditolak 429. Pulihkan dengan me-restart instance uji, atau hapus kunci `dproabsent:<nama_db>:batas:*` di Redis.
- Absen MASUK yang diulang tetap diterima, jadi putaran berikutnya tidak perlu membersihkan data. Untuk mulai bersih:

  ```sh
  psql -d dproabsent_uji_beban -Atc 'select photo from "Absensi" where "sessionId" = 900001' > /tmp/foto-uji.txt
  (cd <FOTO_DIR_uji> && xargs rm -f < /tmp/foto-uji.txt)
  psql -d dproabsent_uji_beban -c 'delete from "Absensi" where "sessionId" = 900001'
  ```

- Selesai menguji: hentikan instance uji, hapus database uji (`dropdb dproabsent_uji_beban`), dan hapus isi `FOTO_DIR` uji.
