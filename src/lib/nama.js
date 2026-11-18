// Aturan nama untuk login dan password awal. Dipakai rute login dan skrip reset password,
// supaya keduanya selalu sepakat soal "nama depan".

// "Adam (Araya)" -> "adam araya": huruf kecil, tanda baca jadi spasi, spasi dirapatkan.
export function rapikanNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Nama crew selalu diawali huruf kapital di setiap kata: "andrew santoso" atau "ANDREW SANTOSO" jadi "Andrew Santoso".
// Kalau diketik campuran huruf besar dan kecil, hanya huruf pertama tiap kata yang dikapitalkan,
// supaya singkatan seperti "Aldi (PMI)" tetap utuh. Spasi berlebih dibuang.
export function namaKapital(nama) {
  const rapi = String(nama || "").trim().replace(/\s+/g, " ");
  const seragam = rapi === rapi.toLowerCase() || rapi === rapi.toUpperCase();
  const dasar = seragam ? rapi.toLowerCase() : rapi;
  return dasar.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, pisah, huruf) => pisah + huruf.toUpperCase());
}

export function namaDepan(nama) {
  return rapikanNama(nama).split(" ")[0] || "";
}

// Password awal crew: nama depan + 4 angka terakhir nomor HP, misalnya "ian8694".
// Dua orang bernama sama tetap punya password berbeda, dan nama saja tidak cukup untuk menebaknya.
export function passwordAwal(nama, phone) {
  const digit = String(phone || "").replace(/\D/g, "");
  return (namaDepan(nama) || "crew") + digit.slice(-4);
}
