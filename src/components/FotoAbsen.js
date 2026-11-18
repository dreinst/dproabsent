"use client";

import { useRef, useState } from "react";

// Thumbnail foto absen yang bisa diklik. Foto besar tampil di <dialog> modal:
// Esc, tombol Tutup, dan klik di latar sama-sama menutupnya.
export default function FotoAbsen({ id, nama, ket }) {
  const dlg = useRef(null);
  const [buka, setBuka] = useState(false);

  function bukaFoto() {
    setBuka(true);
    // Dialog baru dirender sesudah state berubah, jadi showModal dipanggil di frame berikutnya.
    requestAnimationFrame(() => dlg.current?.showModal());
  }

  return (
    <>
      <button type="button" className="thumb-btn" aria-label={`Perbesar foto absen ${nama}`} onClick={bukaFoto}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="thumb" loading="lazy" src={`/api/foto/${id}`} alt="" />
      </button>
      {buka && (
        <dialog
          ref={dlg} className="foto-dlg" aria-label={`Foto absen ${nama}`}
          onClose={() => setBuka(false)}
          onClick={(e) => { if (e.target === dlg.current || e.target.classList.contains("foto-isi")) dlg.current.close(); }}
        >
          <div className="foto-isi">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="foto-besar" src={`/api/foto/${id}`} alt={`Foto absen ${nama}`} />
            <div className="foto-ket">
              <b>{nama}</b>
              {ket.map((t, i) => <span key={i}>{t}</span>)}
            </div>
            <button type="button" className="foto-tutup" onClick={() => dlg.current?.close()}>Tutup</button>
          </div>
        </dialog>
      )}
    </>
  );
}
