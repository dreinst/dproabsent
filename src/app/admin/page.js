import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtWaktu, fmtSingkat, fmtHari } from "@/lib/waktu";
import { MULAI_DATA_BARU } from "@/lib/aturan";
import PilihAcara from "@/components/PilihAcara";
import AdminShell, { Cari } from "@/components/AdminShell";
import KartuAbsen from "@/components/KartuAbsen";
import { BarisSaring, Chip } from "@/components/Saringan";
import { catatPulang } from "./actions";

export const dynamic = "force-dynamic";

const SARING = {
  belum: { verifiedAt: null },
  luar: { insideRadius: false },
  telat: { status: "TERLAMBAT" },
};
// Kalau acaranya lebih dari ini, pilihan acara tampil sebagai dropdown.
const MAKS_CHIP_ACARA = 8;
// Jumlah absen terbaru yang diambil sebelum dikelompokkan per crew dan sesi.
const MAKS_ABSEN = 300;
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

// Pilihan acara di satu periode beserta jumlah absennya, urutan dari absen terbaru. Rekap lama hanya memuat acara yang
// punya absen lama. Data baru juga memuat acara aktif yang belum punya absen (di urutan akhir), supaya owner dan
// superadmin bisa membuka sesinya sebelum dimulai.
const acaraDiPeriode = (periode) => periode === "lama"
  ? prisma.$queryRaw`
    SELECT e.id, e.name, COUNT(*)::int AS n
    FROM "Absensi" a JOIN "Session" s ON s.id = a."sessionId" JOIN "Event" e ON e.id = s."eventId"
    WHERE a."checkedAt" < ${MULAI_DATA_BARU}
    GROUP BY e.id, e.name ORDER BY MAX(a."checkedAt") DESC`
  : prisma.$queryRaw`
    SELECT e.id, e.name, COUNT(a.id)::int AS n
    FROM "Event" e
    LEFT JOIN "Session" s ON s."eventId" = e.id
    LEFT JOIN "Absensi" a ON a."sessionId" = s.id AND a."checkedAt" >= ${MULAI_DATA_BARU}
    GROUP BY e.id, e.name, e.active
    HAVING COUNT(a.id) > 0 OR e.active
    ORDER BY MAX(a."checkedAt") DESC NULLS LAST, e.id DESC`;

// Ringkasan per sesi, termasuk sesi yang belum dimulai atau belum punya absen. Dengan acara terpilih isinya semua sesi
// acara itu, tanpa acara terpilih isinya semua sesi di acara aktif.
const ringkasanSesi = (eventId) => prisma.$queryRaw`
  SELECT s.id, s.jobdesc, s."startAt", s."endAt", e.name AS acara,
    COUNT(DISTINCT a."userId") FILTER (WHERE a.kind = 'MASUK')::int AS masuk,
    COUNT(a.id) FILTER (WHERE a."verifiedAt" IS NULL)::int AS belum
  FROM "Session" s JOIN "Event" e ON e.id = s."eventId" LEFT JOIN "Absensi" a ON a."sessionId" = s.id
  WHERE ${eventId ? Prisma.sql`s."eventId" = ${eventId}` : Prisma.sql`e.active`}
  GROUP BY s.id, e.name ORDER BY s."startAt", s.id`;

const statusSesi = (s, now) =>
  now < new Date(s.startAt) ? "Belum dimulai" : now <= new Date(s.endAt) ? "Sedang berlangsung" : "Selesai";


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

  const sekarang = new Date();
  const idPulang = (await belumPulang(sekarang))
    .filter((r) => (periode === "lama" ? r.checkedAt < MULAI_DATA_BARU : r.checkedAt >= MULAI_DATA_BARU)
      && (!acaraId || r.eventId === acaraId))
    .map((r) => r.id);
  const [sesi, rows, semua, belum, luar, telat] = await Promise.all([
    periode === "baru" ? ringkasanSesi(acaraId) : [],
    prisma.absensi.findMany({
      where: { AND: [wherePeriodeAcara, f === "pulang" ? { id: { in: idPulang } } : SARING[f] || {}, cari] },
      // verifiedBy untuk keterangan "Disahkan oleh" dan "Ditolak oleh" di tiap foto.
      include: { user: true, session: { include: { event: true } }, verifiedBy: { select: { name: true, role: true } } },
      omit: { photo: true },
      orderBy: { checkedAt: "desc" },
      take: MAKS_ABSEN,
    }),
    prisma.absensi.count({ where: wherePeriodeAcara }),
    prisma.absensi.count({ where: { ...wherePeriodeAcara, ...SARING.belum } }),
    prisma.absensi.count({ where: { ...wherePeriodeAcara, ...SARING.luar } }),
    prisma.absensi.count({ where: { ...wherePeriodeAcara, ...SARING.telat } }),
  ]);

  // Satu kartu per crew per sesi. Urutan kartu mengikuti absen terbarunya (rows sudah terbaru dulu),
  // isi kartu diurutkan dari absen paling awal.
  const kelompok = [];
  const peta = new Map();
  for (const r of rows) {
    const kunci = `${r.userId}-${r.sessionId}`;
    let g = peta.get(kunci);
    if (!g) { g = { kunci, user: r.user, session: r.session, items: [] }; peta.set(kunci, g); kelompok.push(g); }
    g.items.push(r);
  }
  for (const g of kelompok) g.items.reverse();
  const jumlahCrew = new Set(rows.map((r) => r.userId)).size;

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
  const totalPeriode = daftarAcara.reduce((t, a) => t + a.n, 0);
  const kosongPeriode = periode === "lama" ? `Tidak ada absen sebelum ${tglBatas}.` : `Belum ada absen sejak ${tglBatas}.`;
  // Acara aktif yang belum punya absen tetap bisa dipilih, jadi pesan kosongnya dibedakan.
  const kosongAcara = acaraId && daftarAcara.find((a) => a.id === acaraId).n === 0;

  return (
    <AdminShell
      user={user} tab="/admin" title="Verifikasi absen"
      sub="Sahkan absen yang sesuai dan tolak absen yang tidak sesuai."
      pesan={sp}
      aksi={<Cari q={q} f={f === "belum" ? "" : f} placeholder="Cari nama crew atau acara"
        tambahan={{ periode: periode === "lama" ? "lama" : "", acara: acaraId ? String(acaraId) : "" }} />}
    >
      <BarisSaring judul="Periode">
        <div className="saring">
          <Chip href={url({ p: "baru", a: 0 })} aktif={periode === "baru"} label={`Data baru (mulai ${tglBatas})`} />
          <Chip href={url({ p: "lama", a: 0 })} aktif={periode === "lama"} label={`Rekap lama (sebelum ${tglBatas})`} />
        </div>
      </BarisSaring>

      {daftarAcara.length > 0 && (
        <BarisSaring judul="Acara">
          {daftarAcara.length <= MAKS_CHIP_ACARA ? (
            <div className="saring">
              <Chip href={url({ a: 0 })} aktif={!acaraId} label="Semua acara" n={totalPeriode} />
              {daftarAcara.map((a) => <Chip key={a.id} href={url({ a: a.id })} aktif={a.id === acaraId} label={a.name} n={a.n} />)}
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
        </BarisSaring>
      )}

      {(acaraId || sesi.length > 0) && periode === "baru" && (
        <section className="ringkasan-sesi" aria-label="Ringkasan per sesi">
          {sesi.length === 0 && <div className="kosong">Acara ini belum memiliki sesi.</div>}
          {sesi.map((s) => {
            const status = statusSesi(s, sekarang);
            return (
              <div className="ringkasan-baris" key={s.id}>
                <div className="ringkasan-judul">
                  <b>{s.jobdesc}</b>
                  {!acaraId && <span className="meta">{s.acara}</span>}
                  <span className="meta">{fmtWaktu(s.startAt)} sampai {fmtSingkat(s.endAt)}</span>
                </div>
                <div className="ringkasan-angka">
                  <span className={status === "Sedang berlangsung" ? "status-sesi berlangsung" : "status-sesi"}>{status}</span>
                  <span><b>{s.masuk}</b> crew absen masuk</span>
                  <span className={s.belum > 0 ? "perlu" : undefined}><b>{s.belum}</b> absen belum disahkan</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <BarisSaring judul="Status">
        <div className="saring">
          {[
            ["belum", "Belum disahkan", belum], ["telat", "Terlambat", telat],
            ["pulang", "Belum pulang", idPulang.length], ["luar", "Di luar radius", luar],
            ["semua", "Semua", semua],
          ].map(([nilai, label, n]) => <Chip key={nilai} href={url({ st: nilai })} aktif={nilai === f} label={label} n={n} />)}
        </div>
      </BarisSaring>

      {f === "pulang" ? (
        <>
          <div className="tabel">
            <div className="baris kop" style={KOL_PULANG}>
              <div>Crew</div><div>Acara dan sesi</div><div>Masuk</div><div>Shift selesai</div><div>Aksi</div>
            </div>
            {rows.length === 0 && <div className="kosong">Semua crew sudah absen pulang.</div>}
            {rows.map((r) => (
              <div className="baris" style={KOL_PULANG} key={r.id}>
                <div className="tebal kol-utama">{r.user.name}</div>
                <div className="lebar">
                  <div className="tebal">{r.session.event.name}</div>
                  <div className="meta">{r.session.jobdesc}</div>
                </div>
                <div>{fmtSingkat(r.checkedAt)}</div>
                <div>{fmtSingkat(r.session.endAt)}</div>
                <div className="kol-aksi">
                  <form action={catatPulang}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-primary btn-kecil">Catat pulang</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <div className="meta">Crew masih dapat absen pulang sendiri selama acara aktif. Jika dicatat dari sini, jam pulang mengikuti jam selesai shift dan tanpa foto.</div>
        </>
      ) : (
      <>

      {rows.length === 0 && <div className="kosong">{totalPeriode === 0 ? kosongPeriode : kosongAcara ? "Belum ada absen di acara ini." : f === "belum" && !q ? "Semua absen di sini sudah disahkan." : "Tidak ada absen yang sesuai."}</div>}
      {kelompok.map((g) => <KartuAbsen key={g.kunci} user={g.user} session={g.session} items={g.items} />)}
      <div className="meta">Menampilkan {rows.length} absen dari {jumlahCrew} crew{rows.length >= MAKS_ABSEN ? ` (batas ${MAKS_ABSEN} absen terbaru)` : ""}.</div>
      </>
      )}
    </AdminShell>
  );
}
