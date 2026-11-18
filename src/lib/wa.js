// Nomor WhatsApp Andrew untuk bantuan crew, dan pembuat tautan chat dengan teks isian.
export const NOMOR_BANTUAN = "6282228555254";

export const PESAN_BANTUAN = {
  belum: "Halo Andrew, nomor saya belum terdaftar di absen D'Pro (absen.dpro.events). Nama saya: ",
  password: "Halo Andrew, saya tidak bisa masuk ke absen D'Pro (absen.dpro.events), password saya tidak bisa. Nama saya: ",
  lain: "Halo Andrew, saya ada kendala di absen D'Pro (absen.dpro.events): ",
};

// Teks tombol per jenis bantuan.
export const LABEL_BANTUAN = {
  belum: "Nomor belum terdaftar",
  password: "Password tidak bisa",
  lain: "Kendala lain",
};

export function tautanWa(teks) {
  return `https://wa.me/${NOMOR_BANTUAN}?text=${encodeURIComponent(teks)}`;
}

export const tautanBantuan = (jenis) => tautanWa(PESAN_BANTUAN[jenis] || PESAN_BANTUAN.lain);
