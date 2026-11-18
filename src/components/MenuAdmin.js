"use client";

import { useRef } from "react";
import Link from "next/link";

// Bilah atas dan menu layar penuh panel pengelola di HP, meniru menu HP landing dpro.events.
// Memakai <dialog> modal, jadi Esc, fokus pertama, dan pengembalian fokus ditangani browser.
// menu berisi [href, label, aktif]. children berisi tombol keluar.
export default function MenuAdmin({ menu, nama, peran, children }) {
  const dlg = useRef(null);
  const tutup = () => dlg.current?.close();

  return (
    <>
      <div className="bilah-admin">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" />
        <button
          type="button" className="menu-buka" aria-label="Buka menu" aria-haspopup="dialog"
          onClick={() => dlg.current?.showModal()}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      <dialog ref={dlg} className="menu-hp" aria-label="Menu panel pengelola">
        <div className="menu-hp-kop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo-dpro.svg" alt="" />
          <button type="button" className="menu-tutup" aria-label="Tutup menu" onClick={tutup}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {/* Menu ditutup setiap kali tautan diketuk, termasuk tautan ke halaman yang sedang dibuka. */}
        <nav className="menu-hp-daftar" onClick={(e) => { if (e.target.closest("a")) tutup(); }}>
          {menu.map(([href, label, aktif]) => (
            <Link key={href} href={href} className={aktif ? "on" : undefined} aria-current={aktif ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="menu-hp-akun">
          <b>{nama}</b>
          <span>{peran}</span>
          {children}
        </div>
      </dialog>
    </>
  );
}
