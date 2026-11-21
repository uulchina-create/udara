const daftarKota = [
  { nama: "Medan", lat: 3.5952, lon: 98.6722 },
  { nama: "Jakarta", lat: -6.2088, lon: 106.8456 },
  { nama: "Pekanbaru", lat: 0.5071, lon: 101.4478 },
  { nama: "Bandung", lat: -6.9175, lon: 107.6191 },
  { nama: "Surabaya", lat: -7.2575, lon: 112.7521 },
  { nama: "Palembang", lat: -2.9761, lon: 104.7754 },
  { nama: "Makassar", lat: -5.1477, lon: 119.4327 },
  { nama: "Manado", lat: 1.4748, lon: 124.8421 },
  { nama: "Bitung", lat: 1.4451, lon: 125.1825 },
  { nama: "Semarang", lat: -6.9667, lon: 110.4167 },
  { nama: "Yogyakarta", lat: -7.7956, lon: 110.3695 },
  { nama: "Denpasar", lat: -8.6705, lon: 115.2126 },
  { nama: "Balikpapan", lat: -1.2379, lon: 116.8529 },
  { nama: "Pontianak", lat: -0.0263, lon: 109.3425 },
  { nama: "Banjarmasin", lat: -3.3194, lon: 114.5908 },
  { nama: "Padang", lat: -0.9471, lon: 100.4172 },
  { nama: "Jayapura", lat: -2.5916, lon: 140.6690 },
  { nama: "Sibolga", lat: 1.7425, lon: 98.7792 }
];


const pilihKota = document.getElementById("kota");
const status = document.getElementById("status");

daftarKota.forEach((k, i) => {
  pilihKota.innerHTML += `<option value="${i}">${k.nama}</option>`;
});

// ===== 2. Ambil data dari API (Fetch + Async/Await + JSON) =====
async function ambilData(kota) {
  const url =
    "https://air-quality-api.open-meteo.com/v1/air-quality" +
    `?latitude=${kota.lat}&longitude=${kota.lon}` +
    "&hourly=pm2_5&forecast_days=5&timezone=auto";
  const respons = await fetch(url);
  if (!respons.ok) throw new Error("Server API tidak merespons.");
  return await respons.json();
}

// ===== 3. Olah data: rata-rata PM2.5 per hari (looping) =====
function rataRataHarian(data) {
  const waktu = data.hourly.time;
  const pm25 = data.hourly.pm2_5;
  const perHari = {};

  for (let i = 0; i < waktu.length; i++) {
    if (pm25[i] === null) continue;
    const tanggal = waktu[i].slice(0, 10);
    if (!perHari[tanggal]) perHari[tanggal] = [];
    perHari[tanggal].push(pm25[i]);
  }

  return Object.keys(perHari).map((tanggal) => {
    const nilai = perHari[tanggal];
    const total = nilai.reduce((a, b) => a + b, 0);
    return { tanggal, pm25: total / nilai.length };
  });
}

// ===== 4. Prediksi =====
function movingAverage(nilai, n = 3) {
  const terakhir = nilai.slice(-n);
  return terakhir.reduce((a, b) => a + b, 0) / terakhir.length;
}

function analisisTren(nilai) {
  const selisih = nilai[nilai.length - 1] - nilai[0];
  if (selisih > 3) return "Tren naik: kualitas udara cenderung memburuk.";
  if (selisih < -3) return "Tren turun: kualitas udara cenderung membaik.";
  return "Tren stabil: kualitas udara cenderung tetap.";
}

// ===== 5. Kategori (IF ELSE), ambang PM2.5 mengacu pada ISPU =====
function tentukanKategori(pm25) {
  if (pm25 <= 15.5) return { teks: "Baik", warna: "var(--baik)" };
  else if (pm25 <= 55.4) return { teks: "Sedang", warna: "var(--sedang)" };
  else if (pm25 <= 150.4) return { teks: "Tidak Sehat", warna: "var(--tidak-sehat)" };
  else if (pm25 <= 250.4) return { teks: "Sangat Tidak Sehat", warna: "var(--sangat)" };
  else return { teks: "Berbahaya", warna: "var(--berbahaya)" };
}

// ===== 5b. Grafik (Chart.js) =====
let grafikChart = null;

// Ubah "var(--baik)" menjadi nilai warna asli dari CSS
function warnaCSS(v) {
  const nama = v.startsWith("var(") ? v.slice(4, -1) : v;
  return getComputedStyle(document.documentElement).getPropertyValue(nama).trim() || v;
}

function gambarGrafik(harian) {
  if (typeof Chart === "undefined") return; // Chart.js belum termuat (offline)

  const label = harian.map((h) => h.tanggal.slice(5)); // MM-DD
  const nilai = harian.map((h) => Number(h.pm25.toFixed(1)));
  const warna = harian.map((h) => warnaCSS(tentukanKategori(h.pm25).warna));
  const teks = warnaCSS("--teks");
  const garis = warnaCSS("--garis");

  // Moving Average 3 hari untuk setiap titik
  const ma = nilai.map((_, i) => {
    const s = nilai.slice(Math.max(0, i - 2), i + 1);
    return Number((s.reduce((a, b) => a + b, 0) / s.length).toFixed(1));
  });

  if (grafikChart) grafikChart.destroy();

  grafikChart = new Chart(document.getElementById("grafik"), {
    data: {
      labels: label,
      datasets: [
        {
          type: "bar",
          label: "PM2.5 harian",
          data: nilai,
          backgroundColor: warna,
          borderRadius: 6,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { labels: { color: teks } },
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${c.parsed.y} µg/m³`,
            afterLabel: (c) =>
              c.datasetIndex === 0 ? "Kategori: " + tentukanKategori(c.parsed.y).teks : "",
          },
        },
      },
      scales: {
        x: { ticks: { color: teks }, grid: { display: false } },
        y: {
          beginAtZero: true,
          title: { display: true, text: "µg/m³", color: teks },
          ticks: { color: teks },
          grid: { color: garis },
        },
      },
    },
  });
}

const saranKesehatan = {
  "Baik": {
    anak: "Aman bermain dan berolahraga di luar ruangan.",
    dewasa: "Aktivitas dan olahraga di luar ruangan aman dilakukan.",
    lansia: "Aman beraktivitas di luar. Tetap minum air yang cukup.",
  },
  "Sedang": {
    anak: "Boleh bermain di luar. Jika batuk atau sesak, istirahat di dalam ruangan.",
    dewasa: "Aktivitas normal. Yang sensitif (asma, alergi) kurangi aktivitas berat yang lama di luar.",
    lansia: "Batasi aktivitas berat yang lama di luar. Bawa obat pribadi jika punya penyakit jantung atau paru.",
  },
  "Tidak Sehat": {
    anak: "Kurangi bermain di luar. Pakai masker N95/KN95 saat harus keluar dan perbanyak waktu di dalam ruangan.",
    dewasa: "Hindari olahraga berat di luar. Pakai masker N95/KN95 jika harus keluar rumah.",
    lansia: "Sebaiknya tetap di dalam ruangan dengan jendela tertutup. Hubungi dokter jika sesak atau batuk memburuk.",
  },
  "Sangat Tidak Sehat": {
    anak: "Tetap di dalam ruangan dan hindari aktivitas luar ruangan.",
    dewasa: "Hindari aktivitas luar ruangan. Gunakan masker N95/KN95 dan penjernih udara jika ada.",
    lansia: "Tetap di dalam ruangan dan siapkan obat rutin. Segera ke fasilitas kesehatan jika sesak atau nyeri dada.",
  },
  "Berbahaya": {
    anak: "Tetap di dalam ruangan dengan jendela dan ventilasi tertutup. Segera periksa jika ada gejala.",
    dewasa: "Jangan beraktivitas di luar. Ikuti arahan pemerintah daerah dan segera ke fasilitas kesehatan jika ada gejala.",
    lansia: "Tetap di dalam ruangan dan minta pendampingan keluarga. Segera ke fasilitas kesehatan jika ada gejala.",
  },
};

function tampilkanSaran(kota, kat) {
  const s = saranKesehatan[kat.teks];
  const kelompok = [["Anak-anak", "anak"], ["Dewasa", "dewasa"], ["Lansia", "lansia"]];

  document.getElementById("judulSaran").textContent =
    `Saran kesehatan untuk ${kota.nama} (${kat.teks})`;
  document.getElementById("saran").innerHTML = kelompok
    .map(([nama, kunci]) =>
      `<div class="saran-kartu" style="--warna:${kat.warna}">
         <h3>${nama}</h3><p>${s[kunci]}</p></div>`)
    .join("");
}


function tampilkanHasil(harian, kota) {
  const nilai = harian.map((h) => h.pm25);
  const prediksi = movingAverage(nilai, 3);
  const kat = tentukanKategori(prediksi);

  document.getElementById("prediksi").textContent = prediksi.toFixed(1);
  const badge = document.getElementById("kategori");
  badge.textContent = kat.teks;
  badge.style.setProperty("--warna", kat.warna);
  document.getElementById("kartuUtama").style.setProperty("--warna", kat.warna);
  document.getElementById("tren").textContent = analisisTren(nilai);

  const tabel = document.getElementById("tabel");
  tabel.innerHTML = "";
  harian.forEach((h) => {
    const k = tentukanKategori(h.pm25);
    tabel.innerHTML += `<tr style="--warna:${k.warna}">
      <td>${h.tanggal}</td><td>${h.pm25.toFixed(1)}</td>
      <td><span class="titik"></span>${k.teks}</td></tr>`;
  });

  gambarGrafik(harian);
  tampilkanSaran(kota, kat);

  document.getElementById("hasil").hidden = false;
}

document.getElementById("tombol").addEventListener("click", async () => {
  const kota = daftarKota[pilihKota.value];
  status.className = "";
  status.textContent = `Mengambil data ${kota.nama}...`;
  try {
    const data = await ambilData(kota);
    const harian = rataRataHarian(data);
    tampilkanHasil(harian, kota);
    status.textContent = `Data untuk ${kota.nama} berhasil dimuat.`;
  } catch (err) {
    status.className = "error";
    status.textContent =
      "Gagal mengambil data. Periksa koneksi internet lalu coba lagi.";
    console.error(err);
  }
});