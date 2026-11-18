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
    <div className="wrap crew">
      {/* Blok hero navy ala landing: bilah kaca berisi logo dan tombol akun, lalu judul dan foto profil. */}
      <header className="crew-hero">
        <nav className="bilah" aria-label="Akun">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
          <div className="row">
            {admin && <Link href="/admin" className="btn-ghost btn-kecil">Panel admin</Link>}
            <LogoutButton />
          </div>
        </nav>
        <div className="crew-hero-isi">
          <div className="judul">
            <h1>Absen saya</h1>
          </div>
          <FotoProfil id={user.id} nama={user.name} avatar={user.avatar} />
        </div>
      </header>

      {sessions.length === 0 && (
        <div className="card">
          <h2>Belum ada sesi aktif</h2>
          <p className="sub">Sesi tugas akan tampil di sini setelah dibuka oleh kantor.</p>
        </div>
      )}

      {/* Satu kartu per acara. Sesi yang sedang berlangsung tampil paling atas, lalu yang masih menunggu absen pulang,
          lalu yang akan datang. Sesi yang sudah berakhir dilipat di bagian bawah kartu. */}
      {kelompokAcara(sessions, now).map((g) => (
        <section className="card acara-kartu" key={g.event.id} aria-label={g.event.name}>
          <div className="acara-kop">
            <h2>{g.event.name}</h2>
            {g.event.client && <p className="meta">{g.event.client}</p>}
          </div>
          {g.utama.map((s) => <SesiBlok key={s.id} s={s} now={now} />)}
          {g.lewat.length > 0 && (
            <details className="sesi-lewat">
              <summary>Sesi yang sudah berakhir ({g.lewat.length})</summary>
              {g.lewat.map((s) => <SesiBlok key={s.id} s={s} now={now} />)}
            </details>
          )}
        </section>
      ))}

      {/* Di laptop kolom ini menempel di kanan daftar acara, di HP tampil di bawahnya. */}
      <aside className="crew-samping">
        <Link href="/riwayat" className="btn-ghost">Lihat riwayat absen saya</Link>
        {/* Kendala apa pun saat absen langsung ke WhatsApp Andrew. */}
        <div className="butuh-bantuan">
          <div className="judul-bantuan">Mengalami kendala saat absen?</div>
          <BantuanWa jenis={["lain"]} label="Hubungi Andrew" />
        </div>
      </aside>
    </div>
  );
}

// Kelompokkan sesi per acara dari daftar sesi yang sudah dimuat, tanpa query tambahan.
// Urutan sesi dan acara: sedang berlangsung (0), sudah absen masuk tetapi belum pulang (1),
// akan datang (2), lalu sudah berakhir (3). Sesi berurutan 3 dilipat di bawah kartu.
function kelompokAcara(sessions, now) {
  const peta = new Map();
  for (const s of sessions) {
    const masuk = s.absensi.some((a) => a.kind === "MASUK");
    const pulang = s.absensi.some((a) => a.kind === "PULANG");
    const jalan = s.startAt <= now && now <= s.endAt;
    const urut = jalan ? 0 : masuk && !pulang ? 1 : now < s.startAt ? 2 : 3;
    if (!peta.has(s.eventId)) peta.set(s.eventId, { event: s.event, sesi: [] });
    peta.get(s.eventId).sesi.push({ s, urut });
  }
  const daftar = [...peta.values()].map((g) => {
    g.sesi.sort((a, b) => a.urut - b.urut || a.s.startAt - b.s.startAt);
    return {
      event: g.event,
      urut: g.sesi[0].urut,
      mulai: g.sesi[0].s.startAt,
      utama: g.sesi.filter((x) => x.urut < 3).map((x) => x.s),
      lewat: g.sesi.filter((x) => x.urut === 3).map((x) => x.s),
    };
  });
  return daftar.sort((a, b) => a.urut - b.urut || a.mulai - b.mulai);
}

// Satu sesi di dalam kartu acara: status, jam, jarak absen progres, dan panel absennya.
function SesiBlok({ s, now }) {
  const jalan = s.startAt <= now && now <= s.endAt;
  return (
    <div className={jalan ? "sesi-blok jalan" : "sesi-blok"}>
      <div className="sesi-info">
        <div className={jalan ? "mata merah" : "mata"}>
          {jalan ? "Sedang berlangsung" : now < s.startAt ? "Akan datang" : "Sudah berakhir"}
        </div>
        <h3>{s.jobdesc}</h3>
        <p className="sub">
          {fmtWaktu(s.startAt)} sampai {fmtSingkat(s.endAt)}
          <br />Absen progres setiap {jedaSesi(s)} menit
        </p>
      </div>
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
}
