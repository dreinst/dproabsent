import { createClient } from "redis";

// Satu koneksi Redis per proses (per worker cluster), dibuat saat pertama dipakai.
// Redis hanya pelengkap. Kalau REDIS_URL kosong, atau Redis mati, putus, atau lambat,
// ambilRedis() mengembalikan null dan pemakainya memakai cadangan di memori.
// Aplikasi tidak boleh ikut mati karena Redis.

const BATAS_SAMBUNG_MS = 1000; // batas membuka koneksi; permintaan pertama sesudah klien dibuat menunggu kira-kira selama ini
const BATAS_PERINTAH_MS = 1000; // satu perintah lebih lama dari ini dianggap macet
const REHAT_MS = 5000; // setelah perintah macet, koneksi dibuang dan Redis tidak dipakai selama ini

// Disimpan di globalThis karena Next bisa memuat modul yang sama lebih dari sekali dalam satu proses.
const g = (globalThis.__dproRedis ??= { klien: null, tungguAwal: null, rehatSampai: 0, logTerakhir: 0, awalan: null });

// Semua kunci diberi awalan. Bawaannya memakai nama database, supaya instance uji dan produksi
// yang kebetulan memakai Redis yang sama tidak saling membaca cache dan hitungan login.
export function kunciRedis(kunci) {
  if (!g.awalan) {
    let db = "";
    try {
      db = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1));
    } catch {}
    g.awalan = process.env.REDIS_PREFIX || `dproabsent:${db || "app"}:`;
  }
  return g.awalan + kunci;
}

// Galat Redis dicatat paling sering sekali per 30 detik per worker, supaya log tidak banjir saat Redis mati.
function catatGalat(e) {
  const now = Date.now();
  if (now - g.logTerakhir < 30000) return;
  g.logTerakhir = now;
  console.warn(`[redis ${process.pid}] ${e?.code || e?.name || "galat"}: ${e?.message || e}. Memakai cadangan memori.`);
}

function buatKlien(url) {
  const klien = createClient({
    url,
    RESP: 2,
    // Perintah langsung ditolak saat koneksi putus, tidak ditahan sampai tersambung lagi.
    disableOfflineQueue: true,
    // PING tiap 10 detik membuat koneksi sehat tidak pernah diam 30 detik. Koneksi yang diam selama itu
    // (Redis berhenti menjawab, termasuk saat jabat tangan) diputus lalu disambung ulang.
    pingInterval: 10000,
    socket: {
      connectTimeout: BATAS_SAMBUNG_MS,
      socketTimeout: 30000,
      // Terus mencoba menyambung lagi di latar, paling jarang tiap 5 detik.
      reconnectStrategy: (n) => Math.min(250 * 2 ** n, 5000),
    },
  });
  klien.on("error", catatGalat);
  klien.on("ready", () => console.log(`[redis ${process.pid}] tersambung`));
  // connect() baru selesai saat tersambung. Selama Redis mati, janji ini menggantung dan itu tidak apa-apa.
  klien.connect().catch(catatGalat);
  return klien;
}

// Selesai saat klien siap, saat percobaan sambung pertama gagal, atau saat batas waktu habis.
function tungguSiap(klien, ms) {
  return new Promise((selesai) => {
    const beres = () => {
      clearTimeout(t);
      klien.off("ready", beres);
      klien.off("error", beres);
      selesai();
    };
    const t = setTimeout(beres, ms);
    klien.once("ready", beres);
    klien.once("error", beres);
  });
}

// Klien yang siap dipakai, atau null kalau Redis tidak tersedia saat ini.
export async function ambilRedis() {
  const url = process.env.REDIS_URL;
  if (!url || Date.now() < g.rehatSampai) return null;
  if (!g.klien) {
    try {
      g.klien = buatKlien(url);
    } catch (e) {
      // Biasanya REDIS_URL salah tulis (mis. tanpa redis://). Dicoba lagi semenit kemudian supaya tetap tercatat di log.
      catatGalat(e);
      g.rehatSampai = Date.now() + 60000;
      return null;
    }
    g.tungguAwal = tungguSiap(g.klien, BATAS_SAMBUNG_MS + 200).finally(() => {
      g.tungguAwal = null;
    });
  }
  if (g.tungguAwal) await g.tungguAwal;
  return g.klien?.isReady ? g.klien : null;
}

class GalatLambat extends Error {
  constructor() {
    super(`perintah Redis lebih dari ${BATAS_PERINTAH_MS} ms`);
    this.name = "RedisLambat";
  }
}

// Jalankan fn(klien) dengan batas waktu. Hasilnya { nilai } kalau berhasil, atau null kalau Redis
// tidak ada, putus, membalas galat, atau terlalu lama. Kalau null, pemanggil memakai cadangan memori.
export async function cobaRedis(fn) {
  const klien = await ambilRedis();
  if (!klien) return null;
  let timer;
  const kerja = Promise.resolve().then(() => fn(klien));
  kerja.catch(() => {}); // kalau batas waktu menang duluan, galat susulan dari kerja diabaikan
  try {
    const nilai = await Promise.race([
      kerja,
      new Promise((_, tolak) => {
        timer = setTimeout(() => tolak(new GalatLambat()), BATAS_PERINTAH_MS);
      }),
    ]);
    return { nilai };
  } catch (e) {
    catatGalat(e);
    if (e instanceof GalatLambat && g.klien === klien) {
      // Koneksi yang macet (tersambung tapi tidak menjawab) dibuang. Sesudah rehat, koneksi baru dibuat.
      g.klien = null;
      g.rehatSampai = Date.now() + REHAT_MS;
      try {
        klien.destroy();
      } catch {}
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
