"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { tambahKapten } from "@/app/admin/aksi-kapten";

// Form menunjuk kapten: kotak cari dan daftar crew aktif (urut nama) yang tersaring saat mengetik nama
// atau empat digit akhir nomor HP. crew berisi { id, name, akhir } dengan akhir = empat digit akhir nomor HP.
// Pilihan dikirim lewat input tersembunyi, jadi tetap terkirim walau barisnya sedang tersembunyi oleh pencarian.
export default function PilihKapten({ eventId, crew }) {
  const [kata, setKata] = useState("");
  const [pilih, setPilih] = useState(null);

  if (crew.length === 0) {
    return <p className="meta kapten-catatan">Semua crew aktif sudah menjadi kapten acara ini.</p>;
  }

  const k = kata.trim().toLowerCase();
  const angka = k.replace(/\D/g, "");
  const tampil = k ? crew.filter((c) => c.name.toLowerCase().includes(k) || (angka && c.akhir.includes(angka))) : crew;

  return (
    <form action={tambahKapten} className="pilih-kapten">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="userId" value={pilih?.id ?? ""} />
      <label htmlFor={`cari-kapten-${eventId}`}>Tambah kapten</label>
      <input
        id={`cari-kapten-${eventId}`} type="search" value={kata} onChange={(e) => setKata(e.target.value)}
        placeholder="Cari nama atau akhir nomor HP" autoComplete="off"
      />
      <div className="pilih-kapten-daftar" role="radiogroup" aria-label="Crew aktif">
        {tampil.length === 0 && <div className="kosong">Tidak ada crew yang cocok.</div>}
        {tampil.map((c) => (
          <label key={c.id} className={c.id === pilih?.id ? "pilih-kapten-item on" : "pilih-kapten-item"}>
            <input type="radio" name={`kapten-${eventId}`} checked={c.id === pilih?.id} onChange={() => setPilih(c)} />
            <span className="grow">{c.name}</span>
            <span className="meta">{c.akhir}</span>
          </label>
        ))}
      </div>
      <div className="pilih-kapten-kaki">
        <span className="meta">
          {pilih ? <>Dipilih: <b>{pilih.name}</b></> : k ? `${tampil.length} dari ${crew.length} crew aktif` : `${crew.length} crew aktif`}
        </span>
        <TombolTunjuk siap={Boolean(pilih)} />
      </div>
    </form>
  );
}

function TombolTunjuk({ siap }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary btn-kecil" disabled={!siap || pending}>
      {pending ? "Menyimpan..." : "Tunjuk sebagai kapten"}
    </button>
  );
}
