import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { daftarAcaraUpah, pilihAcara, rekapUpah } from "@/lib/data-upah";
import { DAFTAR_TARIF, bacaTarif } from "@/lib/pengaturan";
import { fmtRupiah, fmtDurasi } from "@/lib/upah";
import { fmtHari, fmtTanggal } from "@/lib/waktu";
import AdminShell, { Panel } from "@/components/AdminShell";
import PilihAcara from "@/components/PilihAcara";
import { BarisSaring } from "@/components/Saringan";
import Avatar from "@/components/Avatar";
import { simpanTarifAksi } from "./actions";

export const dynamic = "force-dynamic";

const KOL = { "--kol": "minmax(0, 1.6fr) 60px 136px 116px 56px 92px 132px 72px" };
const strip = "-";

function FormTarif({ tarif, acaraId, galat, tutup }) {
  return (
    <form action={simpanTarifAksi}>
      {acaraId && <input type="hidden" name="acara" value={acaraId} />}
      {galat && <div className="err" style={{ marginTop: 12 }}>{galat}</div>}
      {DAFTAR_TARIF.map((t) => (
        <div key={t.nama}>
          <label htmlFor={`tarif-${t.nama}`}>{t.label} ({t.satuan})</label>
          <input
            id={`tarif-${t.nama}`} type="number" name={t.nama} inputMode="numeric"
            min="1" max={t.maks} step="1" required defaultValue={tarif[t.nama]}
          />
        </div>
      ))}
      <p className="meta" style={{ margin: "8px 0 0" }}>
        Waktu kerja di atas jam kerja normal dalam satu sesi ditampilkan sebagai lembur, dengan tarif per jam yang sama.
      </p>
      <p className="note">
        Tarif baru langsung berlaku untuk seluruh rekap dan slip, termasuk acara yang sudah selesai. Slip yang sudah dicetak tidak ikut berubah.
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn-primary" style={{ width: "auto" }}>Simpan tarif</button>
        <Link href={tutup} className="btn-ghost">Batal</Link>
      </div>
    </form>
  );
}

// Sel angka: di layar lebar label diambil dari baris judul, di layar sempit dari data-label.
function Sel({ label, children, kosongHp }) {
  return <div className={kosongHp ? "u-angka u-tanpa-hp" : "u-angka"} data-label={label}>{children}</div>;
}

export default async function UpahPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const sp = await searchParams;
  const daftar = await daftarAcaraUpah();
  const terpilih = pilihAcara(daftar, sp.acara);
  const rekap = terpilih ? await rekapUpah(terpilih.id) : null;
  const acaraId = terpilih?.id;
  const panelTarif = Boolean(sp.tarif);
  const tarif = rekap?.tarif ?? (panelTarif ? await bacaTarif() : null);

  // Tautan halaman ini dengan acara yang sedang dipilih, ditambah parameter lain kalau perlu.
  const href = (tambahan = {}) => {
    const u = new URLSearchParams(acaraId ? { acara: String(acaraId) } : {});
    for (const [k, v] of Object.entries(tambahan)) u.set(k, v);
    const qs = u.toString();
    return qs ? `/admin/upah?${qs}` : "/admin/upah";
  };
  // Pesan galat dari form tarif tampil di dalam panel, bukan di atas halaman yang tertutup panel.
  const pesan = { ok: sp.ok, err: panelTarif ? undefined : sp.err };

  const aksi = (
    <div className="row u-aksi">
      <Link href={href({ tarif: "1" })} className="btn-ghost">Ubah tarif</Link>
      {rekap && (
        <a href={`/admin/upah/csv?acara=${acaraId}`} className="btn-primary" style={{ width: "auto" }} download>
          Unduh CSV
        </a>
      )}
    </div>
  );

  return (
    <AdminShell
      user={user} tab="/admin/upah" title="Upah" pesan={pesan} aksi={aksi}
      sub="Rekap upah crew dan kapten per acara. Upah dihitung dari absen yang telah disahkan."
    >
      {!terpilih && <div className="kosong">Belum ada acara.</div>}

      {terpilih && (
        <BarisSaring judul="Acara">
          <PilihAcara
            aktif={href()}
            pilihan={daftar.map((e) => [
              `/admin/upah?acara=${e.id}`,
              `${e.name} (${fmtHari(e.startAt)})${e.active ? "" : ", nonaktif"}`,
            ])}
          />
        </BarisSaring>
      )}

      {rekap && (
        <>
          {rekap.dataLama > 0 && (
            <div className="u-pesan">
              Acara ini memuat {rekap.dataLama} absen dari sistem lama. Data lama hanya berisi absen masuk tanpa absen pulang,
              sehingga tidak menghasilkan jam dibayar menurut aturan upah per jam.
            </div>
          )}
          {rekap.tarif.bawaan.length > 0 && (
            <div className="u-pesan">
              Sebagian tarif belum tersimpan di database, sehingga memakai nilai bawaan. Silakan simpan ulang tarif.
            </div>
          )}

          <div className="u-ringkas">
            <div className="u-kotak utama">
              <span>Total upah</span>
              <b>{fmtRupiah(rekap.total.upah)}</b>
              <small>{rekap.total.orang} orang</small>
            </div>
            <div className="u-kotak">
              <span>Crew</span>
              <b>{fmtRupiah(rekap.total.upahCrew)}</b>
              <small>{rekap.total.crew} orang, {fmtDurasi(rekap.total.menitDibayar)} dibayar</small>
            </div>
            <div className="u-kotak">
              <span>Kapten</span>
              <b>{fmtRupiah(rekap.total.upahKapten)}</b>
              <small>{rekap.total.kapten} orang, {rekap.total.jumlahHari} hari</small>
            </div>
            <div className={rekap.total.menunggu ? "u-kotak warn" : "u-kotak"}>
              <span>Menunggu pengesahan</span>
              <b>{rekap.total.menunggu} absen</b>
              <small>
                {rekap.total.menunggu
                  ? <Link href={`/admin?acara=${acaraId}`}>Buka halaman verifikasi</Link>
                  : "Tidak ada absen yang menunggu."}
              </small>
            </div>
          </div>

          <p className="meta u-tarif">
            Tarif berlaku: crew <b>{fmtRupiah(rekap.tarif.crewPerJam)}</b> per jam, kapten <b>{fmtRupiah(rekap.tarif.kaptenPerHari)}</b> per hari.
            {" "}Waktu kerja di atas <b>{rekap.tarif.jamPerShift} jam</b> per sesi ditampilkan sebagai lembur.
            {rekap.tarif.diubah && <> Terakhir disimpan {fmtTanggal(rekap.tarif.diubah)}.</>}
          </p>

          <div className="tabel tabel-upah">
            <div className="baris kop" style={KOL}>
              <div>Nama</div>
              <div className="kanan">Sesi</div>
              <div className="kanan">Jam dibayar</div>
              <div className="kanan">Lembur</div>
              <div className="kanan">Hari</div>
              <div className="kanan">Menunggu</div>
              <div className="kanan">Upah</div>
              <div />
            </div>
            {rekap.orang.length === 0 && <div className="kosong">Belum ada absen di acara ini.</div>}
            {rekap.orang.map((r) => {
              const kapten = r.peran === "KAPTEN";
              return (
                <div className="baris u-baris" style={KOL} key={r.user.id}>
                  <div className="u-nama">
                    <Avatar id={r.user.id} nama={r.user.name} avatar={r.user.avatar} ukuran={36} />
                    <div className="u-nama-teks">
                      <b>{r.user.name}</b>
                      {kapten ? <span className="badge navy">Kapten</span> : <span className="u-peran">Crew</span>}
                    </div>
                  </div>
                  <div className="u-fakta">
                    <Sel label="Sesi">{r.sesiDihadiri}</Sel>
                    <Sel label="Jam dibayar" kosongHp={kapten}>{kapten ? strip : fmtDurasi(r.menitDibayar)}</Sel>
                    <Sel label="Lembur" kosongHp={kapten || !r.menitLembur}>{kapten ? strip : r.menitLembur ? fmtDurasi(r.menitLembur) : strip}</Sel>
                    <Sel label="Hari" kosongHp={!kapten}>{kapten ? r.jumlahHari : strip}</Sel>
                    <Sel label="Menunggu" kosongHp={!r.menunggu}>
                      {r.menunggu ? <span className="badge warn">{r.menunggu}</span> : 0}
                    </Sel>
                  </div>
                  <div className="u-upah">{fmtRupiah(r.upah)}</div>
                  <div className="u-slip">
                    <Link href={`/admin/upah/slip?acara=${acaraId}&user=${r.user.id}`} className="tautan">Slip</Link>
                  </div>
                  {r.catatan.length > 0 && <div className="u-catatan">{r.catatan.join(". ")}.</div>}
                </div>
              );
            })}
            {rekap.orang.length > 0 && (
              <div className="baris u-baris u-total" style={KOL}>
                <div className="u-nama"><b>Total ({rekap.total.orang} orang)</b></div>
                <div className="u-fakta">
                  <Sel label="Sesi">{rekap.total.sesiDihadiri}</Sel>
                  <Sel label="Jam dibayar">{fmtDurasi(rekap.total.menitDibayar)}</Sel>
                  <Sel label="Lembur" kosongHp={!rekap.total.menitLembur}>{rekap.total.menitLembur ? fmtDurasi(rekap.total.menitLembur) : strip}</Sel>
                  <Sel label="Hari" kosongHp={!rekap.total.jumlahHari}>{rekap.total.jumlahHari}</Sel>
                  <Sel label="Menunggu" kosongHp={!rekap.total.menunggu}>{rekap.total.menunggu}</Sel>
                </div>
                <div className="u-upah">{fmtRupiah(rekap.total.upah)}</div>
                <div className="u-slip" />
              </div>
            )}
          </div>
          <p className="meta">
            Kolom Sesi berisi jumlah sesi yang dihadiri (absen masuk tidak ditolak). Kolom Menunggu berisi absen yang belum disahkan
            dan belum diperhitungkan, sehingga upah dapat berubah setelah absen tersebut disahkan atau ditolak.
          </p>

          <details className="card u-cara">
            <summary>Cara menghitung upah</summary>
            <ul>
              <li>Crew dibayar per jam sebesar {fmtRupiah(rekap.tarif.crewPerJam)}. Waktu kerja dihitung dari absen masuk sampai absen pulang, hanya di dalam jadwal sesi.</li>
              <li>Waktu di antara dua absen berurutan dibayar paling lama sebesar jarak absen progres sesi ditambah 5 menit, misalnya 65 menit untuk jarak 60 menit. Kelebihannya tidak dibayar.</li>
              <li>Waktu tersebut baru dibayar setelah absen penutupnya disahkan. Absen yang ditolak tidak dihitung. Jika absen masuk ditolak, sesi tersebut tidak dibayar.</li>
              <li>Pulang yang dicatat sistem diperlakukan sama dengan absen pulang lainnya dan baru dibayar setelah disahkan.</li>
              <li>Waktu di atas {rekap.tarif.jamPerShift} jam dalam satu sesi ditampilkan sebagai lembur dan dibayar dengan tarif per jam yang sama.</li>
              <li>Upah setiap sesi dibulatkan ke rupiah terdekat. Waktu absen dihitung per menit penuh sesuai jam yang tampil di layar.</li>
              <li>Kapten acara dibayar {fmtRupiah(rekap.tarif.kaptenPerHari)} per hari. Jumlah hari adalah banyaknya tanggal (WIB) yang memiliki absen masuk yang telah disahkan.</li>
            </ul>
          </details>
        </>
      )}

      {panelTarif && tarif && (
        <Panel title="Ubah tarif" tutup={href()}>
          <FormTarif tarif={tarif} acaraId={acaraId} galat={sp.err} tutup={href()} />
        </Panel>
      )}
    </AdminShell>
  );
}
