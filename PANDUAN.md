# Panduan Web Absen D'Pro

Alamat: https://absen.dpro.events

Panduan ini untuk superadmin. Bagian crew bisa diteruskan ke tim lapangan.

## Masuk

1. Buka web absen di HP. Kamera dan lokasi hanya jalan lewat HTTPS, jadi pakai alamat di atas.
2. Isi Nomor HP yang terdaftar, diketik seperti biasa dengan awalan 08. Contoh: `081234564321`. Awalan 62 atau +62 juga diterima.
3. Isi password, lalu tekan Masuk.

Password awal crew adalah nama depan huruf kecil ditambah 4 angka terakhir nomor HP yang terdaftar. Rama dengan nomor 0812xxxx4321 memakai `rama4321`.

Salah password 5 kali membuat nomor itu terkunci 15 menit.

Crew masuk ke halaman absen. Owner dan superadmin masuk ke halaman admin.

## Untuk crew

Layar crew punya satu tombol besar yang berganti sendiri:

1. Absen masuk saat tiba di lokasi.
2. Absen titik cek tiap 60 menit sejak absen terakhir. Layar menampilkan hitung mundurnya. Saat waktunya tiba, crew punya 5 menit. Lewat dari itu absen tetap diterima tapi ditandai terlambat.
3. Absen pulang, yang baru terbuka saat jam selesai sesi.

Tidak ada notifikasi, jadi crew membuka aplikasinya sendiri untuk melihat hitung mundur.

Setiap absen butuh foto langsung dari kamera dan lokasi GPS. Izinkan keduanya saat browser bertanya. Setelah memotret, crew mengetik singkat sedang mengerjakan apa, lalu menekan Kirim. Foto yang sama persis dalam satu sesi ditolak.

Absen di luar radius acara tetap tersimpan, tapi ditandai. Titik cek yang terlewat dicatat saat pulang dan tidak memotong honor. Riwayat absen bisa dibuka lewat tautan "Lihat riwayat absen saya" di bawah layar.

## Untuk superadmin

Halaman admin punya tiga bagian:

- Verifikasi absen: sahkan, batalkan sah, atau tolak absen crew. Foto, jarak ke lokasi, keterangan crew, dan catatan otomatis (terlambat, di luar radius, akurasi GPS rendah) tampil di tiap absen.
- Acara: buat acara, atur titik lokasi dan radius absen dalam meter, lalu tambah sesi tugas seperti Loading, Gladi, dan Event. Tiap sesi punya jam mulai, jam selesai, dan batas telat masuk. Titik cek selalu tiap 60 menit dan tidak bisa diubah.
- Crew: tambah akun, ganti password, nonaktifkan akun, dan isi rekening bank. Rekening hanya terlihat oleh owner dan superadmin.

Akun yang dinonaktifkan tidak bisa masuk, tapi riwayat absennya tetap ada.

Jam selesai sesi menentukan kapan tombol pulang muncul, jadi isi dengan jam selesai shift yang sebenarnya.

## Kalau ada masalah

- Lokasi tidak terbaca: nyalakan GPS dan izinkan lokasi untuk browser, lalu muat ulang halaman.
- Kamera tidak muncul: periksa izin kamera di pengaturan browser.
- Lupa password: superadmin menggantinya di menu Crew.
- Terkunci: tunggu 15 menit.
- Tombol titik cek abu-abu: belum 60 menit sejak absen terakhir, lihat hitung mundurnya.
