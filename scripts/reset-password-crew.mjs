// Mengisi ulang password semua akun CREW aktif dengan password awal:
// nama depan (huruf kecil) + 4 angka terakhir nomor HP, misalnya "ian8694".
// Akun OWNER dan SUPERADMIN tidak disentuh.
//
//   node scripts/reset-password-crew.mjs              simulasi, tidak mengubah apa pun
//   node scripts/reset-password-crew.mjs --jalankan   benar-benar menimpa password
//
// Keluaran (stdout) berupa CSV: nama,nomor_hp,password. Simpan di tempat aman.
// Cadangkan database dulu sebelum memakai --jalankan.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";
import { namaDepan, passwordAwal } from "../src/lib/nama.js";

const jalankan = process.argv.includes("--jalankan");
const prisma = new PrismaClient();

const crew = await prisma.user.findMany({
  where: { role: "CREW", active: true },
  select: { id: true, name: true, phone: true },
  orderBy: { name: "asc" },
});

const csv = (s) => `"${String(s).replace(/"/g, '""')}"`;
const baris = [];
const lewati = [];
for (const u of crew) {
  // Tanpa nama depan atau nomor HP yang cukup, password awalnya tidak bisa dibentuk dengan benar.
  if (!namaDepan(u.name) || u.phone.replace(/\D/g, "").length < 4) { lewati.push(u); continue; }
  baris.push({ id: u.id, name: u.name, phone: u.phone, pwd: passwordAwal(u.name, u.phone) });
}

// Dua akun dengan nama depan dan password yang sama tidak akan bisa dibedakan saat login.
const hitung = new Map();
for (const b of baris) hitung.set(`${namaDepan(b.name)}|${b.pwd}`, (hitung.get(`${namaDepan(b.name)}|${b.pwd}`) || 0) + 1);
const bentrok = baris.filter((b) => hitung.get(`${namaDepan(b.name)}|${b.pwd}`) > 1);

console.log("nama,nomor_hp,password");
for (const b of baris) console.log([csv(b.name.trim()), csv(b.phone), csv(b.pwd)].join(","));

console.error(`Crew aktif: ${crew.length}. Akan diisi: ${baris.length}. Dilewati: ${lewati.length}. Bentrok: ${bentrok.length}.`);
for (const u of lewati) console.error(`  dilewati: id ${u.id}`);
for (const b of bentrok) console.error(`  bentrok (nama dan password sama): id ${b.id}`);

if (!jalankan) {
  console.error("Simulasi saja. Tambahkan --jalankan untuk menimpa password.");
} else if (bentrok.length) {
  console.error("Dibatalkan: selesaikan bentrok di atas dulu (ubah nama salah satu akun).");
  process.exitCode = 1;
} else {
  await prisma.$transaction(
    baris.map((b) => prisma.user.update({ where: { id: b.id }, data: { passwordHash: hashPassword(b.pwd) } })),
    { timeout: 120000 }
  );
  console.error(`Selesai: ${baris.length} password crew diganti.`);
}
await prisma.$disconnect();
