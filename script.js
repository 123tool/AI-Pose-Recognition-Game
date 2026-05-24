// ====== KONFIGURASI GLOBAL STATE ======
let video;
let canvas;
let ctx;
let net;
let poses = [];
let gameActive = false;
let score = 0;

// Logika Tracking Aksi (Squat State Machine)
let currentStage = "up"; 
const SQUAT_THRESHOLD_DOWN = 110;   // Sudut lutut saat jongkok
const SQUAT_THRESHOLD_UP = 150;     // Sudut lutut saat berdiri

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
        console.log("✅ Kamera berhasil diakses");
    } catch (e) {
        console.error("Kamera Error:", e);
        document.getElementById('action-status').textContent = "Akses Kamera Ditolak/Error";
        document.getElementById('loading-overlay').innerHTML = `
            <p style="color: #ef4444; font-weight: 600;">Gagal mengakses kamera</p>
            <p style="font-size: 0.9rem;">Mohon izinkan akses kamera di pengaturan browser Anda.</p>
        `;
        return;
    }

    // 2. Load Model PoseNet
    try {
        net = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 257, height: 257 },
            multiplier: 0.50   // ✅ Typo diperbaiki (multiplier bukan multipl*ie*r)
        });
        
        // Hilangkan overlay loading, munculkan video (walaupun transparan)
        const overlay = document.getElementById('loading-overlay');
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
        console.log("✅ Model AI siap");
    } catch (e) {
        console.error("AI Model Error:", e);
        document.getElementById('action-status').textContent = "Gagal memuat Model AI";
        document.getElementById('loading-overlay').innerHTML = `
            <p style="color: #ef4444; font-weight: 600;">Gagal memuat model AI</p>
            <p style="font-size: 0.9rem;">Periksa koneksi internet Anda.</p>
        `;
        return;
    }

    // 3. Event Listeners Kontrol Game
    btnStart.addEventListener('click', () => {
        if (!gameActive) {
            gameActive = true;
            btnStart.textContent = "PAUSE";
            btnStart.style.backgroundColor = "#ef4444"; 
            document.getElementById('action-status').textContent = "Mulai Bergerak!";
            document.getElementById('action-status').style.color = "var(--text-main)";
        } else {
            gameActive = false;
            btnStart.textContent = "LANJUTKAN";
            btnStart.style.backgroundColor = "var(--accent-blue)";
            document.getElementById('action-status').textContent = "Game Dipause";
            document.getElementById('action-status').style.color = "var(--text-muted)";
        }
    });

    btnReset.addEventListener('click', () => {
        score = 0;
        currentStage = "up";
        document.getElementById('score-counter').textContent = score;
        document.getElementById('action-status').textContent = "Mencari Pose...";
        document.getElementById('action-status').style.color = "var(--text-muted)";
        document.getElementById('confidence-bar').style.width = "0%";
        document.getElementById('confidence-text').textContent = "Akurasi: 0%";
    });

    // Mulai loop deteksi pose setelah semua siap
    detectPoseLoop();
});

// Fungsi Akses Webcam Mandiri & Fleksibel
async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser tidak mendukung WebRTC / getUserMedia");
    }

    const constraints = {
        video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
        },
        audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    // Tunggu metadata video termuat dan mulai playback
    await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
            video.play().then(resolve).catch(reject);
        };
    });
}

// ====== MAIN LOOP AI DETEKSI ======
async function detectPoseLoop() {
    async function poseDetectionFrame() {
        // Pastikan video sudah siap (memiliki dimensi)
        if (!video.videoWidth || !video.videoHeight) {
            requestAnimationFrame(poseDetectionFrame);
            return;
        }

        // Sinkronisasi ukuran canvas dengan video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log(`📐 Canvas diatur ke ${canvas.width}x${canvas.height}`);
        }

        try {
            // Estimasi pose tunggal (dengan mirror horizontal)
            const pose = await net.estimateSinglePose(video, {
                flipHorizontal: true
            });

            poses = [pose];

            // Bersihkan canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Gambar feed kamera yang sudah di-mirror
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            // Gambar skeleton & keypoints jika confidence cukup
            if (pose.score >= 0.15) {
                drawKeypoints(pose.keypoints, ctx);
                drawSkeleton(pose.keypoints, ctx);
                
                if (gameActive) {
                    checkActionRecognition(pose.keypoints, pose.score);
                } else if (!gameActive) {
                    // Saat tidak aktif, tampilkan status netral
                    document.getElementById('action-status').textContent = "Game Dipause";
                }
            } else {
                document.getElementById('action-status').textContent = "Posisikan Seluruh Tubuh...";
                document.getElementById('action-status').style.color = "var(--text-muted)";
            }
        } catch (err) {
            console.error("Gagal melakukan estimasi frame:", err);
        }

        requestAnimationFrame(poseDetectionFrame);
    }

    poseDetectionFrame();
}

// ====== MATH ALGORITHM: MENGHITUNG SUDUT SENDI ======
function calculateAngle(p1, p2, p3) {
    let radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    
    if (angle > 180.0) {
        angle = 360.0 - angle;
    }
    return angle;
}

// ====== LOGIKA REKOGNISI SQUAT ======
function checkActionRecognition(keypoints, totalScore) {
    const hip = keypoints[11];   // Left Hip
    const knee = keypoints[13];  // Left Knee
    const ankle = keypoints[15]; // Left Ankle

    // Pastikan ketiga titik terdeteksi dengan confidence memadai
    if (hip.score > 0.4 && knee.score > 0.4 && ankle.score > 0.4) {
        const kneeAngle = calculateAngle(hip.position, knee.position, ankle.position);
        
        // Update confidence bar
        const avgConfidence = ((hip.score + knee.score + ankle.score) / 3 * 100).toFixed(0);
        document.getElementById('confidence-bar').style.width = `${avgConfidence}%`;
        document.getElementById('confidence-text').textContent = `Akurasi: ${avgConfidence}%`;

        // State Machine Squat
        if (kneeAngle < SQUAT_THRESHOLD_DOWN && currentStage === "up") {
            currentStage = "down";
            document.getElementById('action-status').textContent = "JONGKOK TERDETEKSI!";
            document.getElementById('action-status').style.color = "#3b82f6";
        }
        
        if (kneeAngle > SQUAT_THRESHOLD_UP && currentStage === "down") {
            currentStage = "up";
            score++;
            
            const scoreDisplay = document.getElementById('score-counter');
            scoreDisplay.textContent = score;
            document.getElementById('action-status').textContent = "SQUAT BERHASIL! +1";
            document.getElementById('action-status').style.color = "var(--accent-neon)";

            // Efek skala pada skor
            scoreDisplay.style.transform = "scale(1.2)";
            setTimeout(() => { scoreDisplay.style.transform = "scale(1)"; }, 200);
        }
    } else {
        document.getElementById('action-status').textContent = "Posisikan Seluruh Tubuh...";
        document.getElementById('action-status').style.color = "var(--text-muted)";
        document.getElementById('confidence-bar').style.width = "0%";
        document.getElementById('confidence-text').textContent = "Akurasi: 0%";
    }
}

// ====== DRAWING UTILITIES ======
function drawKeypoints(keypoints, ctx) {
    keypoints.forEach(keypoint => {
        if (keypoint.score > 0.4) {
            const { y, x } = keypoint.position;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(168, 85, 247, 1)";
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff";
            ctx.fill();
        }
    });
}

function drawSkeleton(keypoints, ctx) {
    const adjacentKeypoints = posenet.getAdjacentKeyPoints(keypoints, 0.4);

    adjacentKeypoints.forEach((keypoints) => {
        ctx.beginPath();
        ctx.moveTo(keypoints[0].position.x, keypoints[0].position.y);
        ctx.lineTo(keypoints[1].position.x, keypoints[1].position.y);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
        ctx.stroke();
    });
        }
