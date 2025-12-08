let socket = null;
let objectUrl = null;
let currentViewMode = "apps"; // Mặc định xem Apps
let allInstalledApps = [];    // Danh sách ứng dụng cài đặt

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
        socket.binaryType = "arraybuffer"; // Nhận dữ liệu Stream

        socket.onopen = () => {
            // Gửi gói tin AUTH
            const authPacket = JSON.stringify({ type: "AUTH", payload: pass });
            socket.send(authPacket);
        };

        socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                handleBinaryStream(event.data);
            } else {
                handleJsonData(event.data);
            }
        };

        socket.onclose = () => handleDisconnect();
        socket.onerror = () => { errorLabel.textContent = "Connection Error!"; };
    } catch (e) {
        errorLabel.textContent = "Invalid IP Address!";
    }
}

function handleDisconnect() {
    document.getElementById("main-interface").classList.add("disabled-ui");
    const overlay = document.getElementById("login-overlay");
    overlay.style.display = "flex";
    overlay.style.opacity = "1";
    
    document.getElementById("login-error").textContent = "Disconnected from Server.";
    
    const badge = document.getElementById("connectionBadge");
    badge.className = "status-badge status-offline";
    badge.innerHTML = '<i class="fas fa-circle"></i> Disconnected';

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (socket) socket.close();
}

// --- 2. XỬ LÝ DỮ LIỆU TỪ SERVER (QUAN TRỌNG NHẤT) ---
function handleJsonData(jsonString) {
    try {
        const msg = JSON.parse(jsonString);

        switch (msg.type) {
            // [QUAN TRỌNG] Xử lý Đăng nhập
            case "AUTH_RESULT":
                if (msg.payload === "OK") {
                    // Ẩn màn hình Login
                    const overlay = document.getElementById("login-overlay");
                    overlay.style.opacity = "0";
                    setTimeout(() => {
                        overlay.style.display = "none";
                        document.getElementById("main-interface").classList.remove("disabled-ui");
                    }, 500);

                    // Cập nhật trạng thái
                    const badge = document.getElementById("connectionBadge");
                    badge.className = "status-badge status-online";
                    badge.innerHTML = '<i class="fas fa-circle"></i> Online';
                    
                    logToTerminal("System Connected.", "system");
                    showToast("Connected to Server!", "success");

                    // Tự động lấy danh sách ứng dụng
                    getApps();
                } else {
                    document.getElementById("login-error").textContent = "Wrong Password!";
                    showToast("Login Failed!", "error");
                    socket.close();
                }
                break;

            // Xử lý Ảnh chụp màn hình
            case "SCREEN_CAPTURE":
                c// 1. Lấy dữ liệu ảnh
                const imgSrc = "data:image/jpeg;base64," + msg.payload;

                // 2. Hiển thị vào khung Preview bên phải (Thay vì khung Stream)
                const previewImg = document.getElementById("captured-preview");
                const previewText = document.getElementById("preview-text");
                const saveBadge = document.getElementById("save-badge");

                if (previewImg) {
                    previewImg.src = imgSrc;
                    previewImg.classList.remove("hidden");
                    previewText.style.display = "none"; // Ẩn chữ "Chưa có ảnh"
                    saveBadge.classList.remove("hidden"); // Hiện chữ "Saved"
                    
                    // Hiệu ứng nháy nhẹ để biết ảnh mới
                    previewImg.style.opacity = "0.5";
                    setTimeout(() => previewImg.style.opacity = "1", 300);
                }
                
                // (Tùy chọn) Vẫn hiện thông báo Toast
                if (typeof showToast === "function") showToast("Ảnh đã được lưu và gửi về!", "success");
                break;

            // Xử lý Log & Thông báo
            case "LOG":
                const text = msg.payload;
                const isKeylog = text.includes("[Keylogger]");
                logToTerminal(text, isKeylog ? "keylog" : "info");

                // Hiện thông báo nổi (Toast)
                if (text.includes("Đã diệt") || text.includes("Đã mở") || text.includes("Đang mở")) {
                    showToast(text, "success");
                } else if (text.includes("Lỗi")) {
                    showToast(text, "error");
                }
                break;

            // Xử lý Danh sách App & Process
            case "APP_LIST":
                if (currentViewMode === 'apps') renderProcessTable(msg.payload);
                break;

            case "PROCESS_LIST":
                if (currentViewMode === 'processes') renderProcessTable(msg.payload);
                break;
            
            // [MỚI] Xử lý Danh sách cài đặt (Library)
            case "INSTALLED_LIST":
                allInstalledApps = msg.payload;
                renderAppGrid(allInstalledApps);
                break;
        }
    } catch (e) {
        console.error("JSON Error:", e);
    }
}

function handleBinaryStream(arrayBuffer) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
    objectUrl = URL.createObjectURL(blob);
    const img = document.getElementById("live-screen");
    img.src = objectUrl;
    img.style.display = "block";
    document.getElementById("screen-placeholder").style.display = "none";
    document.getElementById("monitorStatus").innerText = "Live Streaming";
}

// --- 3. GỬI LỆNH (COMMANDS) ---
function sendCmd(command, param = "") {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ command: command, param: param.toString() }));
    }
}

function sendCommand(cmd) { sendCmd(cmd); }
function getProcesses() { 
    currentViewMode = 'processes';
    sendCmd("GET_PROCESS"); 
}
function getApps() { 
    currentViewMode = 'apps';
    sendCmd("GET_APPS"); 
}

function startApp() {
    const input = document.getElementById("quickAppInput");
    const appName = input.value.trim();
    if (appName) {
        sendCmd("START_APP", appName);
        logToTerminal(`Command: Start ${appName}`);
        input.value = ""; 
    } else {
        showToast("Vui lòng nhập tên ứng dụng!", "error");
    }
}

function openWeb(url) {
    sendCmd("START_APP", url);
    logToTerminal(`Command: Open Browser > ${url}`);
    showToast(`Opening ${url}...`, "info");
}

function disconnect() { if (socket) socket.close(); }

// --- 4. APP LIBRARY (TÍNH NĂNG MỚI) ---
function browseApps() {
    document.getElementById("app-library-modal").classList.remove("hidden");
    sendCmd("GET_INSTALLED");
}

function closeAppLibrary() {
    document.getElementById("app-library-modal").classList.add("hidden");
}

function renderAppGrid(appList) {
    const container = document.getElementById("app-grid");
    container.innerHTML = "";
    if (!appList || appList.length === 0) {
        container.innerHTML = '<p class="text-center w-100">No apps found.</p>';
        return;
    }
    appList.forEach(app => {
        const div = document.createElement("div");
        div.className = "app-item-btn";
        div.onclick = () => { 
            sendCmd("START_APP", app.path);
            closeAppLibrary();
            showToast(`Launching ${app.name}...`, "success");
        };
        div.innerHTML = `<i class="fas fa-cube app-item-icon"></i><span class="app-item-name">${app.name}</span>`;
        container.appendChild(div);
    });
}

function filterApps() {
    const keyword = document.getElementById("appSearch").value.toLowerCase();
    const filtered = allInstalledApps.filter(app => app.name.toLowerCase().includes(keyword));
    renderAppGrid(filtered);
}

// --- 5. UI HELPERS ---
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return; // Tránh lỗi nếu chưa thêm div vào HTML
    
    const toast = document.createElement("div");
    toast.className = `toast-msg ${type}`;
    let icon = type === "success" ? "check-circle" : (type === "error" ? "exclamation-circle" : "info-circle");
    let color = type === "success" ? "text-success" : (type === "error" ? "text-danger" : "text-primary");
    
    toast.innerHTML = `<i class="fas fa-${icon} ${color}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.5s ease-out forwards";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function switchTab(tabName, element) {
    document.querySelectorAll(".list-group-item").forEach((el) => el.classList.remove("active"));
    element.classList.add("active");
    document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
    document.getElementById(`tab-${tabName}`).classList.add("active");
    
    const titles = { dashboard: "Overview", monitor: "Screen Monitor", processes: "Task Manager", terminal: "Terminal & Logs" };
    document.getElementById("pageTitle").innerText = titles[tabName];
}

function renderProcessTable(dataList) {
    const tbody = document.querySelector("#procTable tbody");
    tbody.innerHTML = "";
    dataList.forEach((item) => {
        const tr = document.createElement("tr");
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
        const key = text.replace("[Keylogger] ", "");
        const displayKey = key.length > 1 ? ` [${key}] ` : key;
        if (term.lastChild && term.lastChild.classList && term.lastChild.classList.contains("keylog-stream")) {
            term.lastChild.textContent += displayKey;
        } else {
            const div = document.createElement("div");
            div.className = "keylog-stream";
            div.style.color = "#fbbf24";
            div.textContent = `> ${displayKey}`;
            term.appendChild(div);
        }
    } else {
        const div = document.createElement("div");
        div.style.color = type === "system" ? "#3b82f6" : "#10b981";
        div.textContent = `[${new Date().toLocaleTimeString()}] > ${text}`;
        term.appendChild(div);
    }
    term.scrollTop = term.scrollHeight;
}

function viewFullImage(imgElement) {
    const w = window.open("");
    w.document.write(`<img src="${imgElement.src}" style="width:100%">`);
}