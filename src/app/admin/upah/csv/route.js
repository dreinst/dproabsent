import { getCurrentUser, isAdmin } from "@/lib/auth";
import { rekapUpah } from "@/lib/data-upah";
import { fmtDurasi, tanggalWib } from "@/lib/upah";

export const dynamic = "force-dynamic";

const teks = (isi, status) => new Response(isi, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

// Sel CSV selalu dikutip. Teks yang diawali =, +, -, @, tab, atau CR diberi tanda kutip tunggal
// supaya tidak dijalankan sebagai rumus saat dibuka di Excel atau Google Sheets.
function sel(nilai) {
  if (typeof nilai === "number") return String(nilai);
  let s = String(nilai ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// Unduh rekap upah satu acara sebagai CSV (UTF-8 dengan BOM, pemisah koma). Khusus owner dan superadmin.
export async function GET(req) {
  const user = await getCurrentUser();
  if (!user) return teks("Silakan masuk terlebih dahulu.", 401);
  if (!isAdmin(user)) return teks("Tidak berwenang.", 403);

  const rekap = await rekapUpah(new URL(req.url).searchParams.get("acara"));
  if (!rekap) return teks("Acara tidak ditemukan.", 404);
  const { acara, tarif, orang, total } = rekap;

  const kepala = [
    "Acara", "ID akun", "Nama", "Peran", "Sesi dihadiri", "Menit dibayar", "Jam dibayar", "Menit lembur",
    "Hari (kapten)", "Tarif (Rp)", "Satuan tarif", "Upah (Rp)", "Absen menunggu pengesahan", "Catatan",
  ];
  const baris = orang.map((r) => {
    const kapten = r.peran === "KAPTEN";
    return [
      acara.name, r.user.id, r.user.name, kapten ? "Kapten" : "Crew", r.sesiDihadiri,
      kapten ? "" : r.menitDibayar, kapten ? "" : fmtDurasi(r.menitDibayar), kapten ? "" : r.menitLembur,
      kapten ? r.jumlahHari : "", kapten ? tarif.kaptenPerHari : tarif.crewPerJam, kapten ? "per hari" : "per jam",
      r.upah, r.menunggu, r.catatan.join(". "),
    ];
  });
  const jumlah = [
    acara.name, "", "TOTAL", `${total.orang} orang`, total.sesiDihadiri, total.menitDibayar, fmtDurasi(total.menitDibayar),
    total.menitLembur, total.jumlahHari, "", "", total.upah, total.menunggu, "",
  ];
  const isi = `﻿${[kepala, ...baris, jumlah].map((b) => b.map(sel).join(",")).join("\r\n")}\r\n`;

  const slug = acara.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `acara-${acara.id}`;
  const nama = `upah-${slug}-${tanggalWib(acara.startAt)}.csv`;
  return new Response(isi, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nama}"`,
      "cache-control": "no-store",
    },
  });
}
