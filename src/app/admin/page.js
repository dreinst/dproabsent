import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtSingkat } from "@/lib/waktu";
import { KIND, STATUS, nadaStatus } from "@/lib/label";
import AdminShell, { Cari, Saring } from "@/components/AdminShell";
import AdminActions from "@/components/AdminActions";

export const dynamic = "force-dynamic";

const SARING = {
  belum: { verifiedAt: null },
  luar: { insideRadius: false },
  telat: { status: "TERLAMBAT" },
};
const KOL = { "--kol": "56px 1.1fr 1.3fr 110px 1.3fr 170px" };

export default async function AdminPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const sp = await searchParams;
  const f = SARING[sp.f] ? sp.f : "";
  const q = String(sp.q || "").trim();
  const cari = q
    ? { OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { session: { event: { name: { contains: q, mode: "insensitive" } } } },
      ] }
    : {};

  const [rows, semua, belum, luar, telat] = await Promise.all([
    prisma.absensi.findMany({
      where: { ...SARING[f], ...cari },
      include: { user: true, session: { include: { event: true } } },
      orderBy: { checkedAt: "desc" },
      take: 100,
    }),
    prisma.absensi.count(),
    prisma.absensi.count({ where: SARING.belum }),
    prisma.absensi.count({ where: SARING.luar }),
    prisma.absensi.count({ where: SARING.telat }),
  ]);

  return (
    <AdminShell
      user={user} tab="/admin" title="Verifikasi absen"
      sub="Sahkan absen yang benar, tolak yang tidak sesuai."
      aksi={<Cari q={q} f={f} placeholder="Cari nama crew atau acara" />}
    >
      <Saring base="/admin" f={f} q={q} pilihan={[
        ["", `Semua ${semua}`], ["belum", `Belum disahkan ${belum}`],
        ["luar", `Di luar radius ${luar}`], ["telat", `Terlambat ${telat}`],
      ]} />

      <div className="tabel">
        <div className="baris kop" style={KOL}>
          <div>Foto</div><div>Crew</div><div>Acara dan sesi</div><div>Waktu</div><div>Status</div><div>Aksi</div>
        </div>
        {rows.length === 0 && <div className="kosong">Tidak ada absen yang cocok.</div>}
        {rows.map((r) => (
          <div className="baris" style={KOL} key={r.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div><img className="thumb" src={r.photo} alt={`Foto absen ${r.user.name}`} /></div>
            <div className="lebar">
              <div className="tebal">{r.user.name}</div>
              {r.activity && <div className="meta">{r.activity}</div>}
            </div>
            <div className="lebar">
              <div className="tebal">{r.session.event.name}</div>
              <div className="meta">{r.session.jobdesc} · {KIND[r.kind]}</div>
            </div>
            <div>{fmtSingkat(r.checkedAt)}</div>
            <div className="lebar">
              <div className="lencana">
                <span className={`badge ${nadaStatus(r.status)}`}>{STATUS[r.status]}</span>
                <span className={`badge ${r.insideRadius ? "muted" : "bad"}`}>{r.distanceM} m</span>
                {r.verifiedAt ? <span className="badge ok">Sah</span> : <span className="badge warn">Belum</span>}
              </div>
              {r.note && <div className="note">{r.note}</div>}
            </div>
            <div><AdminActions id={r.id} verified={!!r.verifiedAt} /></div>
          </div>
        ))}
      </div>
      <div className="meta">Menampilkan {rows.length} absen terbaru.</div>
    </AdminShell>
  );
}
