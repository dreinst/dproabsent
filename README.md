# DPro Absen

Absensi crew D'Production berbasis web: login pakai nama, absen dengan foto kamera dan lokasi GPS, dengan batas radius acara. Verifikasi oleh owner dan superadmin.

## Fitur

- Login crew dan admin pakai nama (depan atau lengkap) dan password. Tanda baca dan huruf besar diabaikan. Akun bernama sama dibedakan lewat passwordnya. Gagal 5 kali per nama (atau 40 kali per IP) terkunci 15 menit.
- Password awal crew: nama depan huruf kecil ditambah 4 angka terakhir nomor HP (`scripts/reset-password-crew.mjs`).
- Satu tombol besar di layar crew yang berganti sendiri: Absen masuk, lalu Absen titik cek, lalu Absen pulang.
- Titik cek selalu 60 menit sejak absen terakhir. Crew punya 5 menit; lewat itu tetap diterima tapi ditandai terlambat.
- Absen pulang terbuka saat jam selesai sesi. Tidak ada notifikasi push, crew membuka aplikasi sendiri dan melihat hitung mundur.
- Foto diambil langsung dari kamera, otomatis dikecilkan (maks 720 px, WebP) dan disimpan sebagai berkas di `FOTO_DIR`, bukan di database. Metadata EXIF dibuang.
- Lokasi GPS dipantau di latar dan jarak ke titik acara dihitung di server. Di luar radius tetap tersimpan tapi ditandai.
- Titik cek yang terlewat dicatat sebagai catatan saat pulang, tidak memotong honor.
- Foto identik dalam satu sesi ditolak, supaya tidak memakai foto orang lain.
- Halaman admin untuk owner dan superadmin: sahkan, batalkan sah, atau tolak absen; kelola acara, sesi, dan akun crew.

Pengganti kolom `checkAbsent` (1/2) sistem lama: status faktual pakai enum `HadirStatus`, pengesahan pakai `verifiedBy` dan `verifiedAt` (null berarti belum disahkan).

## Jalankan lokal

1. Isi `.env` dari `.env.example` (butuh Postgres).
2. `npm install`
3. `npx prisma migrate deploy`
4. `npm run seed`
5. `npm run dev`

## Akun demo (hasil seed, bukan data asli)

| Peran | Nama untuk login | Password |
|---|---|---|
| Owner | owner | owner123 |
| Superadmin | andrew | super123 |
| Crew | crew | crew123 |

Dua akun crew demo bernama depan sama dan passwordnya sama, jadi login `crew` ditolak. Pakai nama lengkapnya (`crew satu`, `crew dua`).

Catatan: kamera dan GPS hanya berjalan lewat HTTPS atau localhost.

## Produksi

- Variabel lingkungan: `DATABASE_URL`, `AUTH_SECRET` (wajib, aplikasi menolak jalan tanpanya), dan opsional `FOTO_DIR` (default `/data/fotos` di Docker).
- Pasang volume persisten di `/data/fotos`. Isinya foto absen, dan ikut dicadangkan ke NAS tiap malam.
- Jangan jalankan `npm run seed` di produksi, karena membuat akun demo dengan password yang tertulis di atas.
- Data lama yang fotonya masih berupa data URL di database tetap terbaca lewat `/api/foto/[id]`.
