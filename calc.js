const PEMBAGI_JAM = 173;
const AKHIR_KERJA_NORMAL = '14:00';

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Hari biasa: jam lembur ke-1 = 1,5; jam berikutnya = 2
// 1 jam -> 1,5 | 2 jam -> 3,5 | 3 jam -> 5,5
function jamLemburNormal(jam) {
  if (jam <= 0) return 0;
  return 1.5 + 2 * (jam - 1);
}

// Hari Lembur (kerja di hari libur): jam 1-8 = 2x, jam ke-9 = 3x, jam ke-10+ = 4x
// 8 jam -> 16 | 9 jam -> 19 | 11 jam -> 27
function jamLemburPenuh(jam) {
  if (jam <= 0) return 0;
  if (jam <= 8) return 2 * jam;
  if (jam === 9) return 19;
  return 19 + 4 * (jam - 9);
}

function jamLemburHari(rec) {
  if (!rec || rec.libur || !rec.masuk || !rec.keluar) return 0;
  const menit = toMinutes(rec.keluar) - toMinutes(rec.masuk);
  if (menit <= 0) return 0;
  if (rec.lembur) return jamLemburPenuh(Math.floor(menit / 60));
  const otMenit = toMinutes(rec.keluar) - toMinutes(AKHIR_KERJA_NORMAL);
  return jamLemburNormal(Math.floor(Math.max(0, otMenit) / 60));
}

// Validasi rekaman dari file import: hanya terima bentuk yang dikenal
function bersihkanRekaman(r) {
  if (!r || typeof r !== 'object') return null;
  const out = {};
  const masuk = String(r.masuk == null ? '' : r.masuk).match(/^(\d{1,2}):(\d{2})/);
  const keluar = String(r.keluar == null ? '' : r.keluar).match(/^(\d{1,2}):(\d{2})/);
  if (masuk) out.masuk = masuk[1].padStart(2, '0') + ':' + masuk[2];
  if (keluar) out.keluar = keluar[1].padStart(2, '0') + ':' + keluar[2];
  if (r.lembur) out.lembur = true;
  if (r.libur) out.libur = true;
  return out;
}

function ringkasanBulan(data, bulan, gajiPokok) {
  let jam = 0, hariKerja = 0, hariLembur = 0, hariLibur = 0;
  for (const [tgl, rec] of Object.entries(data)) {
    if (!tgl.startsWith(bulan)) continue;
    if (rec.libur) { hariLibur++; continue; }
    if (rec.masuk && rec.keluar) hariKerja++;
    if (rec.lembur) hariLembur++;
    jam += jamLemburHari(rec);
  }
  const uangLembur = (gajiPokok / PEMBAGI_JAM) * jam;
  return {
    jam, hariKerja, hariLembur, hariLibur, uangLembur,
    gajiPokok,
    total: gajiPokok + uangLembur,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { PEMBAGI_JAM, jamLemburNormal, jamLemburPenuh, jamLemburHari, bersihkanRekaman, ringkasanBulan };
}