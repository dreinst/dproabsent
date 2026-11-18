// Nomor WhatsApp Andrew untuk bantuan crew, dan pembuat tautan chat dengan teks isian.
export const NOMOR_BANTUAN = "6282228555254";

export const PESAN_BANTUAN = {
  belum: "Halo Andrew, nomor saya belum terdaftar di absensi D'Pro (absen.dpro.events). Nama saya: ",
  password: "Halo Andrew, saya tidak dapat masuk ke absensi D'Pro (absen.dpro.events) karena kendala password. Nama saya: ",
  lain: "Halo Andrew, saya mengalami kendala di absensi D'Pro (absen.dpro.events): ",
};

// Teks tombol per jenis bantuan.
export const LABEL_BANTUAN = {
  belum: "Nomor belum terdaftar",
  password: "Kendala password",
  lain: "Kendala lain",
};

export function tautanWa(teks) {
  return `https://wa.me/${NOMOR_BANTUAN}?text=${encodeURIComponent(teks)}`;
}

export const tautanBantuan = (jenis) => tautanWa(PESAN_BANTUAN[jenis] || PESAN_BANTUAN.lain);
