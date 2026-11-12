// Pembatas percobaan login di memori. Aplikasi jalan sebagai satu proses, jadi cukup Map.
// Gagal berturut-turut dihitung per kunci (nomor HP atau IP) dalam jendela waktu tetap.
const JENDELA_MS = 15 * 60 * 1000;
const peta = new Map(); // kunci -> { n, sampai }

function ambil(kunci) {
  const now = Date.now();
  const e = peta.get(kunci);
  if (!e || e.sampai <= now) { peta.delete(kunci); return null; }
  return e;
}

export function sisaTunggu(kunci, maks) {
  const e = ambil(kunci);
  return e && e.n >= maks ? Math.ceil((e.sampai - Date.now()) / 1000) : 0;
}

export function catatGagal(kunci) {
  const e = ambil(kunci);
  if (e) e.n += 1;
  else peta.set(kunci, { n: 1, sampai: Date.now() + JENDELA_MS });
  if (peta.size > 5000) for (const [k, v] of peta) if (v.sampai <= Date.now()) peta.delete(k);
}

export function hapusCatatan(kunci) {
  peta.delete(kunci);
}
