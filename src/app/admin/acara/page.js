import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtWaktu } from "@/lib/waktu";
import { aktifAcara } from "@/app/admin/actions";
import AdminShell, { Cari, Saring, Panel } from "@/components/AdminShell";
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
  const cari = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { client: { contains: q, mode: "insensitive" } }] }
    : {};

  const [acara, aktif, semua] = await Promise.all([
    prisma.event.findMany({
      where: { ...SARING[f], ...cari },
      include: { _count: { select: { sessions: true } } },
      orderBy: { startAt: "desc" },
    }),
    prisma.event.count({ where: SARING.aktif }),
    prisma.event.count(),
  ]);
  const balik = `/admin/acara?f=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <AdminShell
      user={user} tab="/admin/acara" title="Acara" pesan={sp}
      sub="Sesi dari acara aktif muncul di halaman absen crew."
      aksi={<>
        <Cari q={q} f={f} placeholder="Cari nama acara atau klien" />
        <Link href="/admin/acara?buat=1" className="btn-primary" style={{ width: "auto" }}>Buat acara</Link>
      </>}
    >
      <Saring base="/admin/acara" f={f} q={q} pilihan={[
        ["aktif", `Aktif ${aktif}`], ["nonaktif", `Nonaktif ${semua - aktif}`], ["semua", `Semua ${semua}`],
      ]} />

      <div className="tabel">
        <div className="baris kop" style={KOL}>
          <div>Nama acara</div><div>Klien</div><div>Mulai</div><div>Sesi</div><div>Radius</div><div>Aktif</div><div />
        </div>
        {acara.length === 0 && <div className="kosong">Tidak ada acara yang cocok.</div>}
        {acara.map((e) => (
          <div className="baris" style={KOL} key={e.id}>
            <div className="lebar tebal">{e.name}</div>
            <div>{e.client}</div>
            <div>{fmtWaktu(e.startAt)}</div>
            <div>{e._count.sessions}<span className="meta"> sesi</span></div>
            <div>{e.radiusM} m</div>
            <div>
              <form action={aktifAcara}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="balik" value={balik} />
                <button className={e.active ? "sakelar on" : "sakelar"} aria-label={`${e.active ? "Nonaktifkan" : "Aktifkan"} ${e.name}`} />
              </form>
            </div>
            <div><Link href={`/admin/acara/${e.id}`} className="tautan">Kelola</Link></div>
          </div>
        ))}
      </div>
      <div className="meta">Menampilkan {acara.length} dari {semua} acara.</div>

      {sp.buat && <Panel title="Buat acara" tutup="/admin/acara"><FormAcara /></Panel>}
    </AdminShell>
  );
}
