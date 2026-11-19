// Pengambil data untuk rekap upah, slip, dan CSV. Perhitungannya sendiri ada di src/lib/upah.js (fungsi murni).
import { prisma } from "@/lib/prisma";
import { bacaTarif } from "@/lib/pengaturan";
import { hitungUpahAcara } from "@/lib/upah";

// Semua acara untuk pilihan di halaman upah, yang terbaru di atas.
export function daftarAcaraUpah() {
  return prisma.event.findMany({
    select: { id: true, name: true, client: true, startAt: true, endAt: true, active: true },
    orderBy: [{ startAt: "desc" }, { id: "desc" }],
  });
}

// Acara yang dipilih lewat ?acara=, atau bawaannya acara aktif terbaru (kalau tidak ada, acara terbaru).
export function pilihAcara(daftar, idDiminta) {
  return (
    daftar.find((e) => String(e.id) === String(idDiminta ?? "")) ||
    daftar.find((e) => e.active) ||
    daftar[0] ||
    null
  );
}

// Rekap upah satu acara: data acara, tarif yang berlaku, dan hasil hitung per orang.
// Mengembalikan null kalau acaranya tidak ada.
export async function rekapUpah(eventId, sekarang = new Date()) {
  const id = Number(eventId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const acara = await prisma.event.findUnique({
    where: { id },
    include: { sessions: { orderBy: { startAt: "asc" } } },
  });
  if (!acara) return null;

  const idSesi = acara.sessions.map((s) => s.id);
  const [absen, kapten, tarif, dataLama] = await Promise.all([
    idSesi.length
      ? prisma.absensi.findMany({
          where: { sessionId: { in: idSesi } },
          select: { id: true, sessionId: true, userId: true, kind: true, status: true, checkedAt: true, verifiedAt: true, otomatis: true },
        })
      : [],
    prisma.kaptenAcara.findMany({ where: { eventId: id }, select: { userId: true } }),
    bacaTarif(),
    // Data impor sistem lama hanya punya absen masuk, jadi tidak menghasilkan jam dibayar.
    idSesi.length ? prisma.absensi.count({ where: { sessionId: { in: idSesi }, note: { startsWith: "Data lama" } } }) : 0,
  ]);

  const idOrang = [...new Set([...absen.map((a) => a.userId), ...kapten.map((k) => k.userId)])];
  const orang = idOrang.length
    ? await prisma.user.findMany({
        where: { id: { in: idOrang } },
        select: { id: true, name: true, phone: true, role: true, avatar: true, active: true },
      })
    : [];

  const hasil = hitungUpahAcara({
    sesi: acara.sessions,
    absen,
    kapten: kapten.map((k) => k.userId),
    orang,
    tarif,
    sekarang,
  });
  return { acara, tarif, dataLama, ...hasil };
}
