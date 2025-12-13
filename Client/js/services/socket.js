/**
 * SOCKET SERVICE
 * Wrapper cho WebSocket, xử lý kết nối và phân phối gói tin.
 */

// Mảng chứa các hàm callback đăng ký lắng nghe
const listeners = {};

let socket = null;

export const SocketService = {
    
    connect(ip, port, password) {
        return new Promise((resolve, reject) => {
            try {
                socket = new WebSocket(`ws://${ip}:${port}`);
                socket.binaryType = "arraybuffer";

                socket.onopen = () => {
                    // Gửi Auth ngay khi mở
                    this.send("AUTH", password);
                };

                socket.onmessage = (event) => {
                    if (event.data instanceof ArrayBuffer) {
                        dispatch("BINARY_STREAM", event.data);
                    } else {
                        try {
                            const packet = JSON.parse(event.data);
                            // Nếu là gói tin AUTH_RESULT, xử lý promise connect
                            if (packet.type === "AUTH_RESULT") {
                                if (packet.payload === "OK") resolve("Connected");
                                else reject(new Error("Wrong Password"));
                            }
                            // Phân phối gói tin cho các module khác
                            dispatch(packet.type, packet);
                        } catch (e) { console.error(e); }
                    }
                };

                socket.onerror = (e) => reject(new Error("Socket Error"));
                socket.onclose = () => dispatch("DISCONNECT", null);

            } catch (e) {
                reject(e);
            }
        });
    },

    disconnect() {
        if (socket) socket.close();
    },

    // Gửi lệnh đi (Các Feature sẽ gọi hàm này)
    send(command, param = "") {
        if (socket && socket.readyState === WebSocket.OPEN) {
            // Tự động detect nếu là AUTH type hay Command thường
            if (command === "AUTH") {
                socket.send(JSON.stringify({ type: "AUTH", payload: param }));
            } else {
                socket.send(JSON.stringify({ command: command, param: param.toString() }));
            }
        }
    },

    // Cho phép các module đăng ký lắng nghe sự kiện (Observer Pattern)
    // Ví dụ: Webcam.js sẽ gọi: SocketService.on("WEBCAM_FRAME", handleFrame);
    on(type, callback) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(callback);
    },
    
    off(type, callback) {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter(cb => cb !== callback);
    }
};

// Hàm nội bộ để gọi các listener
function dispatch(type, data) {
    if (listeners[type]) {
        listeners[type].forEach(callback => callback(data));
    }
}