// Semua jam ditampilkan dan diisi dalam WIB, apa pun zona waktu server (container VPS jalan di UTC).
export const TZ = "Asia/Jakarta";

const buat = (opsi) => {
  const f = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...opsi });
  return (d) => f.format(d);
};

export const fmtWaktu = buat({
  weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
export const fmtTanggal = buat({ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtSingkat = buat({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Date -> nilai <input type="datetime-local"> dalam WIB.
export const keInput = (d) => (d ? new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16) : "");

// Nilai datetime-local (dibaca sebagai WIB) -> Date, atau null kalau kosong/rusak.
export function dariInput(s) {
  const d = new Date(`${String(s || "").slice(0, 16)}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
