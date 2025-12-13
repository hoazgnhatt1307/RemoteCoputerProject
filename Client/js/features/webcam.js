import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';

let webcamZoomLevel = 100;
let webcamFitMode = 'contain';
let isWebcamPanning = false;
let webcamStartX, webcamStartY, webcamScrollLeft, webcamScrollTop;
let isWebcamActive = false; // Track webcam state
let recordingInterval = null;
let remainingSeconds = 0;

export const WebcamFeature = {
    init() {
        SocketService.on('WEBCAM_FRAME', this.handleWebcamFrame.bind(this));
        SocketService.on('VIDEO_FILE', this.handleVideoDownload.bind(this));

        // Setup pan controls
        this.setupWebcamPan();
    },

    /**
     * Toggle Webcam ON/OFF
     */
    toggleWebcam() {
        const btn = document.getElementById("btn-webcam-toggle");
        const btnText = document.getElementById("btn-webcam-text");
        const recordBtn = document.getElementById("btn-webcam-record");

        if (!isWebcamActive) {
            // Turn ON
            console.log('📹 Starting Webcam...');
            SocketService.send('START_WEBCAM');
            isWebcamActive = true;
            
            // Update button appearance
            if (btn) {
                btn.className = "btn btn-danger w-100 mb-2 fw-bold";
            }
            if (btnText) {
                btnText.innerText = "TẮT WEBCAM";
            }
            
            // Enable record button
            if (recordBtn) {
                recordBtn.disabled = false;
            }
            
            UIManager.showToast("Bật Webcam...", "info");
        } else {
            // Turn OFF
            console.log('📹 Stopping Webcam...');
            SocketService.send('STOP_WEBCAM');
            isWebcamActive = false;
            // Stop any ongoing recording countdown
            this.stopRecordingTimer(true);
            
            // Reset interface
            this.resetWebcam();
            
            // Update button appearance
            if (btn) {
                btn.className = "btn btn-success w-100 mb-2 fw-bold";
            }
            if (btnText) {
                btnText.innerText = "BẬT WEBCAM";
            }
            
            // Disable record button
            if (recordBtn) {
                recordBtn.disabled = true;
            }
            
            UIManager.showToast("Tắt Webcam", "info");
        }
    },

    // Reset webcam về trạng thái ban đầu
    resetWebcam() {
        console.log('🔄 Resetting webcam...');
        
        const camImg = document.getElementById("webcam-feed");
        const placeholder = document.getElementById("webcam-placeholder");
        const statusBadge = document.getElementById("cam-status");

        if(camImg) {
            camImg.style.display = "none";
            camImg.style.visibility = "hidden";
            camImg.style.opacity = "0";
            camImg.src = "";
            camImg.removeAttribute('src');
            camImg.className = "";
            console.log('✓ Webcam image reset');
        }
        
        if(placeholder) {
            placeholder.style.removeProperty('display');
            placeholder.style.removeProperty('visibility');
            placeholder.style.removeProperty('opacity');
            placeholder.style.opacity = "1";
            placeholder.style.display = "block";
            placeholder.style.visibility = "visible";
            placeholder.classList.remove('hidden');
            placeholder.removeAttribute('data-shown');
            console.log('✓ Webcam placeholder shown');
        }
        
        if(statusBadge) {
            statusBadge.className = "badge bg-secondary";
            statusBadge.innerText = "OFFLINE";
            console.log('✓ Status badge reset');
        }
        
        webcamZoomLevel = 100;
        webcamFitMode = 'contain';
        this.updateWebcamZoomDisplay();
    },

    handleWebcamFrame(data) {
        const payload = data.payload || data;
        
        if (!payload) {
            console.error('❌ No payload received');
            return;
        }
        
        console.log('✅ Received webcam frame');
        
        const camImg = document.getElementById("webcam-feed");
        const placeholder = document.getElementById("webcam-placeholder");
        const statusBadge = document.getElementById("cam-status");

        console.log('📷 Elements found:', { 
            camImg: !!camImg, 
            placeholder: !!placeholder, 
            statusBadge: !!statusBadge 
        });

        if(camImg) {
            camImg.src = "data:image/jpeg;base64," + payload;
            camImg.style.display = "block";
            camImg.style.visibility = "visible";
            camImg.style.opacity = "1";
            camImg.style.zIndex = "10";
            camImg.removeAttribute('hidden');
            
            console.log('✓ Webcam image displayed');
            
            // Apply zoom and fit
            this.applyWebcamZoom(webcamZoomLevel);
            this.applyWebcamFit(webcamFitMode);
        } else {
            console.error('❌ #webcam-feed element not found!');
        }
        
        if(placeholder) {
            // Complete reset of placeholder
            placeholder.style.removeProperty('display');
            placeholder.style.removeProperty('visibility');
            placeholder.style.removeProperty('opacity');
            placeholder.style.removeProperty('pointer-events');
            
            placeholder.style.display = "none";
            placeholder.style.visibility = "hidden";
            placeholder.style.opacity = "0";
            placeholder.style.pointerEvents = "none";
            
            placeholder.classList.add('hidden');
            placeholder.removeAttribute('data-shown');
            
            console.log('✓ Webcam placeholder hidden');
        } else {
            console.error('❌ #webcam-placeholder element not found!');
        }
        
        if(statusBadge) {
            statusBadge.className = "badge bg-success";
            statusBadge.innerText = "LIVE";
            console.log('✓ Status badge updated');
        }
    },

    /**
     * Start recording webcam
     */
    startRecording() {
        if (!isWebcamActive) {
            UIManager.showToast("Hãy bật Webcam trước!", "error");
            return;
        }

        const durationInput = document.getElementById("record-duration");
        const duration = Math.max(5, Math.min(120, parseInt(durationInput ? durationInput.value : 10, 10) || 10));
        // Disable controls during recording
        const recordBtn = document.getElementById('btn-webcam-record');
        const cancelBtn = document.getElementById('btn-webcam-cancel');
        if (recordBtn) recordBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = false;
        if (durationInput) durationInput.disabled = true;
        this.startRecordingTimer(duration);
        
        SocketService.send('RECORD_WEBCAM', duration);
        UIManager.showToast(`Đang ghi hình ${duration}s...`, "info");
    },

    handleVideoDownload(data) {
        const payload = data.payload || data;
        // Chuyển đổi Base64 sang Binary Blob để tải video
        const binaryString = window.atob(payload);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: "video/avi" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        
        const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
        a.download = `Server_Rec_${time}.avi`;
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        UIManager.showToast("Đã tải video về máy!", "success");
        // Re-enable controls after video is ready
        const durationInput = document.getElementById('record-duration');
        const recordBtn = document.getElementById('btn-webcam-record');
        const cancelBtn = document.getElementById('btn-webcam-cancel');
        if (durationInput) durationInput.disabled = false;
        if (isWebcamActive && recordBtn) recordBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = true;
        this.stopRecordingTimer();
    },

    // NEW: Webcam Zoom
    zoom(action) {
        const img = document.getElementById("webcam-feed");
        if (!img || img.style.display === "none") return;

        if (action === 'in') {
            if (webcamZoomLevel < 200) webcamZoomLevel += 25;
        } else if (action === 'out') {
            if (webcamZoomLevel > 50) webcamZoomLevel -= 25;
        } else if (action === 'reset') {
            webcamZoomLevel = 100;
        }

        this.applyWebcamZoom(webcamZoomLevel);
        this.updateWebcamZoomDisplay();
        UIManager.showToast(`Webcam Zoom: ${webcamZoomLevel}%`, "info");
    },

    applyWebcamZoom(level) {
        const img = document.getElementById("webcam-feed");
        if (!img) return;

        img.className = img.className.replace(/zoom-\d+/g, '').trim();
        img.classList.add(`zoom-${level}`);
    },

    updateWebcamZoomDisplay() {
        const display = document.getElementById("webcam-zoom-level");
        if (display) {
            display.textContent = `${webcamZoomLevel}%`;
        }
    },

    // NEW: Webcam Fit Mode Toggle
    toggleFitMode() {
        const modes = ['contain', 'cover', 'fill'];
        const currentIndex = modes.indexOf(webcamFitMode);
        webcamFitMode = modes[(currentIndex + 1) % modes.length];
        
        this.applyWebcamFit(webcamFitMode);
        
        const btn = document.getElementById("btn-webcam-fit");
        const icons = {
            'contain': 'fa-compress-arrows-alt',
            'cover': 'fa-expand-arrows-alt',
            'fill': 'fa-arrows-alt'
        };
        
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) icon.className = `fas ${icons[webcamFitMode]}`;
        }
        
        UIManager.showToast(`Webcam Fit: ${webcamFitMode}`, "info");
    },

    applyWebcamFit(mode) {
        const img = document.getElementById("webcam-feed");
        if (!img) return;

        img.className = img.className.replace(/fit-(contain|cover|fill)/g, '').trim();
        img.classList.add(`fit-${mode}`);
    },

    // NEW: Webcam Fullscreen
    toggleFullscreen() {
        const container = document.getElementById("webcam-container");
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => {
                container.classList.add('fullscreen');
                
                if (!container.querySelector('.webcam-fullscreen-exit')) {
                    const exitBtn = document.createElement('button');
                    exitBtn.className = 'webcam-fullscreen-exit';
                    exitBtn.innerHTML = '<i class="fas fa-times"></i> Exit (ESC)';
                    exitBtn.onclick = () => this.toggleFullscreen();
                    container.appendChild(exitBtn);
                }
                
                UIManager.showToast("Webcam Fullscreen", "info");
            }).catch(err => {
                UIManager.showToast("Fullscreen failed", "error");
            });
        } else {
            document.exitFullscreen().then(() => {
                container.classList.remove('fullscreen');
                const exitBtn = container.querySelector('.webcam-fullscreen-exit');
                if (exitBtn) exitBtn.remove();
                UIManager.showToast("Exited Fullscreen", "info");
            });
        }
    },

    // NEW: Pan & Drag for Zoomed Webcam
    setupWebcamPan() {
        const container = document.getElementById("webcam-container");
        if (!container) return;

        container.addEventListener('mousedown', (e) => {
            if (webcamZoomLevel > 100) {
                isWebcamPanning = true;
                webcamStartX = e.pageX - container.offsetLeft;
                webcamStartY = e.pageY - container.offsetTop;
                webcamScrollLeft = container.scrollLeft;
                webcamScrollTop = container.scrollTop;
            }
        });

        container.addEventListener('mouseleave', () => {
            isWebcamPanning = false;
        });

        container.addEventListener('mouseup', () => {
            isWebcamPanning = false;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isWebcamPanning) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const y = e.pageY - container.offsetTop;
            const walkX = (x - webcamStartX) * 1.5;
            const walkY = (y - webcamStartY) * 1.5;
            container.scrollLeft = webcamScrollLeft - walkX;
            container.scrollTop = webcamScrollTop - walkY;
        });
    },

    // Recording countdown helpers
    startRecordingTimer(durationSec) {
        const timerEl = document.getElementById('recording-timer-container');
        const countdownEl = document.getElementById('recording-countdown');
        remainingSeconds = durationSec;
        if (timerEl) timerEl.style.display = 'flex';
        if (countdownEl) countdownEl.textContent = `${remainingSeconds}s`;

        if (recordingInterval) clearInterval(recordingInterval);
        recordingInterval = setInterval(() => {
            remainingSeconds -= 1;
            // Play beep at last 3 seconds
            if (remainingSeconds <= 3 && remainingSeconds > 0) {
                this.playCountdownBeep();
            }
            if (countdownEl) countdownEl.textContent = `${Math.max(0, remainingSeconds)}s`;
            if (remainingSeconds <= 0) {
                this.stopRecordingTimer();
            }
        }, 1000);
    },

    stopRecordingTimer(forceHide = false) {
        if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
        }
        const timerEl = document.getElementById('recording-timer-container');
        if (timerEl) timerEl.style.display = 'none';
        remainingSeconds = 0;

        // Re-enable controls unless forceHide (called by webcam off)
        const durationInput = document.getElementById('record-duration');
        const recordBtn = document.getElementById('btn-webcam-record');
        const cancelBtn = document.getElementById('btn-webcam-cancel');
        if (durationInput) durationInput.disabled = false;
        if (!forceHide && isWebcamActive && recordBtn) recordBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = true;
    },

    // Cancel recording early
    cancelRecording() {
        this.stopRecordingTimer();
        // Attempt to notify server to cancel if supported
        SocketService.send('CANCEL_RECORD');
        UIManager.showToast('Đã hủy ghi hình', 'info');
    },

    // Simple beep using Web Audio API
    playCountdownBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(880, ctx.currentTime);
            g.gain.setValueAtTime(0.001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.16);
        } catch (e) {
            // Fail silently
        }
    }
};