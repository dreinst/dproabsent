// Aturan nama untuk login dan password awal. Dipakai rute login dan skrip reset password,
// supaya keduanya selalu sepakat soal "nama depan".

// "Adam (Araya)" -> "adam araya": huruf kecil, tanda baca jadi spasi, spasi dirapatkan.
export function rapikanNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Nama crew selalu diawali huruf kapital di setiap kata: "andrew santoso", "ANDREW SANTOSO",
// atau "BUDI santoso" jadi "Andrew Santoso" dan "Budi Santoso". Kata kapital semua di dalam kurung
// dianggap singkatan dan dibiarkan, misalnya "Aldi (PMI)". Spasi berlebih dibuang.
const awalKapital = (s) => s.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, pisah, huruf) => pisah + huruf.toUpperCase());

export function namaKapital(nama) {
  const rapi = String(nama || "").trim().replace(/\s+/g, " ");
  if (rapi === rapi.toLowerCase() || rapi === rapi.toUpperCase()) return awalKapital(rapi.toLowerCase());
  return rapi
    .split(" ")
    .map((kata) => {
      const huruf = kata.replace(/[^\p{L}]/gu, "");
      const kapitalSemua = huruf !== "" && huruf === huruf.toUpperCase() && huruf !== huruf.toLowerCase();
      if (kapitalSemua && /^\(.*\)$/.test(kata)) return kata;
      return awalKapital(kapitalSemua ? kata.toLowerCase() : kata);
    })
    .join(" ");
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
