"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { aturKapten } from "@/app/admin/aksi-kapten";

// Ceklis kapten acara. crew berisi { id, name, akhir, nonaktif }, sudah diurutkan di server: kapten saat ini
// di atas, sisanya urut nama. Urutan tidak berubah saat dicentang. awal berisi id kapten saat halaman dirender.
// Baris yang tersaring pencarian hanya diberi atribut hidden, jadi kotak centangnya tetap ikut terkirim.
export default function AturKapten({ eventId, crew, awal }) {
  const [kata, setKata] = useState("");
  const [pilih, setPilih] = useState(() => new Set(awal));

  const ditambah = crew.filter((c) => pilih.has(c.id) && !awal.includes(c.id));
  const dilepas = crew.filter((c) => !pilih.has(c.id) && awal.includes(c.id));
  const berubah = ditambah.length + dilepas.length > 0;
  const terpilih = crew.filter((c) => pilih.has(c.id));

  const k = kata.trim().toLowerCase();
  const angka = k.replace(/\D/g, "");
  const cocok = (c) => !k || c.name.toLowerCase().includes(k) || Boolean(angka && c.akhir.includes(angka));
  const jumlahCocok = crew.filter(cocok).length;

  const ganti = (id) =>
    setPilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });

  const daftarNama = (daftar) => daftar.map((c) => c.name).join(", ");

  return (
    <form action={aturKapten} className="atur-kapten">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="awal" value={awal.join(",")} />

      <label htmlFor={`cari-kapten-${eventId}`}>Pilih kapten</label>
      <input
        id={`cari-kapten-${eventId}`} type="search" value={kata} onChange={(e) => setKata(e.target.value)}
        placeholder="Cari nama atau akhir nomor HP" autoComplete="off"
      />

      <div className="atur-kapten-daftar" role="group" aria-label="Crew yang bisa menjadi kapten">
        {crew.length === 0 && <div className="kosong">Belum ada crew aktif.</div>}
        {crew.length > 0 && jumlahCocok === 0 && <div className="kosong">Tidak ada crew yang cocok.</div>}
        {crew.map((c) => (
          <label key={c.id} className={pilih.has(c.id) ? "atur-kapten-item on" : "atur-kapten-item"} hidden={!cocok(c)}>
            <input type="checkbox" name="kapten" value={c.id} checked={pilih.has(c.id)} onChange={() => ganti(c.id)} />
            <span className="grow">
              {c.name}
              {c.nonaktif && <small className="atur-kapten-nonaktif">Akun nonaktif</small>}
            </span>
            <span className="meta">{c.akhir}</span>
          </label>
        ))}
      </div>

      <p className="meta atur-kapten-ket">
        {k ? `${jumlahCocok} dari ${crew.length} crew cocok dengan pencarian.` : `${crew.length} crew dalam daftar.`}
      </p>

      <div className="atur-kapten-pilihan" aria-live="polite">
        <span className="atur-kapten-judul">Kapten yang dipilih</span>
        {terpilih.length === 0 ? (
          <span className="meta">Belum ada kapten.</span>
        ) : (
          <ul>
            {terpilih.map((c) => <li key={c.id}>{c.name}</li>)}
          </ul>
        )}
      </div>

      <div className="atur-kapten-kaki">
        <span className={berubah ? "atur-kapten-ringkas ubah" : "atur-kapten-ringkas"} aria-live="polite">
          {berubah ? (
            <>
              {ditambah.length > 0 && <span className="atur-kapten-ubah">Ditambahkan: {daftarNama(ditambah)}.</span>}
              {dilepas.length > 0 && <span className="atur-kapten-ubah">Dilepas: {daftarNama(dilepas)}.</span>}
            </>
          ) : "Belum ada perubahan."}
        </span>
        <div className="row">
          <button type="button" className="btn-ghost btn-kecil" disabled={!berubah} onClick={() => setPilih(new Set(awal))}>
            Batalkan perubahan
          </button>
          <TombolSimpan siap={berubah} />
        </div>
      </div>
    </form>
  );
}

function TombolSimpan({ siap }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary btn-kecil" disabled={!siap || pending}>
      {pending ? "Menyimpan..." : "Simpan kapten"}
    </button>
  );
}
