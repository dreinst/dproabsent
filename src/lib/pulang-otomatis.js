import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { MULAI_DATA_BARU } from "./aturan";
import { TANPA_FOTO } from "./foto";

// Pulang otomatis: crew yang sudah absen masuk tetapi belum absen pulang sampai 1 jam setelah jam selesai sesi
// dicatatkan PULANG oleh sistem. Jamnya jam selesai sesi, lokasinya titik acara, tanpa foto, bertanda otomatis,
// dan belum disahkan, karena kapten atau admin yang memutuskan.
// Dijalankan tiap 60 detik oleh src/instrumentation.js di setiap worker. Aman walau beberapa proses jalan bersamaan:
// hanya satu proses yang mendapat kunci advisory dalam satu waktu, dan INSERT memeriksa ulang lewat NOT EXISTS.

export const TUNGGU_PULANG_MENIT = 60;
export const CATATAN_PULANG_OTOMATIS = "Tidak absen pulang. Pulang dicatat otomatis oleh sistem pada jam selesai sesi.";
const JEDA_MS = 60000;
// Kunci pg_advisory untuk pekerjaan ini. Angka bebas, asal tidak dipakai pekerjaan lain di database yang sama.
const KUNCI = 7260418;

// Kolom waktu bertipe timestamp tanpa zona dan berisi jam UTC, sedangkan Prisma mengirim Date sebagai timestamptz.
// Supaya perbandingan tidak bergeser mengikuti zona sesi database, waktu dikirim sebagai teks ISO lalu diubah ke jam UTC.
const jamUtc = (d) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

// Absen masuk (m) dan sesinya (s) yang perlu dicatatkan pulang. Data impor lama, absen yang ditolak,
// dan sesi yang selesai sebelum MULAI_DATA_BARU tidak disentuh.
function syarat(kini) {
  const batas = new Date(kini.getTime() - TUNGGU_PULANG_MENIT * 60000);
  return Prisma.sql`
    m.kind = 'MASUK' AND m.status <> 'TIDAK_HADIR'
    AND COALESCE(m.note, '') NOT LIKE 'Data lama%'
    AND s."endAt" < ${jamUtc(batas)} AND s."endAt" >= ${jamUtc(MULAI_DATA_BARU)}
    AND NOT EXISTS (
      SELECT 1 FROM "Absensi" p
      WHERE p."sessionId" = m."sessionId" AND p."userId" = m."userId" AND p.kind = 'PULANG')`;
}

// Satu putaran. Hasilnya jumlah absen pulang yang dicatat.
export async function catatPulangOtomatis(kini = new Date()) {
  // Pemeriksaan ringan tanpa transaksi dulu. Hampir selalu tidak ada yang perlu dicatat.
  const [{ ada }] = await prisma.$queryRaw`
    SELECT EXISTS (SELECT 1 FROM "Absensi" m JOIN "Session" s ON s.id = m."sessionId" WHERE ${syarat(kini)}) AS ada`;
  if (!ada) return 0;

  return prisma.$transaction(async (tx) => {
    // Kunci dilepas sendiri saat transaksi selesai. Proses lain yang tidak mendapatkannya melewati putaran ini.
    const [{ dapat }] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${KUNCI}::bigint) AS dapat`;
    if (!dapat) return 0;
    // DISTINCT ON: satu pulang per crew per sesi walau absen masuknya tercatat lebih dari sekali.
    // photoHash unik per sesi dan crew supaya tidak bentrok dengan pemeriksaan foto identik.
    return tx.$executeRaw`
      INSERT INTO "Absensi" ("sessionId", "userId", kind, status, "checkedAt", lat, lng, "distanceM", "insideRadius",
        photo, "photoHash", note, otomatis, "createdAt")
      SELECT DISTINCT ON (m."sessionId", m."userId")
        m."sessionId", m."userId", 'PULANG'::"AbsenKind", 'HADIR'::"HadirStatus", s."endAt", e.lat, e.lng, 0, true,
        ${TANPA_FOTO}, encode(sha256(convert_to('pulang-otomatis:' || m."sessionId" || ':' || m."userId", 'UTF8')), 'hex'),
        ${CATATAN_PULANG_OTOMATIS}, true, ${jamUtc(kini)}
      FROM "Absensi" m JOIN "Session" s ON s.id = m."sessionId" JOIN "Event" e ON e.id = s."eventId"
      WHERE ${syarat(kini)}
      ORDER BY m."sessionId", m."userId", m."checkedAt"`;
  }, { maxWait: 5000, timeout: 20000 });
}

// Penjadwal satu per proses. Disimpan di globalThis supaya pemanggilan ganda tidak membuat dua penjadwal.
const g = (globalThis.__dproPulangOtomatis ??= { timer: null, jalan: false, galatTerakhir: 0 });

export function mulaiPulangOtomatis() {
  if (g.timer) return;
  const putaran = async () => {
    if (g.jalan) return; // putaran sebelumnya belum selesai
    g.jalan = true;
    try {
      const n = await catatPulangOtomatis();
      // Log hanya kalau ada baris baru.
      if (n > 0) console.log(`[pulang-otomatis ${process.pid}] ${n} absen pulang dicatat otomatis`);
    } catch (e) {
      // Galat dicatat paling sering sekali per 10 menit per proses, supaya log tidak banjir saat database bermasalah.
      if (Date.now() - g.galatTerakhir > 600000) {
        g.galatTerakhir = Date.now();
        console.error(`[pulang-otomatis ${process.pid}] gagal: ${e?.message || e}`);
      }
    } finally {
      g.jalan = false;
    }
  };
  // Putaran pertama diacak 5 sampai 15 detik setelah proses hidup, supaya worker yang hidup bersamaan tidak serentak.
  setTimeout(putaran, 5000 + Math.floor(Math.random() * 10000)).unref();
  g.timer = setInterval(putaran, JEDA_MS);
  g.timer.unref();
}
