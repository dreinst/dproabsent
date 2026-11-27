// Aturan absen. Semuanya berlaku sama di semua sesi, kecuali jarak titik cek yang diatur per sesi.
// Titik cek dihitung sejak absen terakhir (masuk atau titik cek sebelumnya). Sesi baru memakai 60 menit,
// lalu owner atau superadmin bisa mengubahnya per sesi (kolom Session.checkpointMinutes).
export const JEDA_MENIT = 60;
export const JEDA_MIN = 10;
export const JEDA_MAKS = 720;
// Jarak titik cek yang berlaku untuk satu sesi. Sesi impor lama tersimpan 0, jadi memakai jarak bawaan.
export const jedaSesi = (sesi) => (sesi?.checkpointMinutes > 0 ? sesi.checkpointMinutes : JEDA_MENIT);
// Setelah waktunya tiba, crew punya 5 menit. Lewat itu absen tetap diterima tapi ditandai terlambat.
export const BATAS_MENIT = 5;
// Toleransi selisih jam HP dan server saat absen sedikit lebih awal.
export const TOLERANSI_MS = 60000;
// Absen masuk dibuka sekian menit sebelum jam mulai sesi, supaya yang datang lebih awal bisa langsung absen.
// Terlambat tetap dihitung dari jam mulai sesi ditambah toleransinya.
export const BUKA_AWAL_MENIT = 60;
export const jamBukaMasuk = (sesi) => new Date(sesi.startAt).getTime() - BUKA_AWAL_MENIT * 60000;
// Pulang yang dicatat lebih dari 15 menit setelah shift selesai diberi catatan supaya admin tahu jamnya bukan jam pulang sebenarnya.
export const PULANG_TELAT_MENIT = 15;
// Absen sebelum tanggal ini adalah data lama (impor sistem lama dan uji coba). Datanya tetap tersimpan,
// tetapi halaman Verifikasi hanya menampilkannya di Rekap lama.
export const MULAI_DATA_BARU = new Date("2026-11-18T00:00:00+07:00");
