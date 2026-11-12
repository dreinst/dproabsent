import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { bacaFoto } from "@/lib/foto";

// Foto absen hanya boleh dilihat pemiliknya dan admin (owner/superadmin).
export async function GET(_req, { params }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Belum masuk.", { status: 401 });

  const { id } = await params;
  const row = await prisma.absensi.findUnique({
    where: { id: Number(id) || 0 },
    select: { userId: true, photo: true },
  });
  if (!row || (row.userId !== user.id && !isAdmin(user))) {
    return new NextResponse("Tidak ditemukan.", { status: 404 });
  }

  const foto = await bacaFoto(row.photo);
  if (!foto) return new NextResponse("Foto tidak ada.", { status: 404 });
  return new NextResponse(foto.body, {
    headers: {
      "content-type": foto.type,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
