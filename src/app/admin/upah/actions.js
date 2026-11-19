"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { periksaTarif, simpanTarif, DAFTAR_TARIF } from "@/lib/pengaturan";

// Simpan tarif upah. Aksi server bisa dipanggil siapa saja yang tahu alamatnya, jadi hak akses diperiksa di sini.
export async function simpanTarifAksi(f) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/login");

  const acara = Number.parseInt(f.get("acara"), 10);
  const dasar = Number.isInteger(acara) && acara > 0 ? `/admin/upah?acara=${acara}` : "/admin/upah?";
  const sambung = dasar.endsWith("?") ? "" : "&";

  const isian = Object.fromEntries(DAFTAR_TARIF.map((t) => [t.nama, f.get(t.nama)]));
  const { nilai, galat } = periksaTarif(isian);
  // Saat gagal, panel tarif dibuka lagi dan pesannya tampil di dalam panel.
  if (galat) redirect(`${dasar}${sambung}tarif=1&err=${encodeURIComponent(galat)}`);

  await simpanTarif(nilai);
  redirect(`${dasar}${sambung}ok=${encodeURIComponent("Tarif berhasil disimpan. Angka upah di halaman ini sudah memakai tarif baru.")}`);
}
