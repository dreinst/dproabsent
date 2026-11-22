import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtWaktu, keInput } from "@/lib/waktu";
import { JEDA_MENIT, JEDA_MIN, JEDA_MAKS, jedaSesi } from "@/lib/aturan";
import { simpanSesi, hapusSesi } from "@/app/admin/actions";
import AdminShell from "@/components/AdminShell";
import FormAcara from "@/components/FormAcara";
import AturKapten from "@/components/AturKapten";

export const dynamic = "force-dynamic";

function FormSesi({ eventId, sesi, mulai }) {
  return (
    <form action={simpanSesi}>
      <input type="hidden" name="eventId" value={eventId} />
      {sesi && <input type="hidden" name="id" value={sesi.id} />}
      <label>Nama tugas (misalnya Loading, Gladi, Event)</label>
      <input type="text" name="jobdesc" defaultValue={sesi?.jobdesc} required />
      <div className="dua">
        <div>
          <label>Mulai (WIB)</label>
          <input type="datetime-local" name="startAt" defaultValue={keInput(sesi?.startAt ?? mulai)} required />
        </div>
        <div>
          <label>Selesai (WIB)</label>
          <input type="datetime-local" name="endAt" defaultValue={keInput(sesi?.endAt)} required />
        </div>
      </div>
      <div className="dua">
        <div>
          <label>Jarak absen progres (menit)</label>
          <input
            type="number" name="checkpointMinutes" min={JEDA_MIN} max={JEDA_MAKS} step="1"
            defaultValue={sesi ? jedaSesi(sesi) : JEDA_MENIT}
          />
          <div className="meta" style={{ marginTop: 4 }}>
            Bawaan 60 menit. Jika lebih panjang dari durasi sesi, crew cukup absen masuk dan pulang.
          </div>
        </div>
        <div>
          <label>Toleransi keterlambatan (menit)</label>
          <input type="number" name="graceMinutes" min="0" defaultValue={sesi?.graceMinutes ?? 15} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn-primary btn-kecil">{sesi ? "Simpan sesi" : "Tambah sesi"}</button>
        {sesi && sesi._count.absensi === 0 && (
          <button className="btn-bad btn-kecil" formAction={hapusSesi}>Hapus sesi</button>
        )}
      </div>
    </form>
  );
}

export default async function AcaraDetailPage({ params, searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const id = Number((await params).id);
  const acara = Number.isInteger(id)
    ? await prisma.event.findUnique({
        where: { id },
        include: {
          sessions: { orderBy: { startAt: "asc" }, include: { _count: { select: { absensi: true } } } },
        },
      })
    : null;
  if (!acara) notFound();

  // Semua crew aktif, ditambah kapten acara ini yang akunnya sudah nonaktif. Kapten saat ini di atas, sisanya urut nama.
  const crew = await prisma.user.findMany({
    where: { role: "CREW", OR: [{ active: true }, { kaptenAcara: { some: { eventId: acara.id } } }] },
    select: { id: true, name: true, phone: true, active: true, kaptenAcara: { where: { eventId: acara.id }, select: { userId: true } } },
    orderBy: { name: "asc" },
  });
  const calonKapten = crew
    .map((c) => ({ id: c.id, name: c.name, akhir: c.phone.slice(-4), nonaktif: !c.active, kapten: c.kaptenAcara.length > 0 }))
    .sort((x, y) => Number(y.kapten) - Number(x.kapten));
  const idKapten = calonKapten.filter((c) => c.kapten).map((c) => c.id);

  return (
    <AdminShell
      user={user} tab="/admin/acara" title={acara.name} pesan={await searchParams}
      sub={acara.active ? "Acara aktif. Ubah data acara dan atur sesi tugasnya di halaman ini." : "Acara nonaktif dan tidak tampil di halaman crew."}
      aksi={<Link href="/admin/acara" className="btn-ghost">Kembali ke daftar acara</Link>}
    >
      <div className="dua-kolom">
        <div className="card">
          <h2>Data acara</h2>
          <FormAcara acara={acara} />
        </div>

        <div className="kolom-tumpuk">
          <div className="card">
            <h2>Sesi tugas</h2>
            <p className="sub" style={{ margin: 0 }}>Crew melakukan absen per sesi. Pilih sesi untuk mengubahnya.</p>
            {acara.sessions.map((s) => (
              <details className="sesi" key={s.id}>
                <summary>
                  <div className="grow">
                    <b>{s.jobdesc}</b>
                    <span className="meta">{fmtWaktu(s.startAt)} sampai {fmtWaktu(s.endAt)}</span>
                    <br />
                    <span className="meta">Absen progres setiap {jedaSesi(s)} menit</span>
                  </div>
                  <span className="badge muted" style={{ background: "#fff" }}>{s._count.absensi} absen</span>
                </summary>
                <FormSesi eventId={acara.id} sesi={s} />
              </details>
            ))}
            <details className="sesi" open={acara.sessions.length === 0}>
              <summary><b>Tambah sesi</b></summary>
              <FormSesi eventId={acara.id} mulai={acara.startAt} />
            </details>
            <p className="meta" style={{ margin: "14px 0 0" }}>Sesi yang sudah memiliki absen tidak dapat dihapus.</p>
          </div>

          <section className="card kapten-kartu" aria-labelledby="judul-kapten">
            <h2 id="judul-kapten">Kapten acara</h2>
            <p className="sub">
              Centang crew yang menjadi kapten acara ini, lalu simpan. Kapten bisa diganti kapan saja. Kapten mengesahkan absen
              crew dan melihat progres crew lewat Panel kapten, tanpa melihat upah. Absen kapten disahkan oleh owner atau superadmin.
            </p>
            {/* key berganti setiap daftar kapten berubah, supaya kotak cari dan centang kembali bersih sesudah simpan. */}
            <AturKapten
              key={idKapten.join("-")}
              eventId={acara.id}
              awal={idKapten}
              crew={calonKapten.map(({ kapten, ...c }) => c)}
            />
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
