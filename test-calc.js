const assert = require('assert');
const { jamLemburNormal, jamLemburPenuh, jamLemburHari, bersihkanRekaman, keterangan, upahPerJam, pendapatanHari, ringkasanBulan, akumulasiHarian, pph21Setahun, ambangPajakSetahun, hitungGaji } = require('./calc.js');

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

// Upah per hari: 8 jam x upah/jam + lembur hari itu
assert.strictEqual(upahPerJam(GAJI_POKOK), rate);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00' }, GAJI_POKOK, '12') - 13.5 * rate) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00' }, GAJI_POKOK, '11') - 11.5 * rate) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '14:00' }, GAJI_POKOK, '12') - 8 * rate) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00', lembur: true }, GAJI_POKOK, '12') - 23 * rate) < 1e-9);
assert.strictEqual(pendapatanHari({ libur: true }, GAJI_POKOK, '12'), 0);
assert.strictEqual(pendapatanHari({ masuk: '06:00' }, GAJI_POKOK, '12'), 0);
assert.strictEqual(pendapatanHari({}, GAJI_POKOK, '12'), 0);

// Ringkasan bulan: pokok ikut hari yang tercatat, bukan dibayar penuh
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
assert.ok(Math.abs(s.total - (s.gajiHarian + s.uangLembur)) < 1e-9);
// Sebulan kerja penuh (21,625 hari) = gaji pokok
assert.ok(Math.abs(8 * rate * (173 / 8) - GAJI_POKOK) < 1e-9);

// Mode 11 jam: hari biasa jadi 3,5, total bulan 26,5
const s11 = ringkasanBulan(data, '2026-09', GAJI_POKOK, '11');
assert.strictEqual(s11.jam, 26.5);
assert.ok(Math.abs(s11.total - (8 * rate + 26.5 * rate)) < 1e-9);
assert.ok(s11.total < s.total);

// Akumulasi harian: urut tanggal, total berjalan
const ak = akumulasiHarian(data, '2026-09', GAJI_POKOK, '12');
assert.deepStrictEqual(ak.map(r => r.tanggal), ['2026-09-01', '2026-09-02', '2026-09-03']);
assert.ok(Math.abs(ak[0].upah - 13.5 * rate) < 1e-9);
assert.ok(Math.abs(ak[0].akumulasi - ak[0].upah) < 1e-9);
assert.ok(Math.abs(ak[1].upah - 23 * rate) < 1e-9);
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

// Hitung gaji: potongan BPJS dari gaji pokok, PPh dari bruto
const g = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '12');
assert.ok(Math.abs(g.bpjsTk - GAJI_POKOK * 0.03) < 1e-9);
assert.ok(Math.abs(g.bpjsKes - GAJI_POKOK * 0.01) < 1e-9);
assert.strictEqual(g.bruto, g.total);
assert.ok(Math.abs(g.bersih - (g.bruto - g.bpjsTk - g.bpjsKes - g.pph)) < 1e-9);
assert.ok(g.bersih < g.bruto);
const g11 = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0', '11');
assert.ok(g11.bruto < g.bruto);
// Penjelasan kenapa PPh 0: kurangSetahun > 0 selama belum kena pajak
assert.ok(g.kurangSetahun > 0);
assert.strictEqual(g.ambangSetahun, ambangPajakSetahun(bpjsSetahun, 54000000));

// THR/bonus: PPh-nya selisih metode tahunan, dipotong penuh di bulan itu
const dataBesar = {};
for (let i = 1; i <= 22; i++) dataBesar['2026-10-' + String(i).padStart(2, '0')] = { masuk: '06:00', keluar: '17:00' };
const gB = hitungGaji(dataBesar, '2026-10', GAJI_POKOK, 'TK/0', '12', 0);
const gT = hitungGaji(dataBesar, '2026-10', GAJI_POKOK, 'TK/0', '12', GAJI_POKOK);
assert.strictEqual(gB.pphThr, 0);
assert.ok(gT.pphThr > 0);
assert.ok(Math.abs(gT.pph - (gB.pph + gT.pphThr)) < 1e-9);
assert.ok(Math.abs(gT.bersih - (gT.bruto + GAJI_POKOK - gT.bpjsTk - gT.bpjsKes - gT.pph)) < 1e-9);
assert.ok(Math.abs(gT.pphThr - (pph21Setahun(gB.bruto * 12 + GAJI_POKOK, GAJI_POKOK * 0.03 * 12, 54000000)
  - pph21Setahun(gB.bruto * 12, GAJI_POKOK * 0.03 * 12, 54000000))) < 1e-9);

// Sudah kena pajak -> tidak ada kekurangan
assert.ok(gB.pph > 0);
assert.strictEqual(gB.kurangSetahun, 0);

console.log('OK - semua perhitungan benar');
