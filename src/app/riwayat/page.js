import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

const fmt = (d) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);

const KIND = { MASUK: "Masuk", CHECKPOINT: "Titik cek", PULANG: "Pulang" };

function badgeClass(status, insideRadius) {
  if (!insideRadius) return "bad";
  if (status === "TERLAMBAT") return "warn";
  if (status === "TIDAK_HADIR") return "bad";
  return "ok";
}

export default async function RiwayatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");

  const rows = await prisma.absensi.findMany({
    where: { userId: user.id },
    include: { session: { include: { event: true } } },
    orderBy: { checkedAt: "desc" },
    take: 200,
  });

  return (
    <div className="wrap">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
          <div>
            <h1>Riwayat absen</h1>
            <div className="who">{user.name}</div>
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <Link href="/" className="btn-ghost" style={{ textDecoration: "none", padding: "10px 16px", borderRadius: 999 }}>
          Kembali ke absen
        </Link>
      </div>

      {rows.length === 0 && (
        <div className="card"><h2>Belum ada riwayat</h2><p className="sub">Absen pertamamu akan muncul di sini.</p></div>
      )}

      {rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="list-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="thumb" src={r.photo} alt={`Foto ${KIND[r.kind]}`} />
            <div className="grow">
              <div><b>{r.session.event.name}</b> <span className="badge muted">{KIND[r.kind]}</span></div>
              <div className="meta">{r.session.jobdesc} · {fmt(r.checkedAt)}</div>
              <div className="meta">
                <span className={`badge ${badgeClass(r.status, r.insideRadius)}`}>{r.status}</span>{" "}
                <span className={`badge ${r.insideRadius ? "muted" : "bad"}`}>{r.distanceM} m</span>{" "}
                {r.verifiedAt ? <span className="badge ok">sah</span> : <span className="badge warn">belum</span>}
              </div>
              {r.activity && <div className="meta"><b>Kegiatan:</b> {r.activity}</div>}
              {r.note && <div className="note">{r.note}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
