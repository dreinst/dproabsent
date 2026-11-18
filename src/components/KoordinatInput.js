"use client";

import { useState } from "react";

// Titik lokasi acara: tempel "lat, lng" dari Google Maps, atau ambil dari GPS perangkat ini.
export default function KoordinatInput({ defaultValue = "" }) {
  const [nilai, setNilai] = useState(defaultValue);
  const [msg, setMsg] = useState("");

  function ambil() {
    if (!navigator.geolocation) { setMsg("Perangkat ini tidak dapat membaca lokasi."); return; }
    setMsg("Membaca lokasi...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setNilai(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`);
        setMsg(`Lokasi terbaca, akurasi sekitar ${Math.round(p.coords.accuracy)} m.`);
      },
      () => setMsg("Lokasi tidak terbaca. Mohon izinkan akses lokasi, lalu coba lagi."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  const bersih = nilai.replace(/\s/g, "");
  return (
    <div>
      <input
        type="text"
        name="koordinat"
        value={nilai}
        onChange={(e) => setNilai(e.target.value)}
        placeholder="-7.96662, 112.63263"
        required
      />
      <div className="row" style={{ marginTop: 8, alignItems: "center" }}>
        <button type="button" className="btn-ghost btn-kecil" onClick={ambil}>Gunakan lokasi saat ini</button>
        {bersih && (
          <a className="meta" href={`https://www.google.com/maps?q=${encodeURIComponent(bersih)}`} target="_blank" rel="noopener noreferrer">
            Lihat di Google Maps
          </a>
        )}
      </div>
      {msg && <div className="meta" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
