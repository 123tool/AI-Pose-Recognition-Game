## ⚡ AI Pose Tracker & Action Recognition Game

Aplikasi berbasis web (*SaaS-ready*) yang memanfaatkan teknologi Kecerdasan Buatan (AI) untuk melakukan estimasi pose manusia (*Human Pose Estimation*) dan pengenalan aksi secara *real-time* langsung melalui *webcam* browser tanpa memerlukan komputasi server pihak ketiga (*100% Client-Side*).

Aplikasi ini mengintegrasikan model pembelajaran mendalam (**PoseNet**) di atas **TensorFlow.js** untuk melacak titik kunci tubuh (sendi), mengukur sudut biomekanika gerakan menggunakan algoritma matematika trigonometri, serta menghitung repetisi olahraga (seperti **Squat**) secara otomatis dan interaktif.

---

## ✨ Fitur Utama

*   **Real-time Human Pose Estimation:** Melacak 17 titik kunci tubuh (mata, telinga, bahu, sikut, pinggul, lutut, pergelangan kaki) secara instan menggunakan arsitektur *MobileNetV1* yang ringan dan responsif.
*   **Mathematical Action Recognition:** Algoritma internal menghitung sudut sendi lutut ($Angle$) secara presisi menggunakan fungsi trigonometri $\text{atan2}$ untuk mendeteksi repetisi gerakan *Squat* secara akurat.
*   **Modern Glassmorphism UI:** Desain antarmuka gelap yang elegan dengan aksen neon, transisi halus, efek *mirroring* video, serta indikator bar akurasi (*confidence score*).
*   **Zero-Server Architecture:** Seluruh pemrosesan model kecerdasan buatan terjadi di sisi klien (komputer/gadget pengguna), menjadikannya sangat aman, hemat *bandwidth*, dan gratis untuk di-host di GitHub Pages.

---

## 🚀 Teknologi yang Digunakan

*   **Frontend HTML5 & CSS3:** Menggunakan struktur semantik modern dan tata letak CSS Grid/Flexbox yang responsif dengan estetika gaya *cyberpunk/fitness dashboard*.
*   **Vanilla JavaScript (ES6+):** Mengatur logika *state machine* game, manajemen kamera, dan pembaruan DOM tanpa dependensi *heavy framework*.
*   **TensorFlow.js & PoseNet:** Pustaka inti pemelajaran mesin berkinerja tinggi untuk memuat dan mengeksekusi model pra-latih di browser dengan akselerasi WebGL.

---

## Catatan Penting untuk Akurasi Maksimal
- ​Pencahayaan : Pastikan ruangan Anda memiliki intensitas cahaya yang cukup agar kamera dapat menangkap detail tubuh dengan jelas.
- ​Jarak Kamera : Posisikan tubuh Anda sekitar 2 - 3 meter mundur dari kamera agar seluruh bagian pinggul, lutut, hingga kaki dapat masuk ke dalam bingkai (frame) deteksi.
- ​Izin Kamera : Berikan izin akses webcam pada browser saat pertama kali membuka aplikasi ini
