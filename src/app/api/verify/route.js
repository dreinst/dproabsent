import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

const MAKS_MASSAL = 500;

export async function POST(req) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });

  const { id, ids, action } = await req.json().catch(() => ({}));

  // Pengesahan banyak sekaligus: hanya "sahkan", dan hanya absen yang belum disahkan yang disentuh.
  if (ids !== undefined) {
    if (action !== "sahkan") return NextResponse.json({ error: "Aksi massal hanya untuk sahkan." }, { status: 400 });
    const sah = Array.isArray(ids) && ids.length > 0 && ids.length <= MAKS_MASSAL
      && ids.every((n) => Number.isInteger(n) && n > 0);
    if (!sah) return NextResponse.json({ error: `ids harus berisi 1 sampai ${MAKS_MASSAL} bilangan bulat positif.` }, { status: 400 });
    const hasil = await prisma.absensi.updateMany({
      where: { id: { in: ids }, verifiedAt: null },
      data: { verifiedById: user.id, verifiedAt: new Date() },
    });
    return NextResponse.json({ ok: true, jumlah: hasil.count });
  }

  const row = await prisma.absensi.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Data absen tidak ditemukan." }, { status: 404 });

  if (action === "sahkan") {
    await prisma.absensi.update({
      where: { id: row.id },
      data: { verifiedById: user.id, verifiedAt: new Date() },
    });
  } else if (action === "batal") {
    await prisma.absensi.update({
      where: { id: row.id },
      data: { verifiedById: null, verifiedAt: null },
    });
  } else if (action === "tolak") {
    const note = [row.note, `Ditolak oleh ${user.name}`].filter(Boolean).join(". ");
    await prisma.absensi.update({
      where: { id: row.id },
      data: { status: "TIDAK_HADIR", verifiedById: user.id, verifiedAt: new Date(), note },
    });
  } else {
    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
