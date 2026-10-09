import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

const MENU = [
  ["/admin", "Verifikasi"],
  ["/admin/acara", "Acara"],
  ["/admin/crew", "Crew"],
];
const PERAN = { OWNER: "Owner", SUPERADMIN: "Superadmin" };

// Kerangka panel pengelola: sidebar, judul halaman, tombol aksi, dan pesan hasil aksi (?ok= atau ?err=).
export default function AdminShell({ user, tab, title, sub, aksi, pesan = {}, children }) {
  return (
    <div className="admin">
      <aside className="sisi">
        <div className="merek"><b>DPro Absen</b><span>Panel pengelola</span></div>
        {MENU.map(([href, label]) => (
          <Link key={href} href={href} className={href === tab ? "menu on" : "menu"}>{label}</Link>
        ))}
        <div className="akun">
          <b>{user.name}</b>
          <span>{PERAN[user.role]}</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="isi">
        <div className="kepala">
          <div className="judul"><h1>{title}</h1><p>{sub}</p></div>
          {aksi}
        </div>
        {pesan.err && <div className="err" style={{ marginBottom: 16 }}>{pesan.err}</div>}
        {pesan.ok && <div className="ok-msg" style={{ marginBottom: 16 }}>{pesan.ok}</div>}
        {children}
      </main>
    </div>
  );
}

// Kotak cari dan chip saring memakai query ?q= dan ?f= di halaman yang sama.
export function Cari({ q, f, placeholder }) {
  return (
    <form className="cari">
      {f && <input type="hidden" name="f" value={f} />}
      <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} />
    </form>
  );
}

export function Saring({ base, pilihan, f, q }) {
  return (
    <div className="saring">
      {pilihan.map(([nilai, label]) => {
        const sp = new URLSearchParams();
        if (nilai) sp.set("f", nilai);
        if (q) sp.set("q", q);
        const qs = sp.toString();
        return (
          <Link key={nilai} href={qs ? `${base}?${qs}` : base} className={nilai === f ? "chip on" : "chip"}>{label}</Link>
        );
      })}
    </div>
  );
}

// Panel kaca di sisi kanan untuk form tambah dan ubah.
export function Panel({ title, tutup, children }) {
  return (
    <>
      <Link href={tutup} className="redup" aria-label="Tutup panel" />
      <div className="panel" role="dialog" aria-label={title}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>{title}</h2>
          <Link href={tutup} className="btn-ghost btn-kecil">Tutup</Link>
        </div>
        {children}
      </div>
    </>
  );
}
