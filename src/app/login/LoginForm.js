"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BantuanWa from "@/components/BantuanWa";

// Teks panduan dipakai persis seperti yang ditetapkan pemilik. Jangan diubah tanpa izin.
const PEMBUKA = "Baca panduan ini sampai habis sebelum masuk.";
const POIN = [
  "Absen di lokasi acara dengan GPS dan internet menyala. Izinkan kamera dan lokasi saat diminta. Absen dari luar lokasi tetap tercatat, tetapi ditandai.",
  "Absen masuk di sesi yang bertanda \"Sedang berlangsung\". Lewat 15 menit dari jam mulai (bisa berbeda tiap sesi), absen tercatat terlambat.",
  "Absen progres sesuai jadwal di kartu sesi, biasanya tiap 60 menit, paling lambat 5 menit setelah waktunya. Tidak ada notifikasi, jadi pantau hitung mundurnya.",
  "Absen pulang saat sesi selesai. Kalau sampai 1 jam setelah sesi selesai belum absen pulang, sistem mencatat Anda tidak absen pulang.",
  "Pakai foto asli dan isi \"Yang dikerjakan\" dengan jujur. Jam kerja hanya dihitung dari absen yang disahkan kapten atau admin.",
  "Ada kendala? Hubungi Andrew lewat tombol bantuan.",
];
const PERNYATAAN = "Saya telah membaca dan memahami panduan absen di atas.";

export default function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  // Status HTTP galat terakhir, untuk memilih tombol bantuan.
  const [kode, setKode] = useState(0);
  const [busy, setBusy] = useState(false);
  // Panduan dibaca seperti kebijakan: kotak bergulir, lalu satu pernyataan yang tercentang otomatis begitu panduan
  // digulir sampai akhir. Tidak ada yang disimpan, jadi tiap membuka halaman masuk crew membaca ulang.
  const [terbaca, setTerbaca] = useState(false);
  const [setuju, setSetuju] = useState(false);
  const [pesanCentang, setPesanCentang] = useState("");
  const gulir = useRef(null);
  const kotakSetuju = useRef(null);
  const sudahTerbaca = useRef(false);

  // Isian berhuruf berarti nama admin (owner atau superadmin), jadi pernyataan tidak diwajibkan.
  const admin = /[a-z]/i.test(phone);
  const boleh = setuju || admin;

  // Dianggap terbaca begitu kotak panduan sampai di bawah, atau kalau isinya muat tanpa perlu digulir.
  // Saat itu pernyataan dicentang otomatis, cukup sekali: kalau crew menghapus centangnya lalu menggulir lagi,
  // centang tidak muncul sendiri. Sekali terbaca tetap terbaca walaupun kotaknya digulir naik lagi.
  useEffect(() => {
    const el = gulir.current;
    if (!el) return;
    const cek = () => {
      if (sudahTerbaca.current || el.scrollTop + el.clientHeight < el.scrollHeight - 16) return;
      sudahTerbaca.current = true;
      setTerbaca(true);
      setSetuju(true);
      setPesanCentang("");
    };
    cek();
    el.addEventListener("scroll", cek, { passive: true });
    window.addEventListener("resize", cek);
    return () => {
      el.removeEventListener("scroll", cek);
      window.removeEventListener("resize", cek);
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!boleh) {
      // Belum terbaca: arahkan ke kotak panduan. Sudah terbaca tetapi centangnya dihapus: arahkan ke pernyataan.
      setPesanCentang(
        terbaca
          ? "Mohon centang pernyataan di bawah panduan sebelum masuk."
          : "Mohon baca panduan sampai akhir sebelum masuk."
      );
      const tuju = terbaca ? kotakSetuju.current : gulir.current;
      if (tuju) {
        tuju.scrollIntoView({ block: "center", behavior: "smooth" });
        tuju.focus({ preventScroll: true });
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
        {/* Bayangan di bawah kotak menandakan isi panduan masih berlanjut. tabIndex supaya bisa digulir dengan papan ketik. */}
        <div className={terbaca ? "panduan-kotak habis" : "panduan-kotak"}>
          <div className="panduan-gulir" ref={gulir} tabIndex={0} role="region" aria-label="Isi panduan absen">
            <ol>
              {POIN.map((teks, i) => <li key={i}>{teks}</li>)}
            </ol>
          </div>
        </div>
        {!terbaca && <p className="panduan-petunjuk">Gulir panduan sampai akhir. Pernyataan di bawah akan tercentang otomatis.</p>}
        <label className={terbaca ? "poin" : "poin mati"}>
          <input
            type="checkbox"
            checked={setuju}
            disabled={!terbaca}
            onChange={(e) => {
              setSetuju(e.target.checked);
              setPesanCentang("");
            }}
            ref={kotakSetuju}
          />
          <span>{PERNYATAAN}</span>
        </label>
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
      {/* aria-disabled, bukan disabled: tombol tetap bisa ditekan supaya crew mendapat pesan dan diarahkan ke panduan. */}
      <button className="btn-primary" disabled={busy} aria-disabled={!boleh || busy} data-terkunci={!boleh ? "ya" : undefined}>
        {busy ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
