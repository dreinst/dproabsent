"use client";

import { useRef, useState } from "react";

// Thumbnail foto absen yang bisa diklik. Foto besar tampil di <dialog> modal:
// Esc, tombol Tutup, dan klik di latar sama-sama menutupnya.
// jam (opsional) tampil sebagai label kecil di pojok foto kecil. children (opsional) tampil di bawah keterangan foto besar.
// tanpaFoto (opsional) untuk absen yang dicatat sistem: kotak "Tanpa foto" tampil sebagai ganti gambar, dan gambar tidak dimuat.
export default function FotoAbsen({ id, nama, ket, jam, tanpaFoto = false, children }) {
  const dlg = useRef(null);
  const [buka, setBuka] = useState(false);

  function bukaFoto() {
    setBuka(true);
    // Dialog baru dirender sesudah state berubah, jadi showModal dipanggil di frame berikutnya.
    requestAnimationFrame(() => dlg.current?.showModal());
  }

  return (
    <>
      <button type="button" className={jam ? "thumb-btn thumb-btn-grup" : "thumb-btn"} aria-label={`Perbesar foto absen ${nama}`} onClick={bukaFoto}>
        {tanpaFoto ? (
          <span className={jam ? "thumb thumb-grup thumb-kosong" : "thumb thumb-kosong"}>Tanpa foto</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={jam ? "thumb thumb-grup" : "thumb"} loading="lazy" src={`/api/foto/${id}`} alt="" />
        )}
        {jam && <span className="thumb-jam">{jam}</span>}
      </button>
      {buka && (
        <dialog
          ref={dlg} className="foto-dlg" aria-label={`Foto absen ${nama}`}
          onClose={() => setBuka(false)}
          onClick={(e) => { if (e.target === dlg.current || e.target.classList.contains("foto-isi")) dlg.current.close(); }}
        >
          <div className="foto-isi">
            {/* Tombol Tutup paling awal: tetap terlihat di pojok kanan atas dan jadi fokus pertama saat dialog dibuka. */}
            <button type="button" className="foto-tutup" onClick={() => dlg.current?.close()}>Tutup</button>
            {tanpaFoto ? (
              <div className="foto-kosong">Tanpa foto</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="foto-besar" src={`/api/foto/${id}`} alt={`Foto absen ${nama}`} />
            )}
            <div className="foto-panel">
              <div className="foto-ket">
                <b>{nama}</b>
                {ket.map((t, i) => <span key={i}>{t}</span>)}
              </div>
              {children && <div className="foto-aksi">{children}</div>}
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
