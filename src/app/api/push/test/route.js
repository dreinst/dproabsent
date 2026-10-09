import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendToUser } from "@/lib/push";

// Kirim satu notifikasi uji ke semua perangkat milik akun yang sedang masuk.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const sent = await sendToUser(user.id, {
    title: "Notifikasi uji",
    body: "Pengingat absen di HP ini sudah jalan.",
    url: "/",
  });
  return NextResponse.json({ ok: true, sent });
}
