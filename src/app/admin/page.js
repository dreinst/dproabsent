import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import AdminActions from "@/components/AdminActions";

export const dynamic = "force-dynamic";

const fmt = (d) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(d);

const KIND = { MASUK: "Masuk", CHECKPOINT: "Titik cek", PULANG: "Pulang" };

function badgeClass(status, insideRadius) {
  if (!insideRadius) return "bad";
  if (status === "TERLAMBAT") return "warn";
  if (status === "TIDAK_HADIR") return "bad";
  return "ok";
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const rows = await prisma.absensi.findMany({
    include: { user: true, session: { include: { event: true } } },
    orderBy: { checkedAt: "desc" },
    take: 100,
  });

  const belum = rows.filter((r) => !r.verifiedAt).length;

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>Verifikasi absen</h1>
          <div className="who">{user.name} · {user.role}</div>
        </div>
        <LogoutButton />
      </div>

      <div className="card">
        <h2>Ringkasan</h2>
        <p className="sub">
          {rows.length} absen terbaru · <b>{belum}</b> belum disahkan.
        </p>
      </div>

      {rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="list-item">
            <img className="thumb" src={r.photo} alt={`Foto absen ${r.user.name}`} />
            <div className="grow">
              <div><b>{r.user.name}</b> <span className="badge muted">{KIND[r.kind]}</span></div>
              <div className="meta">{r.session.event.name} · {r.session.jobdesc}</div>
              <div className="meta">
                {fmt(r.checkedAt)} ·{" "}
                <span className={`badge ${badgeClass(r.status, r.insideRadius)}`}>{r.status}</span>{" "}
                <span className={`badge ${r.insideRadius ? "muted" : "bad"}`}>{r.distanceM} m</span>{" "}
                {r.verifiedAt
                  ? <span className="badge ok">sah</span>
                  : <span className="badge warn">belum</span>}
              </div>
              {r.note && <div className="note">{r.note}</div>}
            </div>
          </div>
          <AdminActions id={r.id} verified={!!r.verifiedAt} />
        </div>
      ))}
    </div>
  );
}
