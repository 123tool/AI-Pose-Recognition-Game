// ====== KONFIGURASI GLOBAL STATE ======
let video;
let canvas;
let ctx;
let net;
let poses = [];
let gameActive = false;
let score = 0;

// Logika Tracking Aksi (Squat State Machine)
let currentStage = "up"; // Keadaan tubuh: 'up' (berdiri) atau 'down' (jongkok)
const SQUAT_THRESHOLD_DOWN = 110; // Sudut lutut di bawah nilai ini dianggap jongkok
const SQUAT_THRESHOLD_UP = 150;   // Sudut lutut di atas nilai ini dianggap kembali berdiri

// ====== INITIALIZATION ======
window.addEventListener('DOMContentLoaded', async () => {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    const btnStart = document.getElementById('btn-start');
    const btnReset = document.getElementById('btn-reset');

    // 1. Setup Kamera Web
    try {
        await setupCamera();
    } catch (e) {
        alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
        console.error(e);
        return;
    }

    // 2. Load Model PoseNet
    try {
        // Menggunakan arsitektur MobileNetV1 untuk performa real-time yang optimal di browser/HP
        net = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 640, height: 480 },
            multiplier: 0.75
        });
        // Sembunyikan overlay loading jika model berhasil dimuat
        document.getElementById('loading-overlay').style.opacity = 0;
        setTimeout(() => {
            document.getElementById('loading-overlay').style.display = 'none';
        }, 500);
    } catch (e) {
        alert("Gagal memuat model PoseNet AI.");
        console.error(e);
        return;
    }

    // 3. Event Listeners Kontrol Game
    btnStart.addEventListener('click', () => {
        if (!gameActive) {
            gameActive = true;
            btnStart.textContent = "PAUSE";
            btnStart.style.backgroundColor = "#ef4444"; // Ubah jadi warna merah saat bermain
            document.getElementById('action-status').textContent = "Mulai Bergerak!";
        } else {
            gameActive = false;
            btnStart.textContent = "LANJUTKAN";
            btnStart.style.backgroundColor = "var(--accent-blue)";
            document.getElementById('action-status').textContent = "Game Dipause";
        }
    });

    btnReset.addEventListener('click', () => {
        score = 0;
        currentStage = "up";
        document.getElementById('score-counter').textContent = score;
        document.getElementById('action-status').textContent = "Mencari Pose...";
        document.getElementById('confidence-bar').style.width = "0%";
        document.getElementById('confidence-text').textContent = "Akurasi: 0%";
    });

    // Run Loop Estimasi Pose
    detectPoseLoop();
});

// Fungsi untuk Akses Webcam
async function setupCamera() {
    video.width = 640;
    video.height = 480;

    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            width: 640,
            height: 480,
            facingMode: "user"
        },
        audio: false
    });
    video.srcObject = stream;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            video.play();
            resolve(video);
        };
    });
}

// ====== MAIN LOOP AI DETEKSI ======
async function detectPoseLoop() {
    // Sesuaikan ukuran resolusi canvas dengan input video stream
    canvas.width = video.width;
    canvas.height = video.height;

    async function poseDetectionFrame() {
        // Melakukan estimasi pose tunggal (single-pose) untuk optimasi kecepatan frame (FPS)
        const pose = await net.estimateSinglePose(video, {
            flipHorizontal: true
        });

        poses = [pose];

        // Bersihkan dan Gambar Ulang Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Render Feed Kamera di Canvas (Efek Mirror)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Gambar Titik Kunci dan Garis Kerangka jika akurasi deteksi mencukupi
        if (pose.score >= 0.2) {
            drawKeypoints(pose.keypoints, ctx);
            drawSkeleton(pose.keypoints, ctx);
            
            // Jalankan algoritma pengenalan aksi jika game sedang aktif
            if (gameActive) {
                checkActionRecognition(pose.keypoints, pose.score);
            }
        }

        requestAnimationFrame(poseDetectionFrame);
    }

    poseDetectionFrame();
}

// ====== MATH ALGORITHM: MENGHITUNG SUDUT SENDI ======
// Menggunakan trigonometri (Atan2) untuk mencari sudut di antara 3 titik kunci (misal: Pinggul -> Lutut -> Pergelangan Kaki)
function calculateAngle(p1, p2, p3) {
    let radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    
    if (angle > 180.0) {
        angle = 360.0 - angle;
    }
    return angle;
}

// ====== LOGIKA REKOGNISI AKSI (SQUAT ENGINE) ======
function checkActionRecognition(keypoints, totalScore) {
    // Ambil koordinat sendi yang dibutuhkan untuk mendeteksi Squat sebelah kiri atau kanan
    const hip = keypoints[11];   // Left Hip
    const knee = keypoints[13];  // Left Knee
    const ankle = keypoints[15]; // Left Ankle

    // Pastikan akurasi deteksi untuk ketiga sendi utama di atas bernilai tinggi
    if (hip.score > 0.5 && knee.score > 0.5 && ankle.score > 0.5) {
        
        // Hitung sudut sendi lutut
        const kneeAngle = calculateAngle(hip.position, knee.position, ankle.position);
        
        // Update Status Bar Akurasi Akumulatif di UI
        const avgConfidence = ((hip.score + knee.score + knee.score) / 3 * 100).toFixed(0);
        document.getElementById('confidence-bar').style.width = `${avgConfidence}%`;
        document.getElementById('confidence-text').textContent = `Akurasi: ${avgConfidence}%`;

        // Deteksi State Squat: Dari Berdiri (Up) -> Turun Jongkok (Down) -> Kembali Berdiri (Up = +1 Skor)
        if (kneeAngle < SQUAT_THRESHOLD_DOWN && currentStage === "up") {
            currentStage = "down";
            document.getElementById('action-status').textContent = "JONGKOK TERDETEKSI!";
            document.getElementById('action-status').style.color = "#3b82f6"; // Berubah warna Biru
        }
        
        if (kneeAngle > SQUAT_THRESHOLD_UP && currentStage === "down") {
            currentStage = "up";
            score++;
            
            // Update UI Score & Trigger Animasi Efek
            const scoreDisplay = document.getElementById('score-counter');
            scoreDisplay.textContent = score;
            document.getElementById('action-status').textContent = "SQUAT BERHASIL! +1";
            document.getElementById('action-status').style.color = "var(--accent-neon)"; // Neon Hijau

            // Efek Flash Animasi Ringkas pada Skor
            scoreDisplay.style.transform = "scale(1.2)";
            setTimeout(() => { scoreDisplay.style.transform = "scale(1)"; }, 200);
        }
    } else {
        document.getElementById('action-status').textContent = "Posisikan Seluruh Tubuh...";
        document.getElementById('action-status').style.color = "var(--text-muted)";
    }
}

// ====== DRAWING UTILITIES (CANVAS RENDERING) ======
function drawKeypoints(keypoints, ctx) {
    keypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            const { y, x } = keypoint.position;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(168, 85, 247, 1)"; // Titik Ungu Glow
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff"; // Inti Putih
            ctx.fill();
        }
    });
}

function drawSkeleton(keypoints, ctx) {
    const adjacentKeypoints = posenet.getAdjacentKeyPoints(keypoints, 0.5);

    adjacentKeypoints.forEach((keypoints) => {
        ctx.beginPath();
        ctx.moveTo(keypoints[0].position.x, keypoints[0].position.y);
        ctx.lineTo(keypoints[1].position.x, keypoints[1].position.y);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.8)"; // Garis Neon Emerald Green
        ctx.stroke();
    });
}
