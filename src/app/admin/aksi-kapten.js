"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { hapusCache, KUNCI_SESI_AKTIF } from "@/lib/cache";

// Pengaturan kapten acara dari halaman detail acara lewat satu ceklis. Hanya owner dan superadmin.
// Satu acara boleh punya lebih dari satu kapten, dan kapten bisa diganti kapan saja.

async function wajibAdmin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/login");
  return user;
}

const bulat = (f, k) => Number.parseInt(f.get(k), 10) || 0;
const kembali = (eventId, kunci, pesan) => redirect(`/admin/acara/${eventId}?${kunci}=${encodeURIComponent(pesan)}`);

// Id dari daftar yang dikirim form, dibuang yang bukan bilangan bulat positif dan yang dobel.
const daftarId = (nilai) => [...new Set(nilai.map((v) => Number.parseInt(v, 10)).filter((n) => Number.isInteger(n) && n > 0))];

// Menyimpan ceklis kapten. Form mengirim awal (id kapten saat halaman dirender, dipisah koma) dan kapten (semua
// id yang tercentang). Hanya selisihnya yang diterapkan, jadi perubahan admin lain di waktu yang sama tidak tertimpa.
export async function aturKapten(f) {
  await wajibAdmin();
  const eventId = bulat(f, "eventId");
  const acara = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!acara) redirect(`/admin/acara?err=${encodeURIComponent("Acara tidak ditemukan.")}`);

  const awal = new Set(daftarId(String(f.get("awal") || "").split(",")));
  const centang = new Set(daftarId(f.getAll("kapten")));
  const tambah = [...centang].filter((id) => !awal.has(id));
  const lepas = [...awal].filter((id) => !centang.has(id));
  if (!tambah.length && !lepas.length) kembali(eventId, "ok", "Tidak ada perubahan kapten.");

  // Yang ditambahkan wajib crew aktif. Kalau ada yang tidak memenuhi, tolak semuanya.
  const calon = tambah.length
    ? await prisma.user.findMany({ where: { id: { in: tambah } }, select: { id: true, name: true, role: true, active: true } })
    : [];
  if (calon.length !== tambah.length || calon.some((c) => c.role !== "CREW" || !c.active)) {
    kembali(eventId, "err", "Kapten hanya dapat dipilih dari crew yang aktif. Tidak ada perubahan yang disimpan.");
  }
  const dilepas = lepas.length
    ? await prisma.user.findMany({ where: { id: { in: lepas } }, select: { id: true, name: true } })
    : [];

  await prisma.$transaction([
    prisma.kaptenAcara.createMany({ data: tambah.map((userId) => ({ eventId, userId })), skipDuplicates: true }),
    prisma.kaptenAcara.deleteMany({ where: { eventId, userId: { in: lepas } } }),
  ]);
  // Tombol Panel kapten di halaman crew dibaca dari cache daftar sesi aktif.
  await hapusCache(KUNCI_SESI_AKTIF);

  const nama = (daftar) => daftar.map((u) => u.name).join(", ");
  const bagian = [];
  if (calon.length) bagian.push(`Ditambahkan: ${nama(calon)}.`);
  if (dilepas.length) bagian.push(`Dilepas: ${nama(dilepas)}.`);
  kembali(eventId, "ok", `Kapten acara disimpan. ${bagian.join(" ")}`);
}
