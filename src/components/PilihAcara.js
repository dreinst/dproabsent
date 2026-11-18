"use client";

import { useRouter } from "next/navigation";

// Pilihan acara berbentuk dropdown untuk daftar yang panjang. `pilihan` berisi [href, label],
// href sudah lengkap dengan parameter lain, jadi komponen ini hanya pindah URL.
export default function PilihAcara({ pilihan, aktif }) {
  const router = useRouter();
  return (
    <select
      className="pilih-acara" aria-label="Pilih acara" value={aktif}
      onChange={(e) => router.push(e.target.value)}
    >
      {pilihan.map(([href, label]) => <option key={href} value={href}>{label}</option>)}
    </select>
  );
}
