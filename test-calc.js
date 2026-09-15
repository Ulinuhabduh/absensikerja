const assert = require('assert');
const { jamLemburNormal, jamLemburPenuh, jamLemburHari, bersihkanRekaman, ringkasanBulan } = require('./calc.js');

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

// Ringkasan bulan + rumus gaji
const data = {
  '2026-09-01': { masuk: '06:00', keluar: '17:00' },
  '2026-09-02': { masuk: '06:00', keluar: '17:00', lembur: true },
  '2026-09-03': { libur: true },
  '2026-10-01': { masuk: '06:00', keluar: '17:00' },
};
const s = ringkasanBulan(data, '2026-09', GAJI_POKOK);
assert.strictEqual(s.jam, 32.5);
assert.strictEqual(s.hariKerja, 2);
assert.strictEqual(s.hariLembur, 1);
assert.strictEqual(s.hariLibur, 1);
assert.ok(Math.abs(s.uangLembur - (GAJI_POKOK / 173) * 32.5) < 1e-9);
assert.ok(Math.abs(s.total - (GAJI_POKOK + s.uangLembur)) < 1e-9);

console.log('OK - semua perhitungan benar');