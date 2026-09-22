const PEMBAGI_JAM = 173;
const JAM_KERJA_SEHARI = 8;
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

// istirahat = jam istirahat setelah shift normal: 0 (mode 11 jam) atau 1 (mode 10 jam + 1 jam istirahat)
function jamLemburHari(rec, istirahat) {
  if (!rec || rec.libur || !rec.masuk || !rec.keluar) return 0;
  const menit = toMinutes(rec.keluar) - toMinutes(rec.masuk);
  if (menit <= 0) return 0;
  if (rec.lembur) return jamLemburPenuh(Math.floor(menit / 60));
  const batas = toMinutes(AKHIR_KERJA_NORMAL) + (istirahat || 0) * 60;
  const otMenit = toMinutes(rec.keluar) - batas;
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
  if (r.libur) {
    out.libur = true;
    if (r.ket === 'izin' || r.ket === 'alfa') out.ket = r.ket;
  }
  return out;
}

const KET_LIBUR = { '': 'Libur', izin: 'Izin', alfa: 'Alfa' };

// Keterangan untuk lembar absensi: Masuk, Masuk (Lembur), Libur/Izin/Alfa
function keterangan(rec) {
  if (!rec) return '';
  if (rec.libur) return KET_LIBUR[rec.ket] || 'Libur';
  if (!rec.masuk) return '';
  return rec.lembur ? 'Masuk (Lembur)' : 'Masuk';
}

function upahPerJam(gajiPokok) {
  return gajiPokok / PEMBAGI_JAM;
}

// Upah satu hari: hari kerja normal = 8 jam + lembur hari itu; hari Lembur = hitungan lemburnya saja
function pendapatanHari(rec, gajiPokok, istirahat) {
  if (!rec || rec.libur) return 0;
  const rate = upahPerJam(gajiPokok);
  if (rec.lembur) return jamLemburHari(rec, istirahat) * rate;
  if (!rec.masuk || !rec.keluar) return 0;
  return (JAM_KERJA_SEHARI + jamLemburHari(rec, istirahat)) * rate;
}

function ringkasanBulan(data, bulan, gajiPokok, istirahat) {
  let jam = 0, hariKerja = 0, hariLembur = 0, hariLibur = 0;
  for (const [tgl, rec] of Object.entries(data)) {
    if (!tgl.startsWith(bulan)) continue;
    if (rec.libur) { hariLibur++; continue; }
    if (rec.lembur) { hariLembur++; jam += jamLemburHari(rec, istirahat); continue; }
    if (rec.masuk && rec.keluar) hariKerja++;
    jam += jamLemburHari(rec, istirahat);
  }
  const rate = upahPerJam(gajiPokok);
  const gajiHarian = JAM_KERJA_SEHARI * rate * hariKerja;
  const uangLembur = jam * rate;
  return {
    jam, hariKerja, hariLembur, hariLibur, upahPerJam: rate,
    gajiHarian,
    uangLembur,
    gajiPokok,
    total: gajiHarian + uangLembur,
  };
}

// Akumulasi berurutan: upah hari itu + total berjalan sampai akhir bulan
function akumulasiHarian(data, bulan, gajiPokok, istirahat) {
  let total = 0;
  return Object.keys(data).filter(k => k.startsWith(bulan)).sort().map(k => {
    const upah = pendapatanHari(data[k], gajiPokok, istirahat);
    total += upah;
    return { tanggal: k, rec: data[k], upah, akumulasi: total };
  });
}

const PTKP = {
  'TK/0': 54000000,
  'TK/1': 58500000,
  'TK/2': 63000000,
  'TK/3': 67500000,
  'K/0': 58500000,
  'K/1': 63000000,
  'K/2': 67500000,
  'K/3': 72000000,
};

const LAPISAN_PPH = [
  [60000000, 0.05],
  [250000000, 0.15],
  [500000000, 0.25],
  [5000000000, 0.30],
  [Infinity, 0.35],
];

// Estimasi PPh 21 setahun: bruto - biaya jabatan 5% (maks 6jt) - JHT/JP - PTKP, tarif progresif
function pph21Setahun(brutoSetahun, potonganBpjsTkSetahun, ptkp) {
  const biayaJabatan = Math.min(brutoSetahun * 0.05, 6000000);
  const pkp = Math.floor(Math.max(0, brutoSetahun - biayaJabatan - potonganBpjsTkSetahun - ptkp) / 1000) * 1000;
  if (pkp <= 0) return 0;
  let pajak = 0, bawah = 0;
  for (const [atas, tarif] of LAPISAN_PPH) {
    const kena = Math.min(pkp, atas) - bawah;
    if (kena > 0) pajak += kena * tarif;
    if (pkp <= atas) break;
    bawah = atas;
  }
  return pajak;
}

// thr = THR/bonus yang dibayarkan di bulan itu (0 bila tidak ada)
function hitungGaji(data, bulan, gajiPokok, ptkp, istirahat, thr) {
  const s = ringkasanBulan(data, bulan, gajiPokok, istirahat);
  const bpjsTk = gajiPokok * 0.03;
  const bpjsKes = gajiPokok * 0.01;
  const brutoSetahun = s.total * 12;
  const pphTeraturSetahun = pph21Setahun(brutoSetahun, bpjsTk * 12, PTKP[ptkp] || 0);
  const nilaiThr = thr > 0 ? thr : 0;
  // PPh atas THR/bonus = selisih PPh setahun (teratur + THR) dengan PPh setahun teratur saja
  const pphThr = nilaiThr > 0
    ? pph21Setahun(brutoSetahun + nilaiThr, bpjsTk * 12, PTKP[ptkp] || 0) - pphTeraturSetahun
    : 0;
  const pph = pphTeraturSetahun / 12 + pphThr;
  return Object.assign({}, s, {
    bruto: s.total,
    thr: nilaiThr,
    bpjsTk, bpjsKes,
    pphTeratur: pphTeraturSetahun / 12,
    pphThr, pph,
    potongan: bpjsTk + bpjsKes + pph,
    bersih: s.total + nilaiThr - bpjsTk - bpjsKes - pph,
  });
}

if (typeof module !== 'undefined') {
  module.exports = { PEMBAGI_JAM, JAM_KERJA_SEHARI, PTKP, jamLemburNormal, jamLemburPenuh, jamLemburHari, bersihkanRekaman, keterangan, upahPerJam, pendapatanHari, ringkasanBulan, akumulasiHarian, pph21Setahun, hitungGaji };
}