import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendToUser } from "@/lib/push";
import { JEDA_MENIT, BATAS_MENIT } from "@/lib/aturan";

// Dipanggil cron (VPS) tiap 1 menit. Dilindungi REMINDER_SECRET.
// Titik cek selalu 60 menit sejak absen terakhir. Crew yang sudah MASUK dan belum PULANG
// dapat pengingat tepat saat waktunya tiba (menit ke-0) dan sekali lagi di menit ke-3,
// selagi masih dalam batas 5 menit. Tidak ada kolom penanda: menit ke-0 dan ke-3 hanya
// terlewati sekali per titik cek selama cron jalan tiap menit.
export const dynamic = "force-dynamic";

async function run(req) {
  const secret = process.env.REMINDER_SECRET;
  const given =
    req.headers.get("x-reminder-secret") ||
    new URL(req.url).searchParams.get("key");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
  }

  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: {
      startAt: { lte: now },
      endAt: { gte: now },
      event: { active: true },
    },
    include: { event: true },
  });

  let reminded = 0;
  const detail = [];
  for (const s of sessions) {
    const abs = await prisma.absensi.findMany({
      where: { sessionId: s.id },
      orderBy: { checkedAt: "asc" },
    });
    const byUser = new Map();
    for (const a of abs) {
      if (!byUser.has(a.userId)) byUser.set(a.userId, []);
      byUser.get(a.userId).push(a);
    }
    for (const [userId, list] of byUser) {
      const kinds = list.map((x) => x.kind);
      if (!kinds.includes("MASUK") || kinds.includes("PULANG")) continue;
      const last = list[list.length - 1].checkedAt;
      const menitLewat = Math.floor((now - last) / 60000) - JEDA_MENIT;
      if (menitLewat !== 0 && menitLewat !== BATAS_MENIT - 2) continue;
      const sisa = BATAS_MENIT - menitLewat;
      const n = await sendToUser(userId, {
        title: menitLewat === 0 ? "Waktunya absen" : "Absen sebentar lagi telat",
        body: `${s.event.name} (${s.jobdesc}). Buka dan absen, sisa ${sisa} menit.`,
        url: "/",
      });
      if (n > 0) { reminded++; detail.push({ userId, sessionId: s.id }); }
    }
  }

  return NextResponse.json({ ok: true, sessions: sessions.length, reminded, detail });
}

export async function GET(req) { return run(req); }
export async function POST(req) { return run(req); }
