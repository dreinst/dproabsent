"use client";

// Membuka dialog cetak browser. Dari dialog itu slip bisa dicetak ke kertas atau disimpan sebagai PDF.
export default function TombolCetak({ children = "Cetak atau simpan PDF" }) {
  return (
    <button type="button" className="btn-primary btn-kecil" onClick={() => window.print()}>
      {children}
    </button>
  );
}
