import Link from "next/link";

// Baris saringan berlabel (misalnya Periode, Acara, Status). children berisi chip di dalam .saring atau dropdown.
// Komponen server tanpa state, jadi bisa dipakai di halaman mana pun yang menyaring daftar lewat URL.
export function BarisSaring({ judul, children }) {
  return (
    <div className="saring-baris">
      <span className="saring-judul">{judul}</span>
      {children}
    </div>
  );
}

// Chip saringan berupa tautan. n (opsional) tampil sebagai angka kecil di sisi kanan chip.
export function Chip({ href, aktif, label, n }) {
  return (
    <Link href={href} className={aktif ? "chip on" : "chip"}>
      {label}
      {n !== undefined && <small>{n}</small>}
    </Link>
  );
}
