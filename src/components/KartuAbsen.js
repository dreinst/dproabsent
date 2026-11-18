import Avatar from "@/components/Avatar";
import FotoAbsen from "@/components/FotoAbsen";
import AdminActions, { SahkanSemua } from "@/components/AdminActions";
import { fmtSingkat, fmtHari, fmtJam, fmtTanggal } from "@/lib/waktu";
import { KIND, STATUS, nadaStatus } from "@/lib/label";

// Kartu absen satu crew dalam satu sesi: profil, ringkasan, tombol Sahkan semua, dan grid foto
// yang bisa diperbesar beserta tombol Sahkan dan Tolak. items berisi absen sesi itu, urut dari yang paling awal.
// Dipakai di halaman Verifikasi dan bisa dipakai ulang di halaman lain yang menampilkan absen per crew per sesi.
export default function KartuAbsen({ user, session, items }) {
  const awal = items[0].checkedAt;
  const akhir = items[items.length - 1].checkedAt;
  const idBelum = items.filter((r) => !r.verifiedAt).map((r) => r.id);
  const nTelat = items.filter((r) => r.status === "TERLAMBAT").length;
  const nLuar = items.filter((r) => !r.insideRadius).length;
  const rentang = items.length === 1 ? fmtSingkat(awal)
    : fmtHari(awal) === fmtHari(akhir) ? `${fmtSingkat(awal)} sampai ${fmtJam(akhir)}`
    : `${fmtSingkat(awal)} sampai ${fmtSingkat(akhir)}`;

  return (
    <section className="grup" aria-label={`Absen ${user.name}`}>
      <div className="grup-kop">
        <div className="grup-profil">
          <Avatar id={user.id} nama={user.name} avatar={user.avatar} ukuran={48} />
          <div className="grup-info">
            <div className="grup-nama">{user.name}</div>
            <div className="meta"><b>{session.event.name}</b> · {session.jobdesc}</div>
            <div className="meta">{rentang}</div>
            <div className="lencana">
              <span className="badge muted">
                {items.length} absen{idBelum.length > 0 ? `, ${idBelum.length} belum disahkan` : ""}
              </span>
              {nTelat > 0 && <span className="badge warn">{nTelat} terlambat</span>}
              {nLuar > 0 && <span className="badge bad">{nLuar} di luar radius</span>}
            </div>
          </div>
        </div>
        <div className="grup-aksi">
          {idBelum.length > 0 ? <SahkanSemua ids={idBelum} /> : <span className="badge ok">Semua sudah sah</span>}
        </div>
      </div>
      <div className="grup-foto">
        {items.map((r) => (
          <div className="grup-item" key={r.id}>
            <FotoAbsen
              id={r.id} nama={user.name} jam={fmtJam(r.checkedAt)}
              ket={[
                `${session.event.name} · ${session.jobdesc}`,
                `${KIND[r.kind]} · ${fmtTanggal(r.checkedAt)}`,
                `${STATUS[r.status]} · ${r.distanceM} m dari titik acara`,
                ...(r.activity ? [`Yang dikerjakan: ${r.activity}`] : []),
                ...(r.note ? [`Catatan: ${r.note}`] : []),
                r.verifiedAt ? "Sudah disahkan" : "Belum disahkan",
              ]}
            >
              <AdminActions id={r.id} verified={!!r.verifiedAt} tutupDialog />
            </FotoAbsen>
            <div className="grup-jenis">{KIND[r.kind]}</div>
            <div className="lencana">
              {r.status !== "HADIR" && <span className={`badge ${nadaStatus(r.status)}`}>{STATUS[r.status]}</span>}
              <span className={`badge ${r.insideRadius ? "muted" : "bad"}`}>{r.distanceM} m</span>
              {r.verifiedAt ? <span className="badge ok">Sah</span> : <span className="badge warn">Belum sah</span>}
            </div>
            {r.activity && <div className="meta">{r.activity}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
