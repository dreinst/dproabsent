# DPro Absen

Absensi crew D'Production berbasis web: login nomor HP, absen dengan foto kamera dan lokasi GPS, dengan batas radius acara. Verifikasi oleh owner dan superadmin.

## Fitur

- Login crew dan admin pakai nomor HP dan password.
- Absen MASUK, titik cek berkala, dan PULANG. Foto diambil langsung dari kamera, lokasi dari GPS.
- Jarak ke titik acara dihitung di server. Di luar radius tetap tersimpan tapi ditandai.
- Titik cek yang terlewat dicatat sebagai catatan saat pulang, tidak memotong honor.
- Foto identik dalam satu sesi ditolak, supaya tidak memakai foto orang lain.
- Halaman admin untuk owner dan superadmin: sahkan, batalkan sah, atau tolak absen.

Pengganti kolom `checkAbsent` (1/2) sistem lama: status faktual pakai enum `HadirStatus`, pengesahan pakai `verifiedBy` dan `verifiedAt` (null berarti belum disahkan).

## Jalankan lokal

1. Isi `.env` dari `.env.example` (butuh Postgres).
2. `npm install`
3. `npx prisma migrate deploy`
4. `npm run seed`
5. `npm run dev`

## Akun demo (hasil seed, bukan data asli)

| Peran | Nomor HP | Password |
|---|---|---|
| Owner | 628000000001 | owner123 |
| Superadmin | 628000000002 | super123 |
| Crew | 628000000011 | crew123 |
| Crew | 628000000012 | crew123 |

Catatan: kamera dan GPS hanya berjalan lewat HTTPS atau localhost.
