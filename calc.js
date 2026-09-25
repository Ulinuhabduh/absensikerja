const PEMBAGI_JAM = 173;
const JAM_KERJA_SEHARI = 8;
const AKHIR_KERJA_NORMAL = '14:00';

// Mode jam kerja: istirahat dipotong dari jam kehadiran, lembur = jam lembur hari biasa
const MODE_JAM = {
  '12': { istirahat: 1, lembur: 3 },
  '11': { istirahat: 1, lembur: 2 },
};

function modeCfg(mode) {
  return MODE_JAM[mode] || MODE_JAM['12'];
}

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

// Hari biasa: jumlah jam lembur mengikuti mode (12 jam -> 3, 11 jam -> 2),
// dihitung hanya bila pulang setelah shift normal + istirahat.
// Hari Lembur: jam kehadiran dipotong istirahat dulu, lalu pakai kelipatan khusus.
function jamLemburHari(rec, mode) {
  if (!rec || rec.libur || !rec.masuk || !rec.keluar) return 0;
  const menit = toMinutes(rec.keluar) - toMinutes(rec.masuk);
  if (menit <= 0) return 0;
  const cfg = modeCfg(mode);
  if (rec.lembur) {
    const jamKerja = Math.floor(menit / 60) - cfg.istirahat;
    return jamKerja > 0 ? jamLemburPenuh(jamKerja) : 0;
  }
  if (toMinutes(rec.keluar) <= toMinutes(AKHIR_KERJA_NORMAL) + cfg.istirahat * 60) return 0;
  return jamLemburNormal(cfg.lembur);
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

// Upah lembur satu hari (hanya bagian lembur; gaji pokok bersifat bulanan tetap,
// dibayar penuh terpisah). Hari biasa = jam lembur hari itu; hari Lembur = hitungan lemburnya.
function pendapatanHari(rec, gajiPokok, mode) {
  if (!rec || rec.libur) return 0;
  const rate = upahPerJam(gajiPokok);
  if (!rec.masuk || !rec.keluar) return 0;
  return jamLemburHari(rec, mode) * rate;
}

// Ringkasan bulanan model gaji bulanan tetap (seperti slip perusahaan):
// gaji pokok dibayar penuh, potongan absensi/alfa diinput manual per bulan,
// uang lembur dijumlah dari jam lembur. gajiHarian hanya info pro-rata.
function ringkasanBulan(data, bulan, gajiPokok, mode, potonganAbsensi) {
  const pot = Number(potonganAbsensi) || 0;
  let jam = 0, hariKerja = 0, hariLembur = 0, hariLibur = 0, hariAlfa = 0, hariIzin = 0;
  for (const [tgl, rec] of Object.entries(data)) {
    if (!tgl.startsWith(bulan)) continue;
    if (rec.libur) {
      hariLibur++;
      if (rec.ket === 'alfa') hariAlfa++;
      else if (rec.ket === 'izin') hariIzin++;
      continue;
    }
    if (rec.lembur) { hariLembur++; jam += jamLemburHari(rec, mode); continue; }
    if (rec.masuk && rec.keluar) hariKerja++;
    jam += jamLemburHari(rec, mode);
  }
  const rate = upahPerJam(gajiPokok);
  const gajiHarian = JAM_KERJA_SEHARI * rate * hariKerja;
  const uangLembur = jam * rate;
  const gajiKotor = gajiPokok - pot;
  return {
    jam, hariKerja, hariLembur, hariLibur, hariAlfa, hariIzin, upahPerJam: rate,
    gajiHarian,
    uangLembur,
    gajiPokok,
    potonganAbsensi: pot,
    gajiKotor,
    total: gajiKotor + uangLembur,
  };
}

// Akumulasi lembur harian berurutan: upah lembur hari itu + total berjalan sampai akhir bulan.
// Kolom ini hanya menjumlah bagian lembur; gaji pokok dihitung penuh di ringkasan.
function akumulasiHarian(data, bulan, gajiPokok, mode) {
  let total = 0;
  return Object.keys(data).filter(k => k.startsWith(bulan)).sort().map(k => {
    const upah = pendapatanHari(data[k], gajiPokok, mode);
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

// Tarif Efektif Rata-rata bulanan (Lampiran PP 58/2023), nilai dalam persen.
// Pasangan [batas atas bruto bulanan, tarif]; baris terakhir berlaku untuk kelebihannya.
const TER = {
  A: [
    [5400000,0], [5650000,0.25], [5950000,0.5], [6300000,0.75], [6750000,1], [7500000,1.25],
    [8550000,1.5], [9650000,1.75], [10050000,2], [10350000,2.25], [10700000,2.5], [11050000,3],
    [11600000,3.5], [12500000,4], [13750000,5], [15100000,6], [16950000,7], [19750000,8],
    [24150000,9], [26450000,10], [28000000,11], [30050000,12], [32400000,13], [35400000,14],
    [39100000,15], [43850000,16], [47800000,17], [51400000,18], [56300000,19], [62200000,20],
    [68600000,21], [77500000,22], [89000000,23], [103000000,24], [125000000,25], [157000000,26],
    [206000000,27], [337000000,28], [454000000,29], [550000000,30], [695000000,31], [910000000,32],
    [1400000000,33], [Infinity,34],
  ],
  B: [
    [6200000,0], [6500000,0.25], [6850000,0.5], [7300000,0.75], [9200000,1], [10750000,1.5],
    [11250000,2], [11600000,2.5], [12600000,3], [13600000,4], [14950000,5], [16400000,6],
    [18450000,7], [21850000,8], [26000000,9], [27700000,10], [29350000,11], [31450000,12],
    [33950000,13], [37100000,14], [41100000,15], [45800000,16], [49500000,17], [53800000,18],
    [58500000,19], [64000000,20], [71000000,21], [80000000,22], [93000000,23], [109000000,24],
    [129000000,25], [163000000,26], [211000000,27], [374000000,28], [459000000,29], [555000000,30],
    [704000000,31], [957000000,32], [1405000000,33], [Infinity,34],
  ],
  C: [
    [6600000,0], [6950000,0.25], [7350000,0.5], [7800000,0.75], [8850000,1], [9800000,1.25],
    [10950000,1.5], [11200000,1.75], [12050000,2], [12950000,3], [14150000,4], [15550000,5],
    [17050000,6], [19500000,7], [22700000,8], [26600000,9], [28100000,10], [30100000,11],
    [32600000,12], [35400000,13], [38900000,14], [43000000,15], [47400000,16], [51200000,17],
    [55800000,18], [60400000,19], [66700000,20], [74500000,21], [83200000,22], [95600000,23],
    [110000000,24], [134000000,25], [169000000,26], [221000000,27], [390000000,28], [463000000,29],
    [561000000,30], [709000000,31], [965000000,32], [1419000000,33], [Infinity,34],
  ],
};

// Kategori TER sesuai status PTKP
function kategoriTer(ptkp) {
  if (ptkp === 'K/3') return 'C';
  if (['TK/2', 'TK/3', 'K/1', 'K/2'].includes(ptkp)) return 'B';
  return 'A';
}

// Tarif TER (desimal) untuk bruto bulanan; batas0 = batas lapisan 0%
function terRate(brutoBulanan, kategori) {
  const tabel = TER[kategori] || TER.A;
  for (const [batas, tarif] of tabel) {
    if (brutoBulanan <= batas) return { tarif: tarif / 100, batas0: tabel[0][0] };
  }
  const akhir = tabel[tabel.length - 1];
  return { tarif: akhir[1] / 100, batas0: tabel[0][0] };
}

const LAPISAN_PPH = [
  [60000000, 0.05],
  [250000000, 0.15],
  [500000000, 0.25],
  [5000000000, 0.30],
  [Infinity, 0.35],
];

function pkpSetahun(brutoSetahun, potonganBpjsTkSetahun, ptkp) {
  const biayaJabatan = Math.min(brutoSetahun * 0.05, 6000000);
  return Math.floor(Math.max(0, brutoSetahun - biayaJabatan - potonganBpjsTkSetahun - ptkp) / 1000) * 1000;
}

// Rincian per lapisan tarif: berapa yang kena dan pajaknya
function rincianLapisan(pkp) {
  const out = [];
  let bawah = 0;
  for (const [atas, tarif] of LAPISAN_PPH) {
    const kena = Math.min(pkp, atas) - bawah;
    if (kena > 0) out.push({ dari: bawah, sampai: Math.min(pkp, atas), tarif, pajak: kena * tarif });
    if (pkp <= atas) break;
    bawah = atas;
  }
  return out;
}

// PPh 21 setahun dengan tarif progresif: bruto - biaya jabatan - JHT/JP - PTKP
function pph21Setahun(brutoSetahun, potonganBpjsTkSetahun, ptkp) {
  return rincianLapisan(pkpSetahun(brutoSetahun, potonganBpjsTkSetahun, ptkp)).reduce((t, l) => t + l.pajak, 0);
}

// Ambang bruto setahun agar PKP > 0 (batas mulai kena PPh 21 tahunan)
function ambangPajakSetahun(bpjsSetahun, ptkp) {
  const a = (bpjsSetahun + ptkp) / 0.95;
  return a <= 120000000 ? a : 6000000 + bpjsSetahun + ptkp;
}

// Penyesuaian per bulan: potongan absensi/alfa dan selisih/koreksi (bisa negatif).
// Bentuk: { pot: { 'YYYY-MM': nominal }, sel: { 'YYYY-MM': nominal } }
function adjBaca(adjMap, bulan) {
  const m = (adjMap && typeof adjMap === 'object') ? adjMap : {};
  const pot = m.pot || m.potongan || {};
  const sel = m.sel || m.selisih || {};
  return { pot: Number(pot[bulan]) || 0, sel: Number(sel[bulan]) || 0 };
}

// PPh atas THR/bonus: selisih PPh setahun (rutin disetahunkan + selisih + THR)
// dengan PPh setahun rutin saja. Rutin = gaji kotor + lembur satu bulan.
function pphAtasThr(brutoRutin, selisih, nilaiThr, gajiPokok, ptkp) {
  if (arguments.length <= 4) {
    ptkp = gajiPokok; gajiPokok = nilaiThr; nilaiThr = selisih; selisih = 0;
  }
  const bpjsSetahun = gajiPokok * 0.03 * 12;
  const reg = brutoRutin * 12 + (Number(selisih) || 0);
  return pph21Setahun(reg + nilaiThr, bpjsSetahun, PTKP[ptkp] || 0)
    - pph21Setahun(reg, bpjsSetahun, PTKP[ptkp] || 0);
}

function brutoSetahunAktual(data, tahun, gajiPokok, mode, thrMap, adjMap) {
  const map = thrMap || {};
  let total = 0;
  for (let b = 1; b <= 12; b++) {
    const key = tahun + '-' + String(b).padStart(2, '0');
    const adj = adjBaca(adjMap, key);
    total += ringkasanBulan(data, key, gajiPokok, mode, adj.pot).total + adj.sel;
    if (map[key] > 0) total += map[key];
  }
  return total;
}

// PPh yang sudah dipotong Januari–November (TER atas rutin+selisih + PPh atas THR)
function pphTerpotongJanNov(data, tahun, gajiPokok, ptkp, mode, thrMap, adjMap) {
  const map = thrMap || {};
  const kat = kategoriTer(ptkp);
  let total = 0;
  for (let b = 1; b <= 11; b++) {
    const key = tahun + '-' + String(b).padStart(2, '0');
    const adj = adjBaca(adjMap, key);
    const rutin = ringkasanBulan(data, key, gajiPokok, mode, adj.pot).total;
    const bruto = rutin + adj.sel;
    total += terRate(bruto, kat).tarif * bruto;
    if (map[key] > 0) total += pphAtasThr(rutin, adj.sel, map[key], gajiPokok, ptkp);
  }
  return total;
}

// thrMap = { 'YYYY-MM': nominal } untuk semua THR/bonus
// adjMap = { pot: { 'YYYY-MM': potongan absensi/alfa }, sel: { 'YYYY-MM': selisih/koreksi } }
function hitungGaji(data, bulan, gajiPokok, ptkp, mode, thrMap, adjMap) {
  const map = thrMap || {};
  const adj = adjBaca(adjMap, bulan);
  const s = ringkasanBulan(data, bulan, gajiPokok, mode, adj.pot);
  const bpjsTk = gajiPokok * 0.03;
  const bpjsKes = gajiPokok * 0.01;
  const nilaiThr = map[bulan] > 0 ? map[bulan] : 0;
  const rutin = s.total;
  const bruto = rutin + adj.sel;
  const ptkpNilai = PTKP[ptkp] || 0;
  const kat = kategoriTer(ptkp);
  const desember = bulan.slice(5) === '12';
  let pphTeratur, pphThr, pph, ter = null, brutoSetahun, sudahPotong = 0;
  if (desember) {
    // Masa pajak terakhir: hitung setahun penuh (progresif), kurangi yang sudah dipotong Jan–Nov
    brutoSetahun = brutoSetahunAktual(data, bulan.slice(0, 4), gajiPokok, mode, map, adjMap);
    sudahPotong = pphTerpotongJanNov(data, bulan.slice(0, 4), gajiPokok, ptkp, mode, map, adjMap);
    pphTeratur = pph21Setahun(brutoSetahun, bpjsTk * 12, ptkpNilai) - sudahPotong;
    pphThr = 0;
    pph = pphTeratur;
  } else {
    ter = terRate(bruto, kat);
    pphTeratur = ter.tarif * bruto;
    pphThr = nilaiThr > 0 ? pphAtasThr(rutin, adj.sel, nilaiThr, gajiPokok, ptkp) : 0;
    pph = pphTeratur + pphThr;
    brutoSetahun = rutin * 12 + adj.sel + nilaiThr;
  }
  const ambangSetahun = ambangPajakSetahun(bpjsTk * 12, ptkpNilai);
  return Object.assign({}, s, {
    rutin,
    bruto,
    selisih: adj.sel,
    thr: nilaiThr,
    bpjsTk, bpjsKes,
    pphTeratur, pphThr, pph,
    potongan: bpjsTk + bpjsKes + pph,
    bersih: rutin + adj.sel + nilaiThr - bpjsTk - bpjsKes - pph,
    brutoTotalSetahun: brutoSetahun,
    ambangSetahun,
    kurangSetahun: Math.max(0, ambangSetahun - brutoSetahun),
    terKategori: kat,
    terRate: ter ? ter.tarif : null,
    terBatas0: ter ? ter.batas0 : null,
    metode: desember ? 'rekonsiliasi' : 'TER',
    sudahPotong,
  });
}

if (typeof module !== 'undefined') {
  module.exports = { PEMBAGI_JAM, JAM_KERJA_SEHARI, MODE_JAM, PTKP, TER, jamLemburNormal, jamLemburPenuh, jamLemburHari, bersihkanRekaman, keterangan, upahPerJam, pendapatanHari, ringkasanBulan, akumulasiHarian, kategoriTer, terRate, pph21Setahun, pkpSetahun, rincianLapisan, ambangPajakSetahun, pphAtasThr, brutoSetahunAktual, pphTerpotongJanNov, hitungGaji };
}
