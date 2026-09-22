const assert = require('assert');
const { jamLemburNormal, jamLemburPenuh, jamLemburHari, bersihkanRekaman, keterangan, upahPerJam, pendapatanHari, ringkasanBulan, akumulasiHarian, pph21Setahun, hitungGaji } = require('./calc.js');

const GAJI_POKOK = 4245927;

// Hari biasa: 3 jam overtime = 1,5 + 2 + 2 = 5,5
assert.strictEqual(jamLemburNormal(0), 0);
assert.strictEqual(jamLemburNormal(1), 1.5);
assert.strictEqual(jamLemburNormal(2), 3.5);
assert.strictEqual(jamLemburNormal(3), 5.5);

// Hari Lembur: 8 jam = 16, 9 jam = 19, 11 jam = 27
assert.strictEqual(jamLemburPenuh(8), 16);
assert.strictEqual(jamLemburPenuh(9), 19);
assert.strictEqual(jamLemburPenuh(10), 23);
assert.strictEqual(jamLemburPenuh(11), 27);

// Rekaman sehari
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00' }), 5.5);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true }), 27);
assert.strictEqual(jamLemburHari({ masuk: '06:00', keluar: '17:00', lembur: true, libur: true }), 0);
assert.strictEqual(jamLemburHari({ masuk: '05:50', keluar: '14:00' }), 0);
assert.strictEqual(jamLemburHari({}), 0);

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
const rate = GAJI_POKOK / 173;
assert.strictEqual(upahPerJam(GAJI_POKOK), rate);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00' }, GAJI_POKOK) - 13.5 * rate) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '14:00' }, GAJI_POKOK) - 8 * rate) < 1e-9);
assert.ok(Math.abs(pendapatanHari({ masuk: '06:00', keluar: '17:00', lembur: true }, GAJI_POKOK) - 27 * rate) < 1e-9);
assert.strictEqual(pendapatanHari({ libur: true }, GAJI_POKOK), 0);
assert.strictEqual(pendapatanHari({ masuk: '06:00' }, GAJI_POKOK), 0);
assert.strictEqual(pendapatanHari({}, GAJI_POKOK), 0);

// Ringkasan bulan: pokok ikut hari yang tercatat, bukan dibayar penuh
const data = {
  '2026-09-01': { masuk: '06:00', keluar: '17:00' },
  '2026-09-02': { masuk: '06:00', keluar: '17:00', lembur: true },
  '2026-09-03': { libur: true },
  '2026-10-01': { masuk: '06:00', keluar: '17:00' },
};
const s = ringkasanBulan(data, '2026-09', GAJI_POKOK);
assert.strictEqual(s.jam, 32.5);
assert.strictEqual(s.hariKerja, 1);
assert.strictEqual(s.hariLembur, 1);
assert.strictEqual(s.hariLibur, 1);
assert.ok(Math.abs(s.gajiHarian - 8 * rate) < 1e-9);
assert.ok(Math.abs(s.uangLembur - rate * 32.5) < 1e-9);
assert.ok(Math.abs(s.total - (s.gajiHarian + s.uangLembur)) < 1e-9);
// Sebulan kerja penuh (21,625 hari) = gaji pokok
assert.ok(Math.abs(8 * rate * (173 / 8) - GAJI_POKOK) < 1e-9);

// Akumulasi harian: urut tanggal, total berjalan
const ak = akumulasiHarian(data, '2026-09', GAJI_POKOK);
assert.deepStrictEqual(ak.map(r => r.tanggal), ['2026-09-01', '2026-09-02', '2026-09-03']);
assert.ok(Math.abs(ak[0].upah - 13.5 * rate) < 1e-9);
assert.ok(Math.abs(ak[0].akumulasi - ak[0].upah) < 1e-9);
assert.ok(Math.abs(ak[1].upah - 27 * rate) < 1e-9);
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

// Hitung gaji: potongan BPJS dari gaji pokok, PPh dari bruto
const g = hitungGaji(data, '2026-09', GAJI_POKOK, 'TK/0');
assert.ok(Math.abs(g.bpjsTk - GAJI_POKOK * 0.03) < 1e-9);
assert.ok(Math.abs(g.bpjsKes - GAJI_POKOK * 0.01) < 1e-9);
assert.strictEqual(g.bruto, g.total);
assert.ok(Math.abs(g.bersih - (g.bruto - g.bpjsTk - g.bpjsKes - g.pph)) < 1e-9);
assert.ok(g.bersih < g.bruto);

console.log('OK - semua perhitungan benar');