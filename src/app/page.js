import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtWaktu, fmtSingkat } from "@/lib/waktu";
import LogoutButton from "@/components/LogoutButton";
import AbsenPanel from "@/components/AbsenPanel";

export const dynamic = "force-dynamic";

// Waktu absen terakhir yang memulai hitungan 60 menit berikutnya (masuk atau titik cek).
function lastAt(absensi) {
  const aktif = absensi.filter((a) => a.kind !== "PULANG");
  return aktif.length ? aktif[aktif.length - 1].checkedAt.getTime() : null;
}

export default async function CrewHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");

  const sessions = await prisma.session.findMany({
    where: { event: { active: true } },
    include: {
      event: true,
      // omit photo: foto diambil lewat /api/foto/[id], tidak ikut dimuat dari database.
      absensi: { where: { userId: user.id }, orderBy: { checkedAt: "asc" }, omit: { photo: true } },
    },
    orderBy: { startAt: "asc" },
  });
  const now = new Date();

  return (
    <div className="wrap">
      <div className="topbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
        <LogoutButton />
      </div>
      <div className="judul">
        <h1>Absen saya</h1>
        <p>Halo, {user.name}</p>
      </div>

      {sessions.length === 0 && (
        <div className="card">
          <h2>Belum ada sesi aktif</h2>
          <p className="sub">Tunggu kantor membuka sesi tugas untuk acara yang sedang berjalan.</p>
        </div>
      )}

      {sessions.map((s) => {
        const jalan = s.startAt <= now && now <= s.endAt;
        return (
          <div className="card" key={s.id}>
            <div className={jalan ? "mata merah" : "mata"}>
              {jalan ? "Sedang berjalan" : now < s.startAt ? "Berikutnya" : "Sudah lewat"}
            </div>
            <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <h2 className="grow">{s.event.name}</h2>
              <span className="badge navy">{s.jobdesc}</span>
            </div>
            <p className="sub">
              {fmtWaktu(s.startAt)} sampai {fmtSingkat(s.endAt)}
              <br />Titik cek tiap 60 menit
            </p>
            <AbsenPanel
              session={{
                id: s.id,
                endAt: s.endAt.getTime(),
                eventName: s.event.name,
                jobdesc: s.jobdesc,
              }}
              lastAt={lastAt(s.absensi)}
              existing={s.absensi.map((a) => ({
                id: a.id,
                kind: a.kind,
                status: a.status,
                checkedAt: fmtSingkat(a.checkedAt),
                distanceM: a.distanceM,
                insideRadius: a.insideRadius,
                activity: a.activity,
                note: a.note,
              }))}
            />
          </div>
        );
      })}

      <Link href="/riwayat" className="btn-ghost">Lihat riwayat absen saya</Link>
    </div>
  );
}
