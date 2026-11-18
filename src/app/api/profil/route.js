import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MAKS_BYTE, FotoError } from "@/lib/foto";
import { simpanProfil, hapusProfil } from "@/lib/profil";

// User yang sedang masuk (crew atau admin) mengganti foto profilnya sendiri.
export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const panjang = Number(req.headers.get("content-length") || 0);
  if (panjang > MAKS_BYTE * 1.5) {
    return NextResponse.json({ error: "Ukuran foto terlalu besar." }, { status: 413 });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body.photo !== "string" || !body.photo.startsWith("data:image/")) {
    return NextResponse.json({ error: "Foto wajib diambil dari kamera." }, { status: 400 });
  }

  let baru;
  try {
    baru = await simpanProfil(body.photo);
  } catch (e) {
    if (e instanceof FotoError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const lama = user.avatar;
  try {
    await prisma.user.update({ where: { id: user.id }, data: { avatar: baru.rel } });
  } catch (e) {
    await hapusProfil(baru.rel);
    throw e;
  }
  await hapusProfil(lama);
  return NextResponse.json({ ok: true, avatar: baru.rel });
}
