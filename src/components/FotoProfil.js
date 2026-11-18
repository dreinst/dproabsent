"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";

const SISI = 640; // sisi persegi foto yang dikirim

// Foto profil sendiri: avatar, tombol pasang atau ganti, dan layar kamera depan.
export default function FotoProfil({ id, nama, avatar }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [buka, setBuka] = useState(false);
  const [facing, setFacing] = useState("user");
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Buka kamera lewat efek supaya elemen <video> sudah ada saat stream dipasang.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!buka || shot) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setErr("Kamera tidak dapat dibuka. Mohon izinkan akses kamera di browser.");
          setBuka(false);
        }
      }
    }
    start();
    return () => { cancelled = true; stopCamera(); };
  }, [buka, shot, facing]);

  // Layar penuh: kunci gulir halaman di belakang selama kamera terbuka.
  useEffect(() => {
    if (!buka) return;
    const awal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = awal; };
  }, [buka]);

  function mulai() { setErr(""); setShot(null); setBuka(true); }
  function tutup() { stopCamera(); setBuka(false); setShot(null); setErr(""); }

  // Potret diambil persis dari area di dalam bingkai bulat (video ditampilkan object-fit cover),
  // supaya hasilnya sama dengan yang terlihat di layar.
  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const cw = v.clientWidth || v.videoWidth, ch = v.clientHeight || v.videoHeight;
    const skala = Math.max(cw / v.videoWidth, ch / v.videoHeight);
    const bingkai = Math.min(cw * 0.78, 360);
    const sisi = Math.min(Math.round(bingkai / skala), v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - sisi) / 2;
    const sy = (v.videoHeight - sisi) / 2;
    const out = Math.min(SISI, sisi);
    const canvas = document.createElement("canvas");
    canvas.width = out; canvas.height = out;
    canvas.getContext("2d").drawImage(v, sx, sy, sisi, sisi, 0, 0, out, out);
    setShot(canvas.toDataURL("image/jpeg", 0.8));
    stopCamera();
  }

  async function simpan() {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/profil", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photo: shot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || "Foto profil gagal disimpan. Silakan coba lagi."); return; }
      setBuka(false); setShot(null);
      router.refresh();
    } catch {
      setErr("Koneksi internet bermasalah. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="profil-baris">
        <Avatar id={id} nama={nama} avatar={avatar} ukuran={64} />
        <div className="profil-teks">
          <div className="profil-nama">{nama}</div>
          <button type="button" className="profil-tombol" onClick={mulai}>
            {avatar ? "Ganti foto profil" : "Pasang foto profil"}
          </button>
          {err && !buka && <div className="err">{err}</div>}
        </div>
      </div>

      {buka && (
        <div className="layar-kamera">
          <div className="kamera-media">
            {!shot ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} playsInline muted style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
                <div className="profil-bingkai" aria-hidden="true" />
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="profil-pratinjau" src={shot} alt="Pratinjau foto profil" />
            )}
            <div className="kamera-atas">
              <button className="kaca-tombol" onClick={tutup} disabled={busy}>Batal</button>
              {!shot && (
                <button
                  className="kaca-tombol"
                  onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                >
                  Ganti kamera
                </button>
              )}
            </div>
            <span className="kaca kamera-label">Foto profil</span>
          </div>

          {!shot ? (
            <div className="kamera-bawah">
              <button className="shutter" onClick={capture} aria-label="Ambil foto" />
              <p>Posisikan wajah di tengah bingkai dan menghadap kamera.</p>
            </div>
          ) : (
            <div className="kamera-bawah form">
              {err && <div className="err">{err}</div>}
              <button className="tombol-besar" onClick={simpan} disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan"}
              </button>
              <button className="btn-ghost" onClick={() => { setErr(""); setShot(null); }} disabled={busy}>Foto ulang</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
