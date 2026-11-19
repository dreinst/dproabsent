import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rekapUpah } from "@/lib/data-upah";
import { fmtRupiah, fmtDurasi, samarkanHp, catatanSesi } from "@/lib/upah";
import { fmtHari, fmtJam, TZ } from "@/lib/waktu";
import TombolCetak from "@/components/TombolCetak";

export const dynamic = "force-dynamic";

const fmtHariPanjang = new Intl.DateTimeFormat("id-ID", {
  timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
});

// Judul tab juga menjadi nama berkas bawaan saat slip disimpan sebagai PDF.
export async function generateMetadata({ searchParams }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return { title: "Slip upah" };
  const sp = await searchParams;
  const [akun, acara] = await Promise.all([
    prisma.user.findUnique({ where: { id: Number(sp.user) || 0 }, select: { name: true } }),
    prisma.event.findUnique({ where: { id: Number(sp.acara) || 0 }, select: { name: true } }),
  ]);
  return { title: akun && acara ? `Slip upah ${akun.name}, ${acara.name}` : "Slip upah" };
}

// "18 Nov 2026" atau "17 Nov 2026 sampai 18 Nov 2026".
function rentang(awal, akhir) {
  if (!awal) return "-";
  const a = fmtHari(awal);
  const b = akhir ? fmtHari(akhir) : a;
  return a === b ? a : `${a} sampai ${b}`;
}

export default async function SlipPage({ searchParams }) {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  if (!isAdmin(admin)) redirect("/");

  const sp = await searchParams;
  const sekarang = new Date();
  const rekap = await rekapUpah(sp.acara, sekarang);
  if (!rekap) notFound();
  const r = rekap.orang.find((o) => String(o.user.id) === String(sp.user));
  if (!r) notFound();

  const { acara, tarif } = rekap;
  const kapten = r.peran === "KAPTEN";
  const sesiPerId = new Map(rekap.sesi.map((s) => [s.id, s]));
  const periode = rekap.sesi.length
    ? rentang(rekap.sesi[0].startAt, rekap.sesi.reduce((m, s) => (s.endAt > m ? s.endAt : m), rekap.sesi[0].endAt))
    : rentang(acara.startAt, acara.endAt);

  return (
    <div className="slip-hal">
      <div className="slip-alat">
        <Link href={`/admin/upah?acara=${acara.id}`} className="btn-ghost btn-kecil">Kembali ke rekap upah</Link>
        <TombolCetak />
      </div>

      <article className="slip">
        <header className="slip-kop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dpro.svg" alt="D'Production" />
          <div>
            <h1>Slip Upah</h1>
            <p>{acara.name}</p>
          </div>
        </header>

        <dl className="slip-data">
          <div><dt>Nama</dt><dd>{r.user.name}</dd></div>
          <div><dt>Nomor HP</dt><dd>{samarkanHp(r.user.phone)}</dd></div>
          <div><dt>Peran</dt><dd>{kapten ? "Kapten acara" : "Crew"}</dd></div>
          <div><dt>Acara</dt><dd>{acara.name}{acara.client ? `, ${acara.client}` : ""}</dd></div>
          <div><dt>Periode acara</dt><dd>{periode}</dd></div>
          <div><dt>Tarif</dt><dd>{kapten ? `${fmtRupiah(tarif.kaptenPerHari)} per hari` : `${fmtRupiah(tarif.crewPerJam)} per jam`}</dd></div>
        </dl>

        <h2 className="slip-sub">{kapten ? "Rincian per hari" : "Rincian per sesi"}</h2>
        <div className="slip-gulir">
          {kapten ? (
            <table className="slip-tabel">
              <thead>
                <tr><th>Tanggal</th><th>Sesi dengan absen masuk sah</th><th>Masuk pertama</th><th className="kanan">Upah</th></tr>
              </thead>
              <tbody>
                {r.hari.length === 0 && (
                  <tr><td colSpan={4} className="slip-kosong">Belum ada absen masuk yang disahkan.</td></tr>
                )}
                {r.hari.map((h) => (
                  <tr key={h.tanggal}>
                    <td>{fmtHari(h.masuk[0].checkedAt)}</td>
                    <td>{[...new Set(h.masuk.map((a) => sesiPerId.get(a.sessionId)?.jobdesc ?? "Sesi"))].join(", ")}</td>
                    <td>{fmtJam(h.masuk[0].checkedAt)}</td>
                    <td className="kanan">{fmtRupiah(h.upah)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Total ({r.jumlahHari} hari x {fmtRupiah(tarif.kaptenPerHari)})</td><td className="kanan">{fmtRupiah(r.upah)}</td></tr>
              </tfoot>
            </table>
          ) : (
            <table className="slip-tabel">
              <thead>
                <tr>
                  <th>Tanggal</th><th>Sesi</th><th>Masuk</th><th>Pulang</th>
                  <th className="kanan">Jam dibayar</th><th className="kanan">Lembur</th><th className="kanan">Upah</th>
                </tr>
              </thead>
              <tbody>
                {r.sesi.length === 0 && (
                  <tr><td colSpan={7} className="slip-kosong">Belum ada absen.</td></tr>
                )}
                {r.sesi.map((x) => {
                  const ket = catatanSesi(x);
                  return [
                    <tr key={x.sesi.id} className={ket.length ? "ada-ket" : undefined}>
                      <td>{fmtHari(x.sesi.startAt)}</td>
                      <td>
                        <b>{x.sesi.jobdesc}</b>
                        <span className="slip-jadwal">{fmtJam(x.sesi.startAt)} sampai {fmtJam(x.sesi.endAt)}</span>
                      </td>
                      <td>{x.masuk ? fmtJam(x.masuk.checkedAt) : "-"}</td>
                      <td>{x.pulang ? `${fmtJam(x.pulang.checkedAt)}${x.pulang.otomatis ? " (sistem)" : ""}` : "-"}</td>
                      <td className="kanan">{fmtDurasi(x.menitDibayar)}</td>
                      <td className="kanan">{x.menitLembur ? fmtDurasi(x.menitLembur) : "-"}</td>
                      <td className="kanan">{fmtRupiah(x.upah)}</td>
                    </tr>,
                    ket.length > 0 && (
                      <tr key={`${x.sesi.id}-ket`} className="slip-ket">
                        <td colSpan={7}>{ket.join(" ")}</td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="kanan">{fmtDurasi(r.menitDibayar)}</td>
                  <td className="kanan">{r.menitLembur ? fmtDurasi(r.menitLembur) : "-"}</td>
                  <td className="kanan">{fmtRupiah(r.upah)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="slip-total">
          <span>Total upah</span>
          <b>{fmtRupiah(r.upah)}</b>
        </div>

        <section className="slip-dasar">
          <h2 className="slip-sub">Dasar perhitungan</h2>
          {kapten ? (
            <p>
              Kapten acara dibayar per hari dengan tarif {fmtRupiah(tarif.kaptenPerHari)} per hari. Jumlah hari adalah banyaknya
              tanggal (WIB) yang memiliki absen masuk yang telah disahkan dan tidak ditolak, sehingga beberapa sesi pada tanggal
              yang sama dihitung sebagai satu hari.
            </p>
          ) : (
            <p>
              Upah crew dihitung per jam dengan tarif {fmtRupiah(tarif.crewPerJam)} per jam berdasarkan waktu kerja yang tercatat
              melalui absen dan telah disahkan. Waktu kerja dihitung dari absen masuk sampai absen pulang dan dibatasi oleh jadwal
              sesi. Setiap rentang waktu di antara dua absen berurutan dibayar paling lama sebesar jarak absen progres sesi ditambah
              5 menit, dan hanya dibayar apabila absen penutupnya telah disahkan. Absen yang ditolak tidak diperhitungkan, dan sesi
              dengan absen masuk yang ditolak tidak dibayar. Waktu kerja di atas {tarif.jamPerShift} jam dalam satu sesi dicatat
              sebagai lembur dan dibayar dengan tarif per jam yang sama. Waktu absen dihitung per menit penuh, dan upah setiap sesi
              dibulatkan ke rupiah terdekat.
            </p>
          )}
          {r.menunggu > 0 && (
            <p className="slip-perhatian">
              Pada saat slip ini dicetak, terdapat {r.menunggu} absen yang belum disahkan dan belum diperhitungkan dalam slip ini.
            </p>
          )}
        </section>

        <footer className="slip-kaki">
          <p>
            Dicetak pada {fmtHariPanjang.format(sekarang)}, pukul {fmtJam(sekarang)} WIB
            <br />oleh {admin.name}.
          </p>
          <div className="slip-ttd">
            <span>Disetujui oleh,</span>
            <span className="slip-garis" />
            <span>Nama dan tanda tangan</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
