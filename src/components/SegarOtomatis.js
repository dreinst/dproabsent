"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const JEDA_MS = 60000;
const fmtJam = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

// Data halaman admin dimuat ulang tiap 1 menit tanpa memuat ulang seluruh halaman.
// Putaran dilewati saat tab tidak terlihat, saat admin sedang mengisi kolom, atau saat foto besar terbuka,
// supaya ketikan dan foto yang sedang dilihat tidak terganggu.
export default function SegarOtomatis() {
  const router = useRouter();
  const [terakhir, setTerakhir] = useState(null);

  useEffect(() => {
    let sebelumnya = Date.now();
    function segarkan() {
      if (document.visibilityState !== "visible") return;
      const aktif = document.activeElement;
      if (aktif?.matches("input:not([type=checkbox]):not([type=radio]), textarea, select")) return;
      if (document.querySelector("dialog[open]")) return;
      sebelumnya = Date.now();
      router.refresh();
      setTerakhir(new Date());
    }
    const putaran = setInterval(segarkan, JEDA_MS);
    // Kembali ke tab setelah lama ditinggal: langsung segarkan tanpa menunggu putaran berikutnya.
    function saatTerlihat() {
      if (document.visibilityState === "visible" && Date.now() - sebelumnya >= JEDA_MS) segarkan();
    }
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      clearInterval(putaran);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, [router]);

  return (
    <span className="segar-otomatis">
      Diperbarui otomatis tiap 1 menit{terakhir ? `, terakhir ${fmtJam.format(terakhir)}` : ""}
    </span>
  );
}
