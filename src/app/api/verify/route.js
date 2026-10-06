import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export async function POST(req) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });

  const { id, action } = await req.json().catch(() => ({}));
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
