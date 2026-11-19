import Avatar from "@/components/Avatar";
import FotoAbsen from "@/components/FotoAbsen";
import AdminActions, { SahkanSemua } from "@/components/AdminActions";
import { fmtSingkat, fmtHari, fmtJam, fmtTanggal } from "@/lib/waktu";
import { KIND, STATUS, nadaStatus } from "@/lib/label";

// Hak bawaan untuk owner dan superadmin: semua tombol tampil.
const SEMUA = () => ({ putus: true, batal: true, alasan: null });

// "Disahkan oleh Dimas" atau "Ditolak oleh Bayu (Kapten)". Pengesah yang bukan owner atau superadmin adalah kapten.
// Absen ditolak tersimpan sebagai TIDAK_HADIR yang sudah diputuskan. verifiedBy perlu ikut dimuat (name dan role).
export function keputusan(r) {
  if (!r.verifiedAt) return "Belum disahkan";
  const kata = r.status === "TIDAK_HADIR" ? "Ditolak" : "Disahkan";
  if (!r.verifiedBy) return `Sudah ${kata.toLowerCase()}`;
  return `${kata} oleh ${r.verifiedBy.name}${r.verifiedBy.role === "CREW" ? " (Kapten)" : ""}`;
}

// Kartu absen satu crew dalam satu sesi: profil, ringkasan, tombol Sahkan semua, dan grid foto
// yang bisa diperbesar beserta tombol Sahkan dan Tolak. items berisi absen sesi itu, urut dari yang paling awal.
// Dipakai di halaman Verifikasi admin dan Panel kapten. hak(r) mengembalikan { putus, batal, alasan } untuk satu absen
// (lihat hakKapten di src/lib/kapten.js); tanpa hak, semua tombol tampil seperti untuk owner dan superadmin.
export default function KartuAbsen({ user, session, items, hak = SEMUA }) {
  const awal = items[0].checkedAt;
  const akhir = items[items.length - 1].checkedAt;
  const hakAbsen = new Map(items.map((r) => [r.id, hak(r)]));
  const belum = items.filter((r) => !r.verifiedAt);
  const idBisaSah = belum.filter((r) => hakAbsen.get(r.id).putus).map((r) => r.id);
  const nTelat = items.filter((r) => r.status === "TERLAMBAT").length;
  const nLuar = items.filter((r) => !r.insideRadius).length;
  const tanpaPulang = items.some((r) => r.otomatis);
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
                {items.length} absen{belum.length > 0 ? `, ${belum.length} belum disahkan` : ""}
              </span>
              {nTelat > 0 && <span className="badge warn">{nTelat} terlambat</span>}
              {nLuar > 0 && <span className="badge bad">{nLuar} di luar radius</span>}
              {tanpaPulang && <span className="badge warn">Tidak absen pulang</span>}
            </div>
          </div>
        </div>
        <div className="grup-aksi">
          {idBisaSah.length > 0 ? <SahkanSemua ids={idBisaSah} />
            : belum.length > 0 ? <span className="badge muted">Pengesahan oleh owner atau superadmin</span>
            : <span className="badge ok">Semua sudah sah</span>}
        </div>
      </div>
      <div className="grup-foto">
        {items.map((r) => {
          const h = hakAbsen.get(r.id);
          const ditolak = r.verifiedAt && r.status === "TIDAK_HADIR";
          return (
            <div className="grup-item" key={r.id}>
              <FotoAbsen
                id={r.id} nama={user.name} jam={fmtJam(r.checkedAt)} tanpaFoto={r.otomatis}
                ket={[
                  `${session.event.name} · ${session.jobdesc}`,
                  `${KIND[r.kind]} · ${fmtTanggal(r.checkedAt)}`,
                  r.otomatis ? `${STATUS[r.status]} · dicatat sistem, tanpa foto dan lokasi` : `${STATUS[r.status]} · ${r.distanceM} m dari titik acara`,
                  ...(r.activity ? [`Yang dikerjakan: ${r.activity}`] : []),
                  ...(r.note ? [`Catatan: ${r.note}`] : []),
                  keputusan(r),
                ]}
              >
                {r.verifiedAt
                  ? h.batal && <AdminActions id={r.id} verified tutupDialog />
                  : h.putus ? <AdminActions id={r.id} verified={false} tutupDialog />
                  : h.alasan && <p className="foto-aksi-ket">{h.alasan}</p>}
              </FotoAbsen>
              <div className="grup-jenis">{KIND[r.kind]}</div>
              <div className="lencana">
                {r.otomatis && <span className="badge warn">Tidak absen pulang</span>}
                {r.status !== "HADIR" && <span className={`badge ${nadaStatus(r.status)}`}>{STATUS[r.status]}</span>}
                {!r.otomatis && <span className={`badge ${r.insideRadius ? "muted" : "bad"}`}>{r.distanceM} m</span>}
                {ditolak ? <span className="badge bad">Ditolak</span>
                  : r.verifiedAt ? <span className="badge ok">Sah</span> : <span className="badge warn">Belum sah</span>}
              </div>
              {r.verifiedAt && <div className="meta grup-oleh">{keputusan(r)}</div>}
              {r.activity && <div className="meta">{r.activity}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
