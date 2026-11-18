import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { simpanCrew, aktifCrew } from "@/app/admin/actions";
import { fmtHari } from "@/lib/waktu";
import { MULAI_DATA_BARU } from "@/lib/aturan";
import Avatar from "@/components/Avatar";
import AdminShell, { Cari, Panel } from "@/components/AdminShell";

export const dynamic = "force-dynamic";

const PERAN = { CREW: "Crew", SUPERADMIN: "Superadmin", OWNER: "Owner" };
const SARING = {
  crew: { role: "CREW" },
  admin: { role: { in: ["OWNER", "SUPERADMIN"] } },
  nonaktif: { active: false },
};
const KOL = { "--kol": "1.5fr 1fr 140px 60px 50px" };

function FormCrew({ akun, admin }) {
  // Peran owner hanya bisa diberikan owner; akun sendiri tidak bisa diubah peran dan statusnya.
  const pilihan = Object.keys(PERAN).filter((r) => r !== "OWNER" || admin.role === "OWNER");
  const diri = akun?.id === admin.id;
  return (
    <form action={simpanCrew}>
      {akun && <input type="hidden" name="id" value={akun.id} />}
      <label>Nama</label>
      <input type="text" name="name" defaultValue={akun?.name} required />
      <label>Nomor HP (digunakan untuk masuk)</label>
      <input type="tel" name="phone" inputMode="numeric" placeholder="08xxxxxxxxxx" defaultValue={akun?.phone} required />
      <label>{akun ? "Password baru" : "Password"}</label>
      <input
        type="text" name="password" autoComplete="off" minLength={6} required={!akun}
        placeholder={akun ? "Kosongkan jika tidak ingin mengganti" : "Minimal 6 karakter"}
      />
      <label>Rekening bank (opsional)</label>
      <input type="text" name="bankAccount" defaultValue={akun?.bankAccount || ""} />
      {diri ? (
        <>
          <input type="hidden" name="role" value={akun.role} />
          <input type="hidden" name="active" value="on" />
        </>
      ) : (
        <>
          <label>Peran</label>
          <div className="row" style={{ gap: 8 }}>
            {pilihan.map((r) => (
              <label className="pilih" key={r}>
                <input type="radio" name="role" value={r} defaultChecked={(akun?.role || "CREW") === r} />
                <span className="chip">{PERAN[r]}</span>
              </label>
            ))}
          </div>
          <label className="pilihan">
            <div className="grow"><b>Akun aktif</b><span>Dapat masuk dan melakukan absen.</span></div>
            <input type="checkbox" className="sakelar" name="active" defaultChecked={akun ? akun.active : true} />
          </label>
        </>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn-primary" style={{ width: "auto" }}>{akun ? "Simpan akun" : "Buat akun"}</button>
        <Link href="/admin/crew" className="btn-ghost">Batal</Link>
      </div>
    </form>
  );
}

export default async function CrewPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const sp = await searchParams;
  const f = SARING[sp.f] ? sp.f : "";
  const q = String(sp.q || "").trim();
  const angka = q.replace(/\D/g, "");
  const cari = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(angka ? [{ phone: { contains: angka } }] : [])] }
    : {};

  const periode = sp.periode === "lama" ? "lama" : "baru";
  const tglBatas = fmtHari(MULAI_DATA_BARU);
  // Data baru: owner dan superadmin selalu, akun yang dibuat sejak tanggal batas, atau yang punya absen sejak itu.
  const baru = {
    OR: [
      { role: { in: ["OWNER", "SUPERADMIN"] } },
      { createdAt: { gte: MULAI_DATA_BARU } },
      { absensi: { some: { checkedAt: { gte: MULAI_DATA_BARU } } } },
    ],
  };
  // Kalau kotak cari diisi, pencarian menjangkau semua crew tanpa melihat periode.
  const lingkup = q ? {} : periode === "lama" ? { NOT: baru } : baru;

  const [akun, semua, crew, admin, nonaktif, nBaru, nLama] = await Promise.all([
    prisma.user.findMany({ where: { AND: [lingkup, SARING[f] || {}, cari] }, orderBy: { name: "asc" } }),
    prisma.user.count({ where: lingkup }),
    prisma.user.count({ where: { AND: [lingkup, SARING.crew] } }),
    prisma.user.count({ where: { AND: [lingkup, SARING.admin] } }),
    prisma.user.count({ where: { AND: [lingkup, SARING.nonaktif] } }),
    prisma.user.count({ where: baru }),
    prisma.user.count({ where: { NOT: baru } }),
  ]);
  // Tautan yang mempertahankan parameter lain. Nilai bawaan tidak ditulis.
  const url = ({ p = periode, st = f, kata = q } = {}) => {
    const u = new URLSearchParams();
    if (p === "lama") u.set("periode", "lama");
    if (st) u.set("f", st);
    if (kata) u.set("q", kata);
    const qs = u.toString();
    return qs ? `/admin/crew?${qs}` : "/admin/crew";
  };
  const bolehUbah = (a) => a.role !== "OWNER" || user.role === "OWNER";
  const balik = url();
  const diubah = sp.ubah ? await prisma.user.findUnique({ where: { id: Number(sp.ubah) || 0 } }) : null;

  return (
    <AdminShell
      user={user} tab="/admin/crew" title="Crew" pesan={sp}
      sub={`${nBaru + nLama} akun. Nomor HP digunakan untuk masuk.`}
      aksi={<>
        <Cari q={q} f={f} placeholder="Cari nama atau nomor HP"
          tambahan={{ periode: periode === "lama" ? "lama" : "" }} />
        <Link href="/admin/crew?tambah=1" className="btn-primary" style={{ width: "auto" }}>Tambah akun</Link>
      </>}
    >
      <div className="saring-baris">
        <span className="saring-judul">Periode</span>
        <div className="saring">
          <Link href={url({ p: "baru" })} className={periode === "baru" ? "chip on" : "chip"}>Data baru (mulai {tglBatas})<small>{nBaru}</small></Link>
          <Link href={url({ p: "lama" })} className={periode === "lama" ? "chip on" : "chip"}>Rekap lama<small>{nLama}</small></Link>
        </div>
      </div>
      {q && <div className="meta ket-cari">Hasil pencarian mencakup crew dari semua periode.</div>}
      <div className="saring">
        {[["", `Semua ${semua}`], ["crew", `Crew ${crew}`], ["admin", `Admin ${admin}`], ["nonaktif", `Nonaktif ${nonaktif}`]].map(([nilai, label]) => (
          <Link key={nilai} href={url({ st: nilai })} className={nilai === f ? "chip on" : "chip"}>{label}</Link>
        ))}
      </div>

      <div className="tabel">
        <div className="baris kop" style={KOL}>
          <div>Nama</div><div>Nomor HP</div><div>Peran</div><div>Aktif</div><div />
        </div>
        {akun.length === 0 && <div className="kosong">{!q && periode === "lama" ? `Tidak ada akun lama (sebelum ${tglBatas}).` : "Tidak ada akun yang cocok."}</div>}
        {akun.map((a) => (
          <div className="baris" style={KOL} key={a.id}>
            <div className="lebar tebal nama-crew kol-utama"><Avatar id={a.id} nama={a.name} avatar={a.avatar} ukuran={36} /><span>{a.name}</span></div>
            <div>{a.phone}</div>
            <div>{a.role === "CREW" ? "Crew" : <span className="badge navy">{PERAN[a.role]}</span>}</div>
            <div className="kol-sakelar">
              {bolehUbah(a) && a.id !== user.id ? (
                <form action={aktifCrew}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="balik" value={balik} />
                  <button className={a.active ? "sakelar on" : "sakelar"} aria-label={`${a.active ? "Nonaktifkan" : "Aktifkan"} ${a.name}`} />
                </form>
              ) : (
                <span className="badge ok">Aktif</span>
              )}
            </div>
            <div className="kol-aksi">{bolehUbah(a) && <Link href={`/admin/crew?ubah=${a.id}`} className="tautan">Ubah</Link>}</div>
          </div>
        ))}
      </div>
      <div className="meta">Menampilkan {akun.length} dari {semua} akun{q ? "" : periode === "lama" ? " di rekap lama" : " di data baru"}.</div>

      {sp.tambah && <Panel title="Tambah akun" tutup="/admin/crew"><FormCrew admin={user} /></Panel>}
      {diubah && bolehUbah(diubah) && (
        <Panel title="Ubah akun" tutup="/admin/crew"><FormCrew akun={diubah} admin={user} /></Panel>
      )}
    </AdminShell>
  );
}
