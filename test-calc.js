const assert = require('assert');
const { jamLemburNormal, jamLemburPenuh, jamLemburHari, infoDisiplin, bersihkanRekaman, keterangan, upahPerJam, pendapatanHari, ringkasanBulan, akumulasiHarian, pph21Setahun, ambangPajakSetahun, hitungGaji, TER, kategoriTer, terRate, brutoSetahunAktual } = require('./calc.js');

const GAJI_POKOK = 4245927;
const rate = GAJI_POKOK / 173;

// Hari biasa: OT ke-1 = 1,5; berikutnya = 2 (fraksional ikut)
assert.strictEqual(jamLemburNormal(0), 0);
assert.strictEqual(jamLemburNormal(1), 1.5);
assert.strictEqual(jamLemburNormal(2), 3.5);
assert.strictEqual(jamLemburNormal(3), 5.5);
assert.strictEqual(jamLemburNormal(0.5), 0.75);
assert.strictEqual(jamLemburNormal(3.5), 6.5);

// Hari Lembur: 8 jam = 16, 9 jam = 19, 10 jam = 23, 11 jam = 27, 11,5 jam = 29
assert.strictEqual(jamLemburPenuh(8), 16);
assert.strictEqual(jamLemburPenuh(9), 19);
assert.strictEqual(jamLemburPenuh(10), 23);
assert.strictEqual(jamLemburPenuh(11), 27);
assert.strictEqual(jamLemburPenuh(11.5), 29);

// Dinamis per hari dari durasi (istirahat 1 jam); mode diabaikan.
// 06:00-17:00 = 11 jam -> kerja 10 -> OT 2 -> 3,5
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00' }, '12'), 3.5);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00' }, '11'), 3.5);
// 05:30-18:00 & 17:30-06:00 (lewat tengah malam) = 12,5 jam -> OT 3,5 -> 6,5
assert.strictEqual(jamLemburHari({ masuk: '05:30', keluar: '18:00' }, '12'), 6.5);
assert.strictEqual(jamLemburHari({ masuk: '17:30', keluar: '06:00' }, '12'), 6.5);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '18:00' }, '12'), 5.5);
// OT nol bila kerja <= 8 jam
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '15:00' }, '12'), 0);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '14:00' }, '11'), 0);
assert.strictEqual(jamLemburHari({ masuk: '05:50', keluar: '14:00' }, '12'), 0);
assert.strictEqual(jamLemburHari({}), 0);

// Hari Lembur: seluruh durasi kerja (06:00-17:00 -> 10 jam -> 23)
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true }, '12'), 23);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true }, '11'), 23);
assert.strictEqual(jamLemburHari({ masuk: '05:30', keluar: '18:00', lembur: true }, '12'), 29);
assert.strictEqual(jamLemburHari({ masuk: '17:30', keluar: '06:00', lembur: true }, '12'), 29);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '18:00', lembur: true }, '12'), 27);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true, libur: true }, '12'), 0);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '07:00', lembur: true }, '12'), 0);

// Pecahan selain .5 dibulatkan ke 0,5 terdekat (16-Mar: 4,53 -> 4,5)
assert.strictEqual(jamLemburHari({ masuk: '17:30', keluar: '05:01' }, '12'), 4.5);
assert.strictEqual(jamLemburHari({ masuk: '05:50', keluar: '17:42', lembur: true }, '12'), 26.5);

// Roster menang atas aktual (bukti 3 bulan: lembur ikut roster)
assert.strictEqual(jamLemburHari({ masuk: '17:07', keluar: '05:01', jadwalMasuk: '17:30', jadwalKeluar: '06:00' }, '12'), 6.5);
assert.strictEqual(jamLemburHari({ masuk: '05:12', keluar: '18:03', jadwalMasuk: '05:30', jadwalKeluar: '18:00', lembur: true }, '12'), 29);
// Roster separuh diabaikan -> ikut aktual
assert.strictEqual(jamLemburHari({ masuk: '17:07', keluar: '05:01', jadwalMasuk: '17:30' }, '12'), 5.5);
// Tanpa aktual (hanya roster) tidak dihitung
assert.strictEqual(jamLemburHari({ jadwalMasuk: '17:30', jadwalKeluar: '06:00' }, '12'), 0);

// Disiplin vs roster (toleransi 5 menit): info saja, tidak memotong
assert.deepStrictEqual(infoDisiplin({ masuk: '17:07', keluar: '05:01', jadwalMasuk: '17:30', jadwalKeluar: '06:00' }), { telat: 0, awal: 59 });
assert.deepStrictEqual(infoDisiplin({ masuk: '17:35', keluar: '06:00', jadwalMasuk: '17:30', jadwalKeluar: '06:00' }), null);
assert.deepStrictEqual(infoDisiplin({ masuk: '17:36', keluar: '06:00', jadwalMasuk: '17:30', jadwalKeluar: '06:00' }), { telat: 6, awal: 0 });
assert.strictEqual(infoDisiplin({ masuk: '17:30', keluar: '06:00' }), null);
assert.strictEqual(infoDisiplin({ libur: true }), null);

// Sanitasi data import
assert.deepStrictEqual(bersihkanRekaman({ masuk: '6:00', keluar: '17:00:00', lembur: 1 }),
  { masuk: '06:00', keluar: '17:00', lembur: true });
assert.deepStrictEqual(bersihkanRekaman({ masuk: '17:07', keluar: '05:01', jadwalMasuk: '17:30', jadwalKeluar: '6:00' }),
  { masuk: '17:07', keluar: '05:01', jadwalMasuk: '17:30', jadwalKeluar: '06:00' });
assert.deepStrictEqual(bersihkanRekaman({ masuk: 'abc', keluar: null, libur: true }), { libur: true });
assert.strictEqual(bersihkanRekaman(null), null);
assert.strictEqual(bersihkanRekaman('2026-09-01'), null);
assert.deepStrictEqual(bersihkanRekaman({ libur: true, ket: 'izin' }), { libur: true, ket: 'izin' });
assert.deepStrictEqual(bersihkanRekaman({ libur: true, ket: 'ngawur' }), { libur: true });

// Keterangan lembar absensi
assert.strictEqual(keterangan(null), '');
assert.strictEqual(keterangan({}), '');
assert.strictEqual(keterangan({ masuk: '06:00', keluar: '17:00' }), 'Masuk');
assert.strictEqual(keterangan({ masuk: '06:00', keluar: '17:00', lembur: true }), 'Masuk (Lembur)');
assert.strictEqual(keterangan({ libur: true }), 'Libur');
assert.strictEqual(keterangan({ libur: true, ket: 'izin' }), 'Izin');
assert.strictEqual(keterangan({ libur: true, ket: 'alfa' }), 'Alfa');

// Upah harian = pokok/21 + uang lembur dinamis (hari kerja & full lembur sama)
const HARIAN = GAJI_POKOK / 21;
assert.strictEqual(upahPerJam(GAJI_POKOK), rate);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00' }, GAJI_POKOK, '12') - (HARIAN + 3.5 * rate)) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '05:30', keluar: '18:00' }, GAJI_POKOK, '12') - (HARIAN + 6.5 * rate)) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '14:00' }, GAJI_POKOK, '12') - HARIAN) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00', lembur: true }, GAJI_POKOK, '12') - (HARIAN + 23 * rate)) < 1e-9);
assert.strictEqual(pendapatanHari({ libur: true }, GAJI_POKOK, '12'), 0);
assert.strictEqual(pendapatanHari({ masuk: '06:00' }, GAJI_POKOK, '12'), 0);
assert.strictEqual(pendapatanHari({}, GAJI_POKOK, '12'), 0);

// Ringkasan bulan: akumulasi harian (tiap masuk = pokok/21 + lembur).
// total = gaji harian + uang lembur; libur/alfa = 0 tanpa potongan otomatis.
const data = {
  '2026-09-01': { masuk: '06:00', keluar: '17:00' },
  '2026-09-02': { masuk: '06:00', keluar: '17:00', lembur: true },
  '2026-09-03': { libur: true },
  '2026-10-01': { masuk: '06:00', keluar: '17:00' },
};
const s = ringkasanBulan(data, '2026-09', GAJI_POKOK, '12');
assert.strictEqual(s.jam, 26.5);
assert.strictEqual(s.hariKerja, 1);
assert.strictEqual(s.hariLembur, 1);
assert.strictEqual(s.hariLibur, 1);
assert.ok(Math.abs(s.gajiHarian - 2 * GAJI_POKOK / 21) < 1e-9);
assert.ok(Math.abs(s.uangLembur - rate * 26.5) < 1e-9);
assert.strictEqual(s.gajiKotor, s.gajiHarian);
assert.strictEqual(s.potonganAbsensi, 0);
assert.ok(Math.abs(s.total - (s.gajiHarian + s.uangLembur)) < 1e-9);
// Potongan manual (override) mengurangi gaji kotor dan total
const sPot = ringkasanBulan(data, '2026-09', GAJI_POKOK, '12', 100000);
assert.strictEqual(sPot.potonganAbsensi, 100000);
assert.ok(Math.abs(sPot.gajiKotor - (s.gajiHarian - 100000)) < 1e-9);
assert.ok(Math.abs(sPot.total - (s.total - 100000)) < 1e-9);
// Sebulan kerja penuh (21,625 hari) = gaji pokok
assert.ok(Math.abs(8 * rate * (173 / 8) - GAJI_POKOK) < 1e-9);

// Mode diabaikan (dinamis): hasil sama untuk mode apa pun
const s11 = ringkasanBulan(data, '2026-09', GAJI_POKOK, '11');
assert.strictEqual(s11.jam, 26.5);
assert.ok(Math.abs(s11.total - s.total) < 1e-9);

// Akumulasi harian: urut tanggal, total berjalan (pokok/21 + lembur)
const ak = akumulasiHarian(data, '2026-09', GAJI_POKOK, '12');
assert.deepStrictEqual(ak.map(r => r.tanggal), ['2026-09-01', '2026-09-02', '2026-09-03']);
assert.ok(Math.abs(ak[0].upah - (GAJI_POKOK / 21 + 3.5 * rate)) < 1e-9);
assert.ok(Math.abs(ak[0].akumulasi - ak[0].upah) < 1e-9);
assert.ok(Math.abs(ak[1].upah - (GAJI_POKOK / 21 + 23 * rate)) < 1e-9);
assert.ok(Math.abs(ak[1].akumulasi - (ak[0].upah + ak[1].upah)) < 1e-9);
assert.strictEqual(ak[2].upah, 0);
assert.ok(Math.abs(ak[2].akumulasi - s.total) < 1e-9);

// PPh 21: bruto 100jt setahun, JHT/JP 1,5jt, TK/0 -> pkp 39,5jt -> 5%
assert.strictEqual(pph21Setahun(0, 0, 54000000), 0);
assert.strictEqual(pph21Setahun(100000000, 1500000, 54000000), 1975000);
// bruto 300jt: pkp 238,5jt -> 60jt*5% + 178,5jt*15%
assert.strictEqual(pph21Setahun(300000000, 1500000, 54000000), 29775000);
// biaya jabatan dipatok 6jt, PTKP K/3 lebih besar -> pajak lebih kecil
assert.ok(pph21Setahun(300000000, 1500000, 72000000) < 29775000);

// Ambang mulai kena pajak: tepat di ambang PPh 0, sedikit di atasnya sudah kena
const bpjsSetahun = GAJI_POKOK * 0.03 * 12;
const ambang = ambangPajakSetahun(bpjsSetahun, 54000000);
assert.strictEqual(pph21Setahun(ambang, bpjsSetahun, 54000000), 0);
assert.ok(pph21Setahun(ambang * 1.01, bpjsSetahun, 54000000) > 0);
// ambang setahun / 12 = ambang bruto bulanan TK/0 (sekitar 4,87 juta)
assert.ok(Math.abs(ambang / 12 - 4870924) < 10);

// Hitung gaji: akumulasi harian + lembur; potongan BPJS dari gaji pokok acuan, PPh dari bruto
const g = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '12');
assert.ok(Math.abs(g.bpjsTk - GAJI_POKOK * 0.03) < 1e-9);
assert.ok(Math.abs(g.bpjsKes - GAJI_POKOK * 0.01) < 1e-9);
assert.strictEqual(g.bruto, g.total);
assert.ok(Math.abs(g.bersih - (g.bruto - g.bpjsTk - g.bpjsKes - g.pph)) < 1e-9);
assert.ok(g.bersih < g.bruto);
const g11 = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '11');
assert.ok(Math.abs(g11.bruto - g.bruto) < 1e-9);
// 2 hari saja -> bruto kecil, TER 0%, masih di bawah ambang tahunan
assert.strictEqual(g.pph, 0);
assert.ok(g.kurangSetahun > 0);
assert.strictEqual(g.ambangSetahun, ambangPajakSetahun(bpjsSetahun, 54000000));
// Penyesuaian: selisih menggeser bruto dan bersih; alfa/libur = 0 tanpa potongan
const dataAdj = {
  '2026-09-01': { masuk: '06:00', keluar: '17:00' },
  '2026-09-02': { libur: true, ket: 'alfa' },
};
const gAdj = hitungGaji(dataAdj, '2026-09', GAJI_POKOK, 'TK/0', '12', {}, { sel: { '2026-09': -50000 } });
assert.strictEqual(gAdj.potonganAbsensi, 0);
assert.strictEqual(gAdj.hariAlfa, 1);
assert.strictEqual(gAdj.selisih, -50000);
assert.ok(Math.abs(gAdj.rutin - (GAJI_POKOK / 21 + 3.5 * rate)) < 1e-9);
assert.ok(Math.abs(gAdj.bruto - (gAdj.rutin - 50000)) < 1e-9);
assert.ok(Math.abs(gAdj.bersih - (gAdj.bruto - gAdj.bpjsTk - gAdj.bpjsKes - gAdj.pph)) < 1e-9);
// Aturan sama berlaku untuk bulan mana pun: alfa tetap 0 potongan
const dataAdjNov = {
  '2026-10-01': { masuk: '06:00', keluar: '17:00' },
  '2026-10-02': { libur: true, ket: 'alfa' },
};
const gAdjNov = hitungGaji(dataAdjNov, '2026-10', GAJI_POKOK, 'TK/0', '12', {}, {});
assert.strictEqual(gAdjNov.potonganAbsensi, 0);
assert.strictEqual(gAdjNov.potonganAbsensi, gAdj.potonganAbsensi);

// THR/bonus: gabung ke bruto, PPh = TER atas bruto gabungan
const dataBesar = {};
for (let i = 1; i <= 22; i++) dataBesar['2026-10-' + String(i).padStart(2, '0')] = { masuk: '06:00', keluar: '17:00' };
const gB = hitungGaji(dataBesar, '2026-10', GAJI_POKOK, 'TK/0', '12', {});
const gT = hitungGaji(dataBesar, '2026-10', GAJI_POKOK, 'TK/0', '12', { '2026-10': GAJI_POKOK });
assert.strictEqual(gB.pphThr, 0);
assert.strictEqual(gT.pphThr, 0);
assert.ok(Math.abs(gT.bruto - (gB.bruto + GAJI_POKOK)) < 1e-9);
assert.ok(Math.abs(gT.pph - terRate(gT.bruto, 'A').tarif * gT.bruto) < 1e-9);
assert.ok(Math.abs(gT.bersih - (gT.bruto - gT.bpjsTk - gT.bpjsKes - gT.pph)) < 1e-9);

// Sudah kena pajak -> tidak ada kekurangan
assert.ok(gB.pph > 0);
assert.strictEqual(gB.kurangSetahun, 0);

// Regresi slip Januari 2026: 20 kerja + 6 lembur + 5 libur, mode 11,
// 26 hari -> bagian pokok mentok di 3.616.901, lembur 208 jam = 4.348.644
const janData = {};
for (let i = 1; i <= 31; i++) janData['2026-01-' + String(i).padStart(2, '0')] = { masuk: '06:00', keluar: '17:00' };
for (const t of ['2026-01-01', '2026-01-03', '2026-01-10', '2026-01-17', '2026-01-24', '2026-01-31']) janData[t].lembur = true;
for (const t of ['2026-01-02', '2026-01-09', '2026-01-16', '2026-01-23', '2026-01-30']) janData[t] = { libur: true };
const gJanSlip = hitungGaji(janData, '2026-01', 3616901, 'K/1', '11', {}, { sel: { '2026-01': -32487 } });
assert.strictEqual(gJanSlip.hariKerja, 20);
assert.strictEqual(gJanSlip.hariLembur, 6);
assert.strictEqual(gJanSlip.hariLibur, 5);
assert.strictEqual(gJanSlip.jam, 208);
assert.strictEqual(Math.round(gJanSlip.uangLembur), 4348644);
assert.strictEqual(Math.round(gJanSlip.gajiHarian), 3616901);
assert.strictEqual(Math.round(gJanSlip.gajiKotor), 3616901);
assert.strictEqual(gJanSlip.potonganAbsensi, 0);
assert.strictEqual(Math.round(gJanSlip.rutin), 7965545);
assert.strictEqual(Math.round(gJanSlip.bruto), 7933058);

// Cap pokok: 22 hari -> harian mentok di pokok, total = pokok + lembur;
// baris ke-22 dst hanya nambah lembur
const capData = {};
for (let i = 1; i <= 22; i++) capData['2026-10-' + String(i).padStart(2, '0')] = { masuk: '06:00', keluar: '17:00' };
const sCap = ringkasanBulan(capData, '2026-10', GAJI_POKOK, '12');
assert.strictEqual(Math.round(sCap.gajiHarian), GAJI_POKOK);
assert.ok(Math.abs(sCap.total - (GAJI_POKOK + sCap.uangLembur)) < 1e-6);
const akCap = akumulasiHarian(capData, '2026-10', GAJI_POKOK, '12');
assert.ok(Math.abs(akCap[21].akumulasi - sCap.total) < 1e-6);
assert.ok(Math.abs(akCap[21].upah - 3.5 * rate) < 1e-6);

// Februari 2026 (roster): 18 normal panjang x 6,5 + 1 pendek x 3,5 + 5 full x 29 = 265,5
const febData = {
  '2026-02-01': { masuk: '06:00', keluar: '17:00' },
  '2026-02-07': { libur: true, ket: 'alfa' },
  '2026-02-14': { libur: true, ket: 'alfa' },
  '2026-02-21': { libur: true, ket: 'alfa' },
  '2026-02-28': { libur: true, ket: 'alfa' },
};
for (const t of ['2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05', '2026-02-08', '2026-02-09', '2026-02-10', '2026-02-11', '2026-02-12', '2026-02-15', '2026-02-16', '2026-02-18', '2026-02-19', '2026-02-22', '2026-02-23', '2026-02-24', '2026-02-25', '2026-02-26']) {
  febData[t] = t < '2026-02-15' && t > '2026-02-07' || t > '2026-02-21'
    ? { masuk: '05:30', keluar: '18:00' } : { masuk: '17:30', keluar: '06:00' };
}
for (const t of ['2026-02-06', '2026-02-13', '2026-02-17', '2026-02-20', '2026-02-27']) {
  febData[t] = (t === '2026-02-13' || t === '2026-02-27')
    ? { masuk: '05:30', keluar: '18:00', lembur: true } : { masuk: '17:30', keluar: '06:00', lembur: true };
}
const sFeb = ringkasanBulan(febData, '2026-02', GAJI_POKOK, '12');
assert.ok(Math.abs(sFeb.jam - 265.5) < 1e-9);

// --- Tabel TER (Lampiran PP 58/2023) ---
assert.strictEqual(TER.A.length, 44);
assert.strictEqual(TER.B.length, 40);
assert.strictEqual(TER.C.length, 41);
for (const k of ['A', 'B', 'C']) {
  assert.strictEqual(TER[k][0][1], 0, k + ' mulai dari 0%');
  assert.strictEqual(TER[k][TER[k].length - 1][1], 34, k + ' puncak 34%');
  assert.strictEqual(TER[k][TER[k].length - 1][0], Infinity, k + ' baris terakhir tanpa batas');
  for (let i = 1; i < TER[k].length; i++) {
    assert.ok(TER[k][i][0] > TER[k][i - 1][0], k + ' batas naik di baris ' + i);
    assert.ok(TER[k][i][1] > TER[k][i - 1][1], k + ' tarif naik di baris ' + i);
  }
}
// Kategori sesuai PTKP
assert.strictEqual(kategoriTer('TK/0'), 'A');
assert.strictEqual(kategoriTer('K/0'), 'A');
assert.strictEqual(kategoriTer('TK/2'), 'B');
assert.strictEqual(kategoriTer('K/2'), 'B');
assert.strictEqual(kategoriTer('K/3'), 'C');
// Tarif per lapisan
assert.strictEqual(terRate(5400000, 'A').tarif, 0);
assert.strictEqual(terRate(6000000, 'A').tarif, 0.0075);
assert.strictEqual(terRate(50000000, 'A').tarif, 0.18);
assert.strictEqual(terRate(6200000, 'B').tarif, 0);
assert.strictEqual(terRate(9200000, 'B').tarif, 0.01);
assert.strictEqual(terRate(2000000000, 'A').tarif, 0.34);

// --- Mekanisme TER + rekonsiliasi Desember ---
const setahun = {};
for (let b = 1; b <= 12; b++) {
  for (let i = 1; i <= 20; i++) setahun['2026-' + String(b).padStart(2, '0') + '-' + String(i).padStart(2, '0')] = { masuk: '06:00', keluar: '17:00' };
}
const gJan = hitungGaji(setahun, '2026-01', GAJI_POKOK, 'TK/0', '12', {});
assert.strictEqual(gJan.metode, 'TER');
assert.strictEqual(gJan.terKategori, 'A');
assert.ok(Math.abs(gJan.pph - terRate(gJan.bruto, 'A').tarif * gJan.bruto) < 1e-9);
const gDes = hitungGaji(setahun, '2026-12', GAJI_POKOK, 'TK/0', '12', {});
assert.strictEqual(gDes.metode, 'rekonsiliasi');
// Total setahun (TER Jan-Nov + rekonsiliasi Des) harus sama dengan PPh setahun progresif
let totalPph = 0, totalBruto = 0;
for (let b = 1; b <= 12; b++) {
  const gb = hitungGaji(setahun, '2026-' + String(b).padStart(2, '0'), GAJI_POKOK, 'TK/0', '12', {});
  totalPph += gb.pph;
  totalBruto += gb.bruto;
}
assert.ok(Math.abs(totalBruto - brutoSetahunAktual(setahun, '2026', GAJI_POKOK, '12', {})) < 1e-6);
assert.ok(Math.abs(totalPph - pph21Setahun(totalBruto, GAJI_POKOK * 0.03 * 12, 54000000)) < 1e-6);

console.log('OK - semua perhitungan benar');
