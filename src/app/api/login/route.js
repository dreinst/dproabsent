import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPasswordAsync } from "@/lib/password";
import { setSession, normalizePhone } from "@/lib/auth";
import { sisaTunggu, catatGagal, hapusCatatan } from "@/lib/batas";
import { rapikanNama, namaDepan } from "@/lib/nama";

const MAKS_PER_NOMOR = 5;
// Ratusan crew di satu WiFi venue berbagi satu IP, jadi batas per IP dibuat longgar. Batas utama tetap per nomor.
const MAKS_PER_IP = 300;

export async function POST(req) {
  const { phone, password } = await req.json().catch(() => ({}));
  const isian = String(phone || "").trim();
  // Isian berhuruf berarti nama: jalur ini hanya untuk owner dan superadmin.
  // Crew selalu masuk pakai nomor. Mereka mengetik 08..., database menyimpan 628...
  const pakaiNama = /[a-z]/i.test(isian);
  const nomor = pakaiNama ? rapikanNama(isian) : normalizePhone(isian);
  if (!nomor || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Nomor HP dan password wajib diisi." }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "tanpa-ip";
  const kunciNomor = `${pakaiNama ? "nama" : "nomor"}:${nomor.slice(0, 40)}`;
  const kunciIp = `ip:${ip}`;
  const tunggu = Math.max(...(await Promise.all([sisaTunggu(kunciNomor, MAKS_PER_NOMOR), sisaTunggu(kunciIp, MAKS_PER_IP)])));
  if (tunggu > 0) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan masuk. Silakan coba lagi dalam ${Math.ceil(tunggu / 60)} menit.` },
      { status: 429, headers: { "retry-after": String(tunggu) } }
    );
  }

  let user = null;
  if (pakaiNama) {
    // Nama depan atau nama lengkap, huruf besar dan tanda baca diabaikan ("andrew" cocok dengan "Andrew (Superadmin)").
    const admin = await prisma.user.findMany({
      where: { active: true, role: { in: ["OWNER", "SUPERADMIN"] } },
      select: { id: true, name: true, role: true, active: true, passwordHash: true },
    });
    const senama = admin.filter((u) => rapikanNama(u.name) === nomor || namaDepan(u.name) === nomor);
    if (senama.length === 1) user = senama[0];
  } else {
    user = await prisma.user.findUnique({
      where: { phone: nomor },
      select: { id: true, role: true, active: true, passwordHash: true },
    });
  }
  // Akun tidak ada atau nonaktif tetap diverifikasi ke hash palsu supaya waktu jawabnya sama.
  const sah = await verifyPasswordAsync(password, user?.active ? user.passwordHash : undefined);
  if (!sah) {
    await Promise.all([catatGagal(kunciNomor), catatGagal(kunciIp)]);
    // Pesan sama untuk nomor dan nama, supaya halaman masuk tidak membocorkan cara masuk owner dan superadmin.
    return NextResponse.json({ error: "Nomor HP atau password salah." }, { status: 401 });
  }

  await hapusCatatan(kunciNomor);
  await setSession(user.id, user.role);
  return NextResponse.json({ ok: true, role: user.role });
}
