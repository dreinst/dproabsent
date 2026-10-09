import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtWaktu, keInput } from "@/lib/waktu";
import { simpanSesi, hapusSesi } from "@/app/admin/actions";
import AdminShell from "@/components/AdminShell";
import FormAcara from "@/components/FormAcara";

export const dynamic = "force-dynamic";

function FormSesi({ eventId, sesi, mulai }) {
  return (
    <form action={simpanSesi}>
      <input type="hidden" name="eventId" value={eventId} />
      {sesi && <input type="hidden" name="id" value={sesi.id} />}
      <label>Tugas (misalnya Loading, Gladi, Event)</label>
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
          <label>Titik cek tiap (menit, 0 = tanpa)</label>
          <input type="number" name="checkpointMinutes" min="0" defaultValue={sesi?.checkpointMinutes ?? 60} />
        </div>
        <div>
          <label>Batas telat (menit)</label>
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

  return (
    <AdminShell
      user={user} tab="/admin/acara" title={acara.name} pesan={await searchParams}
      sub={acara.active ? "Acara aktif. Ubah data acara dan atur sesi tugasnya." : "Acara nonaktif, tidak tampil di halaman crew."}
      aksi={<Link href="/admin/acara" className="btn-ghost">Kembali ke daftar acara</Link>}
    >
      <div className="dua-kolom">
        <div className="card">
          <h2>Data acara</h2>
          <FormAcara acara={acara} />
        </div>

        <div className="card">
          <h2>Sesi tugas</h2>
          <p className="sub" style={{ margin: 0 }}>Crew absen per sesi. Ketuk sesi untuk mengubahnya.</p>
          {acara.sessions.map((s) => (
            <details className="sesi" key={s.id}>
              <summary>
                <div className="grow">
                  <b>{s.jobdesc}</b>
                  <span className="meta">{fmtWaktu(s.startAt)} sampai {fmtWaktu(s.endAt)}</span>
                </div>
                {s.checkpointMinutes > 0 && <span className="badge navy">Titik cek {s.checkpointMinutes} menit</span>}
                <span className="badge muted" style={{ background: "#fff" }}>{s._count.absensi} absen</span>
              </summary>
              <FormSesi eventId={acara.id} sesi={s} />
            </details>
          ))}
          <details className="sesi" open={acara.sessions.length === 0}>
            <summary><b>Tambah sesi</b></summary>
            <FormSesi eventId={acara.id} mulai={acara.startAt} />
          </details>
          <p className="meta" style={{ margin: "14px 0 0" }}>Sesi yang sudah punya absen tidak bisa dihapus.</p>
        </div>
      </div>
    </AdminShell>
  );
}
