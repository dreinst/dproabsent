import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { fmtSingkat, fmtHari } from "@/lib/waktu";
import { MULAI_DATA_BARU } from "@/lib/aturan";
import FotoAbsen from "@/components/FotoAbsen";
import PilihAcara from "@/components/PilihAcara";
import { KIND, STATUS, nadaStatus } from "@/lib/label";
import AdminShell, { Cari } from "@/components/AdminShell";
import AdminActions from "@/components/AdminActions";
import { catatPulang } from "./actions";

export const dynamic = "force-dynamic";

const SARING = {
  belum: { verifiedAt: null },
  luar: { insideRadius: false },
  telat: { status: "TERLAMBAT" },
};
// Kalau acaranya lebih dari ini, pilihan acara tampil sebagai dropdown.
const MAKS_CHIP_ACARA = 8;
const KOL_PULANG = { "--kol": "1.1fr 1.4fr 130px 130px 150px" };

// Absen masuk yang shift-nya sudah selesai tapi belum ada absen pulang. Data impor lama dan absen yang ditolak tidak ikut.
// Hasilnya bawa checkedAt dan eventId supaya bisa disaring per periode dan acara.
const belumPulang = (now) => prisma.$queryRaw`
  SELECT m.id, m."checkedAt", s."eventId" FROM "Absensi" m JOIN "Session" s ON s.id = m."sessionId"
  WHERE m.kind = 'MASUK' AND m.status <> 'TIDAK_HADIR' AND s."endAt" < ${now}
    AND COALESCE(m.note, '') NOT LIKE 'Data lama%'
    AND NOT EXISTS (
      SELECT 1 FROM "Absensi" p
      WHERE p."sessionId" = m."sessionId" AND p."userId" = m."userId" AND p.kind = 'PULANG')
  ORDER BY s."endAt" DESC`;

// Acara yang punya absen di satu periode, beserta jumlahnya, urutan dari absen terbaru.
const acaraDiPeriode = (wherePeriode) => prisma.$queryRaw`
  SELECT e.id, e.name, COUNT(*)::int AS n
  FROM "Absensi" a JOIN "Session" s ON s.id = a."sessionId" JOIN "Event" e ON e.id = s."eventId"
  WHERE ${wherePeriode === "lama" ? Prisma.sql`a."checkedAt" < ${MULAI_DATA_BARU}` : Prisma.sql`a."checkedAt" >= ${MULAI_DATA_BARU}`}
  GROUP BY e.id, e.name ORDER BY MAX(a."checkedAt") DESC`;

const KOL = { "--kol": "56px 1.1fr 1.3fr 110px 1.3fr 170px" };

export default async function AdminPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const sp = await searchParams;
  // Bawaan halaman adalah antrean "Belum disahkan". Daftar lengkap dipilih lewat ?f=semua.
  const f = SARING[sp.f] || sp.f === "pulang" || sp.f === "semua" ? sp.f : "belum";
  const q = String(sp.q || "").trim();
  const periode = sp.periode === "lama" ? "lama" : "baru";
  const tglBatas = fmtHari(MULAI_DATA_BARU);
  const wherePeriode = { checkedAt: periode === "lama" ? { lt: MULAI_DATA_BARU } : { gte: MULAI_DATA_BARU } };

  // Acara hanya sah kalau punya absen di periode terpilih, kalau tidak dianggap "Semua acara".
  const daftarAcara = await acaraDiPeriode(periode);
  const acaraId = daftarAcara.find((a) => String(a.id) === String(sp.acara))?.id || 0;
  const wherePeriodeAcara = { ...wherePeriode, ...(acaraId ? { session: { eventId: acaraId } } : {}) };

  const cari = q
    ? { OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { session: { event: { name: { contains: q, mode: "insensitive" } } } },
      ] }
    : {};

  const idPulang = (await belumPulang(new Date()))
    .filter((r) => (periode === "lama" ? r.checkedAt < MULAI_DATA_BARU : r.checkedAt >= MULAI_DATA_BARU)
      && (!acaraId || r.eventId === acaraId))
    .map((r) => r.id);
  const [rows, semua, belum, luar, telat] = await Promise.all([
    prisma.absensi.findMany({
      where: { AND: [wherePeriodeAcara, f === "pulang" ? { id: { in: idPulang } } : SARING[f] || {}, cari] },
      include: { user: true, session: { include: { event: true } } },
      omit: { photo: true },
      orderBy: { checkedAt: "desc" },
      take: 100,
    }),
    prisma.absensi.count({ where: wherePeriodeAcara }),
    prisma.absensi.count({ where: { ...wherePeriodeAcara, ...SARING.belum } }),
    prisma.absensi.count({ where: { ...wherePeriodeAcara, ...SARING.luar } }),
    prisma.absensi.count({ where: { ...wherePeriodeAcara, ...SARING.telat } }),
  ]);

  // Tautan yang mempertahankan parameter lain. Nilai kosong atau bawaan tidak ditulis.
  const url = ({ p = periode, a = acaraId, st = f, kata = q } = {}) => {
    const u = new URLSearchParams();
    if (p === "lama") u.set("periode", "lama");
    if (a) u.set("acara", String(a));
    if (st && st !== "belum") u.set("f", st);
    if (kata) u.set("q", kata);
    const qs = u.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };
  const chip = (href, aktif, label, n) => (
    <Link key={href} href={href} className={aktif ? "chip on" : "chip"}>{label}{n !== undefined && <small>{n}</small>}</Link>
  );
  const totalPeriode = daftarAcara.reduce((t, a) => t + a.n, 0);
  const kosongPeriode = periode === "lama" ? `Tidak ada absen sebelum ${tglBatas}.` : `Belum ada absen sejak ${tglBatas}.`;

  return (
    <AdminShell
      user={user} tab="/admin" title="Verifikasi absen"
      sub="Sahkan absen yang benar, tolak yang tidak sesuai."
      pesan={sp}
      aksi={<Cari q={q} f={f === "belum" ? "" : f} placeholder="Cari nama crew atau acara"
        tambahan={{ periode: periode === "lama" ? "lama" : "", acara: acaraId ? String(acaraId) : "" }} />}
    >
      <div className="saring-baris">
        <span className="saring-judul">Periode</span>
        <div className="saring">
          {chip(url({ p: "baru", a: 0 }), periode === "baru", `Data baru (mulai ${tglBatas})`)}
          {chip(url({ p: "lama", a: 0 }), periode === "lama", `Rekap lama (sebelum ${tglBatas})`)}
        </div>
      </div>

      {totalPeriode > 0 && (
        <div className="saring-baris">
          <span className="saring-judul">Acara</span>
          {daftarAcara.length <= MAKS_CHIP_ACARA ? (
            <div className="saring">
              {chip(url({ a: 0 }), !acaraId, "Semua acara", totalPeriode)}
              {daftarAcara.map((a) => chip(url({ a: a.id }), a.id === acaraId, a.name, a.n))}
            </div>
          ) : (
            <PilihAcara
              aktif={url({ a: acaraId })}
              pilihan={[
                [url({ a: 0 }), `Semua acara (${totalPeriode})`],
                ...daftarAcara.map((a) => [url({ a: a.id }), `${a.name} (${a.n})`]),
              ]}
            />
          )}
        </div>
      )}

      <div className="saring-baris">
        <span className="saring-judul">Status</span>
        <div className="saring">
          {[
            ["belum", "Belum disahkan", belum], ["telat", "Terlambat", telat],
            ["pulang", "Belum pulang", idPulang.length], ["luar", "Di luar radius", luar],
            ["semua", "Semua", semua],
          ].map(([nilai, label, n]) => chip(url({ st: nilai }), nilai === f, label, n))}
        </div>
      </div>

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
        {rows.length === 0 && <div className="kosong">{totalPeriode === 0 ? kosongPeriode : f === "belum" && !q ? "Semua absen di sini sudah disahkan." : "Tidak ada absen yang cocok."}</div>}
        {rows.map((r) => (
          <div className="baris" style={KOL} key={r.id}>
            <div>
              <FotoAbsen id={r.id} nama={r.user.name} ket={[
                r.session.event.name,
                `${r.session.jobdesc} · ${KIND[r.kind]}`,
                fmtSingkat(r.checkedAt),
                `${STATUS[r.status]} · ${r.distanceM} m dari titik acara`,
              ]} />
            </div>
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
