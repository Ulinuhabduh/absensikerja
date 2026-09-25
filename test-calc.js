const assert = require('assert');
const { jamLemburNormal, jamLemburPenuh, jamLemburHari, bersihkanRekaman, keterangan, upahPerJam, pendapatanHari, ringkasanBulan, akumulasiHarian, pph21Setahun, ambangPajakSetahun, hitungGaji, TER, kategoriTer, terRate, brutoSetahunAktual } = require('./calc.js');

const GAJI_POKOK = 4245927;
const rate = GAJI_POKOK / 173;

// Hari biasa: 3 jam overtime = 1,5 + 2 + 2 = 5,5
assert.strictEqual(jamLemburNormal(0), 0);
assert.strictEqual(jamLemburNormal(1), 1.5);
assert.strictEqual(jamLemburNormal(2), 3.5);
assert.strictEqual(jamLemburNormal(3), 5.5);

// Hari Lembur: 8 jam = 16, 9 jam = 19, 10 jam = 23, 11 jam = 27
assert.strictEqual(jamLemburPenuh(8), 16);
assert.strictEqual(jamLemburPenuh(9), 19);
assert.strictEqual(jamLemburPenuh(10), 23);
assert.strictEqual(jamLemburPenuh(11), 27);

// Mode menentukan jam lembur hari biasa: 12 jam -> 3 (5,5), 11 jam -> 2 (3,5)
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00' }, '12'), 5.5);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00' }, '11'), 3.5);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '18:00' }, '12'), 5.5);
// Pulang belum lewat shift normal + istirahat (15:00) -> tidak ada lembur
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '15:00' }, '12'), 0);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '14:00' }, '11'), 0);
assert.strictEqual(jamLemburHari({ masuk: '05:50', keluar: '14:00' }, '12'), 0);
assert.strictEqual(jamLemburHari({}), 0);

// Hari Lembur: jam kehadiran dipotong 1 jam istirahat, tidak tergantung mode
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true }, '12'), 23);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true }, '11'), 23);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '18:00', lembur: true }, '12'), 27);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true, libur: true }, '12'), 0);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '07:00', lembur: true }, '12'), 0);

// Sanitasi data import
assert.deepStrictEqual(bersihkanRekaman({ masuk: '6:00', keluar: '17:00:00', lembur: 1 }),
  { masuk: '06:00', keluar: '17:00', lembur: true });
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

// Upah lembur per hari (hanya bagian lembur; pokok bersifat bulanan tetap)
assert.strictEqual(upahPerJam(GAJI_POKOK), rate);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00' }, GAJI_POKOK, '12') - 5.5 * rate) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00' }, GAJI_POKOK, '11') - 3.5 * rate) < 1e-9);
assert.strictEqual(pendapatanHari({ masuk: '06:00', keluar: '14:00' }, GAJI_POKOK, '12'), 0);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00', lembur: true }, GAJI_POKOK, '12') - 23 * rate) < 1e-9);
assert.strictEqual(pendapatanHari({ libur: true }, GAJI_POKOK, '12'), 0);
assert.strictEqual(pendapatanHari({ masuk: '06:00' }, GAJI_POKOK, '12'), 0);
assert.strictEqual(pendapatanHari({}, GAJI_POKOK, '12'), 0);

// Ringkasan bulan: pokok dibayar penuh (bulanan tetap), lembur dijumlah terpisah.
// gajiHarian hanya info pro-rata; total = gaji kotor + uang lembur.
const data = {
  '2026-09-01': { masuk: '06:00', keluar: '17:00' },
  '2026-09-02': { masuk: '06:00', keluar: '17:00', lembur: true },
  '2026-09-03': { libur: true },
  '2026-10-01': { masuk: '06:00', keluar: '17:00' },
};
const s = ringkasanBulan(data, '2026-09', GAJI_POKOK, '12');
assert.strictEqual(s.jam, 28.5);
assert.strictEqual(s.hariKerja, 1);
assert.strictEqual(s.hariLembur, 1);
assert.strictEqual(s.hariLibur, 1);
assert.ok(Math.abs(s.gajiHarian - 8 * rate) < 1e-9);
assert.ok(Math.abs(s.uangLembur - rate * 28.5) < 1e-9);
assert.strictEqual(s.gajiKotor, GAJI_POKOK);
assert.ok(Math.abs(s.total - (GAJI_POKOK + s.uangLembur)) < 1e-9);
// Potongan absensi mengurangi gaji kotor dan total
const sPot = ringkasanBulan(data, '2026-09', GAJI_POKOK, '12', 100000);
assert.strictEqual(sPot.potonganAbsensi, 100000);
assert.strictEqual(sPot.gajiKotor, GAJI_POKOK - 100000);
assert.ok(Math.abs(sPot.total - (s.total - 100000)) < 1e-9);
// Sebulan kerja penuh (21,625 hari) = gaji pokok
assert.ok(Math.abs(8 * rate * (173 / 8) - GAJI_POKOK) < 1e-9);

// Mode 11 jam: hari biasa jadi 3,5, total bulan = pokok + 26,5 jam
const s11 = ringkasanBulan(data, '2026-09', GAJI_POKOK, '11');
assert.strictEqual(s11.jam, 26.5);
assert.ok(Math.abs(s11.total - (GAJI_POKOK + 26.5 * rate)) < 1e-9);
assert.ok(s11.total < s.total);

// Akumulasi lembur harian: urut tanggal, total berjalan (hanya bagian lembur)
const ak = akumulasiHarian(data, '2026-09', GAJI_POKOK, '12');
assert.deepStrictEqual(ak.map(r => r.tanggal), ['2026-09-01', '2026-09-02', '2026-09-03']);
assert.ok(Math.abs(ak[0].upah - 5.5 * rate) < 1e-9);
assert.ok(Math.abs(ak[0].akumulasi - ak[0].upah) < 1e-9);
assert.ok(Math.abs(ak[1].upah - 23 * rate) < 1e-9);
assert.ok(Math.abs(ak[1].akumulasi - (ak[0].upah + ak[1].upah)) < 1e-9);
assert.strictEqual(ak[2].upah, 0);
assert.ok(Math.abs(ak[2].akumulasi - s.uangLembur) < 1e-9);

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

// Hitung gaji: pokok penuh + lembur; potongan BPJS dari gaji pokok, PPh dari bruto
const g = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '12');
assert.ok(Math.abs(g.bpjsTk - GAJI_POKOK * 0.03) < 1e-9);
assert.ok(Math.abs(g.bpjsKes - GAJI_POKOK * 0.01) < 1e-9);
assert.strictEqual(g.bruto, g.total);
assert.ok(Math.abs(g.bersih - (g.bruto - g.bpjsTk - g.bpjsKes - g.pph)) < 1e-9);
assert.ok(g.bersih < g.bruto);
const g11 = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '11');
assert.ok(g11.bruto < g.bruto);
// Rutin sebulan penuh di atas ambang tahunan, tapi TER masih 0% di bawah 5,4jt
assert.strictEqual(g.pph, 0);
assert.strictEqual(g.kurangSetahun, 0);
assert.strictEqual(g.ambangSetahun, ambangPajakSetahun(bpjsSetahun, 54000000));
// Penyesuaian: potongan mengurangi rutin, selisih menggeser bruto dan bersih
const gAdj = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '12', {}, { pot: { '2026-09': 200000 }, sel: { '2026-09': -50000 } });
assert.strictEqual(gAdj.potonganAbsensi, 200000);
assert.strictEqual(gAdj.selisih, -50000);
assert.ok(Math.abs(gAdj.rutin - (g.rutin - 200000)) < 1e-9);
assert.ok(Math.abs(gAdj.bruto - (g.rutin - 250000)) < 1e-9);
assert.ok(Math.abs(gAdj.bersih - (gAdj.bruto - gAdj.bpjsTk - gAdj.bpjsKes - gAdj.pph)) < 1e-9);
// Potongan sekali isi (angka) berlaku untuk bulan mana pun
const gFix = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '12', {}, { pot: 150000 });
assert.strictEqual(gFix.potonganAbsensi, 150000);
assert.ok(Math.abs(gFix.rutin - (g.rutin - 150000)) < 1e-9);
const gFixNov = hitungGaji(data, '2026-10', GAJI_POKOK, 'TK/0', '12', {}, { pot: 150000 });
assert.strictEqual(gFixNov.potonganAbsensi, 150000);

// THR/bonus: PPh-nya selisih metode tahunan, dipotong penuh di bulan itu
const dataBesar = {};
for (let i = 1; i <= 22; i++) dataBesar['2026-10-' + String(i).padStart(2, '0')] = { masuk: '06:00', keluar: '17:00' };
const gB = hitungGaji(dataBesar, '2026-10', GAJI_POKOK, 'TK/0', '12', {});
const gT = hitungGaji(dataBesar, '2026-10', GAJI_POKOK, 'TK/0', '12', { '2026-10': GAJI_POKOK });
assert.strictEqual(gB.pphThr, 0);
assert.ok(gT.pphThr > 0);
assert.ok(Math.abs(gT.pph - (gB.pph + gT.pphThr)) < 1e-9);
assert.ok(Math.abs(gT.bersih - (gT.bruto + GAJI_POKOK - gT.bpjsTk - gT.bpjsKes - gT.pph)) < 1e-9);
assert.ok(Math.abs(gT.pphThr - (pph21Setahun(gB.bruto * 12 + GAJI_POKOK, GAJI_POKOK * 0.03 * 12, 54000000)
  - pph21Setahun(gB.bruto * 12, GAJI_POKOK * 0.03 * 12, 54000000))) < 1e-9);

// Sudah kena pajak -> tidak ada kekurangan
assert.ok(gB.pph > 0);
assert.strictEqual(gB.kurangSetahun, 0);

// Regresi slip Januari 2026: 20 kerja + 6 lembur + 5 libur, mode 11,
// pokok 3.616.901 dibayar penuh, lembur 208 jam = 4.348.644
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
assert.strictEqual(gJanSlip.gajiKotor, 3616901);
assert.strictEqual(Math.round(gJanSlip.rutin), 7965545);
assert.strictEqual(Math.round(gJanSlip.bruto), 7933058);

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
