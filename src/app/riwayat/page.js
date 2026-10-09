import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtTanggal } from "@/lib/waktu";
import { KIND, STATUS, nadaStatus } from "@/lib/label";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
        <LogoutButton />
      </div>
      <div className="judul">
        <h1>Riwayat absen</h1>
        <p>{user.name}</p>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Link href="/" className="btn-ghost btn-kecil">Kembali ke absen</Link>
      </div>

      {rows.length === 0 && (
        <div className="card"><h2>Belum ada riwayat</h2><p className="sub">Absen pertamamu akan muncul di sini.</p></div>
      )}

      {rows.map((r) => (
        <div className="riwayat" key={r.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="thumb besar" src={r.photo} alt={`Foto ${KIND[r.kind]}`} />
          <div className="grow">
            <div className="tebal" style={{ fontSize: 15 }}>{r.session.event.name}</div>
            <div className="meta" style={{ margin: "2px 0 6px" }}>
              {r.session.jobdesc} · {KIND[r.kind]} · {fmtTanggal(r.checkedAt)}
            </div>
            <div className="lencana">
              <span className={`badge ${nadaStatus(r.status)}`}>{STATUS[r.status]}</span>
              <span className={`badge ${r.insideRadius ? "muted" : "bad"}`}>
                {r.distanceM} m{!r.insideRadius && ", luar radius"}
              </span>
              {r.verifiedAt ? <span className="badge ok">Sah</span> : <span className="badge warn">Belum disahkan</span>}
            </div>
            {r.activity && <div className="meta" style={{ marginTop: 6 }}>{r.activity}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
