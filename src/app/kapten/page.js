import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hakKapten } from "@/lib/kapten";
import { fmtWaktu, fmtSingkat } from "@/lib/waktu";
import KartuAbsen from "@/components/KartuAbsen";
import { BarisSaring, Chip } from "@/components/Saringan";
import PilihAcara from "@/components/PilihAcara";
import SegarOtomatis from "@/components/SegarOtomatis";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

// Saringan status. Bawaannya antrean "Belum disahkan".
const SARING = {
  belum: { label: "Belum disahkan", where: { verifiedAt: null } },
  telat: { label: "Terlambat", where: { status: "TERLAMBAT" } },
  pulang: { label: "Tidak absen pulang", where: { otomatis: true } },
  semua: { label: "Semua", where: {} },
};
// Kalau acaranya lebih dari ini, pilihan acara tampil sebagai dropdown.
const MAKS_CHIP_ACARA = 8;
// Jumlah absen terbaru yang diambil sebelum dikelompokkan per crew dan sesi.
const MAKS_ABSEN = 300;

// Ringkasan per sesi satu acara: crew yang absen masuk dan jumlah absen per saringan.
const ringkasanSesi = (eventId) => prisma.$queryRaw`
  SELECT s.id, s.jobdesc, s."startAt", s."endAt",
    COUNT(DISTINCT a."userId") FILTER (WHERE a.kind = 'MASUK')::int AS masuk,
    COUNT(a.id)::int AS semua,
    COUNT(a.id) FILTER (WHERE a."verifiedAt" IS NULL)::int AS belum,
    COUNT(a.id) FILTER (WHERE a.status = 'TERLAMBAT')::int AS telat,
    COUNT(a.id) FILTER (WHERE a.otomatis)::int AS pulang
  FROM "Session" s LEFT JOIN "Absensi" a ON a."sessionId" = s.id
  WHERE s."eventId" = ${eventId}
  GROUP BY s.id ORDER BY s."startAt"`;

// Jumlah absen belum disahkan per acara, untuk angka di pilihan acara.
const belumPerAcara = (ids) => prisma.$queryRaw`
  SELECT s."eventId" AS id, COUNT(*)::int AS n
  FROM "Absensi" a JOIN "Session" s ON s.id = a."sessionId"
  WHERE s."eventId" IN (${Prisma.join(ids)}) AND a."verifiedAt" IS NULL
  GROUP BY s."eventId"`;

// Panel kapten: absen crew di acara yang dipegang, dikelompokkan per crew per sesi seperti halaman Verifikasi.
// Tombol yang tampil mengikuti hakKapten (src/lib/kapten.js), dan /api/verify memeriksa aturan yang sama.
export default async function KaptenPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Acara yang dipegang: acara aktif di atas, lalu yang terbaru.
  const acara = await prisma.event.findMany({
    where: { kapten: { some: { userId: user.id } } },
    select: { id: true, name: true, active: true },
    orderBy: [{ active: "desc" }, { startAt: "desc" }],
  });
  // Halaman ini hanya untuk kapten. Selain itu diarahkan ke halaman absen.
  if (acara.length === 0) redirect("/");

  const sp = await searchParams;
  const f = SARING[sp.f] ? sp.f : "belum";
  const dipilih = acara.find((a) => String(a.id) === String(sp.acara)) || acara[0];

  const [kapten, sesi, belumAcara, rows] = await Promise.all([
    prisma.kaptenAcara.findMany({ where: { eventId: dipilih.id }, select: { userId: true } }),
    ringkasanSesi(dipilih.id),
    belumPerAcara(acara.map((a) => a.id)),
    prisma.absensi.findMany({
      where: { session: { eventId: dipilih.id }, ...SARING[f].where },
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
        session: { select: { id: true, jobdesc: true, event: { select: { name: true } } } },
        verifiedBy: { select: { name: true, role: true } },
      },
      omit: { photo: true },
      orderBy: { checkedAt: "desc" },
      take: MAKS_ABSEN,
    }),
  ]);

  const kaptenAcara = new Set(kapten.map((k) => k.userId));
  const hak = (r) => hakKapten(user.id, r, kaptenAcara);
  const nBelum = new Map(belumAcara.map((r) => [r.id, r.n]));
  const total = { belum: 0, telat: 0, pulang: 0, semua: 0 };
  for (const s of sesi) for (const k of Object.keys(total)) total[k] += s[k];

  // Satu kartu per crew per sesi. Urutan kartu mengikuti absen terbarunya, isi kartu dari absen paling awal.
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

  // Tautan yang mempertahankan parameter lain. Nilai bawaan tidak ditulis.
  const url = ({ a = dipilih.id, st = f } = {}) => {
    const u = new URLSearchParams();
    if (a !== acara[0].id) u.set("acara", String(a));
    if (st !== "belum") u.set("f", st);
    const qs = u.toString();
    return qs ? `/kapten?${qs}` : "/kapten";
  };
  const namaAcara = (a) => (a.active ? a.name : `${a.name} (nonaktif)`);

  return (
    <div className="wrap kapten-hal">
      <header className="crew-hero">
        <nav className="bilah" aria-label="Akun">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
          <LogoutButton />
        </nav>
        {/* Tombol kembali di isi hero seperti halaman Riwayat, supaya bilah atas tetap muat di HP selebar 360 px. */}
        <div className="crew-hero-isi">
          <div className="judul">
            <h1>Panel kapten</h1>
            <p>Sahkan atau tolak absen crew di acara yang Anda pegang. Absen Anda dan absen kapten lain disahkan oleh owner atau superadmin.</p>
            <SegarOtomatis />
          </div>
          <div className="row">
            <Link href="/" className="btn-ghost btn-kecil">Kembali ke halaman absen</Link>
          </div>
        </div>
      </header>

      <main className="kapten-isi">
        <BarisSaring judul="Acara">
          {acara.length <= MAKS_CHIP_ACARA ? (
            <div className="saring">
              {acara.map((a) => (
                <Chip key={a.id} href={url({ a: a.id })} aktif={a.id === dipilih.id} label={namaAcara(a)} n={nBelum.get(a.id) ?? 0} />
              ))}
            </div>
          ) : (
            <PilihAcara
              aktif={url({ a: dipilih.id })}
              pilihan={acara.map((a) => [url({ a: a.id }), `${namaAcara(a)}, ${nBelum.get(a.id) ?? 0} belum disahkan`])}
            />
          )}
        </BarisSaring>

        <section className="ringkasan-sesi" aria-label="Ringkasan per sesi">
          {sesi.length === 0 && <div className="kosong">Acara ini belum memiliki sesi.</div>}
          {sesi.map((s) => (
            <div className="ringkasan-baris" key={s.id}>
              <div className="ringkasan-judul">
                <b>{s.jobdesc}</b>
                <span className="meta">{fmtWaktu(s.startAt)} sampai {fmtSingkat(s.endAt)}</span>
              </div>
              <div className="ringkasan-angka">
                <span><b>{s.masuk}</b> crew absen masuk</span>
                <span className={s.belum > 0 ? "perlu" : undefined}><b>{s.belum}</b> absen belum disahkan</span>
              </div>
            </div>
          ))}
        </section>

        <BarisSaring judul="Status">
          <div className="saring">
            {Object.entries(SARING).map(([nilai, { label }]) => (
              <Chip key={nilai} href={url({ st: nilai })} aktif={nilai === f} label={label} n={total[nilai]} />
            ))}
          </div>
        </BarisSaring>

        {rows.length === 0 && (
          <div className="kosong">
            {f === "belum" ? "Semua absen di acara ini sudah disahkan." : f === "pulang" ? "Tidak ada crew yang tidak absen pulang." : "Tidak ada absen yang sesuai."}
          </div>
        )}
        {kelompok.map((g) => <KartuAbsen key={g.kunci} user={g.user} session={g.session} items={g.items} hak={hak} />)}
        {rows.length > 0 && (
          <div className="meta">
            Menampilkan {rows.length} absen dari {jumlahCrew} crew{rows.length >= MAKS_ABSEN ? ` (batas ${MAKS_ABSEN} absen terbaru)` : ""}.
          </div>
        )}
      </main>
    </div>
  );
}
