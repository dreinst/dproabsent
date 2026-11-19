# Panduan Web Absen D'Pro

Alamat: https://absen.dpro.events

Panduan ini untuk superadmin. Bagian crew bisa diteruskan ke tim lapangan.

## Masuk

1. Buka web absen di HP. Kamera dan lokasi hanya jalan lewat HTTPS, jadi pakai alamat di atas.
2. Isi Nomor HP yang terdaftar, diketik seperti biasa dengan awalan 08. Contoh: `081234564321`. Awalan 62 atau +62 juga diterima.
3. Isi password, lalu tekan Masuk.

Password crew diberikan kantor.

Owner dan superadmin tidak perlu nomor: di kolom yang sama, isi `owner` atau `superadmin`, lalu password. Tidak ada tombol pilihan, web langsung mengenali nomor atau nama.

Salah password 5 kali membuat nomor atau nama itu terkunci 15 menit.

Login crew berlaku 30 hari, jadi crew cukup masuk sekali sebelum tiba di lokasi. Login owner dan superadmin berlaku 12 jam.

Di halaman masuk ada blok "Perlu bantuan?" untuk langsung menghubungi Andrew lewat WhatsApp: Nomor belum terdaftar, Kendala password, atau Kendala lain. Kalau masuk gagal, tombol yang sesuai juga muncul di bawah pesan galatnya.

Crew masuk ke halaman absen. Owner dan superadmin masuk ke halaman admin.

## Untuk crew

Di bagian atas ada foto profil crew. Foto awalnya diambil dari foto profil WhatsApp kalau terlihat. Crew bisa memasang atau menggantinya sendiri lewat "Pasang foto profil" atau "Ganti foto profil", memakai kamera depan. Di bagian bawah ada tombol "Hubungi Andrew" untuk kendala saat absen.

Layar crew punya satu tombol besar yang berganti sendiri:

1. Absen masuk saat tiba di lokasi.
2. Absen progres sesuai jarak sesinya (bawaan 60 menit) sejak absen terakhir. Jaraknya tertulis di kartu sesi. Layar menampilkan hitung mundurnya. Saat waktunya tiba, crew punya 5 menit. Lewat dari itu absen tetap diterima tapi ditandai terlambat.
3. Absen pulang, yang baru terbuka saat jam selesai sesi.

Tidak ada notifikasi, jadi crew membuka aplikasinya sendiri untuk melihat hitung mundur.

Setiap absen butuh foto langsung dari kamera dan lokasi GPS. Izinkan keduanya saat browser bertanya. Setelah memotret, crew mengisi kolom "Yang dikerjakan", lalu menekan Kirim. Foto yang sama persis dalam satu sesi ditolak.

Absen di luar radius acara tetap tersimpan, tapi ditandai. Absen progres yang terlewat dicatat saat pulang. Kalau lupa absen pulang, crew masih bisa menyusul selama acaranya aktif. Jam yang tercatat adalah jam saat tombol ditekan, dan absennya diberi catatan berapa menit setelah shift selesai. Riwayat absen bisa dibuka lewat tautan "Lihat riwayat absen saya" di bawah layar.

## Untuk superadmin

Halaman admin punya tiga bagian:

- Verifikasi absen: sahkan, batalkan sah, atau tolak absen crew. Foto, jarak ke lokasi, keterangan crew, dan catatan otomatis (terlambat, di luar radius, akurasi GPS rendah) tampil di tiap absen. Absen dikelompokkan per crew per sesi, dengan jam tertulis di setiap foto. Tombol "Sahkan semua" mengesahkan semua absen crew itu di sesi tersebut sekaligus. Ketuk foto untuk memperbesarnya. Di foto besar, satu absen tetap bisa disahkan, ditolak, atau dibatalkan sahnya sendiri. Semua halaman admin memperbarui datanya sendiri tiap 1 menit, kecuali saat sedang mengetik atau melihat foto besar. Halaman ini hanya menghitung absen mulai 18 Nov 2026. Absen sebelum itu ada di pilihan "Rekap lama". Absen bisa dipilih per acara, lalu disaring per status: Belum disahkan (tampilan bawaan), Terlambat, Belum pulang, Di luar radius, dan Semua.
- Acara: buat acara, atur titik lokasi dan radius absen dalam meter, lalu tambah sesi tugas seperti Loading, Gladi, dan Event. Tiap sesi punya jam mulai, jam selesai, batas telat masuk, dan jarak absen progres. Jarak absen progres bawaannya 60 menit dan bisa diubah per sesi antara 10 dan 720 menit, juga saat sesinya sedang berjalan.
- Crew: tambah akun, ganti password, nonaktifkan akun, dan isi rekening bank. Rekening hanya terlihat oleh owner dan superadmin. Nama selalu disimpan dengan huruf kapital di awal setiap kata, walaupun diketik huruf kecil semua atau kapital semua. Nama yang diketik campuran, misalnya "Aldi (PMI)", hanya dikapitalkan huruf pertamanya.
- Halaman Acara dan Crew bawaannya hanya menampilkan data yang aktif mulai 18 Nov 2026. Data sebelumnya ada di pilihan "Rekap lama". Kotak cari selalu mencari di semua data. Foto profil crew tampil di daftar Crew dan di kartu Verifikasi, untuk dicocokkan dengan foto absen. Crew tanpa foto ditampilkan dengan inisial namanya.

Akun yang dinonaktifkan tidak bisa masuk, tapi riwayat absennya tetap ada.

Jam selesai sesi menentukan kapan tombol pulang muncul, jadi isi dengan jam selesai shift yang sebenarnya.

Crew yang lupa absen pulang muncul di menu Verifikasi, tab "Belum pulang". Tombol "Catat pulang" mencatatkan pulangnya di jam selesai shift, tanpa foto, dan langsung sah. Tombol ini tetap bisa dipakai setelah acaranya dinonaktifkan.

## Kapten

Owner atau superadmin menunjuk kapten di halaman detail acara, bagian "Kapten acara". Satu acara boleh punya lebih dari satu kapten, dan kapten bisa diganti kapan saja. Kapten tetap absen seperti crew.

Kapten membuka "Panel kapten" dari halaman absennya. Di sana kapten mengesahkan atau menolak absen crew di acara yang dipegangnya, termasuk lewat tombol "Sahkan semua". Kapten tidak bisa memutuskan absen dirinya sendiri, kapten lain, owner, atau superadmin; absen tersebut diputuskan owner atau superadmin. Kapten hanya bisa membatalkan pengesahan yang ia buat sendiri. Di menu Verifikasi, setiap absen menampilkan siapa yang mengesahkan atau menolak, dengan tanda "(Kapten)" bila diputuskan kapten. Owner dan superadmin tetap bisa mengubah semua keputusan.

## Pulang otomatis

Crew yang belum absen pulang sampai 1 jam setelah jam selesai sesi dicatat pulang otomatis oleh sistem pada jam selesai sesi, dengan keterangan "Tidak absen pulang". Absen ini belum disahkan; kapten atau admin yang memutuskan. Sebelum 1 jam lewat, crew masih bisa absen pulang sendiri. Absen pulang kedua untuk sesi yang sama ditolak.

## Upah dan slip gaji

Menu Upah menampilkan rekap upah per acara, unduhan CSV, dan slip upah per orang yang bisa dicetak atau disimpan sebagai PDF. Tarif bisa diubah owner atau superadmin lewat tombol "Ubah tarif". Tarif berlaku untuk semua acara, termasuk rekap acara lama.

- Crew dibayar per jam (awal Rp15.000). Jam yang dibayar hanya waktu kerja yang terbukti lewat absen yang sudah disahkan. Setiap absen yang sah membayar rentang sejak absen sebelumnya, paling lama sebesar jarak absen progres sesi ditambah 5 menit, dan dihitung di dalam jadwal sesi. Waktu tanpa absen progres, termasuk lembur tanpa progres, tidak dibayar. Lembur yang direncanakan dicatat dengan memperpanjang jam selesai sesi.
- Waktu kerja di atas 8 jam per sesi ditampilkan sebagai lembur dan dibayar dengan tarif per jam yang sama.
- Absen yang ditolak tidak dihitung. Sesi dengan absen masuk yang ditolak tidak dibayar. Absen yang belum disahkan belum dihitung dan tampil di kolom "Menunggu".
- Kapten dibayar per hari (awal Rp200.000) untuk setiap tanggal ia punya absen masuk yang sah di acara yang dipegangnya.

## Kalau ada masalah

- Lokasi tidak terbaca: nyalakan GPS dan izinkan lokasi untuk browser, lalu muat ulang halaman.
- Kamera tidak muncul: periksa izin kamera di pengaturan browser.
- Lupa password: superadmin menggantinya di menu Crew.
- Terkunci: tunggu 15 menit.
- Tombol "Absen progres" abu-abu: jarak absen progres sesi itu belum lewat sejak absen terakhir, lihat hitung mundurnya.
