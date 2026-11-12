// Aturan absen yang berlaku sama di semua sesi.
// Titik cek selalu 60 menit sejak absen terakhir (masuk atau titik cek sebelumnya).
export const JEDA_MENIT = 60;
// Setelah waktunya tiba, crew punya 5 menit. Lewat itu absen tetap diterima tapi ditandai terlambat.
export const BATAS_MENIT = 5;
// Toleransi selisih jam HP dan server saat absen sedikit lebih awal.
export const TOLERANSI_MS = 60000;
