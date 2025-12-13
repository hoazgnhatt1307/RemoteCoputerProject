// let socket = null;
// let objectUrl = null;
// let currentViewMode = "apps"; // Mặc định xem Apps
// let allInstalledApps = []; // Danh sách ứng dụng cài đặt

// // --- 1. KẾT NỐI SERVER ---
// function initiateConnection() {
//   const ip = document.getElementById("server-ip").value.trim();
//   const port = document.getElementById("server-port").value.trim();
//   const pass = document.getElementById("auth-pass").value.trim();
//   const errorLabel = document.getElementById("login-error");

//   if (!ip || !port) {
//     errorLabel.textContent = "Please enter IP and Port!";
//     return;
//   }

//   errorLabel.textContent = "Connecting...";

//   try {
//     socket = new WebSocket(`ws://${ip}:${port}`);
//     socket.binaryType = "arraybuffer"; // Nhận dữ liệu Stream

//     socket.onopen = () => {
//       // Gửi gói tin AUTH
//       const authPacket = JSON.stringify({ type: "AUTH", payload: pass });
//       socket.send(authPacket);
//     };

//     socket.onmessage = (event) => {
//         if (event.data instanceof ArrayBuffer) {
//             // --- XỬ LÝ BINARY MỚI ---
//             handleBinaryStream(event.data);
//         } else {
//             handleJsonData(event.data);
//         }
//     };

//     socket.onclose = () => handleDisconnect();
//     socket.onerror = () => {
//       errorLabel.textContent = "Connection Error!";
//     };
//   } catch (e) {
//     errorLabel.textContent = "Invalid IP Address!";
//   }
// }

// function handleDisconnect() {
//   document.getElementById("main-interface").classList.add("disabled-ui");
//   const overlay = document.getElementById("login-overlay");
//   overlay.style.display = "flex";
//   overlay.style.opacity = "1";

//   document.getElementById("login-error").textContent =
//     "Disconnected from Server.";

//   const badge = document.getElementById("connectionBadge");
//   badge.className = "status-badge status-offline";
//   badge.innerHTML = '<i class="fas fa-circle"></i> Disconnected';

//   if (objectUrl) URL.revokeObjectURL(objectUrl);
//   if (socket) socket.close();
// }

// // --- 2. XỬ LÝ DỮ LIỆU TỪ SERVER (QUAN TRỌNG NHẤT) ---
// function handleJsonData(jsonString) {
//   try {
//     const msg = JSON.parse(jsonString);

//     switch (msg.type) {
//       // [QUAN TRỌNG] Xử lý Đăng nhập
//       case "AUTH_RESULT":
//         if (msg.payload === "OK") {
//           // Ẩn màn hình Login
//           const overlay = document.getElementById("login-overlay");
//           overlay.style.opacity = "0";
//           setTimeout(() => {
//             overlay.style.display = "none";
//             document
//               .getElementById("main-interface")
//               .classList.remove("disabled-ui");
//           }, 500);

//           // Cập nhật trạng thái
//           const badge = document.getElementById("connectionBadge");
//           badge.className = "status-badge status-online";
//           badge.innerHTML = '<i class="fas fa-circle"></i> Online';

//           logToTerminal("System Connected.", "system");
//           showToast("Connected to Server!", "success");

//           // Tự động lấy danh sách ứng dụng
//           getApps();
//         } else {
//           document.getElementById("login-error").textContent =
//             "Wrong Password!";
//           showToast("Login Failed!", "error");
//           socket.close();
//         }
//         break;

//       // Xử lý Ảnh chụp màn hình
//       case "SCREENSHOT_FILE":
//         downloadImageFromBase64(msg.payload);
//         showToast("Ảnh đã được lưu về máy!", "success");
//         break;

//       case "SCREEN_CAPTURE":
//         const imgSrc = "data:image/jpeg;base64," + msg.payload;
//         const previewImg = document.getElementById("captured-preview");
//         if (previewImg) {
//           previewImg.src = imgSrc;
//           previewImg.classList.remove("hidden");
//           document.getElementById("preview-text").style.display = "none";
//           document.getElementById("save-badge").classList.remove("hidden");
//         }
//         break;

//       // Xử lý Log & Thông báo
//       case "LOG":
//         const text = msg.payload;
//         if (text.startsWith("[Keylogger]")) {
//           // Nếu là tin Keylogger -> Xử lý riêng
//           handleKeylogData(text.replace("[Keylogger] ", ""));
//         } else {
//           // Nếu là tin hệ thống -> Ghi vào log bên trái
//           logToTerminal(text, "info");

//           // Hiện Toast
//           if (text.includes("Đã diệt") || text.includes("Đã mở")) {
//             showToast(text, "success");
//           } else if (text.includes("Lỗi")) {
//             showToast(text, "error");
//           }
//         }
//         break;

//       // Xử lý Danh sách App & Process
//       case "APP_LIST":
//         if (currentViewMode === "apps") renderProcessTable(msg.payload);
//         break;

//       case "PROCESS_LIST":
//         if (currentViewMode === "processes") renderProcessTable(msg.payload);
//         break;

//       // [MỚI] Xử lý Danh sách cài đặt (Library)
//       case "INSTALLED_LIST":
//         allInstalledApps = msg.payload;
//         renderAppGrid(allInstalledApps);
//         break;

//       case "VIDEO_FILE":
//         downloadVideoFromBase64(msg.payload);
//         showToast("Đã nhận được video từ Server!", "success");
//         break;

//       case "FILE_LIST":
//             renderFileManager(msg.payload);
//             break;

//         case "FILE_DOWNLOAD_DATA":
//             // payload bây giờ là object { fileName, data }
//             const fileInfo = msg.payload;
//             downloadFileFromBase64(fileInfo.fileName, fileInfo.data);
//             break;
//             }
//           } catch (e) {
//             console.error("JSON Error:", e);
//           }
// }

// function handleBinaryStream(arrayBuffer) {
//     // 1. Tạo DataView để đọc byte đầu tiên (Header)
//     const view = new DataView(arrayBuffer);
//     const header = view.getUint8(0); 

//     // 2. Cắt bỏ byte đầu tiên, chỉ lấy phần dữ liệu ảnh
//     const blobData = arrayBuffer.slice(1);
    
//     // 3. Tạo Blob ảnh
//     const blob = new Blob([blobData], { type: "image/jpeg" });
//     const url = URL.createObjectURL(blob);

//     // 4. Kiểm tra Header để hiển thị đúng chỗ
//     if (header === 0x01) { 
//         // Header 0x01 = SCREEN
//         renderScreenFrame(url);
//     } 
//     else if (header === 0x02) { 
//         // Header 0x02 = WEBCAM
//         renderWebcamFrame(url);
//     }
// }

// // --- 3. GỬI LỆNH (COMMANDS) ---
// function sendCmd(command, param = "") {
//   if (socket && socket.readyState === WebSocket.OPEN) {
//     socket.send(JSON.stringify({ command: command, param: param.toString() }));
//   }
// }

// function sendCommand(cmd) {
//   sendCmd(cmd);
// }
// function getProcesses() {
//   currentViewMode = "processes";
//   sendCmd("GET_PROCESS");
// }
// function getApps() {
//   currentViewMode = "apps";
//   sendCmd("GET_APPS");
// }

// function startApp() {
//   const input = document.getElementById("quickAppInput");
//   const appName = input.value.trim();
//   if (appName) {
//     sendCmd("START_APP", appName);
//     logToTerminal(`Command: Start ${appName}`);
//     input.value = "";
//   } else {
//     showToast("Vui lòng nhập tên ứng dụng!", "error");
//   }
// }

// function openWeb(url) {
//   sendCmd("START_APP", url);
//   logToTerminal(`Command: Open Browser > ${url}`);
//   showToast(`Opening ${url}...`, "info");
// }

// function disconnect() {
//   if (socket) socket.close();
// }

// // --- 4. APP LIBRARY (TÍNH NĂNG MỚI) ---
// function browseApps() {
//   document.getElementById("app-library-modal").classList.remove("hidden");
//   sendCmd("GET_INSTALLED");
// }

// function closeAppLibrary() {
//   document.getElementById("app-library-modal").classList.add("hidden");
// }

// function renderAppGrid(appList) {
//   const container = document.getElementById("app-grid");
//   container.innerHTML = "";
//   if (!appList || appList.length === 0) {
//     container.innerHTML = '<p class="text-center w-100">No apps found.</p>';
//     return;
//   }
//   appList.forEach((app) => {
//     const div = document.createElement("div");
//     div.className = "app-item-btn";
//     div.onclick = () => {
//       sendCmd("START_APP", app.path);
//       closeAppLibrary();
//       showToast(`Launching ${app.name}...`, "success");
//     };
//     div.innerHTML = `<i class="fas fa-cube app-item-icon"></i><span class="app-item-name">${app.name}</span>`;
//     container.appendChild(div);
//   });
// }

// function filterApps() {
//   const keyword = document.getElementById("appSearch").value.toLowerCase();
//   const filtered = allInstalledApps.filter((app) =>
//     app.name.toLowerCase().includes(keyword)
//   );
//   renderAppGrid(filtered);
// }

// // --- 5. UI HELPERS ---
// function showToast(message, type = "info") {
//   const container = document.getElementById("toast-container");
//   if (!container) return; // Tránh lỗi nếu chưa thêm div vào HTML

//   const toast = document.createElement("div");
//   toast.className = `toast-msg ${type}`;
//   let icon =
//     type === "success"
//       ? "check-circle"
//       : type === "error"
//       ? "exclamation-circle"
//       : "info-circle";
//   let color =
//     type === "success"
//       ? "text-success"
//       : type === "error"
//       ? "text-danger"
//       : "text-primary";

//   toast.innerHTML = `<i class="fas fa-${icon} ${color}"></i> <span>${message}</span>`;
//   container.appendChild(toast);

//   setTimeout(() => {
//     toast.style.animation = "fadeOut 0.5s ease-out forwards";
//     setTimeout(() => toast.remove(), 500);
//   }, 3000);
// }

// function switchTab(tabName, element) {
//   document
//     .querySelectorAll(".list-group-item")
//     .forEach((el) => el.classList.remove("active"));
//   element.classList.add("active");
//   document
//     .querySelectorAll(".tab-content")
//     .forEach((el) => el.classList.remove("active"));
//   document.getElementById(`tab-${tabName}`).classList.add("active");

//   const titles = {
//     dashboard: "Overview",
//     monitor: "Screen Monitor",
//     processes: "Task Manager",
//     terminal: "Terminal & Logs",
//   };
//   document.getElementById("pageTitle").innerText = titles[tabName];
// }

// function renderProcessTable(dataList) {
//   const tbody = document.querySelector("#procTable tbody");
//   tbody.innerHTML = "";
//   dataList.forEach((item) => {
//     const tr = document.createElement("tr");
//     const displayName = item.title || item.name;
//     tr.innerHTML = `
//             <td><span class="badge bg-secondary">${item.id}</span></td>
//             <td class="fw-bold">${displayName}</td>
//             <td>${item.memory || "N/A"}</td>
//             <td>
//                 <button class="btn btn-danger btn-sm" onclick="if(confirm('Kill ID ${
//                   item.id
//                 }?')) sendCmd('KILL', '${item.id}')">
//                     <i class="fas fa-trash"></i> Kill
//                 </button>
//             </td>
//         `;
//     tbody.appendChild(tr);
//   });
// }

// function logToTerminal(text, type = "info") {
//   const term = document.getElementById("terminal-output");
//   if (type === "keylog") {
//     const key = text.replace("[Keylogger] ", "");
//     const displayKey = key.length > 1 ? ` [${key}] ` : key;
//     if (
//       term.lastChild &&
//       term.lastChild.classList &&
//       term.lastChild.classList.contains("keylog-stream")
//     ) {
//       term.lastChild.textContent += displayKey;
//     } else {
//       const div = document.createElement("div");
//       div.className = "keylog-stream";
//       div.style.color = "#fbbf24";
//       div.textContent = `> ${displayKey}`;
//       term.appendChild(div);
//     }
//   } else {
//     const div = document.createElement("div");
//     div.style.color = type === "system" ? "#3b82f6" : "#10b981";
//     div.textContent = `[${new Date().toLocaleTimeString()}] > ${text}`;
//     term.appendChild(div);
//   }
//   term.scrollTop = term.scrollHeight;
// }

// function viewFullImage(imgElement) {
//   const w = window.open("");
//   w.document.write(`<img src="${imgElement.src}" style="width:100%">`);
// }

// // Thay thế hoặc thêm mới hàm này vào script.js
// function handleKeylogData(dataString) {
//   // dataString có dạng: "LShiftKey|||" hoặc "A|||a" hoặc "Return|||<ENTER>"
//   const parts = dataString.split("|||");
//   const rawKey = parts[0]; // Ví dụ: LShiftKey
//   const translatedChar = parts[1]; // Ví dụ: "" hoặc "a" hoặc "<ENTER>"

//   // 1. Xử lý Ô Phím Thô (Raw Keys)
//   const rawContainer = document.getElementById("raw-key-output");
//   const span = document.createElement("span");
//   span.className = "key-badge";
//   span.innerText = rawKey;

//   // Tô màu cho đẹp
//   if (["Enter", "Back", "Delete", "Escape"].includes(rawKey))
//     span.classList.add("special");
//   if (
//     rawKey.includes("Shift") ||
//     rawKey.includes("Control") ||
//     rawKey.includes("Alt")
//   )
//     span.classList.add("mod");

//   rawContainer.appendChild(span);
//   rawContainer.scrollTop = rawContainer.scrollHeight; // Auto scroll

//   // 2. Xử lý Ô Văn Bản (Word Editor) - Chỉ xử lý nếu có translatedChar
//   if (translatedChar) {
//     const editor = document.getElementById("keylogger-editor");

//     if (translatedChar === "<BACK>") {
//       editor.value = editor.value.slice(0, -1);
//     } else if (translatedChar === "<ENTER>") {
//       editor.value += "\n";
//     } else if (translatedChar === "<TAB>") {
//       editor.value += "    ";
//     } else {
//       editor.value += translatedChar;
//     }
//     editor.scrollTop = editor.scrollHeight;
//   }
// }

// // --- 1. TẢI FILE LOG ---
// function downloadLog() {
//   const content = document.getElementById("keylogger-editor").value;
//   if (!content) {
//     showToast("Chưa có nội dung!", "error");
//     return;
//   }

//   const time = new Date()
//     .toISOString()
//     .slice(0, 19)
//     .replace(/:/g, "-")
//     .replace("T", "_");
//   const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
//   const a = document.createElement("a");
//   a.href = URL.createObjectURL(blob);
//   a.download = `RCS_Log_${time}.txt`;
//   document.body.appendChild(a);
//   a.click();
//   document.body.removeChild(a);
//   showToast("Đang tải xuống...", "success");
// }

// // --- Cấu hình Telex ---
// const TELEX_MAPPING = {
//   // Nguyên âm ghép
//   aw: "ă",
//   aa: "â",
//   dd: "đ",
//   ee: "ê",
//   oo: "ô",
//   ow: "ơ",
//   uw: "ư",
//   // Logic ươ
//   uow: "ươ",
//   uwo: "ươ",
//   // Dấu thanh (s: sắc, f: huyền, r: hỏi, x: ngã, j: nặng)
//   tone: { s: 1, f: 2, r: 3, x: 4, j: 5 },
// };

// // Bảng nguyên âm có dấu
// const VOWEL_TABLE = [
//   // 0: Không, 1: Sắc, 2: Huyền, 3: Hỏi, 4: Ngã, 5: Nặng
//   ["a", "á", "à", "ả", "ã", "ạ"],
//   ["ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"],
//   ["â", "ấ", "ầ", "ẩ", "ẫ", "ậ"],
//   ["e", "é", "è", "ẻ", "ẽ", "ẹ"],
//   ["ê", "ế", "ề", "ể", "ễ", "ệ"],
//   ["i", "í", "ì", "ỉ", "ĩ", "ị"],
//   ["o", "ó", "ò", "ỏ", "õ", "ọ"],
//   ["ô", "ố", "ồ", "ổ", "ỗ", "ộ"],
//   ["ơ", "ớ", "ờ", "ở", "ỡ", "ợ"],
//   ["u", "ú", "ù", "ủ", "ũ", "ụ"],
//   ["ư", "ứ", "ừ", "ử", "ữ", "ự"],
//   ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"],
// ];

// // Hàm tìm và xử lý dấu tiếng Việt trong từ
// function applyTelex(text, char) {
//   if (char === "<BACK>") return text.slice(0, -1);
//   if (char === "<ENTER>") return text + "\n";
//   if (char === "<TAB>") return text + "    ";

//   if (!/^[a-zA-Z0-9]$/.test(char)) return text + char;

//   // Tách từ cuối cùng để xử lý
//   let lastSpace = Math.max(text.lastIndexOf(" "), text.lastIndexOf("\n"));
//   let prefix = text.substring(0, lastSpace + 1); // Phần trước từ đang gõ
//   let word = text.substring(lastSpace + 1); // Từ đang gõ (ví dụ: "tôi")

//   let newWord = word + char;
//   let lowerChar = char.toLowerCase();

//   // 1. Xử lý "Bỏ dấu" hoặc "Gõ đè dấu" (Toggle Tone)
//   // Ví dụ: "tốt" + "s" -> "tốts" (Bỏ dấu sắc cũ, thêm s)
//   // Ví dụ: "tốt" + "f" -> "tồt" (Thay sắc bằng huyền)
//   if (TELEX_MAPPING.tone[lowerChar]) {
//     let toneMark = TELEX_MAPPING.tone[lowerChar]; // 1, 2, 3...

//     // Kiểm tra xem trong từ đã có ký tự nào mang dấu chưa
//     let toneInfo = findToneInWord(word);

//     if (toneInfo) {
//       // Nếu từ ĐÃ CÓ dấu
//       let [charIndex, currentTone, baseChar] = toneInfo;

//       if (currentTone === toneMark) {
//         // CASE 1: Gõ trùng dấu cũ -> XÓA DẤU (Undo)
//         // Ví dụ: "tốt" (sắc) + "s" -> "tot" + "s" -> "tots"
//         let cleanWord = replaceCharInString(word, charIndex, baseChar);
//         return prefix + cleanWord + char;
//       } else {
//         // CASE 2: Gõ dấu khác -> ĐỔI DẤU
//         // Ví dụ: "tốt" (sắc) + "f" -> "tồt"
//         let newCharWithTone = getCharWithTone(baseChar, toneMark);
//         // Giữ Case (Hoa/Thường)
//         if (word[charIndex] === word[charIndex].toUpperCase())
//           newCharWithTone = newCharWithTone.toUpperCase();

//         let newWordReplaced = replaceCharInString(
//           word,
//           charIndex,
//           newCharWithTone
//         );
//         return prefix + newWordReplaced;
//       }
//     } else {
//       // Nếu từ CHƯA CÓ dấu -> THÊM DẤU VÀO NGUYÊN ÂM HỢP LÝ
//       let targetIndex = findVowelToPlaceTone(word);
//       if (targetIndex !== -1) {
//         let baseChar = word[targetIndex];
//         let newCharWithTone = getCharWithTone(baseChar, toneMark);
//         if (baseChar === baseChar.toUpperCase())
//           newCharWithTone = newCharWithTone.toUpperCase();

//         let newWordReplaced = replaceCharInString(
//           word,
//           targetIndex,
//           newCharWithTone
//         );
//         return prefix + newWordReplaced;
//       }
//     }
//   }

//   // 2. Xử lý ký tự đặc biệt (â, ă, đ, ê, ô, ơ, ư) và ươ
//   // Check 3 ký tự cuối cho trường hợp 'uow' -> 'ươ'
//   let last3 = (word + char).slice(-3).toLowerCase();
//   if (last3 === "uow" || last3 === "uwo") {
//     // Tìm 'uo' hoặc 'uw' ở cuối từ gốc để thay thế
//     // Đơn giản hóa: Nếu kết thúc bằng uow -> thay 3 ký tự cuối bằng ươ
//     return prefix + (word + char).slice(0, -3) + "ươ";
//   }

//   // Check 2 ký tự cuối (aa -> â, dd -> đ...)
//   let last2 = (word + char).slice(-2).toLowerCase();

//   // Logic Toggle đặc biệt cho ký tự kép: dd -> đ, nhưng đ + d -> dd
//   // Nếu từ kết thúc bằng 'đ' và gõ thêm 'd' -> revert về 'dd'
//   if (lowerChar === "d" && word.endsWith("đ")) {
//     return prefix + word.slice(0, -1) + "dd";
//   }
//   // Nếu từ kết thúc bằng 'â' và gõ thêm 'a' -> revert về 'aa'
//   if (lowerChar === "a" && word.endsWith("â")) {
//     return prefix + word.slice(0, -1) + "aa";
//   }
//   // (Tương tự cho ee, oo...)

//   // Logic tạo ký tự kép: a+a -> â
//   if (TELEX_MAPPING[last2]) {
//     let replaceChar = TELEX_MAPPING[last2];
//     // Giữ case ký tự đầu
//     let firstOfPair = (word + char).slice(-2)[0];
//     if (firstOfPair === firstOfPair.toUpperCase())
//       replaceChar = replaceChar.toUpperCase();

//     return prefix + word.slice(0, -1) + replaceChar; // Bỏ ký tự cuối của word, thay bằng ký tự mới
//   }

//   // 3. Xử lý 'w' riêng lẻ (u+w -> ư, o+w -> ơ, a+w -> ă)
//   if (lowerChar === "w") {
//     let lastChar = word.slice(-1);
//     if (lastChar.toLowerCase() === "u")
//       return prefix + word.slice(0, -1) + (lastChar === "U" ? "Ư" : "ư");
//     if (lastChar.toLowerCase() === "o")
//       return prefix + word.slice(0, -1) + (lastChar === "O" ? "Ơ" : "ơ");
//     if (lastChar.toLowerCase() === "a")
//       return prefix + word.slice(0, -1) + (lastChar === "A" ? "Ă" : "ă");
//   }

//   return text + char;
// }

// // -- Helpers cho xử lý dấu --
// function findToneInWord(word) {
//   for (let i = 0; i < word.length; i++) {
//     let char = word[i].toLowerCase();
//     for (let row of VOWEL_TABLE) {
//       // Bỏ qua cột 0 (không dấu)
//       for (let t = 1; t < row.length; t++) {
//         if (row[t] === char) {
//           return [i, t, row[0]]; // [Vị trí, Loại dấu, Ký tự gốc]
//         }
//       }
//     }
//   }
//   return null;
// }

// function findVowelToPlaceTone(word) {
//   const lowerWord = word.toLowerCase();

//   // 0. Ưu tiên đặc biệt cho cặp "ươ" (bỏ dấu vào ơ) [MỚI]
//   // Ví dụ: trương + f -> trường (thay vì trừơng)
//   if (lowerWord.includes("ươ")) {
//     return lowerWord.indexOf("ươ") + 1; // Trả về vị trí của 'ơ'
//   }

//   // 1. Ưu tiên tuyệt đối: Các nguyên âm đã có dấu mũ/móc (ê, ô, ơ, â, ă, ư)
//   const priority = ["ê", "ô", "ơ", "â", "ă", "ư"];
//   for (let i = 0; i < word.length; i++) {
//     if (priority.includes(lowerWord[i])) return i;
//   }

//   // 2. Xử lý các trường hợp ngoại lệ (oa, oe, uy -> bỏ dấu vào ký tự thứ 2)
//   const exceptions = ["oa", "oe", "uy"];
//   for (let exc of exceptions) {
//     if (lowerWord.includes(exc)) {
//       return lowerWord.indexOf(exc) + 1;
//     }
//   }

//   // 3. Xử lý phụ âm đầu đặc biệt (qu, gi)
//   let startIdx = 0;
//   if (lowerWord.startsWith("qu") || lowerWord.startsWith("gi")) {
//     if (/[ueoaiy]/.test(lowerWord.slice(2))) {
//       startIdx = 2;
//     }
//   }

//   // 4. Quét nguyên âm thường
//   const normal = ["a", "e", "o", "u", "i", "y"];
//   for (let i = startIdx; i < word.length; i++) {
//     if (normal.includes(lowerWord[i])) return i;
//   }

//   return -1;
// }

// function getCharWithTone(baseChar, toneIndex) {
//   for (let row of VOWEL_TABLE) {
//     if (row[0] === baseChar.toLowerCase()) {
//       return row[toneIndex];
//     }
//   }
//   return baseChar;
// }

// function replaceCharInString(str, index, replacement) {
//   return str.substring(0, index) + replacement + str.substring(index + 1);
// }

// function handleKeylogData(dataString) {
//   let rawKey = dataString;
//   let translatedChar = "";

//   if (dataString.includes("|||")) {
//     const parts = dataString.split("|||");
//     rawKey = parts[0];
//     translatedChar = parts[1];
//   }

//   // Cập nhật Raw Key
//   const rawContainer = document.getElementById("raw-key-output");
//   if (rawContainer) {
//     const span = document.createElement("span");
//     span.className = "key-badge";
//     span.innerText = rawKey;
//     if (["Enter", "Back", "Delete"].includes(rawKey))
//       span.classList.add("special");
//     if (rawKey.includes("Shift") || rawKey.includes("Control"))
//       span.classList.add("mod");
//     rawContainer.appendChild(span);
//     rawContainer.scrollTop = rawContainer.scrollHeight;
//   }

//   // Cập nhật Văn bản với Logic Telex Pro
//   if (translatedChar) {
//     const editor = document.getElementById("keylogger-editor");
//     if (editor) {
//       editor.value = applyTelex(editor.value, translatedChar);
//       editor.scrollTop = editor.scrollHeight;
//     }
//   }
// }

// function clearAllKeylogs() {
//     // 1. Xóa nội dung ô Raw Input (dạng div)
//     const rawOutput = document.getElementById("raw-key-output");
//     if (rawOutput) rawOutput.innerHTML = "";

//     // 2. Xóa nội dung ô Document View (dạng textarea)
//     const docEditor = document.getElementById("keylogger-editor");
//     if (docEditor) docEditor.value = "";
    
//     showToast("Đã xóa dữ liệu Keylogger", "success");
// }

// function startRecordWebcam() {
//   const duration = document.getElementById("record-duration").value;
//   sendCmd("RECORD_WEBCAM", duration);
//   showToast(`Yêu cầu ghi hình ${duration}s...`, "info");
// }

// function downloadVideoFromBase64(base64) {
//     // Chuyển Base64 thành Binary
//     const binaryString = window.atob(base64);
//     const len = binaryString.length;
//     const bytes = new Uint8Array(len);
//     for (let i = 0; i < len; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//     }

//     // Tạo Blob và tải về
//     const blob = new Blob([bytes], { type: "video/avi" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.style.display = "none";
//     a.href = url;
    
//     // Đặt tên file theo giờ hiện tại
//     const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
//     a.download = `Server_Rec_${time}.avi`;
    
//     document.body.appendChild(a);
//     a.click();
    
//     setTimeout(() => {
//         document.body.removeChild(a);
//         window.URL.revokeObjectURL(url);
//     }, 100);
// }

// function downloadImageFromBase64(base64) {
//     const link = document.createElement('a');
    
//     // Tạo link ảo chứa dữ liệu ảnh
//     link.href = 'data:image/jpeg;base64,' + base64;
    
//     // Đặt tên file theo thời gian thực
//     const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
//     link.download = `Screenshot_${time}.jpg`;
    
//     // Kích hoạt tải về
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
// }

// // --- FILE MANAGER LOGIC ---
// let currentPath = "";

// function getDrives() {
//     currentPath = ""; // Về gốc
//     document.getElementById("current-path").innerText = "My Computer";
//     sendCmd("GET_DRIVES");
// }

// function openFolder(path) {
//     currentPath = path;
//     document.getElementById("current-path").innerText = path;
//     sendCmd("GET_DIR", path);
// }

// function reqDownloadFile(path) {
//     if(confirm("Bạn muốn tải file này về máy?")) {
//         sendCmd("DOWNLOAD_FILE", path);
//     }
// }

// function reqDeleteFile(path) {
//     if(confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa file này vĩnh viễn không?")) {
//         sendCmd("DELETE_FILE", path);
//         // Tự động load lại thư mục sau 1 giây
//         setTimeout(() => openFolder(currentPath), 1000);
//     }
// }

// function renderFileManager(items) {
//     if(items.error) {
//         showToast(items.error, "error");
//         return;
//     }

//     const tbody = document.getElementById("file-list-body");
//     tbody.innerHTML = "";

//     items.forEach(item => {
//         const tr = document.createElement("tr");
        
//         let icon = "fa-file";
//         let actionBtn = "";
//         let clickEvent = "";

//         if (item.Type === "DRIVE") {
//             icon = "fa-hdd text-primary";
//             clickEvent = `onclick="openFolder('${item.Path.replace(/\\/g, "\\\\")}')"`;
//         } else if (item.Type === "FOLDER") {
//             icon = "fa-folder text-warning";
//             clickEvent = `onclick="openFolder('${item.Path.replace(/\\/g, "\\\\")}')"`;
//         } else if (item.Type === "BACK") {
//             icon = "fa-level-up-alt";
//             clickEvent = `onclick="openFolder('${item.Path.replace(/\\/g, "\\\\")}')"`;
//         } else {
//             // Là FILE
//             icon = "fa-file-alt text-light";
//             // Nút tải và xóa
//             const safePath = item.Path.replace(/\\/g, "\\\\");
//             actionBtn = `
//                 <button class="btn btn-sm btn-success me-1" onclick="reqDownloadFile('${safePath}')">
//                     <i class="fas fa-download"></i>
//                 </button>
//                 <button class="btn btn-sm btn-danger" onclick="reqDeleteFile('${safePath}')">
//                     <i class="fas fa-trash"></i>
//                 </button>
//             `;
//         }

//         tr.innerHTML = `
//             <td ${clickEvent} style="cursor:pointer"><i class="fas ${icon}"></i></td>
//             <td ${clickEvent} style="cursor:pointer; font-weight: 500;">${item.Name}</td>
//             <td>${item.Size || ""}</td>
//             <td>${actionBtn}</td>
//         `;
//         tbody.appendChild(tr);
//     });
// }

// function downloadFileFromBase64(fileName, base64) {
//     const link = document.createElement('a');
//     link.href = 'data:application/octet-stream;base64,' + base64;
//     link.download = fileName;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     showToast("Đang tải file xuống...", "success");
// }
// // Hàm phụ trợ hiển thị màn hình (Tách ra cho gọn)
// let screenObjectUrl = null;
// function renderScreenFrame(url) {
//     if (screenObjectUrl) URL.revokeObjectURL(screenObjectUrl); // Xóa URL cũ để giải phóng RAM
//     screenObjectUrl = url;
    
//     const img = document.getElementById("live-screen");
//     if (img) {
//         img.src = screenObjectUrl;
//         img.style.display = "block";
//         document.getElementById("screen-placeholder").style.display = "none";
//         document.getElementById("monitorStatus").innerText = "Live Streaming";
//     }
// }

// // Hàm phụ trợ hiển thị Webcam
// let camObjectUrl = null;
// function renderWebcamFrame(url) {
//     if (camObjectUrl) URL.revokeObjectURL(camObjectUrl);
//     camObjectUrl = url;

//     const camImg = document.getElementById("webcam-feed");
//     if (camImg) {
//         camImg.src = camObjectUrl;
//         camImg.style.display = "block";
//         document.getElementById("webcam-placeholder").style.display = "none";
        
//         // Cập nhật trạng thái UI
//         const statusBadge = document.getElementById("cam-status");
//         if(statusBadge) {
//             statusBadge.className = "badge bg-success";
//             statusBadge.innerText = "LIVE";
//         }
//     }
// }

// function triggerUpload() {
//     // Kiểm tra: Không cho upload nếu đang ở màn hình danh sách ổ đĩa (My Computer)
//     if (!currentPath || currentPath === "My Computer" || currentPath === "") {
//         showToast("Vui lòng chọn một thư mục ổ đĩa để upload!", "error");
//         return;
//     }
//     // Kích hoạt thẻ input file
//     document.getElementById("upload-input").click();
// }

// // 2. Hàm xử lý khi người dùng đã chọn file
// function handleFileUpload(inputElement) {
//     const file = inputElement.files[0];
//     if (!file) return; // Người dùng hủy chọn

//     // Giới hạn dung lượng Client (ví dụ 50MB) để tránh treo trình duyệt khi convert Base64
//     // Lưu ý: Base64 sẽ làm tăng kích thước file lên khoảng 33%
//     if (file.size > 50 * 1024 * 1024) {
//         showToast("File quá lớn! Vui lòng chọn file < 50MB", "error");
//         inputElement.value = ""; // Reset input
//         return;
//     }

//     showToast(`Đang xử lý upload: ${file.name}...`, "info");

//     const reader = new FileReader();

//     // Khi đọc file xong
//     reader.onload = function(e) {
//         // e.target.result có dạng: "data:application/pdf;base64,JVBERi0xLjQK..."
//         // Ta cần tách bỏ phần header "data:...;base64," chỉ lấy chuỗi mã hóa phía sau
//         const rawBase64 = e.target.result.split(',')[1]; 

//         // Tạo payload đúng theo cấu trúc ServerCore.cs yêu cầu (dòng 345)
//         /* dynamic uploadInfo = JsonConvert.DeserializeObject(packet.param);
//            string targetFolder = uploadInfo.path;
//            string fileName = uploadInfo.fileName;
//            string base64Data = uploadInfo.data;
//         */
//         const payload = {
//             fileName: file.name,
//             path: currentPath,
//             data: rawBase64
//         };

//         // Gửi lệnh lên Server
//         // ServerCore mong đợi param là một JSON string chứa thông tin trên
//         sendCmd("UPLOAD_FILE", JSON.stringify(payload));
        
//         // Reset input để có thể chọn lại file đó lần sau nếu muốn
//         inputElement.value = "";
//     };

//     // Bắt đầu đọc file dưới dạng Data URL (Base64)
//     reader.readAsDataURL(file);
// }

// function createNewFolder() {
//     // 1. Kiểm tra xem đang ở đâu
//     if (!currentPath || currentPath === "My Computer" || currentPath === "") {
//         showToast("Vui lòng chọn một ổ đĩa trước khi tạo thư mục!", "error");
//         return;
//     }

//     // 2. Hỏi tên thư mục
//     const folderName = prompt("Nhập tên thư mục mới:", "New Folder");
    
//     // 3. Nếu người dùng bấm OK và có nhập tên
//     if (folderName && folderName.trim() !== "") {
//         // Gửi lệnh lên Server
//         const payload = {
//             path: currentPath,
//             name: folderName.trim()
//         };
        
//         sendCmd("CREATE_FOLDER", JSON.stringify(payload));
//     }
// }

// let isControlEnabled = false;
// let lastMoveTime = 0;

// function toggleControl(checkbox) {
//     isControlEnabled = checkbox.checked;
//     const screenImg = document.getElementById("live-screen");
    
//     if (isControlEnabled) {
//         showToast("Đã BẬT chế độ điều khiển!", "success");
//         screenImg.style.cursor = "crosshair"; // Đổi con trỏ thành dấu cộng
        
//         // Bắt sự kiện bàn phím
//         document.addEventListener("keydown", handleRemoteKey);
//     } else {
//         showToast("Đã TẮT chế độ điều khiển!", "info");
//         screenImg.style.cursor = "default";
        
//         // Hủy sự kiện bàn phím
//         document.removeEventListener("keydown", handleRemoteKey);
//     }
// }

// // Tự động gắn sự kiện chuột khi trang web tải xong
// document.addEventListener("DOMContentLoaded", () => {
//     const screenImg = document.getElementById("live-screen");
    
//     if (screenImg) {
//         // 1. Di chuyển chuột
//         screenImg.addEventListener("mousemove", (e) => {
//             if (!isControlEnabled) return;

//             // Giới hạn gửi tin (Throttle) 50ms/lần để tránh lag
//             const now = Date.now();
//             if (now - lastMoveTime < 50) return;
//             lastMoveTime = now;

//             const rect = screenImg.getBoundingClientRect();
//             // Tính tọa độ % (từ 0.0 đến 1.0)
//             let rawX = (e.clientX - rect.left) / rect.width;
//             let rawY = (e.clientY - rect.top) / rect.height;

//             // Đảm bảo không bao giờ < 0 hoặc > 1
//             const xPercent = Math.max(0, Math.min(1, rawX));
//             const yPercent = Math.max(0, Math.min(1, rawY));

//             sendCmd("MOUSE_MOVE", JSON.stringify({ x: xPercent, y: yPercent }));
//         });

//         // 2. Click chuột
//         screenImg.addEventListener("mousedown", (e) => {
//             if (!isControlEnabled) return;
//             e.preventDefault(); // Chặn bôi đen ảnh
//             const btn = e.button === 0 ? "left" : (e.button === 2 ? "right" : "middle");
//             sendCmd("MOUSE_CLICK", JSON.stringify({ btn: btn, action: "down" }));
//         });

//         screenImg.addEventListener("mouseup", (e) => {
//             if (!isControlEnabled) return;
//             e.preventDefault();
//             const btn = e.button === 0 ? "left" : (e.button === 2 ? "right" : "middle");
//             sendCmd("MOUSE_CLICK", JSON.stringify({ btn: btn, action: "up" }));
//         });

//         // Chặn menu chuột phải
//         screenImg.addEventListener("contextmenu", (e) => {
//             if (isControlEnabled) e.preventDefault();
//         });
//     }
// });

// // 3. Xử lý bàn phím
// function handleRemoteKey(e) {
//     if (!isControlEnabled) return;
    
//     // Gửi mã phím về Server
//     sendCmd("KEY_PRESS", e.key);

//     // Chặn hành động mặc định của một số phím (như F5, Tab)
//     if (["F5", "Tab", "Alt", "ContextMenu"].includes(e.key)) {
//         e.preventDefault();
//     }
// }

let socket = null;
let objectUrl = null;
let currentViewMode = "apps"; // Mặc định xem Apps
let allInstalledApps = []; // Danh sách ứng dụng cài đặt

// --- BIẾN CHO MONITORING (MỚI) ---
let frameCount = 0;
let perfInterval = null;

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
            // --- XỬ LÝ BINARY MỚI ---
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

  document.getElementById("login-error").textContent = "Disconnected from Server.";

  const badge = document.getElementById("connectionBadge");
  badge.className = "status-badge status-offline";
  badge.innerHTML = '<i class="fas fa-circle"></i> Disconnected';

  // Dừng vòng lặp lấy hiệu năng (MỚI)
  if (perfInterval) clearInterval(perfInterval);

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (socket) socket.close();
}

// --- 2. XỬ LÝ DỮ LIỆU TỪ SERVER ---
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

          // Tự động lấy dữ liệu ban đầu
          getApps();
          sendCmd("GET_SYS_INFO"); // [MỚI] Lấy thông tin phần cứng

          // [MỚI] Bắt đầu vòng lặp lấy hiệu năng mỗi 2 giây
          if (perfInterval) clearInterval(perfInterval);
          perfInterval = setInterval(() => {
              sendCmd("GET_PERFORMANCE");
              updateFPS(); 
          }, 1000);

        } else {
          document.getElementById("login-error").textContent = "Wrong Password!";
          showToast("Login Failed!", "error");
          socket.close();
        }
        break;

      // [MỚI] Thông tin hệ thống tĩnh
      case "SYS_INFO":
        const info = msg.payload;
        if(document.getElementById("os-info")) {
            document.getElementById("os-info").innerText = info.os || "Windows";
            document.getElementById("pc-name").innerText = info.pcName || "Unknown"; // ID mới
            document.getElementById("cpu-name").innerText = info.cpuName || "Standard CPU"; // ID mới
            document.getElementById("gpu-name").innerText = info.gpuName;
            document.getElementById("vram-val").innerText = info.vram;
            document.getElementById("disk-name").innerText = info.totalDisk;
        }
        break;

      // [MỚI] Hiệu năng (Cập nhật biểu đồ tròn CSS)
      case "PERF_STATS":
        const perf = msg.payload;
        
        // Update CPU Chart
        const cpuEl = document.getElementById("chart-cpu");
        if(cpuEl) {
            cpuEl.style.setProperty('--percent', perf.cpu + '%');
            document.getElementById("val-cpu").innerText = perf.cpu + "%";
        }

        // Update Disk Chart
        const diskEl = document.getElementById("chart-disk");
        if(diskEl) {
            diskEl.style.setProperty('--percent', perf.diskUsage + '%');
            document.getElementById("val-disk").innerText = perf.diskUsage + "%";
        }
        break;

      // Xử lý Ảnh chụp màn hình
      case "SCREENSHOT_FILE":
        downloadImageFromBase64(msg.payload);
        showToast("Ảnh đã được lưu về máy!", "success");
        break;

      case "SCREEN_CAPTURE":
        const imgSrc = "data:image/jpeg;base64," + msg.payload;
        const previewImg = document.getElementById("captured-preview");
        if (previewImg) {
          previewImg.src = imgSrc;
          previewImg.classList.remove("hidden");
          document.getElementById("preview-text").style.display = "none";
          document.getElementById("save-badge").classList.remove("hidden");
        }
        break;

      case "LOG":
        const text = msg.payload;
        if (text.startsWith("[Keylogger]")) {
          handleKeylogData(text.replace("[Keylogger] ", ""));
        } else {
          logToTerminal(text, "info");
          if (text.includes("Đã diệt") || text.includes("Đã mở") || text.includes("thành công")) {
            showToast(text, "success");
          } else if (text.includes("Lỗi")) {
            showToast(text, "error");
          }
        }
        break;

      case "APP_LIST":
        if (currentViewMode === "apps") renderProcessTable(msg.payload);
        break;

      case "PROCESS_LIST":
        if (currentViewMode === "processes") renderProcessTable(msg.payload);
        break;

      case "INSTALLED_LIST":
        allInstalledApps = msg.payload;
        renderAppGrid(allInstalledApps);
        break;

      case "VIDEO_FILE":
        downloadVideoFromBase64(msg.payload);
        showToast("Đã nhận được video từ Server!", "success");
        break;

      case "FILE_LIST":
        renderFileManager(msg.payload);
        break;

      case "FILE_DOWNLOAD_DATA":
        const fileInfo = msg.payload;
        downloadFileFromBase64(fileInfo.fileName, fileInfo.data);
        break;
    }
  } catch (e) {
    console.error("JSON Error:", e);
  }
}

function handleBinaryStream(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const header = view.getUint8(0); 
    const blobData = arrayBuffer.slice(1);
    
    const blob = new Blob([blobData], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);

    if (header === 0x01) { 
        // Header 0x01 = SCREEN
        renderScreenFrame(url);
        frameCount++; // [MỚI] Tăng đếm frame để tính FPS
    } 
    else if (header === 0x02) { 
        // Header 0x02 = WEBCAM
        renderWebcamFrame(url);
    }
}

// [MỚI] HÀM TÍNH TOÁN FPS
function updateFPS() {
    const fps = frameCount; 
    frameCount = 0; 
    
    // Tìm thẻ badge FPS mới bên tab Monitor
    const fpsBadge = document.getElementById("stream-fps-badge");
    
    if(fpsBadge) {
        fpsBadge.innerText = fps + " FPS";
        
        // Đổi màu badge theo mức FPS cho trực quan
        if(fps >= 30) {
            fpsBadge.className = "badge bg-success ms-2 shadow-sm border border-secondary";
        } else if (fps >= 15) {
            fpsBadge.className = "badge bg-warning text-dark ms-2 shadow-sm border border-secondary";
        } else {
            fpsBadge.className = "badge bg-danger ms-2 shadow-sm border border-secondary";
        }
    }
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

// --- APP LIBRARY ---
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

// --- UI HELPERS ---
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return; 

  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;
  let icon = type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle";
  let color = type === "success" ? "text-success" : type === "error" ? "text-danger" : "text-primary";

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

  const titles = {
    dashboard: "Overview",
    monitor: "Screen Monitor",
    processes: "Task Manager",
    files: "File Explorer",
    webcam: "Webcam Control",
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

// --- TELEX & KEYLOGGER ---
const TELEX_MAPPING = {
  aw: "ă", aa: "â", dd: "đ", ee: "ê", oo: "ô", ow: "ơ", uw: "ư",
  uow: "ươ", uwo: "ươ",
  tone: { s: 1, f: 2, r: 3, x: 4, j: 5 },
};
const VOWEL_TABLE = [
  ["a", "á", "à", "ả", "ã", "ạ"], ["ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"], ["â", "ấ", "ầ", "ẩ", "ẫ", "ậ"],
  ["e", "é", "è", "ẻ", "ẽ", "ẹ"], ["ê", "ế", "ề", "ể", "ễ", "ệ"], ["i", "í", "ì", "ỉ", "ĩ", "ị"],
  ["o", "ó", "ò", "ỏ", "õ", "ọ"], ["ô", "ố", "ồ", "ổ", "ỗ", "ộ"], ["ơ", "ớ", "ờ", "ở", "ỡ", "ợ"],
  ["u", "ú", "ù", "ủ", "ũ", "ụ"], ["ư", "ứ", "ừ", "ử", "ữ", "ự"], ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"],
];

function applyTelex(text, char) {
  if (char === "<BACK>") return text.slice(0, -1);
  if (char === "<ENTER>") return text + "\n";
  if (char === "<TAB>") return text + "    ";
  if (!/^[a-zA-Z0-9]$/.test(char)) return text + char;

  let lastSpace = Math.max(text.lastIndexOf(" "), text.lastIndexOf("\n"));
  let prefix = text.substring(0, lastSpace + 1);
  let word = text.substring(lastSpace + 1);
  let newWord = word + char;
  let lowerChar = char.toLowerCase();

  if (TELEX_MAPPING.tone[lowerChar]) {
    let toneMark = TELEX_MAPPING.tone[lowerChar];
    let toneInfo = findToneInWord(word);
    if (toneInfo) {
      let [charIndex, currentTone, baseChar] = toneInfo;
      if (currentTone === toneMark) {
        let cleanWord = replaceCharInString(word, charIndex, baseChar);
        return prefix + cleanWord + char;
      } else {
        let newCharWithTone = getCharWithTone(baseChar, toneMark);
        if (word[charIndex] === word[charIndex].toUpperCase()) newCharWithTone = newCharWithTone.toUpperCase();
        let newWordReplaced = replaceCharInString(word, charIndex, newCharWithTone);
        return prefix + newWordReplaced;
      }
    } else {
      let targetIndex = findVowelToPlaceTone(word);
      if (targetIndex !== -1) {
        let baseChar = word[targetIndex];
        let newCharWithTone = getCharWithTone(baseChar, toneMark);
        if (baseChar === baseChar.toUpperCase()) newCharWithTone = newCharWithTone.toUpperCase();
        let newWordReplaced = replaceCharInString(word, targetIndex, newCharWithTone);
        return prefix + newWordReplaced;
      }
    }
  }
  let last3 = (word + char).slice(-3).toLowerCase();
  if (last3 === "uow" || last3 === "uwo") return prefix + (word + char).slice(0, -3) + "ươ";

  let last2 = (word + char).slice(-2).toLowerCase();
  if (lowerChar === "d" && word.endsWith("đ")) return prefix + word.slice(0, -1) + "dd";
  if (lowerChar === "a" && word.endsWith("â")) return prefix + word.slice(0, -1) + "aa";

  if (TELEX_MAPPING[last2]) {
    let replaceChar = TELEX_MAPPING[last2];
    let firstOfPair = (word + char).slice(-2)[0];
    if (firstOfPair === firstOfPair.toUpperCase()) replaceChar = replaceChar.toUpperCase();
    return prefix + word.slice(0, -1) + replaceChar;
  }
  if (lowerChar === "w") {
    let lastChar = word.slice(-1);
    if (lastChar.toLowerCase() === "u") return prefix + word.slice(0, -1) + (lastChar === "U" ? "Ư" : "ư");
    if (lastChar.toLowerCase() === "o") return prefix + word.slice(0, -1) + (lastChar === "O" ? "Ơ" : "ơ");
    if (lastChar.toLowerCase() === "a") return prefix + word.slice(0, -1) + (lastChar === "A" ? "Ă" : "ă");
  }
  return text + char;
}
function findToneInWord(word) {
  for (let i = 0; i < word.length; i++) {
    let char = word[i].toLowerCase();
    for (let row of VOWEL_TABLE) {
      for (let t = 1; t < row.length; t++) {
        if (row[t] === char) return [i, t, row[0]];
      }
    }
  }
  return null;
}
function findVowelToPlaceTone(word) {
  const lowerWord = word.toLowerCase();
  if (lowerWord.includes("ươ")) return lowerWord.indexOf("ươ") + 1;
  const priority = ["ê", "ô", "ơ", "â", "ă", "ư"];
  for (let i = 0; i < word.length; i++) if (priority.includes(lowerWord[i])) return i;
  const exceptions = ["oa", "oe", "uy"];
  for (let exc of exceptions) if (lowerWord.includes(exc)) return lowerWord.indexOf(exc) + 1;
  let startIdx = 0;
  if (lowerWord.startsWith("qu") || lowerWord.startsWith("gi")) if (/[ueoaiy]/.test(lowerWord.slice(2))) startIdx = 2;
  const normal = ["a", "e", "o", "u", "i", "y"];
  for (let i = startIdx; i < word.length; i++) if (normal.includes(lowerWord[i])) return i;
  return -1;
}
function getCharWithTone(baseChar, toneIndex) {
  for (let row of VOWEL_TABLE) if (row[0] === baseChar.toLowerCase()) return row[toneIndex];
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
  const rawContainer = document.getElementById("raw-key-output");
  if (rawContainer) {
    const span = document.createElement("span");
    span.className = "key-badge";
    span.innerText = rawKey;
    if (["Enter", "Back", "Delete"].includes(rawKey)) span.classList.add("special");
    if (rawKey.includes("Shift") || rawKey.includes("Control")) span.classList.add("mod");
    rawContainer.appendChild(span);
    rawContainer.scrollTop = rawContainer.scrollHeight;
  }
  if (translatedChar) {
    const editor = document.getElementById("keylogger-editor");
    if (editor) {
      editor.value = applyTelex(editor.value, translatedChar);
      editor.scrollTop = editor.scrollHeight;
    }
  }
}

function clearAllKeylogs() {
    const rawOutput = document.getElementById("raw-key-output");
    if (rawOutput) rawOutput.innerHTML = "";
    const docEditor = document.getElementById("keylogger-editor");
    if (docEditor) docEditor.value = "";
    showToast("Đã xóa dữ liệu Keylogger", "success");
}

function startRecordWebcam() {
  const duration = document.getElementById("record-duration").value;
  sendCmd("RECORD_WEBCAM", duration);
  showToast(`Yêu cầu ghi hình ${duration}s...`, "info");
}

function downloadVideoFromBase64(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: "video/avi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    a.download = `Server_Rec_${time}.avi`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
}

function downloadImageFromBase64(base64) {
    const link = document.createElement('a');
    link.href = 'data:image/jpeg;base64,' + base64;
    const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    link.download = `Screenshot_${time}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadLog() {
  const content = document.getElementById("keylogger-editor").value;
  if (!content) { showToast("Chưa có nội dung!", "error"); return; }
  const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-").replace("T", "_");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `RCS_Log_${time}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Đang tải xuống...", "success");
}

// --- FILE MANAGER ---
let currentPath = "";

function getDrives() {
    currentPath = ""; 
    document.getElementById("current-path").innerText = "My Computer";
    sendCmd("GET_DRIVES");
}

function openFolder(path) {
    currentPath = path;
    document.getElementById("current-path").innerText = path;
    sendCmd("GET_DIR", path);
}

function openGalleryFolder() {
    switchTab('files', document.querySelector("a[onclick*='switchTab(\\'files\\'']"));
    sendCmd("OPEN_GALLERY");
    document.getElementById("current-path").innerText = "Server Captures (Gallery)";
    showToast("Đang mở thư mục lưu trữ...", "info");
}

function reqDownloadFile(path) {
    if(confirm("Bạn muốn tải file này về máy?")) sendCmd("DOWNLOAD_FILE", path);
}

function reqDeleteFile(path) {
    if(confirm("CẢNH BÁO: Xóa file vĩnh viễn?")) {
        sendCmd("DELETE_FILE", path);
        setTimeout(() => openFolder(currentPath), 1000);
    }
}

function renderFileManager(items) {
    if(items.error) { showToast(items.error, "error"); return; }
    const tbody = document.getElementById("file-list-body");
    tbody.innerHTML = "";
    items.forEach(item => {
        const tr = document.createElement("tr");
        let icon = "fa-file";
        let actionBtn = "";
        let clickEvent = "";

        if (item.Type === "DRIVE") {
            icon = "fa-hdd text-primary";
            clickEvent = `onclick="openFolder('${item.Path.replace(/\\/g, "\\\\")}')"`;
        } else if (item.Type === "FOLDER") {
            icon = "fa-folder text-warning";
            clickEvent = `onclick="openFolder('${item.Path.replace(/\\/g, "\\\\")}')"`;
        } else if (item.Type === "BACK") {
            icon = "fa-level-up-alt";
            clickEvent = `onclick="openFolder('${item.Path.replace(/\\/g, "\\\\")}')"`;
        } else {
            icon = "fa-file-alt text-light";
            const safePath = item.Path.replace(/\\/g, "\\\\");
            actionBtn = `
                <button class="btn btn-sm btn-success me-1" onclick="reqDownloadFile('${safePath}')">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="reqDeleteFile('${safePath}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }
        tr.innerHTML = `
            <td ${clickEvent} style="cursor:pointer"><i class="fas ${icon}"></i></td>
            <td ${clickEvent} style="cursor:pointer; font-weight: 500;">${item.Name}</td>
            <td>${item.Size || ""}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function downloadFileFromBase64(fileName, base64) {
    const link = document.createElement('a');
    link.href = 'data:application/octet-stream;base64,' + base64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Đang tải file xuống...", "success");
}

let screenObjectUrl = null;
function renderScreenFrame(url) {
    if (screenObjectUrl) URL.revokeObjectURL(screenObjectUrl);
    screenObjectUrl = url;
    const img = document.getElementById("live-screen");
    if (img) {
        img.src = screenObjectUrl;
        img.style.display = "block";
        document.getElementById("screen-placeholder").style.display = "none";
        document.getElementById("monitorStatus").innerText = "Live Streaming";
    }
}

let camObjectUrl = null;
function renderWebcamFrame(url) {
    if (camObjectUrl) URL.revokeObjectURL(camObjectUrl);
    camObjectUrl = url;
    const camImg = document.getElementById("webcam-feed");
    if (camImg) {
        camImg.src = camObjectUrl;
        camImg.style.display = "block";
        document.getElementById("webcam-placeholder").style.display = "none";
        const statusBadge = document.getElementById("cam-status");
        if(statusBadge) { statusBadge.className = "badge bg-success"; statusBadge.innerText = "LIVE"; }
    }
}

function triggerUpload() {
    if (!currentPath || currentPath === "My Computer" || currentPath === "") {
        showToast("Vui lòng chọn một thư mục ổ đĩa để upload!", "error");
        return;
    }
    document.getElementById("upload-input").click();
}

function handleFileUpload(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        showToast("File quá lớn! Vui lòng chọn file < 50MB", "error");
        inputElement.value = "";
        return;
    }
    showToast(`Đang xử lý upload: ${file.name}...`, "info");
    const reader = new FileReader();
    reader.onload = function(e) {
        const rawBase64 = e.target.result.split(',')[1]; 
        const payload = { fileName: file.name, path: currentPath, data: rawBase64 };
        sendCmd("UPLOAD_FILE", JSON.stringify(payload));
        inputElement.value = "";
    };
    reader.readAsDataURL(file);
}

function createNewFolder() {
    if (!currentPath || currentPath === "My Computer" || currentPath === "") {
        showToast("Vui lòng chọn một ổ đĩa trước khi tạo thư mục!", "error");
        return;
    }
    const folderName = prompt("Nhập tên thư mục mới:", "New Folder");
    if (folderName && folderName.trim() !== "") {
        const payload = { path: currentPath, name: folderName.trim() };
        sendCmd("CREATE_FOLDER", JSON.stringify(payload));
    }
}

let isControlEnabled = false;
let lastMoveTime = 0;

function toggleControl(checkbox) {
    isControlEnabled = checkbox.checked;
    const screenImg = document.getElementById("live-screen");
    if (isControlEnabled) {
        showToast("Đã BẬT chế độ điều khiển!", "success");
        screenImg.style.cursor = "crosshair"; 
        document.addEventListener("keydown", handleRemoteKey);
    } else {
        showToast("Đã TẮT chế độ điều khiển!", "info");
        screenImg.style.cursor = "default";
        document.removeEventListener("keydown", handleRemoteKey);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const screenImg = document.getElementById("live-screen");
    if (screenImg) {
        screenImg.addEventListener("mousemove", (e) => {
            if (!isControlEnabled) return;
            const now = Date.now();
            if (now - lastMoveTime < 50) return;
            lastMoveTime = now;
            const rect = screenImg.getBoundingClientRect();
            let rawX = (e.clientX - rect.left) / rect.width;
            let rawY = (e.clientY - rect.top) / rect.height;
            const xPercent = Math.max(0, Math.min(1, rawX));
            const yPercent = Math.max(0, Math.min(1, rawY));
            sendCmd("MOUSE_MOVE", JSON.stringify({ x: xPercent, y: yPercent }));
        });
        screenImg.addEventListener("mousedown", (e) => {
            if (!isControlEnabled) return;
            e.preventDefault(); 
            const btn = e.button === 0 ? "left" : (e.button === 2 ? "right" : "middle");
            sendCmd("MOUSE_CLICK", JSON.stringify({ btn: btn, action: "down" }));
        });
        screenImg.addEventListener("mouseup", (e) => {
            if (!isControlEnabled) return;
            e.preventDefault();
            const btn = e.button === 0 ? "left" : (e.button === 2 ? "right" : "middle");
            sendCmd("MOUSE_CLICK", JSON.stringify({ btn: btn, action: "up" }));
        });
        screenImg.addEventListener("contextmenu", (e) => {
            if (isControlEnabled) e.preventDefault();
        });
    }
});

function handleRemoteKey(e) {
    if (!isControlEnabled) return;
    sendCmd("KEY_PRESS", e.key);
    if (["F5", "Tab", "Alt", "ContextMenu", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
    }
}