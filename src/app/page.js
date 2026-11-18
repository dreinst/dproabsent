import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ambilCache, KUNCI_SESI_AKTIF } from "@/lib/cache";
import { fmtWaktu, fmtSingkat } from "@/lib/waktu";
import { jedaSesi } from "@/lib/aturan";
import LogoutButton from "@/components/LogoutButton";
import AbsenPanel from "@/components/AbsenPanel";
import FotoProfil from "@/components/FotoProfil";
import BantuanWa from "@/components/BantuanWa";

export const dynamic = "force-dynamic";

// Waktu absen terakhir yang memulai hitungan titik cek berikutnya (masuk atau titik cek).
function lastAt(absensi) {
  const aktif = absensi.filter((a) => a.kind !== "PULANG");
  return aktif.length ? aktif[aktif.length - 1].checkedAt.getTime() : null;
}

export default async function CrewHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Owner dan superadmin kadang turun jadi crew, jadi mereka juga boleh absen di sini.
  const admin = isAdmin(user);

  // Daftar sesi acara aktif sama untuk semua crew, jadi disimpan di cache 15 detik.
  // Cache dikosongkan oleh aksi admin yang mengubah acara atau sesi (src/app/admin/actions.js).
  const daftarSesi = await ambilCache(KUNCI_SESI_AKTIF, 15, () =>
    prisma.session.findMany({
      where: { event: { active: true } },
      include: { event: true },
      orderBy: { startAt: "asc" },
    })
  );
  // Absen milik crew yang login selalu diambil langsung dari database.
  const absenSaya = daftarSesi.length
    ? await prisma.absensi.findMany({
        where: { userId: user.id, sessionId: { in: daftarSesi.map((s) => s.id) } },
        orderBy: { checkedAt: "asc" },
        // omit photo: foto diambil lewat /api/foto/[id], tidak ikut dimuat dari database.
        omit: { photo: true },
      })
    : [];
  const sessions = daftarSesi.map((s) => ({ ...s, absensi: absenSaya.filter((a) => a.sessionId === s.id) }));
  const now = new Date();

  return (
    <div className="wrap">
      <div className="topbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
        <div className="row">
          {admin && <Link href="/admin" className="btn-ghost btn-kecil">Panel admin</Link>}
          <LogoutButton />
        </div>
      </div>
      <div className="judul">
        <h1>Absen saya</h1>
      </div>
      <FotoProfil id={user.id} nama={user.name} avatar={user.avatar} />

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
              <br />Titik cek tiap {jedaSesi(s)} menit
            </p>
            <AbsenPanel
              session={{
                id: s.id,
                endAt: s.endAt.getTime(),
                jedaMenit: jedaSesi(s),
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
      {/* Kendala apa pun saat absen langsung ke WhatsApp Andrew. */}
      <div className="butuh-bantuan">
        <div className="judul-bantuan">Ada kendala saat absen?</div>
        <BantuanWa jenis={["lain"]} label="Chat Andrew" />
      </div>
    </div>
  );
}
