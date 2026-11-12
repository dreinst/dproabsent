import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPasswordAsync } from "@/lib/password";
import { normalizePhone, setSession } from "@/lib/auth";
import { sisaTunggu, catatGagal, hapusCatatan } from "@/lib/batas";

const MAKS_PER_NOMOR = 5;
const MAKS_PER_IP = 40;

export async function POST(req) {
  const { phone, password } = await req.json().catch(() => ({}));
  const p = normalizePhone(phone);
  if (!p || !password) {
    return NextResponse.json({ error: "Nomor HP dan password wajib diisi." }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "tanpa-ip";
  const kunciNomor = `nomor:${p}`;
  const kunciIp = `ip:${ip}`;
  const tunggu = Math.max(sisaTunggu(kunciNomor, MAKS_PER_NOMOR), sisaTunggu(kunciIp, MAKS_PER_IP));
  if (tunggu > 0) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(tunggu / 60)} menit.` },
      { status: 429, headers: { "retry-after": String(tunggu) } }
    );
  }

  const user = await prisma.user.findUnique({ where: { phone: p } });
  const cocok = await verifyPasswordAsync(password, user?.passwordHash);
  if (!user || !user.active || !cocok) {
    catatGagal(kunciNomor);
    catatGagal(kunciIp);
    return NextResponse.json({ error: "Nomor HP atau password salah." }, { status: 401 });
  }
  hapusCatatan(kunciNomor);
  await setSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
