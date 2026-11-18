import { cobaRedis, kunciRedis } from "./redis";

// Cache untuk data yang sama bagi semua crew, misalnya daftar sesi aktif.
// Isinya JSON di Redis, jadi semua worker memakai salinan yang sama dan hapusCache berlaku untuk semuanya.
// Tanpa Redis, cadangannya Map di memori tiap worker dengan TTL yang sama. Dalam mode cadangan,
// hapusCache hanya mengosongkan worker yang menjalankannya; worker lain menyusul saat TTL habis.
// Jangan pakai untuk data user atau sesi login, karena perubahan akses harus langsung berlaku.

export const KUNCI_SESI_AKTIF = "sesi-aktif";

// Disimpan di globalThis karena Next bisa memuat modul yang sama lebih dari sekali dalam satu proses.
const g = (globalThis.__dproCache ??= { peta: new Map(), jalan: new Map() });

// Date disimpan sebagai {"$tanggal": "2026-11-19T01:02:03.000Z"} dan dikembalikan menjadi Date saat dibaca.
// Hanya objek yang isinya persis satu kunci $tanggal yang dianggap tanggal.
const PENANDA = "$tanggal";

function keJson(nilai) {
  const teks = JSON.stringify(nilai, function (k, v) {
    const asli = this[k]; // v sudah berupa string hasil Date.toJSON, jadi nilai aslinya dibaca dari induk
    if (!(asli instanceof Date)) return v;
    return { [PENANDA]: Number.isNaN(asli.getTime()) ? null : asli.toISOString() };
  });
  return teks ?? "null";
}

function dariJson(teks) {
  return JSON.parse(teks, (k, v) =>
    v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 && PENANDA in v
      ? new Date(v[PENANDA] ?? Number.NaN)
      : v
  );
}

const kr = (kunci) => kunciRedis(`cache:${kunci}`);

// Ambil isi cache, atau jalankan fungsi() lalu simpan hasilnya selama ttlDetik.
// Tiap pemanggil mendapat salinan sendiri, jadi aman diubah tanpa mengotori cache.
export async function ambilCache(kunci, ttlDetik, fungsi) {
  const r = await cobaRedis((k) => k.get(kr(kunci)));
  if (r) {
    if (typeof r.nilai === "string") return dariJson(r.nilai);
  } else {
    const e = g.peta.get(kunci);
    if (e && e.sampai > Date.now()) return dariJson(e.teks);
  }

  // Saat cache kosong, permintaan serentak di worker yang sama menunggu satu query yang sama.
  let jalan = g.jalan.get(kunci);
  if (!jalan) {
    jalan = isiUlang(kunci, ttlDetik, fungsi, Boolean(r)).finally(() => g.jalan.delete(kunci));
    g.jalan.set(kunci, jalan);
  }
  return dariJson(await jalan);
}

async function isiUlang(kunci, ttlDetik, fungsi, adaRedis) {
  const teks = keJson(await fungsi());
  if (adaRedis) {
    const r = await cobaRedis((k) => k.set(kr(kunci), teks, { expiration: { type: "EX", value: ttlDetik } }));
    if (r) return teks;
  }
  g.peta.set(kunci, { teks, sampai: Date.now() + ttlDetik * 1000 });
  return teks;
}

export async function hapusCache(kunci) {
  g.peta.delete(kunci);
  await cobaRedis((k) => k.del(kr(kunci)));
}
