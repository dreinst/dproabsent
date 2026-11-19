"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BantuanWa from "@/components/BantuanWa";

// Teks panduan dipakai persis seperti yang ditetapkan pemilik. Jangan diubah tanpa izin.
const PEMBUKA =
  "Baca setiap poin dengan saksama, lalu centang sebagai tanda Anda telah memahaminya. Tombol Masuk dapat digunakan setelah semua poin dicentang.";
const POIN = [
  "Pastikan Anda berada di lokasi acara saat absen, dengan GPS dan internet menyala. Izinkan akses kamera dan lokasi ketika browser memintanya.",
  "Setelah masuk, pilih acara Anda, lalu pilih sesi yang bertanda \"Sedang berlangsung\". Absen masuk baru dapat dilakukan setelah jam mulai sesi.",
  "Tekan \"Absen masuk\", ambil foto langsung dari kamera, isi kolom \"Yang dikerjakan\", lalu tekan \"Kirim\". Absen masuk yang melewati batas toleransi (umumnya 15 menit setelah jam mulai) tercatat terlambat.",
  "Lakukan absen progres sesuai jarak yang tertera pada kartu sesi (umumnya setiap 60 menit), paling lambat 5 menit setelah waktunya. Aplikasi tidak mengirim notifikasi, jadi pantau hitung mundur pada kartu sesi.",
  "Pada jam selesai sesi, tekan \"Absen pulang\", ambil foto, isi kegiatan terakhir, lalu tekan \"Kirim\". Apabila belum absen pulang hingga 1 jam setelah sesi selesai, sistem mencatat pulang otomatis dengan keterangan tidak absen pulang.",
  "Absen di luar radius lokasi tetap tercatat, tetapi ditandai untuk diperiksa. Jam kerja dihitung dari absen yang disahkan kapten atau admin, jadi gunakan foto asli dan isi kegiatan dengan jujur.",
  "Apabila mengalami kendala saat masuk atau absen, hubungi Andrew melalui tombol bantuan di halaman ini atau tombol \"Hubungi Andrew\" di halaman absen.",
];

export default function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  // Status HTTP galat terakhir, untuk memilih tombol bantuan.
  const [kode, setKode] = useState(0);
  const [busy, setBusy] = useState(false);
  // Centang hanya di memori halaman: tidak disimpan, jadi tiap membuka halaman masuk crew mencentang ulang.
  const [centang, setCentang] = useState(() => POIN.map(() => false));
  const [pesanCentang, setPesanCentang] = useState("");
  const kotak = useRef([]);

  const jumlah = centang.filter(Boolean).length;
  const lengkap = jumlah === POIN.length;
  // Isian berhuruf berarti nama admin (owner atau superadmin), jadi ceklis tidak diwajibkan.
  const admin = /[a-z]/i.test(phone);
  const boleh = lengkap || admin;

  function ubahCentang(i, nilai) {
    setCentang((lama) => lama.map((v, k) => (k === i ? nilai : v)));
    setPesanCentang("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!boleh) {
      setPesanCentang("Mohon centang semua poin panduan sebelum masuk.");
      const i = centang.findIndex((v) => !v);
      const el = kotak.current[i];
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.focus({ preventScroll: true });
      }
      return;
    }
    setErr("");
    setKode(0);
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Gagal masuk. Silakan coba lagi.");
        setKode(res.status);
        return;
      }
      router.replace(data.role === "CREW" ? "/" : "/admin");
      router.refresh();
    } catch {
      setErr("Koneksi internet bermasalah. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {err && (
        <div className="err" style={{ marginBottom: 10 }}>
          {err}
          {kode === 401 && <BantuanWa jenis={["belum", "password"]} />}
          {kode === 429 && <BantuanWa jenis={["lain"]} />}
        </div>
      )}
      <section className="panduan" aria-labelledby="judul-panduan">
        <h2 id="judul-panduan">Panduan absen</h2>
        <p className="panduan-buka">{PEMBUKA}</p>
        <div className="panduan-daftar" role="group" aria-labelledby="judul-panduan">
          {POIN.map((teks, i) => (
            <label key={i} className="poin">
              <input
                type="checkbox"
                checked={centang[i]}
                onChange={(e) => ubahCentang(i, e.target.checked)}
                ref={(el) => { kotak.current[i] = el; }}
              />
              <span>{teks}</span>
            </label>
          ))}
        </div>
      </section>
      {/* Satu kolom untuk semua akun: crew mengisi nomor HP, owner dan superadmin mengisi nama. Server yang membedakannya. */}
      <label>Nomor HP atau nama admin</label>
      <input
        type="text"
        placeholder="08xxxxxxxxxx"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password yang diberikan kantor"
        autoComplete="current-password"
      />
      <div style={{ height: 16 }} />
      {pesanCentang && (
        <div className="err" role="alert" style={{ marginBottom: 10 }}>
          {pesanCentang}
        </div>
      )}
      {/* aria-disabled, bukan disabled: tombol tetap bisa ditekan supaya crew mendapat pesan dan fokus ke poin yang belum dicentang. */}
      <button className="btn-primary" disabled={busy} aria-disabled={!boleh || busy} data-terkunci={!boleh ? "ya" : undefined}>
        {busy ? "Memproses..." : "Masuk"}
      </button>
      {!admin && (
        <p className="panduan-hitung" aria-live="polite">
          {jumlah} dari {POIN.length} poin sudah dicentang
        </p>
      )}
    </form>
  );
}
