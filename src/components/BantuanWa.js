import { LABEL_BANTUAN, tautanBantuan } from "@/lib/wa";

// Tombol chat WhatsApp ke Andrew. Tautan biasa tanpa hook, jadi bisa dipakai di komponen server maupun klien.
// jenis: salah satu atau beberapa dari "belum", "password", "lain". label menggantikan teks bawaan.
export default function BantuanWa({ jenis = ["lain"], label }) {
  const daftar = Array.isArray(jenis) ? jenis : [jenis];
  return (
    <div className="bantuan-wa">
      {daftar.map((j) => (
        <a key={j} className="tombol-wa" href={tautanBantuan(j)} target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M12.04 2a9.93 9.93 0 0 0-8.5 15.05L2 22l5.05-1.5A9.95 9.95 0 1 0 12.04 2Zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3 .88.9-2.92-.2-.31a8.12 8.12 0 1 1 6.73 3.66Zm4.45-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06a6.6 6.6 0 0 1-1.95-1.2 7.3 7.3 0 0 1-1.35-1.68c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.1 3.64.57.25 1.02.4 1.37.5.58.18 1.1.16 1.52.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
          </svg>
          <span>{label || LABEL_BANTUAN[j]}</span>
        </a>
      ))}
    </div>
  );
}
