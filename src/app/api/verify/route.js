import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { hakKapten, petaKapten } from "@/lib/kapten";

const MAKS_MASSAL = 500;
const AKSI = ["sahkan", "tolak", "batal"];
const galat = (pesan, status) => NextResponse.json({ error: pesan }, { status });
// Data absen yang dibutuhkan untuk memeriksa hak kapten (lihat hakKapten di src/lib/kapten.js).
const PILIH = {
  id: true, userId: true, note: true, verifiedAt: true, verifiedById: true,
  user: { select: { role: true } }, session: { select: { eventId: true } },
};

// Sahkan, tolak, atau batalkan pengesahan absen.
// Owner dan superadmin boleh mengubah semuanya. Kapten hanya untuk absen crew di acara yang ia pegang,
// bukan absen dirinya sendiri atau kapten lain, dan hanya boleh membatalkan pengesahan yang ia buat sendiri.
export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return galat("Sesi masuk Anda sudah berakhir. Silakan masuk kembali.", 401);
  const admin = isAdmin(user);
  if (!admin) {
    const kapten = await prisma.kaptenAcara.findFirst({ where: { userId: user.id }, select: { eventId: true } });
    if (!kapten) return galat("Hanya owner, superadmin, dan kapten acara yang dapat mengesahkan absen.", 403);
  }

  const { id, ids, action } = await req.json().catch(() => ({}));

  // Pengesahan banyak sekaligus: hanya "sahkan", dan hanya absen yang belum disahkan yang disentuh.
  if (ids !== undefined) {
    if (action !== "sahkan") return galat("Aksi massal hanya untuk sahkan.", 400);
    const sah = Array.isArray(ids) && ids.length > 0 && ids.length <= MAKS_MASSAL
      && ids.every((n) => Number.isInteger(n) && n > 0);
    if (!sah) return galat(`ids harus berisi 1 sampai ${MAKS_MASSAL} bilangan bulat positif.`, 400);
    if (!admin) {
      // Kapten: semua id harus memenuhi aturan. Satu saja yang tidak, seluruh permintaan ditolak.
      const rows = await prisma.absensi.findMany({ where: { id: { in: ids } }, select: PILIH });
      if (rows.length !== new Set(ids).size) {
        return galat("Sebagian absen tidak ditemukan. Tidak ada absen yang disahkan.", 403);
      }
      const peta = await petaKapten([...new Set(rows.map((r) => r.session.eventId))]);
      const alasan = rows.map((r) => hakKapten(user.id, r, peta.get(r.session.eventId)).alasan).find(Boolean);
      if (alasan) return galat(`${alasan} Tidak ada absen yang disahkan.`, 403);
    }
    const hasil = await prisma.absensi.updateMany({
      where: { id: { in: ids }, verifiedAt: null },
      data: { verifiedById: user.id, verifiedAt: new Date() },
    });
    return NextResponse.json({ ok: true, jumlah: hasil.count });
  }

  if (!AKSI.includes(action)) return galat("Aksi tidak dikenal.", 400);
  const rowId = Number(id);
  if (!Number.isInteger(rowId) || rowId <= 0) return galat("Data absen tidak dikenali.", 400);
  const row = await prisma.absensi.findUnique({ where: { id: rowId }, select: PILIH });
  if (!row) return galat("Data absen tidak ditemukan.", 404);

  // Perubahan oleh kapten diberi syarat di klausa where, supaya keputusan orang lain yang masuk
  // di antara pemeriksaan dan penyimpanan tidak tertimpa.
  let syarat = {};
  if (!admin) {
    const peta = await petaKapten([row.session.eventId]);
    const hak = hakKapten(user.id, row, peta.get(row.session.eventId));
    if (hak.alasan) return galat(hak.alasan, 403);
    if (action === "batal") {
      if (!hak.batal) return galat("Kapten hanya dapat membatalkan pengesahan yang dibuatnya sendiri.", 403);
      syarat = { verifiedById: user.id };
    } else {
      if (!hak.putus) return galat("Absen ini sudah diputuskan oleh owner, superadmin, atau kapten lain.", 403);
      syarat = { OR: [{ verifiedAt: null }, { verifiedById: user.id }] };
    }
  }

  let data;
  if (action === "sahkan") {
    data = { verifiedById: user.id, verifiedAt: new Date() };
  } else if (action === "batal") {
    data = { verifiedById: null, verifiedAt: null };
  } else {
    const oleh = `Ditolak oleh ${user.name}${admin ? "" : " (Kapten)"}`;
    data = { status: "TIDAK_HADIR", verifiedById: user.id, verifiedAt: new Date(), note: [row.note, oleh].filter(Boolean).join(". ") };
  }
  const hasil = await prisma.absensi.updateMany({ where: { id: row.id, ...syarat }, data });
  if (hasil.count === 0) return galat("Absen ini baru saja diubah oleh pengesah lain. Silakan muat ulang halaman.", 409);
  return NextResponse.json({ ok: true });
}
