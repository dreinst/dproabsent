// Pengaturan tarif upah di tabel Pengaturan (kunci, nilai teks). Hanya owner dan superadmin yang boleh mengubahnya.
// Import prisma memakai path relatif berakhiran .js supaya berkas ini juga bisa dimuat uji `node --test`.
import { prisma } from "./prisma.js";

// nama: nama kolom di kode dan di form. bawaan: nilai awal dari migrasi 0003, dipakai kalau barisnya hilang.
export const DAFTAR_TARIF = [
  { kunci: "tarif_crew_per_jam", nama: "crewPerJam", label: "Tarif crew per jam", satuan: "Rp", bawaan: 15000, maks: 10000000 },
  { kunci: "tarif_kapten_per_hari", nama: "kaptenPerHari", label: "Tarif kapten per hari", satuan: "Rp", bawaan: 200000, maks: 100000000 },
  { kunci: "jam_per_shift", nama: "jamPerShift", label: "Jam kerja normal per sesi", satuan: "jam", bawaan: 8, maks: 24 },
];

// Teks berisi angka saja (tanpa titik, koma, atau tanda minus) menjadi bilangan bulat positif. Selain itu null.
export function bacaBulatPositif(teks) {
  const s = String(teks ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Periksa isian form. Hasilnya { nilai } kalau semua benar, atau { galat } berisi pesan untuk admin.
export function periksaTarif(isian) {
  const nilai = {};
  for (const t of DAFTAR_TARIF) {
    const n = bacaBulatPositif(isian[t.nama]);
    if (n === null) return { galat: `${t.label} harus berupa bilangan bulat lebih dari 0, tanpa titik atau koma.` };
    if (n > t.maks) return { galat: `${t.label} paling besar ${t.maks.toLocaleString("id-ID")}.` };
    nilai[t.nama] = n;
  }
  return { nilai };
}

// Tarif yang berlaku: { crewPerJam, kaptenPerHari, jamPerShift, diubah }.
// Nilai yang hilang atau rusak memakai nilai bawaan, dan namanya dicatat di `bawaan` supaya bisa ditampilkan.
export async function bacaTarif() {
  const baris = await prisma.pengaturan.findMany({ where: { kunci: { in: DAFTAR_TARIF.map((t) => t.kunci) } } });
  const peta = new Map(baris.map((b) => [b.kunci, b]));
  const tarif = { bawaan: [], diubah: null };
  for (const t of DAFTAR_TARIF) {
    const b = peta.get(t.kunci);
    const n = b ? bacaBulatPositif(b.nilai) : null;
    tarif[t.nama] = n ?? t.bawaan;
    if (n === null) tarif.bawaan.push(t.nama);
    if (b && (!tarif.diubah || b.updatedAt > tarif.diubah)) tarif.diubah = b.updatedAt;
  }
  return tarif;
}

// Simpan semua tarif sekaligus. `nilai` harus hasil periksaTarif.
export async function simpanTarif(nilai) {
  await prisma.$transaction(
    DAFTAR_TARIF.map((t) =>
      prisma.pengaturan.upsert({
        where: { kunci: t.kunci },
        update: { nilai: String(nilai[t.nama]) },
        create: { kunci: t.kunci, nilai: String(nilai[t.nama]) },
      })
    )
  );
}
