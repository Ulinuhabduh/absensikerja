// Jalankan: node test-jadwal.js (membutuhkan Google Chrome/Chromium).
const assert = require('assert');
const { spawn } = require('child_process');
const { once } = require('events');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

async function testDiBrowser() {
  function cek(kondisi, pesan) { if (!kondisi) throw new Error(pesan); }
  function pilih(hari, status) {
    el('jadwalStatus').value = status;
    el('jadwalHari').value = String(hari);
    el('btnJadwal').click();
  }
  function hapus(hari) {
    const button = document.querySelector('#jadwalMingguan [data-hapus-hari="' + hari + '"]');
    if (button) button.click();
  }
  function jadwalLama(hari) {
    jadwalMingguan = Object.assign({}, jadwalMingguan, { [hari]: 'biasa' });
    localStorage.setItem(KEY_JADWAL, JSON.stringify(jadwalMingguan));
    renderJadwalMingguan();
  }
  function teksJadwal(hari) {
    return document.querySelector('#jadwalMingguan [data-hapus-hari="' + hari + '"]')?.parentElement.textContent || '';
  }
  function ujiSalinOtomatis() {
    const lama = { masuk: '06:00', keluar: '17:00', jadwalMasuk: '06:00', jadwalKeluar: '17:00' };
    const terakhir = { masuk: '05:30', keluar: '17:30', jadwalMasuk: '05:30', jadwalKeluar: '17:30' };
    const libur = { libur: true, ket: null };
    const konfirmasi = window.confirm;
    window.confirm = () => true;
    data = { '2026-10-30': lama, '2026-10-31': terakhir, '2026-10-99': { masuk: '08:00', keluar: '18:00' }, '2026-11-01': libur, '2026-12-31': { masuk: '09:00', keluar: '20:00' } };
    pilih(1, 'lembur');
    pilih(0, 'libur');
    copyRow('2026-11-01'); // Minggu libur -> Senin lembur
    cek(data['2026-11-02'].lembur && data['2026-11-02'].masuk === '05:30' && data['2026-11-02'].keluar === '17:30', 'lembur setelah libur tidak mengambil jam kerja terakhir');
    cek(data['2026-11-02'].jadwalMasuk === '05:30' && data['2026-11-02'].jadwalKeluar === '17:30', 'roster sebelum libur tidak disalin');
    cek(el('manMsg').textContent.includes('2026-10-31'), 'asal jam sebelum libur tidak ditampilkan');
    copyRow('2026-11-02'); // Selasa tidak diatur: biasa, bukan lembur
    cek(!data['2026-11-03'].lembur && !data['2026-11-03'].libur, 'status lembur terbawa ke hari biasa');
    cek(jamLemburHari(data['2026-11-02'], mode) === 27 && jamLemburHari(data['2026-11-03'], mode) === 5.5, 'perhitungan hari lembur dan biasa salah');
    const upah = akumulasiHarian(data, '2026-11', 4245927, mode);
    const pokokHarian = 4245927 / 21, rate = 4245927 / 173;
    cek(Math.abs(upah.find(row => row.tanggal === '2026-11-02').upah - (pokokHarian + 27 * rate)) < 0.000001, 'upah hari lembur salah');
    cek(Math.abs(upah.find(row => row.tanggal === '2026-11-03').upah - (pokokHarian + 5.5 * rate)) < 0.000001, 'upah hari biasa setelah lembur salah');
    for (const hari of ['03', '04', '05', '06']) {
      copyRow('2026-11-' + hari);
      const besok = nextDate('2026-11-' + hari);
      cek(!data[besok].lembur && !data[besok].libur, 'hari biasa berturut-turut menjadi lembur');
    }
    copyRow('2026-11-07'); // Sabtu -> Minggu
    cek(data['2026-11-08'].libur && !data['2026-11-08'].masuk && !data['2026-11-08'].keluar, 'hari libur memiliki jam kerja');
    copyRow('2026-11-08');
    cek(data['2026-11-09'].lembur && data['2026-11-09'].masuk === '05:30' && data['2026-11-09'].jadwalKeluar === '17:30', 'data sebelum libur tidak diambil pada minggu berikutnya');
    cek(el('manMsg').textContent.includes('2026-11-07'), 'tanggal sumber jam tidak benar');
    copyRow('2026-11-09');
    cek(!data['2026-11-10'].lembur && data['2026-11-10'].masuk === '05:30', 'status hari biasa setelah lembur salah');
    cek(data['2026-10-31'] === terakhir && data['2026-11-01'] === libur && !libur.masuk, 'menyalin mengubah data sebelumnya');

    pilih(6, 'libur'); // libur dua hari berturut-turut
    data = { '2026-10-30': terakhir };
    copyRow('2026-10-30');
    copyRow('2026-10-31');
    copyRow('2026-11-01');
    cek(data['2026-11-02'].lembur && data['2026-11-02'].masuk === '05:30' && el('manMsg').textContent.includes('2026-10-30'), 'pencarian sebelum beberapa hari libur gagal');

    hapus(6);
    data = { '2026-12-31': terakhir, '2027-01-01': { libur: true } };
    copyRow('2027-01-01');
    cek(!data['2027-01-02'].lembur && !data['2027-01-02'].libur && data['2027-01-02'].masuk === '05:30' && el('manMsg').textContent.includes('2026-12-31'), 'pencarian sebelum libur lintas tahun gagal');

    data = { '2026-10-30': lama, '2026-10-31': { masuk: '12:00', jadwalMasuk: '12:00', jadwalKeluar: '21:00' }, '2026-11-01': { libur: true } };
    copyRow('2026-11-01');
    cek(data['2026-11-02'].masuk === '12:00' && !data['2026-11-02'].keluar && data['2026-11-02'].jadwalKeluar === '21:00', 'data kerja terdekat yang belum lengkap diabaikan');
    cek(el('manMsg').textContent.includes('Lengkapi jam') && pendapatanHari(data['2026-11-02'], 4245927, mode) === 0, 'jam tidak lengkap tidak diperingatkan');

    data = { '2026-11-01': { libur: true, masuk: '23:00', keluar: '23:30' }, '2026-12-31': terakhir };
    copyRow('2026-11-01');
    cek(data['2026-11-02'].lembur && !data['2026-11-02'].masuk && !data['2026-11-02'].keluar, 'jam libur atau data masa depan salah dipakai');
    cek(el('manMsg').textContent.includes('tidak ditemukan') && el('manMsg').textContent.includes('Lengkapi jam') && pendapatanHari(data['2026-11-02'], 4245927, mode) === 0, 'data kosong tidak diperingatkan');

    hapus(0); hapus(1); hapus(6);
    data = { '2026-11-02': Object.assign({}, terakhir, { lembur: true }) };
    copyRow('2026-11-02');
    cek(data['2026-11-03'].lembur, 'tanpa jadwal perilaku salin lama berubah');
    window.confirm = konfirmasi;
    data = {};
    jadwalMingguan = {};
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_JADWAL);
    renderJadwalMingguan();
    viewMonth = todayKey().slice(0, 7);
    render();
    el('manCancel').click();
  }
  async function impor(payload) {
    const files = new DataTransfer();
    files.items.add(new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' }));
    el('importFile').files = files.files;
    await el('importFile').onchange();
  }
  function hasil(status, pesan) {
    const output = document.createElement('output');
    output.id = 'test-result';
    output.dataset.status = status;
    output.textContent = pesan;
    document.body.appendChild(output);
  }
  try {
    if (!sessionStorage.getItem('jadwal-test-reload')) {
      cek([...el('jadwalStatus').options].map(option => option.value).join(',') === 'lembur,libur', 'pilihan status tidak sesuai');
      el('slipBulan').value = '2026-09';
      el('slipBulan').dispatchEvent(new Event('change'));
      cek(viewMonth === '2026-09', 'periode slip tidak berubah');
      const slipPdf = buatSlipPdf();
      cek(slipPdf.blob.type === 'application/pdf' && slipPdf.blob.size > 1000 && slipPdf.nama.includes('2026-09'), 'slip PDF gagal dibuat');
      const isiSlip = await slipPdf.blob.text();
      cek(isiSlip.includes('PERHITUNGAN SELISIH') && isiSlip.includes('MATRIKS RATE OVERTIME') && isiSlip.includes('Total jam'), 'bagian slip belum lengkap');
      cek(isiSlip.includes('bukan slip resmi perusahaan') && isiSlip.includes('STATUS KERJA'), 'keterangan slip tidak tersedia');
      el('btnSlip').click();
      cek(el('slipMsg').textContent.includes('berhasil'), 'tombol slip gagal');
      el('perusahaanBulan').value = '2026-09';
      el('perusahaanPilihan').value = 'alfalah';
      el('btnPerusahaan').click();
      cek(perusahaanBulanan['2026-09'] === 'alfalah' && JSON.parse(localStorage.getItem(KEY_PERUSAHAAN))['2026-09'] === 'alfalah', 'pilihan perusahaan tidak tersimpan');
      cek((await buatSlipPdf().blob.text()).includes('AL FALAH'), 'slip tidak memakai perusahaan terpilih');
      viewMonth = '2026-10'; renderMonth();
      cek(el('perusahaanPilihan').value === 'alfalah' && perusahaanBulanan['2026-09'] === 'alfalah', 'pilihan tidak berlanjut ke bulan berikutnya');
      el('perusahaanPilihan').value = 'seroja'; el('btnPerusahaan').click();
      viewMonth = '2026-11'; renderMonth();
      cek(el('perusahaanPilihan').value === 'seroja', 'pergantian perusahaan tidak berlanjut');
      viewMonth = '2026-09'; renderMonth();
      cek(el('perusahaanPilihan').value === 'alfalah', 'pergantian mengubah bulan sebelumnya');
      localStorage.removeItem(KEY_PERUSAHAAN); perusahaanBulanan = {};
      cek([...el('jadwalHari').options].map(option => option.value).join(',') === ',1,2,3,4,5,6,0', 'pilihan tujuh hari tidak tersedia');
      cek(!el('jadwalKosong').hidden && !Object.keys(jadwalMingguan).length, 'pengaturan awal mengubah perilaku salin');
      el('btnJadwal').click();
      cek(el('jadwalMsg').textContent.includes('Pilih hari') && !Object.keys(jadwalMingguan).length, 'jadwal kosong tersimpan');
      ujiSalinOtomatis();
      const kerja = { masuk: '05:30', keluar: '17:30', jadwalMasuk: '05:30', jadwalKeluar: '17:30' };
      data = { '2026-12-25': kerja };
      save();
      const sebelum = localStorage.getItem(KEY);
      pilih(6, 'lembur');
      pilih(0, 'libur');
      cek(teksJadwal(6).includes('Sabtu · Lembur') && teksJadwal(0).includes('Minggu · Libur'), 'jadwal tidak terlihat');
      pilih(6, 'libur');
      cek(jadwalMingguan['6'] === 'libur' && document.querySelectorAll('#jadwalMingguan [data-hapus-hari="6"]').length === 1, 'perubahan hari membuat duplikat');
      pilih(6, 'lembur');
      jadwalLama(1);
      cek(teksJadwal(1).includes('Biasa (pengaturan sebelumnya)'), 'jadwal biasa lama tersembunyi');
      hapus(1);
      cek(!Object.prototype.hasOwnProperty.call(jadwalMingguan, '1'), 'jadwal lama tidak dapat dihapus');
      jadwalLama(1);
      cek(localStorage.getItem(KEY) === sebelum, 'mengubah jadwal mengubah absensi yang sudah ada');
      cek(JSON.parse(localStorage.getItem(KEY_JADWAL))['6'] === 'lembur', 'jadwal tidak tersimpan');

      viewMonth = '2026-12';
      renderMonth();
      document.querySelector('[data-copy="2026-12-25"]').click(); // Jumat -> Sabtu
      cek(data['2026-12-26'].lembur && !data['2026-12-26'].libur, 'Sabtu tidak menjadi lembur');
      cek(data['2026-12-26'].masuk === '05:30' && data['2026-12-26'].jadwalKeluar === '17:30', 'jam lembur berubah');
      cek(jamLemburHari(data['2026-12-26'], mode) === 27, 'perhitungan lembur hasil salin salah');
      cek(el('manLembur').getAttribute('aria-pressed') === 'true', 'form tidak menampilkan lembur');
      el('manLembur').click();
      el('manSave').click();
      cek(!data['2026-12-26'].lembur, 'status otomatis tidak dapat diubah manual');
      el('manLembur').click();
      el('manSave').click();
      copyRow('2026-12-26'); // Sabtu -> Minggu
      const libur = data['2026-12-27'];
      cek(libur.libur && !libur.lembur && !libur.ket, 'Minggu tidak menjadi libur biasa');
      cek(!libur.masuk && !libur.keluar && !libur.jadwalMasuk && !libur.jadwalKeluar, 'jam libur tidak dikosongkan');
      cek(pendapatanHari(libur, 4245927, mode) === 0, 'libur masih dihitung sebagai kerja');
      cek(el('manLibur').getAttribute('aria-pressed') === 'true', 'form tidak menampilkan libur');
      el('manSave').click();
      cek(data['2026-12-27'].libur && !data['2026-12-27'].masuk, 'menyimpan form mengubah libur');
      copyRow('2026-12-27'); // Minggu -> Senin
      const senin = data['2026-12-28'];
      cek(!senin.libur && !senin.lembur && !senin.ket, 'Senin tidak kembali menjadi hari biasa');
      cek(senin.masuk === '05:30' && senin.keluar === '17:30' && el('manMsg').textContent.includes('2026-12-26'), 'salinan dari libur tidak mengambil jam sebelumnya');
      el('manMasuk').value = '06:00';
      el('manKeluar').value = '17:00';
      el('manSave').click();
      cek(data['2026-12-28'].masuk === '06:00' && !data['2026-12-28'].libur, 'jam kerja setelah libur tidak tersimpan');
      cek(data['2026-12-25'] === kerja && !kerja.lembur && !kerja.libur, 'baris asal berubah');

      data['2026-12-18'] = { libur: true, ket: 'alfa' };
      copyRow('2026-12-18');
      cek(data['2026-12-19'].lembur && !data['2026-12-19'].libur && !data['2026-12-19'].ket, 'lembur membawa status alfa dari asal');
      cek(!data['2026-12-19'].masuk && el('manMsg').textContent.includes('Lengkapi jam'), 'lembur dari libur tidak meminta jam');

      data['2026-12-29'] = { libur: true, ket: 'sakit' };
      copyRow('2026-12-29'); // Rabu tidak diatur: hari biasa
      cek(!data['2026-12-30'].libur && !data['2026-12-30'].lembur && !data['2026-12-30'].ket && data['2026-12-30'].masuk === '06:00', 'hari biasa setelah sakit tidak mengambil data kerja');
      window.confirm = () => { throw new Error('salin tidak boleh meminta konfirmasi'); };
      data['2026-12-29'] = kerja;
      data['2026-12-30'] = { masuk: '08:00', keluar: '09:00' };
      copyRow('2026-12-29');
      cek(data['2026-12-30'].masuk === kerja.masuk, 'salin langsung tidak menimpa tujuan');
      window.confirm = () => true;

      pilih(5, 'lembur');
      data['2026-12-31'] = kerja;
      copyRow('2026-12-31');
      cek(data['2027-01-01'].lembur && viewMonth === '2027-01', 'salin lintas tahun salah');
      pilih(2, 'libur');
      data['2028-02-28'] = kerja;
      copyRow('2028-02-28');
      cek(data['2028-02-29'].libur, 'salin pada tahun kabisat salah');

      for (let hari = 0; hari < 7; hari++) {
        const status = hari % 2 ? 'lembur' : 'libur';
        pilih(hari, status);
        const tanggal = new Date(2026, 2, 1 + hari); // 1 Maret 2026 adalah Minggu
        const target = tanggal.getFullYear() + '-' + String(tanggal.getMonth() + 1).padStart(2, '0') + '-' + String(tanggal.getDate()).padStart(2, '0');
        tanggal.setDate(tanggal.getDate() - 1);
        const sumber = tanggal.getFullYear() + '-' + String(tanggal.getMonth() + 1).padStart(2, '0') + '-' + String(tanggal.getDate()).padStart(2, '0');
        data[sumber] = kerja;
        copyRow(sumber);
        cek(!!data[target][status], 'aturan hari ke-' + hari + ' salah');
      }
      pilih(0, 'libur');
      jadwalLama(1);
      pilih(2, 'libur');
      hapus(3);
      hapus(4);
      pilih(5, 'lembur');
      pilih(6, 'lembur');

      data['2026-12-10'] = kerja;
      save();
      const tersimpan = localStorage.getItem(KEY);
      const tujuanLama = JSON.stringify(data['2026-12-26']);
      const simpanAbsensi = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {
        if (k === KEY) throw new Error('penyimpanan penuh');
        return simpanAbsensi.call(this, k, v);
      };
      copyRow('2026-12-10');
      cek(!data['2026-12-11'] && localStorage.getItem(KEY) === tersimpan, 'gagal simpan meninggalkan salinan baru');
      cek(el('copyMsg').textContent.includes('tidak tersimpan'), 'gagal salin tidak diberitahukan');
      copyRow('2026-12-25');
      Storage.prototype.setItem = simpanAbsensi;
      cek(JSON.stringify(data['2026-12-26']) === tujuanLama && localStorage.getItem(KEY) === tersimpan, 'gagal simpan menimpa tujuan lama');

      sessionStorage.setItem('jadwal-test-reload', '1');
      location.reload();
      return;
    }

    cek(teksJadwal(6).includes('Sabtu · Lembur'), 'jadwal tidak pulih setelah reload');
    cek(teksJadwal(0).includes('Minggu · Libur'), 'libur tidak pulih setelah reload');
    cek(teksJadwal(1).includes('Biasa (pengaturan sebelumnya)'), 'jadwal biasa lama tidak pulih setelah reload');
    cek(data['2026-12-27'].libur && data['2027-01-01'].lembur, 'data salinan tidak tersimpan');
    window.confirm = () => true;

    const simpan = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('penyimpanan penuh'); };
    pilih(0, 'lembur');
    hapus(0);
    Storage.prototype.setItem = simpan;
    cek(jadwalMingguan['0'] === 'libur' && teksJadwal(0).includes('Minggu · Libur'), 'kegagalan simpan mengubah jadwal');
    cek(el('jadwalMsg').textContent.includes('tidak dapat disimpan'), 'kesalahan penyimpanan tidak ditampilkan');

    const buatUrl = URL.createObjectURL, cabutUrl = URL.revokeObjectURL, klik = HTMLAnchorElement.prototype.click;
    let blob;
    URL.createObjectURL = value => { blob = value; return 'blob:test'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
    exportData();
    URL.createObjectURL = buatUrl;
    URL.revokeObjectURL = cabutUrl;
    HTMLAnchorElement.prototype.click = klik;
    const backup = JSON.parse(await blob.text());
    cek(backup.jadwal_mingguan['0'] === 'libur' && backup.jadwal_mingguan['6'] === 'lembur', 'backup tidak menyimpan jadwal');
    cek(backup.perusahaan_bulanan && typeof backup.perusahaan_bulanan === 'object', 'backup tidak menyimpan perusahaan');
    pilih(0, 'lembur');
    await impor(backup);
    cek(el('backupMsg').textContent.includes('berhasil diimport'), 'import backup gagal');
    cek(jadwalMingguan['0'] === 'libur' && teksJadwal(0).includes('Minggu · Libur'), 'jadwal backup tidak dipulihkan');
    cek(JSON.parse(localStorage.getItem(KEY_JADWAL))['0'] === 'libur', 'jadwal import tidak tersimpan');

    await impor({ data: { '2026-09-01': { masuk: '06:00', keluar: '17:00' } } });
    cek(el('backupMsg').textContent.includes('berhasil diimport') && jadwalMingguan['0'] === 'libur', 'backup lama tidak kompatibel');
    await impor({ data: { '2026-09-01': { masuk: '06:00', keluar: '17:00' } }, perusahaan_bulanan: { '2026-09': 'alfalah' } });
    cek(perusahaanBulanan['2026-09'] === 'alfalah' && JSON.parse(localStorage.getItem(KEY_PERUSAHAAN))['2026-09'] === 'alfalah', 'perusahaan backup tidak dipulihkan');
    await impor({ data: { '2026-09-01': { masuk: '06:00', keluar: '17:00' } } });
    cek(perusahaanBulanan['2026-09'] === 'alfalah', 'backup lama menghapus perusahaan');
    await impor({ data: { '2026-10-01': { libur: true } }, perusahaan_bulanan: { '2026-13': 'alfalah' } });
    cek(el('backupMsg').textContent.includes('Gagal import') && perusahaanBulanan['2026-09'] === 'alfalah', 'perusahaan backup tidak valid diterima');
    const sebelum = localStorage.getItem(KEY);
    for (const jadwal of [null, [], { 8: 'libur' }, { 1: 'alfa' }]) {
      await impor({ data: { '2026-10-01': { libur: true } }, jadwal_mingguan: jadwal });
      cek(el('backupMsg').textContent.includes('Gagal import') && localStorage.getItem(KEY) === sebelum, 'jadwal tidak valid mengubah data');
      cek(jadwalMingguan['0'] === 'libur', 'jadwal tidak valid menimpa pengaturan');
    }
    const isiSebelum = JSON.stringify(data), jadwalSebelum = localStorage.getItem(KEY_JADWAL);
    const simpanImpor = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) {
      if (k === KEY_JADWAL) throw new Error('penyimpanan penuh');
      return simpanImpor.call(this, k, v);
    };
    await impor({ data: { '2026-10-01': { libur: true } }, jadwal_mingguan: { 0: 'biasa' } });
    Storage.prototype.setItem = simpanImpor;
    cek(el('backupMsg').textContent.includes('Gagal import'), 'kegagalan simpan jadwal tidak dilaporkan');
    cek(localStorage.getItem(KEY) === sebelum && JSON.stringify(data) === isiSebelum, 'gagal simpan jadwal tidak memulihkan absensi');
    cek(localStorage.getItem(KEY_JADWAL) === jadwalSebelum && jadwalMingguan['0'] === 'libur', 'gagal simpan jadwal mengubah pengaturan');

    window.confirm = () => false;
    el('btnUserBaru').click();
    cek(localStorage.getItem(KEY_JADWAL) !== null, 'batal reset menghapus jadwal');
    window.confirm = () => true;
    el('btnUserBaru').click();
    cek(localStorage.getItem(KEY_JADWAL) === null && Object.keys(jadwalMingguan).length === 0, 'user baru tidak menghapus jadwal');
    cek(localStorage.getItem(KEY_PERUSAHAAN) === null && !Object.keys(perusahaanBulanan).length, 'user baru tidak menghapus perusahaan');
    cek(el('jadwalHari').value === '' && el('jadwalStatus').value === 'lembur' && !el('jadwalKosong').hidden, 'pilihan jadwal tidak direset');
    hasil('pass', 'Jadwal mingguan, salin, backup, dan reset berhasil.');
  } catch (e) {
    hasil('fail', e && e.stack ? e.stack : String(e));
  }
}

(async () => {
  const root = __dirname;
  const base = fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir();
  const profile = fs.mkdtempSync(path.join(base, 'absensi-test-jadwal-'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace('</body>', '<script>(' + testDiBrowser.toString() + ')();</script></body>');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const types = { '.js': 'text/javascript', '.png': 'image/png', '.jpeg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const args = ['--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--virtual-time-budget=10000', '--user-data-dir=' + profile, '--dump-dom', url];
    if (process.getuid && process.getuid() === 0) args.unshift('--no-sandbox');
    const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', args);
    let stdout = '', stderr = '';
    chrome.stdout.on('data', chunk => { stdout += chunk; });
    chrome.stderr.on('data', chunk => { stderr += chunk; });
    const [code] = await once(chrome, 'close');
    assert.strictEqual(code, 0, stderr);
    const result = stdout.match(/<output id="test-result" data-status="(pass|fail)">([\s\S]*?)<\/output>/);
    assert.ok(result, 'Hasil tes browser tidak ditemukan.\n' + stderr);
    assert.strictEqual(result[1], 'pass', result[2]);
    console.log('OK - ' + result[2]);
  } finally {
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
