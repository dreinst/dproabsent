import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendToUser } from "@/lib/push";

// Dipanggil cron (VPS) tiap 15 menit. Dilindungi REMINDER_SECRET.
// Mencari crew yang sudah MASUK, belum PULANG, dan titik cek terakhirnya
// lewat dari interval sesi, lalu mengirim pengingat ke HP-nya.
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
      checkpointMinutes: { gt: 0 },
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
      if (now - last < s.checkpointMinutes * 60000) continue;
      const n = await sendToUser(userId, {
        title: "Waktunya absen",
        body: `Titik cek untuk ${s.event.name} (${s.jobdesc}). Buka aplikasi dan absen.`,
        url: "/",
      });
      if (n > 0) { reminded++; detail.push({ userId, sessionId: s.id }); }
    }
  }

  return NextResponse.json({ ok: true, sessions: sessions.length, reminded, detail });
}

export async function GET(req) { return run(req); }
export async function POST(req) { return run(req); }
