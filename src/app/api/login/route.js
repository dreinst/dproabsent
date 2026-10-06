import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { normalizePhone, setSession } from "@/lib/auth";

export async function POST(req) {
  const { phone, password } = await req.json().catch(() => ({}));
  const p = normalizePhone(phone);
  if (!p || !password) {
    return NextResponse.json({ error: "Nomor HP dan password wajib diisi." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { phone: p } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Nomor HP atau password salah." }, { status: 401 });
  }
  await setSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
