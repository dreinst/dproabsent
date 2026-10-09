// Label dan warna lencana yang dipakai bersama halaman crew dan admin.
export const KIND = { MASUK: "Masuk", CHECKPOINT: "Titik cek", PULANG: "Pulang" };
export const STATUS = { HADIR: "Hadir", TERLAMBAT: "Terlambat", TIDAK_HADIR: "Tidak hadir" };
export const nadaStatus = (status) => (status === "HADIR" ? "ok" : status === "TERLAMBAT" ? "warn" : "bad");
