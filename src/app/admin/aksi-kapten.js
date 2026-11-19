"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { hapusCache, KUNCI_SESI_AKTIF } from "@/lib/cache";

// Penunjukan dan pelepasan kapten acara dari halaman detail acara. Hanya owner dan superadmin.
// Satu acara boleh punya lebih dari satu kapten, dan kapten bisa diganti kapan saja.

async function wajibAdmin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/login");
  return user;
}

const bulat = (f, k) => Number.parseInt(f.get(k), 10) || 0;
const kembali = (eventId, kunci, pesan) => redirect(`/admin/acara/${eventId}?${kunci}=${encodeURIComponent(pesan)}`);

export async function tambahKapten(f) {
  await wajibAdmin();
  const eventId = bulat(f, "eventId");
  const userId = bulat(f, "userId");
  const acara = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!acara) redirect(`/admin/acara?err=${encodeURIComponent("Acara tidak ditemukan.")}`);
  if (!userId) kembali(eventId, "err", "Silakan pilih crew yang akan ditunjuk sebagai kapten.");

  const crew = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true, active: true } });
  if (!crew || crew.role !== "CREW" || !crew.active) kembali(eventId, "err", "Kapten hanya dapat dipilih dari crew yang aktif.");

  const hasil = await prisma.kaptenAcara.createMany({ data: [{ eventId, userId }], skipDuplicates: true });
  // Tombol Panel kapten di halaman crew dibaca dari cache daftar sesi aktif.
  await hapusCache(KUNCI_SESI_AKTIF);
  kembali(eventId, "ok", hasil.count ? `${crew.name} ditunjuk sebagai kapten acara ini.` : `${crew.name} sudah menjadi kapten acara ini.`);
}

export async function lepasKapten(f) {
  await wajibAdmin();
  const eventId = bulat(f, "eventId");
  const userId = bulat(f, "userId");
  const crew = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const hasil = await prisma.kaptenAcara.deleteMany({ where: { eventId, userId } });
  await hapusCache(KUNCI_SESI_AKTIF);
  if (!hasil.count) kembali(eventId, "err", "Crew tersebut bukan kapten acara ini.");
  kembali(eventId, "ok", `${crew?.name || "Crew"} tidak lagi menjadi kapten acara ini.`);
}
