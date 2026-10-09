"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { KIND, STATUS, nadaStatus } from "@/lib/label";

const LABEL = { MASUK: "Absen masuk", CHECKPOINT: "Absen titik cek", PULANG: "Absen pulang" };

export default function AbsenPanel({ session, existing }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [kind, setKind] = useState(null); // aksi yang sedang dijalankan
  const [shot, setShot] = useState(null); // data URL foto
  const [activity, setActivity] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const hasMasuk = existing.some((e) => e.kind === "MASUK");
  const hasPulang = existing.some((e) => e.kind === "PULANG");

  const actions = [];
  if (!hasMasuk) actions.push("MASUK");
  if (hasMasuk && !hasPulang && session.checkpointMinutes > 0) actions.push("CHECKPOINT");
  if (hasMasuk && !hasPulang) actions.push("PULANG");

  // Buka kamera lewat efek supaya elemen <video> sudah ada saat stream dipasang.
  // Dulu getUserMedia dipanggil sebelum render, jadi tombol harus dipencet 2-3x.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!kind || shot) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setErr("Tidak bisa membuka kamera. Izinkan akses kamera di browser.");
          setKind(null);
        }
      }
    }
    start();
    return () => { cancelled = true; };
  }, [kind, shot]);

  // Matikan kamera saat komponen dilepas.
  useEffect(() => () => stopCamera(), []);

  function openCamera(k) {
    setErr(""); setOk(""); setShot(null); setActivity(""); setKind(k);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const max = 800;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(v, 0, 0, w, h);
    setShot(canvas.toDataURL("image/jpeg", 0.7));
    stopCamera();
  }

  function cancel() {
    stopCamera();
    setKind(null); setShot(null); setErr("");
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("no-geo"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => reject(new Error("denied")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  async function send() {
    setErr(""); setBusy(true);
    try {
      const pos = await getPosition().catch(() => null);
      if (!pos) {
        setErr("Lokasi tidak terbaca. Aktifkan GPS dan izinkan lokasi, lalu coba lagi.");
        return;
      }
      const res = await fetch("/api/absen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          kind,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          activity,
          photo: shot,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Gagal menyimpan absen."); return; }
      setOk(
        `${LABEL[kind]} tersimpan. Jarak ${data.distanceM} m` +
        (data.insideRadius ? " (di lokasi)." : " (di luar radius, ditandai).")
      );
      setKind(null); setShot(null); setActivity("");
      router.refresh();
    } catch {
      setErr("Jaringan bermasalah, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {existing.map((e) => (
        <div key={e.id}>
          <div className="absen-baris">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {e.photo && <img className="thumb kecil" src={e.photo} alt={`Foto ${KIND[e.kind]}`} />}
            <div className="grow">
              <div className="tebal" style={{ fontSize: 14 }}>{KIND[e.kind]}</div>
              <div className="meta" style={{ fontSize: 12 }}>{e.checkedAt} · {e.distanceM} m dari titik</div>
            </div>
            <span className={`badge ${e.insideRadius ? nadaStatus(e.status) : "bad"}`}>
              {e.insideRadius ? STATUS[e.status] : "Luar radius"}
            </span>
          </div>
          {e.note && <div className="note" style={{ margin: "-2px 0 8px" }}>{e.note}</div>}
        </div>
      ))}

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {ok && <div className="ok-msg" style={{ margin: "10px 0" }}>{ok}</div>}

      {!kind && (
        <div className="tumpuk" style={{ marginTop: existing.length ? 12 : 0 }}>
          {hasPulang && <span className="meta">Sesi selesai. Absen lengkap.</span>}
          {actions.map((a) => (
            <button key={a} className={a === "PULANG" ? "btn-ghost" : "btn-primary"} onClick={() => openCamera(a)}>
              {LABEL[a]}
            </button>
          ))}
        </div>
      )}

      {kind && (
        <div className="tumpuk" style={{ marginTop: 12 }}>
          <div className="kamera">
            {!shot ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video ref={videoRef} playsInline muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot} alt="Foto absen" />
            )}
            <span className="kaca atas">{KIND[kind]} · {session.jobdesc}</span>
            <span className="kaca bawah">{shot ? "Lokasi dibaca saat dikirim" : "Ambil foto langsung, bukan dari galeri"}</span>
          </div>
          {!shot ? (
            <>
              <button className="btn-primary" onClick={capture}>Jepret</button>
              <button className="btn-ghost" onClick={cancel}>Batal</button>
            </>
          ) : (
            <>
              <div>
                <label style={{ marginTop: 4 }}>Sedang mengerjakan apa?</label>
                <input
                  type="text"
                  placeholder="Contoh: pasang rigging panggung utama"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  maxLength={300}
                />
              </div>
              <button className="btn-primary" onClick={send} disabled={busy}>
                {busy ? "Mengirim..." : "Kirim absen"}
              </button>
              <button className="btn-ghost" onClick={() => setShot(null)} disabled={busy}>Ulangi foto</button>
              <button className="btn-ghost" onClick={cancel} disabled={busy}>Batal</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
