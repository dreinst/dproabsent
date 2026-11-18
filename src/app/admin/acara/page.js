import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtWaktu, fmtHari } from "@/lib/waktu";
import { MULAI_DATA_BARU } from "@/lib/aturan";
import { aktifAcara } from "@/app/admin/actions";
import AdminShell, { Cari, Panel } from "@/components/AdminShell";
import FormAcara from "@/components/FormAcara";

export const dynamic = "force-dynamic";

const SARING = { aktif: { active: true }, nonaktif: { active: false }, semua: {} };
const KOL = { "--kol": "1.6fr 1fr 190px 50px 80px 60px 60px" };

export default async function AcaraPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const sp = await searchParams;
  const f = SARING[sp.f] ? sp.f : "aktif";
  const q = String(sp.q || "").trim();
  const periode = sp.periode === "lama" ? "lama" : "baru";
  const tglBatas = fmtHari(MULAI_DATA_BARU);
  const cari = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { client: { contains: q, mode: "insensitive" } }] }
    : {};
  // Data baru: acara aktif, atau yang mulai/selesai/punya sesi berakhir sejak tanggal batas. Rekap lama: sisanya.
  const baru = {
    OR: [
      { active: true },
      { startAt: { gte: MULAI_DATA_BARU } },
      { endAt: { gte: MULAI_DATA_BARU } },
      { sessions: { some: { endAt: { gte: MULAI_DATA_BARU } } } },
    ],
  };
  // Kalau kotak cari diisi, pencarian menjangkau semua acara tanpa melihat periode.
  const lingkup = q ? {} : periode === "lama" ? { NOT: baru } : baru;

  const [acara, aktif, semua, nBaru, nLama] = await Promise.all([
    prisma.event.findMany({
      where: { AND: [lingkup, SARING[f], cari] },
      include: { _count: { select: { sessions: true } } },
      orderBy: { startAt: "desc" },
    }),
    prisma.event.count({ where: { AND: [lingkup, SARING.aktif] } }),
    prisma.event.count({ where: lingkup }),
    prisma.event.count({ where: baru }),
    prisma.event.count({ where: { NOT: baru } }),
  ]);
  // Tautan yang mempertahankan parameter lain. Nilai bawaan tidak ditulis.
  const url = ({ p = periode, st = f, kata = q } = {}) => {
    const u = new URLSearchParams();
    if (p === "lama") u.set("periode", "lama");
    if (st && st !== "aktif") u.set("f", st);
    if (kata) u.set("q", kata);
    const qs = u.toString();
    return qs ? `/admin/acara?${qs}` : "/admin/acara";
  };
  const balik = url();

  return (
    <AdminShell
      user={user} tab="/admin/acara" title="Acara" pesan={sp}
      sub="Sesi dari acara yang aktif tampil di halaman absen crew."
      aksi={<>
        <Cari q={q} f={f === "aktif" ? "" : f} placeholder="Cari nama acara atau klien"
          tambahan={{ periode: periode === "lama" ? "lama" : "" }} />
        <Link href="/admin/acara?buat=1" className="btn-primary" style={{ width: "auto" }}>Buat acara</Link>
      </>}
    >
      <div className="saring-baris">
        <span className="saring-judul">Periode</span>
        <div className="saring">
          <Link href={url({ p: "baru" })} className={periode === "baru" ? "chip on" : "chip"}>Data baru (mulai {tglBatas})<small>{nBaru}</small></Link>
          <Link href={url({ p: "lama" })} className={periode === "lama" ? "chip on" : "chip"}>Rekap lama<small>{nLama}</small></Link>
        </div>
      </div>
      {q && <div className="meta ket-cari">Hasil pencarian mencakup acara dari semua periode.</div>}
      <div className="saring">
        {[["aktif", `Aktif ${aktif}`], ["nonaktif", `Nonaktif ${semua - aktif}`], ["semua", `Semua ${semua}`]].map(([nilai, label]) => (
          <Link key={nilai} href={url({ st: nilai })} className={nilai === f ? "chip on" : "chip"}>{label}</Link>
        ))}
      </div>

      <div className="tabel">
        <div className="baris kop" style={KOL}>
          <div>Nama acara</div><div>Klien</div><div>Mulai</div><div>Sesi</div><div>Radius</div><div>Aktif</div><div />
        </div>
        {acara.length === 0 && <div className="kosong">{!q && periode === "lama" ? `Tidak ada acara lama (sebelum ${tglBatas}).` : "Tidak ada acara yang cocok."}</div>}
        {acara.map((e) => (
          <div className="baris" style={KOL} key={e.id}>
            <div className="lebar tebal kol-utama">{e.name}</div>
            <div>{e.client}</div>
            <div>{fmtWaktu(e.startAt)}</div>
            <div>{e._count.sessions}<span className="meta"> sesi</span></div>
            <div>{e.radiusM} m</div>
            <div className="kol-sakelar">
              <form action={aktifAcara}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="balik" value={balik} />
                <button className={e.active ? "sakelar on" : "sakelar"} aria-label={`${e.active ? "Nonaktifkan" : "Aktifkan"} ${e.name}`} />
              </form>
            </div>
            <div className="kol-aksi"><Link href={`/admin/acara/${e.id}`} className="tautan">Kelola</Link></div>
          </div>
        ))}
      </div>
      <div className="meta">Menampilkan {acara.length} dari {semua} acara{q ? "" : periode === "lama" ? " di rekap lama" : " di data baru"}.</div>

      {sp.buat && <Panel title="Buat acara" tutup="/admin/acara"><FormAcara /></Panel>}
    </AdminShell>
  );
}
