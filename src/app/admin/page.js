import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtSingkat } from "@/lib/waktu";
import { KIND, STATUS, nadaStatus } from "@/lib/label";
import AdminShell, { Cari, Saring } from "@/components/AdminShell";
import AdminActions from "@/components/AdminActions";
import { catatPulang } from "./actions";

export const dynamic = "force-dynamic";

const SARING = {
  belum: { verifiedAt: null },
  luar: { insideRadius: false },
  telat: { status: "TERLAMBAT" },
};
const KOL_PULANG = { "--kol": "1.1fr 1.4fr 130px 130px 150px" };

// Absen masuk yang shift-nya sudah selesai tapi belum ada absen pulang. Data impor lama dan absen yang ditolak tidak ikut.
const belumPulang = (now) => prisma.$queryRaw`
  SELECT m.id FROM "Absensi" m JOIN "Session" s ON s.id = m."sessionId"
  WHERE m.kind = 'MASUK' AND m.status <> 'TIDAK_HADIR' AND s."endAt" < ${now}
    AND COALESCE(m.note, '') NOT LIKE 'Data lama%'
    AND NOT EXISTS (
      SELECT 1 FROM "Absensi" p
      WHERE p."sessionId" = m."sessionId" AND p."userId" = m."userId" AND p.kind = 'PULANG')
  ORDER BY s."endAt" DESC`;

const KOL = { "--kol": "56px 1.1fr 1.3fr 110px 1.3fr 170px" };

export default async function AdminPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const sp = await searchParams;
  const f = SARING[sp.f] || sp.f === "pulang" ? sp.f : "";
  const q = String(sp.q || "").trim();
  const cari = q
    ? { OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { session: { event: { name: { contains: q, mode: "insensitive" } } } },
      ] }
    : {};

  const idPulang = (await belumPulang(new Date())).map((r) => r.id);
  const [rows, semua, belum, luar, telat] = await Promise.all([
    prisma.absensi.findMany({
      where: { ...(f === "pulang" ? { id: { in: idPulang } } : SARING[f]), ...cari },
      include: { user: true, session: { include: { event: true } } },
      omit: { photo: true },
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
      pesan={sp}
      aksi={<Cari q={q} f={f} placeholder="Cari nama crew atau acara" />}
    >
      <Saring base="/admin" f={f} q={q} pilihan={[
        ["", `Semua ${semua}`], ["belum", `Belum disahkan ${belum}`],
        ["luar", `Di luar radius ${luar}`], ["telat", `Terlambat ${telat}`],
        ["pulang", `Belum pulang ${idPulang.length}`],
      ]} />

      {f === "pulang" ? (
        <>
          <div className="tabel">
            <div className="baris kop" style={KOL_PULANG}>
              <div>Crew</div><div>Acara dan sesi</div><div>Masuk</div><div>Shift selesai</div><div>Aksi</div>
            </div>
            {rows.length === 0 && <div className="kosong">Tidak ada crew yang lupa absen pulang.</div>}
            {rows.map((r) => (
              <div className="baris" style={KOL_PULANG} key={r.id}>
                <div className="tebal">{r.user.name}</div>
                <div className="lebar">
                  <div className="tebal">{r.session.event.name}</div>
                  <div className="meta">{r.session.jobdesc}</div>
                </div>
                <div>{fmtSingkat(r.checkedAt)}</div>
                <div>{fmtSingkat(r.session.endAt)}</div>
                <div>
                  <form action={catatPulang}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-primary btn-kecil">Catat pulang</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <div className="meta">Crew masih bisa absen pulang sendiri selama acaranya aktif. Kalau dicatat dari sini, jam pulang memakai jam selesai shift dan tanpa foto.</div>
        </>
      ) : (
      <>

      <div className="tabel">
        <div className="baris kop" style={KOL}>
          <div>Foto</div><div>Crew</div><div>Acara dan sesi</div><div>Waktu</div><div>Status</div><div>Aksi</div>
        </div>
        {rows.length === 0 && <div className="kosong">Tidak ada absen yang cocok.</div>}
        {rows.map((r) => (
          <div className="baris" style={KOL} key={r.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div><img className="thumb" loading="lazy" src={`/api/foto/${r.id}`} alt={`Foto absen ${r.user.name}`} /></div>
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
      </>
      )}
    </AdminShell>
  );
}
