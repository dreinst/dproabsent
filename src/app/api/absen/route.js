import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { distanceMeters } from "@/lib/geo";

const KINDS = ["MASUK", "CHECKPOINT", "PULANG"];

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { sessionId, kind, lat, lng, photo, activity, accuracyM } = body;

  if (!sessionId || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "Data absen tidak lengkap." }, { status: 400 });
  }
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Lokasi tidak terbaca. Izinkan akses lokasi lalu coba lagi." }, { status: 400 });
  }
  if (!photo || !photo.startsWith("data:image/")) {
    return NextResponse.json({ error: "Foto wajib diambil dari kamera." }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: Number(sessionId) },
    include: { event: true },
  });
  if (!session || !session.event.active) {
    return NextResponse.json({ error: "Sesi tidak ditemukan atau sudah ditutup." }, { status: 404 });
  }

  const photoHash = createHash("sha256").update(photo).digest("hex");
  // Tolak foto yang persis sama dalam sesi yang sama (cegah absen pakai foto orang lain).
  const dup = await prisma.absensi.findFirst({
    where: { sessionId: session.id, photoHash },
  });
  if (dup) {
    return NextResponse.json(
      { error: "Foto ini sudah dipakai untuk absen di sesi ini. Ambil foto baru langsung dari kamera." },
      { status: 409 }
    );
  }

  const ev = session.event;
  const distanceM = distanceMeters(lat, lng, ev.lat, ev.lng);
  const insideRadius = distanceM <= ev.radiusM;
  const now = new Date();

  const acc = Number.isFinite(accuracyM) ? Math.round(accuracyM) : null;
  const notes = [];
  if (!insideRadius) notes.push(`Di luar radius (${distanceM} m dari titik, batas ${ev.radiusM} m)`);
  if (acc && acc > 100) notes.push(`Akurasi GPS rendah (${acc} m), lokasi kurang pasti`);

  let status = "HADIR";
  if (kind === "MASUK") {
    const lateAfter = new Date(session.startAt.getTime() + session.graceMinutes * 60000);
    if (now > lateAfter) {
      status = "TERLAMBAT";
      const mins = Math.round((now - session.startAt) / 60000);
      notes.push(`Terlambat ${mins} menit dari jam mulai`);
    }
  }

  // Saat pulang: hitung titik cek yang terlewat, jadikan catatan (tidak memotong apa pun).
  if (kind === "PULANG" && session.checkpointMinutes > 0) {
    const masuk = await prisma.absensi.findFirst({
      where: { sessionId: session.id, userId: user.id, kind: "MASUK" },
      orderBy: { checkedAt: "asc" },
    });
    if (masuk) {
      const durationMin = (now - masuk.checkedAt) / 60000;
      const expected = Math.floor(durationMin / session.checkpointMinutes);
      const actual = await prisma.absensi.count({
        where: { sessionId: session.id, userId: user.id, kind: "CHECKPOINT" },
      });
      const missed = Math.max(0, expected - actual);
      if (missed > 0) notes.push(`Titik cek terlewat: ${missed}`);
    }
  }

  const row = await prisma.absensi.create({
    data: {
      sessionId: session.id,
      userId: user.id,
      kind,
      status,
      lat,
      lng,
      accuracyM: acc,
      distanceM,
      insideRadius,
      photo,
      photoHash,
      activity: (activity || "").trim().slice(0, 300) || null,
      note: notes.join(". ") || null,
    },
  });

  return NextResponse.json({ ok: true, id: row.id, status, distanceM, insideRadius, note: row.note });
}
