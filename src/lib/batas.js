import { cobaRedis, kunciRedis } from "./redis";

// Pembatas percobaan login. Gagal berturut-turut dihitung per kunci (nomor HP, nama, atau IP)
// dalam jendela tetap 15 menit sejak gagal pertama.
// Kalau Redis tersedia, hitungan disimpan di Redis sehingga berlaku untuk semua worker.
// Tanpa Redis (atau saat Redis bermasalah), hitungan disimpan di memori masing-masing worker.
const JENDELA_MS = 15 * 60 * 1000;
const peta = (globalThis.__dproBatas ??= new Map()); // kunci -> { n, sampai }

// INCR, lalu PEXPIRE hanya kalau kunci belum punya masa berlaku. Satu skrip supaya atomik.
const SKRIP_CATAT = `local n = redis.call('INCR', KEYS[1])
if redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return n`;
// Jumlah gagal dan sisa masa berlaku (ms) dibaca sekaligus.
const SKRIP_BACA = `local n = redis.call('GET', KEYS[1])
if not n then return {0, 0} end
return {tonumber(n), redis.call('PTTL', KEYS[1])}`;

const kr = (kunci) => kunciRedis(`batas:${kunci}`);

function ambil(kunci) {
  const now = Date.now();
  const e = peta.get(kunci);
  if (!e || e.sampai <= now) { peta.delete(kunci); return null; }
  return e;
}

// Detik yang harus ditunggu sebelum kunci ini boleh mencoba lagi (0 berarti boleh).
export async function sisaTunggu(kunci, maks) {
  const r = await cobaRedis((k) => k.eval(SKRIP_BACA, { keys: [kr(kunci)] }));
  if (r) {
    const [n, sisaMs] = r.nilai.map(Number);
    return n >= maks && sisaMs > 0 ? Math.ceil(sisaMs / 1000) : 0;
  }
  const e = ambil(kunci);
  return e && e.n >= maks ? Math.ceil((e.sampai - Date.now()) / 1000) : 0;
}

export async function catatGagal(kunci) {
  const r = await cobaRedis((k) => k.eval(SKRIP_CATAT, { keys: [kr(kunci)], arguments: [String(JENDELA_MS)] }));
  if (r) return;
  const e = ambil(kunci);
  if (e) e.n += 1;
  else peta.set(kunci, { n: 1, sampai: Date.now() + JENDELA_MS });
  if (peta.size > 5000) for (const [k, v] of peta) if (v.sampai <= Date.now()) peta.delete(k);
}

export async function hapusCatatan(kunci) {
  // Catatan di memori ikut dihapus, kalau-kalau tercatat saat Redis sempat tidak tersedia.
  peta.delete(kunci);
  await cobaRedis((k) => k.del(kr(kunci)));
}
