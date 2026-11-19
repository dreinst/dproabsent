import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { bacaFoto } from "@/lib/foto";
import { kaptenDiSesi } from "@/lib/kapten";

// Foto absen hanya boleh dilihat pemiliknya, admin (owner/superadmin), dan kapten acara tempat absen itu.
export async function GET(_req, { params }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Belum masuk.", { status: 401 });

  const { id } = await params;
  const row = await prisma.absensi.findUnique({
    where: { id: Number(id) || 0 },
    select: { userId: true, sessionId: true, photo: true },
  });
  const boleh = row && (row.userId === user.id || isAdmin(user) || (await kaptenDiSesi(user.id, row.sessionId)));
  if (!boleh) return new NextResponse("Tidak ditemukan.", { status: 404 });

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
