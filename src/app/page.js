import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import AbsenPanel from "@/components/AbsenPanel";
import EnableReminders from "@/components/EnableReminders";

export const dynamic = "force-dynamic";

const fmt = (d) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(d);

export default async function CrewHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");

  const sessions = await prisma.session.findMany({
    where: { event: { active: true } },
    include: {
      event: true,
      absensi: { where: { userId: user.id }, orderBy: { checkedAt: "asc" } },
    },
    orderBy: { startAt: "asc" },
  });

  return (
    <div className="wrap">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
          <div>
            <h1>Absen saya</h1>
            <div className="who">{user.name}</div>
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="card">
        <h2>Pengingat absen</h2>
        <p className="sub">Nyalakan supaya HP mengingatkanmu absen di setiap titik cek.</p>
        <EnableReminders vapidPublic={process.env.VAPID_PUBLIC || process.env.NEXT_PUBLIC_VAPID_PUBLIC || ""} />
      </div>

      {sessions.length === 0 && (
        <div className="card">
          <h2>Belum ada sesi aktif</h2>
          <p className="sub">Tunggu kantor membuka sesi tugas untuk acara yang sedang berjalan.</p>
        </div>
      )}

      {sessions.map((s) => (
        <div className="card" key={s.id}>
          <h2>{s.event.name} <span className="badge muted">{s.jobdesc}</span></h2>
          <p className="sub">
            {fmt(s.startAt)} sampai {fmt(s.endAt)}
            {s.checkpointMinutes > 0 && ` · titik cek tiap ${s.checkpointMinutes} menit`}
          </p>
          <AbsenPanel
            session={{
              id: s.id,
              checkpointMinutes: s.checkpointMinutes,
              eventName: s.event.name,
              radiusM: s.event.radiusM,
            }}
            existing={s.absensi.map((a) => ({
              id: a.id,
              kind: a.kind,
              status: a.status,
              checkedAt: fmt(a.checkedAt),
              distanceM: a.distanceM,
              insideRadius: a.insideRadius,
              activity: a.activity,
              note: a.note,
              verified: !!a.verifiedAt,
            }))}
          />
        </div>
      ))}
    </div>
  );
}
