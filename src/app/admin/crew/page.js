import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { simpanCrew, aktifCrew } from "@/app/admin/actions";
import AdminShell, { Cari, Saring, Panel } from "@/components/AdminShell";

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
      <label>Nomor HP (dipakai untuk masuk)</label>
      <input type="tel" name="phone" inputMode="numeric" placeholder="08xxxxxxxxxx" defaultValue={akun?.phone} required />
      <label>{akun ? "Password baru" : "Password"}</label>
      <input
        type="text" name="password" autoComplete="off" minLength={6} required={!akun}
        placeholder={akun ? "Kosongkan kalau tidak diganti" : "Minimal 6 karakter"}
      />
      <label>Rekening bank (boleh kosong)</label>
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
            <div className="grow"><b>Akun aktif</b><span>Bisa masuk dan absen.</span></div>
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

  const [akun, semua, crew, admin, nonaktif] = await Promise.all([
    prisma.user.findMany({ where: { ...SARING[f], ...cari }, orderBy: { name: "asc" } }),
    prisma.user.count(),
    prisma.user.count({ where: SARING.crew }),
    prisma.user.count({ where: SARING.admin }),
    prisma.user.count({ where: SARING.nonaktif }),
  ]);
  const bolehUbah = (a) => a.role !== "OWNER" || user.role === "OWNER";
  const qs = new URLSearchParams({ ...(f && { f }), ...(q && { q }) }).toString();
  const balik = qs ? `/admin/crew?${qs}` : "/admin/crew";
  const diubah = sp.ubah ? await prisma.user.findUnique({ where: { id: Number(sp.ubah) || 0 } }) : null;

  return (
    <AdminShell
      user={user} tab="/admin/crew" title="Crew" pesan={sp}
      sub={`${semua} akun. Nomor HP dipakai untuk masuk.`}
      aksi={<>
        <Cari q={q} f={f} placeholder="Cari nama atau nomor HP" />
        <Link href="/admin/crew?tambah=1" className="btn-primary" style={{ width: "auto" }}>Tambah akun</Link>
      </>}
    >
      <Saring base="/admin/crew" f={f} q={q} pilihan={[
        ["", `Semua ${semua}`], ["crew", `Crew ${crew}`], ["admin", `Admin ${admin}`], ["nonaktif", `Nonaktif ${nonaktif}`],
      ]} />

      <div className="tabel">
        <div className="baris kop" style={KOL}>
          <div>Nama</div><div>Nomor HP</div><div>Peran</div><div>Aktif</div><div />
        </div>
        {akun.length === 0 && <div className="kosong">Tidak ada akun yang cocok.</div>}
        {akun.map((a) => (
          <div className="baris" style={KOL} key={a.id}>
            <div className="lebar tebal">{a.name}</div>
            <div>{a.phone}</div>
            <div>{a.role === "CREW" ? "Crew" : <span className="badge navy">{PERAN[a.role]}</span>}</div>
            <div>
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
            <div>{bolehUbah(a) && <Link href={`/admin/crew?ubah=${a.id}`} className="tautan">Ubah</Link>}</div>
          </div>
        ))}
      </div>
      <div className="meta">Menampilkan {akun.length} dari {semua} akun.</div>

      {sp.tambah && <Panel title="Tambah akun" tutup="/admin/crew"><FormCrew admin={user} /></Panel>}
      {diubah && bolehUbah(diubah) && (
        <Panel title="Ubah akun" tutup="/admin/crew"><FormCrew akun={diubah} admin={user} /></Panel>
      )}
    </AdminShell>
  );
}
