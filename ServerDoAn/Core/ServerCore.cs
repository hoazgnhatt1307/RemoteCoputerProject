using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Fleck;
using Newtonsoft.Json;

using RemoteControlServer.Models;
using RemoteControlServer.Helpers;
using RemoteControlServer.Services;

namespace RemoteControlServer.Core
{
    public class ServerCore
    {
        private static List<IWebSocketConnection> allSockets = new List<IWebSocketConnection>();
        private static bool isStreaming = false;
        private static string _sessionPassword = "";
        private static readonly object _socketLock = new object();
        private static byte[] _lastFrame = null;

        private static object GetCurrentApps()
        {
            // Lấy danh sách các ứng dụng có cửa sổ (Window)
            return Process.GetProcesses()
                .Where(p => !string.IsNullOrEmpty(p.MainWindowTitle))
                .Select(p => new { id = p.Id, name = p.ProcessName, title = p.MainWindowTitle })
                .ToList();
        }

        private static object GetCurrentProcesses()
        {
            // Lấy danh sách toàn bộ tiến trình
            return Process.GetProcesses()
                .Select(p => new {
                    id = p.Id,
                    name = p.ProcessName,
                    memory = (p.WorkingSet64 / 1024 / 1024) + " MB"
                })
                .OrderByDescending(p => p.id)
                .ToList();
        }

        // 1. Thêm hàm lấy danh sách Shortcut trong Start Menu
        private static object GetInstalledApps()
        {
            var apps = new List<object>();
            try
            {
                // Đường dẫn đến Start Menu chung của máy tính
                string commonStartMenu = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu) + "\\Programs";
                
                // Lấy tất cả file .lnk (shortcut)
                // SearchOption.AllDirectories: Quét cả thư mục con
                var files = Directory.GetFiles(commonStartMenu, "*.lnk", SearchOption.AllDirectories);

                foreach (var file in files)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    
                    // Lọc bớt các file không cần thiết (Help, Uninstall...)
                    if (!fileName.ToLower().Contains("uninstall") && 
                        !fileName.ToLower().Contains("help") && 
                        !fileName.ToLower().Contains("readme"))
                    {
                        apps.Add(new { name = fileName, path = file });
                    }
                }
            }
            catch { } // Bỏ qua lỗi nếu không truy cập được thư mục
            return apps.OrderBy(x => ((dynamic)x).name).ToList();
        }

        public static void Start(string url)
        {
            SystemHelper.InitCounters();
            _sessionPassword = new Random().Next(100000, 999999).ToString();

            // In ra Console thật nổi bật
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("=================================================");
            Console.WriteLine($"   REMOTE CONTROL SERVER IS RUNNING");
            Console.WriteLine($"   URL: {url}");
            Console.WriteLine($"   >> YOUR OTP PASSWORD: {_sessionPassword} <<");
            Console.WriteLine("=================================================");
            Console.ResetColor();

            var server = new WebSocketServer(url);
            server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    Console.WriteLine(">> Client kết nối!");
                    allSockets.Add(socket);
                };
                socket.OnClose = () =>
                {
                    Console.WriteLine(">> Client ngắt kết nối!");
                    allSockets.Remove(socket);
                    if (allSockets.Count == 0) isStreaming = false;
                };
                socket.OnMessage = message => HandleClientCommand(socket, message);
            });

            Console.WriteLine($">> Server đang chạy tại {url}");

            // 1. Xử lý Stream ảnh (Giữ nguyên)
            WebcamManager.OnFrameCaptured += (imgBytes) => {
                BroadcastBinary(0x02, imgBytes);
            };

            // 2. [MỚI] Xử lý Gửi File Video (Giống ý tưởng server.cs)
            WebcamManager.OnVideoSaved += (filePath) => {
                Task.Run(() => {
                    try 
                    {
                        if (File.Exists(filePath))
                        {
                            Console.WriteLine(">> Đang gửi file video về Client...");
                            
                            // Đọc toàn bộ file vào RAM (như MemoryStream)
                            byte[] fileBytes = File.ReadAllBytes(filePath);
                            string base64File = Convert.ToBase64String(fileBytes);
                            
                            // Gửi gói tin đặc biệt chứa dữ liệu file
                            BroadcastJson("VIDEO_FILE", base64File);
                            
                            BroadcastLog($"Đã gửi file video ({fileBytes.Length / 1024} KB) về máy bạn!");

                            // Xóa file tạm sau khi gửi xong (Dọn dẹp chiến trường)
                            File.Delete(filePath);
                        }
                    }
                    catch (Exception ex)
                    {
                        BroadcastLog("Lỗi gửi file: " + ex.Message);
                    }
                });
            };

            Task.Run(() => ScreenStreamLoop());
        }

        private static void BroadcastBinary(byte header, byte[] data)
        {
            if (data == null || allSockets.Count == 0) return;

            // Tạo gói tin: [Header (1 byte)] + [Data (N bytes)]
            byte[] packet = new byte[data.Length + 1];
            packet[0] = header; // Gán byte đầu tiên là header
            Buffer.BlockCopy(data, 0, packet, 1, data.Length); // Copy dữ liệu ảnh vào sau

            foreach (var socket in allSockets.ToList())
            {
                // Sử dụng SafeSend phiên bản byte[] đã có sẵn của bạn
                SafeSend(socket, packet);
            }
        }

        public static void BroadcastLog(string message)
        {
            BroadcastJson("LOG", message);
        }

        // Hàm gửi an toàn (Có khóa lock)
        private static void SafeSend(IWebSocketConnection socket, string message)
        {
            lock (_socketLock) // Chỉ cho phép 1 luồng gửi tại 1 thời điểm
            {
                if (socket.IsAvailable) socket.Send(message);
            }
        }

        private static void SafeSend(IWebSocketConnection socket, byte[] data)
        {
            lock (_socketLock)
            {
                if (socket.IsAvailable) socket.Send(data);
            }
        }

        private static void BroadcastJson(string type, object payload)
        {
            var json = JsonConvert.SerializeObject(new { type = type, payload = payload });
            foreach (var socket in allSockets.ToList()) 
            {
                SafeSend(socket, json); // Dùng hàm gửi an toàn
            }
        }

        private static void SendJson(IWebSocketConnection socket, string type, object payload)
        {
            var json = JsonConvert.SerializeObject(new { type = type, payload = payload });
            SafeSend(socket, json); // Dùng hàm gửi an toàn
        }

        private static void HandleClientCommand(IWebSocketConnection socket, string jsonMessage)
        {
            try
            {
                var packet = JsonConvert.DeserializeObject<WebPacket>(jsonMessage);

                // 1. Auth
                if (packet.type == "AUTH")
                {
                // --- SỬA DÒNG NÀY ---
                // Cũ: if (packet.payload == SERVER_PASSWORD)
                
                // Mới: So sánh với mật khẩu động
                if (packet.payload == _sessionPassword)
                {
                    SendJson(socket, "AUTH_RESULT", "OK");
                    Console.WriteLine("-> Client đăng nhập thành công!");
                }
                else 
                {
                    SendJson(socket, "AUTH_RESULT", "FAIL");
                    Console.WriteLine("-> Client sai mật khẩu!");
                }
                return;
            }

                // 2. Command Processing
                if (!string.IsNullOrEmpty(packet.command))
                {
                    if (packet.command != "GET_PERFORMANCE" && packet.command != "MOUSE_MOVE" && packet.command != "GET_SYS_INFO")
                    {
                        Console.WriteLine($"[CMD]: {packet.command} | {packet.param}");
                    }
                    switch (packet.command)
                    {
                        case "START_STREAM":
                            isStreaming = true;
                            SendJson(socket, "LOG", "Đã bắt đầu Stream Video");
                            break;
                        case "STOP_STREAM":
                            isStreaming = false;
                            SendJson(socket, "LOG", "Đã dừng Stream");
                            break;
                        case "CAPTURE_SCREEN":
                            try
                            {
                                // 1. Chụp ảnh GỐC (Chất lượng 90%, Tỉ lệ 1.0 = Full Size)
                                // Lưu ý: Dữ liệu này chỉ nằm trên RAM (biến imgBytes), không lưu vào ổ cứng Server
                                var imgBytes = SystemHelper.GetScreenShot(90L, 1.0);

                                if (imgBytes != null)
                                {
                                    Console.WriteLine($">> Đã chụp màn hình ({imgBytes.Length / 1024} KB). Đang gửi...");

                                    // 2. Chuyển đổi sang Base64 để gửi qua mạng
                                    string base64Full = Convert.ToBase64String(imgBytes);

                                    // 3. Gửi gói tin chứa ẢNH GỐC để Client tải về
                                    SendJson(socket, "SCREENSHOT_FILE", base64Full);

                                    // 4. (Tùy chọn) Tạo thêm ảnh nhỏ (Thumbnail) để hiển thị xem trước trên Web cho nhanh
                                    var previewBytes = SystemHelper.GetScreenShot(85L, 0.8); 
                                    if (previewBytes != null)
                                    {
                                        SendJson(socket, "SCREEN_CAPTURE", Convert.ToBase64String(previewBytes));
                                    }
                                    
                                    SendJson(socket, "LOG", "Đã gửi ảnh chụp về máy bạn!");
                                }
                            }
                            catch (Exception ex)
                            {
                                SendJson(socket, "LOG", "Lỗi chụp ảnh: " + ex.Message);
                            }
                            break;
                        case "GET_APPS":
                            SendJson(socket, "APP_LIST", GetCurrentApps());
                            break;
                        case "GET_PROCESS":
                            SendJson(socket, "PROCESS_LIST", GetCurrentProcesses());
                            break;
                       case "KILL":
                            try 
                            {
                                int pid = int.Parse(packet.param);
                                var proc = Process.GetProcessById(pid);
                                proc.Kill(); // Thực hiện tắt ứng dụng
                                
                                SendJson(socket, "LOG", $"Đã diệt ID {pid}"); // Báo riêng cho người bấm

                                // Gửi danh sách MỚI NHẤT cho TẤT CẢ Client ngay lập tức
                                // Client nhận được gói tin này sẽ tự động vẽ lại bảng
                                BroadcastJson("APP_LIST", GetCurrentApps());
                                BroadcastJson("PROCESS_LIST", GetCurrentProcesses());
                            } 
                            catch (Exception ex) 
                            { 
                                SendJson(socket, "LOG", "Lỗi Kill: " + ex.Message); 
                            }
                            break;
                        // [ServerCore.cs] - Trong hàm HandleClientCommand

                        case "GET_INSTALLED":
                            SendJson(socket, "INSTALLED_LIST", GetInstalledApps());
                            break;

                        case "START_APP":
                            try 
                            {
                                string request = packet.param;
                                string fileNameToRun = request;

                                // [LOGIC THÔNG MINH] 
                                // Nếu thấy có dấu chấm (.) mà không có khoảng trắng -> Tự hiểu là Web
                                // Ví dụ: nhập "youtube.com" -> tự sửa thành "https://youtube.com"
                                if (request.Contains(".") && !request.Contains(" ") && !request.StartsWith("http"))
                                {
                                    fileNameToRun = "https://" + request;
                                }

                                // Chạy lệnh (Windows tự tìm ứng dụng phù hợp: Web -> Chrome/Edge)
                                Process.Start(new ProcessStartInfo { 
                                    FileName = fileNameToRun, 
                                    UseShellExecute = true 
                                });

                                SendJson(socket, "LOG", $"Đang mở: {fileNameToRun}...");
                                
                                // Cập nhật lại danh sách sau 2s để người dùng thấy trình duyệt hiện lên Task Manager
                                Task.Run(() => {
                                    Thread.Sleep(2000); 
                                    BroadcastJson("APP_LIST", GetCurrentApps());
                                });
                            } 
                            catch 
                            { 
                                SendJson(socket, "LOG", "Lỗi: Không thể mở yêu cầu này!"); 
                            }
                            break;
                        case "SHUTDOWN": Process.Start("shutdown", "/s /t 5"); break;
                        case "RESTART": Process.Start("shutdown", "/r /t 5"); break;
                        case "START_WEBCAM":
                            WebcamManager.StartWebcam();
                            // Đăng ký sự kiện: Khi có ảnh Webcam -> Gửi cho Client này
                            WebcamManager.OnFrameCaptured += (imgBytes) => {
                                // Gửi dạng binary (giống màn hình) nhưng ta cần phân biệt
                                // Ở đây để đơn giản, ta gửi dạng Base64 qua kênh JSON với type riêng
                                string base64 = Convert.ToBase64String(imgBytes);
                                SendJson(socket, "WEBCAM_FRAME", base64);
                            };
                            SendJson(socket, "LOG", "Đã bật Webcam Server");
                            break;

                        case "STOP_WEBCAM":
                            WebcamManager.StopWebcam();
                            SendJson(socket, "LOG", "Đã tắt Webcam");
                            break;

                        case "RECORD_WEBCAM":
                            int seconds = 10; // Mặc định 10s
                            int.TryParse(packet.param, out seconds);
                            
                            string result = WebcamManager.StartRecording(seconds);
                            SendJson(socket, "LOG", result);
                            break;

                        case "START_KEYLOG":
                            if (!KeyLoggerService.IsRunning)
                            {
                                // Chạy Keylogger và gửi kết quả về client
                                KeyLoggerService.StartHook((key) => {
                                    BroadcastLog($"[Keylogger] {key}");
                                });
                                SendJson(socket, "LOG", "Keylogger: Đã BẬT ghi phím.");
                            }
                            else
                            {
                                SendJson(socket, "LOG", "Keylogger đang chạy rồi!");
                            }
                            break;

                        case "STOP_KEYLOG":
                            if (KeyLoggerService.IsRunning)
                            {
                                KeyLoggerService.StopHook();
                                SendJson(socket, "LOG", "Keylogger: Đã TẮT ghi phím.");
                            }
                            else
                            {
                                SendJson(socket, "LOG", "Keylogger chưa được bật.");
                            }
                            break;
                        
                        case "GET_DRIVES": // Lấy danh sách ổ đĩa
                            SendJson(socket, "FILE_LIST", FileManagerService.GetDrives());
                            break;

                        case "GET_DIR": // Lấy nội dung thư mục
                            SendJson(socket, "FILE_LIST", FileManagerService.GetDirectoryContent(packet.param));
                            break;

                        case "DOWNLOAD_FILE": // Tải file về
                            string base64File = FileManagerService.GetFileContentBase64(packet.param);
                            if (base64File == "ERROR_SIZE_LIMIT")
                            {
                                SendJson(socket, "LOG", "Lỗi: File quá lớn (>50MB) để tải qua Web!");
                            }
                            else if (base64File != null)
                            {
                                // Gửi gói tin đặc biệt chứa tên file và nội dung
                                var payload = new { fileName = System.IO.Path.GetFileName(packet.param), data = base64File };
                                SendJson(socket, "FILE_DOWNLOAD_DATA", payload);
                                SendJson(socket, "LOG", "Đang tải xuống: " + System.IO.Path.GetFileName(packet.param));
                            }
                            else
                            {
                                SendJson(socket, "LOG", "Lỗi: Không đọc được file!");
                            }
                            break;

                        case "DELETE_FILE": // Xóa file
                            // Thêm ngoặc nhọn {} để tránh lỗi trùng tên biến result
                            { 
                                string deleteResult = FileManagerService.DeleteFile(packet.param);
                                if (deleteResult == "OK")
                                {
                                    SendJson(socket, "LOG", "Đã xóa file thành công!");
                                }
                                else
                                {
                                    SendJson(socket, "LOG", deleteResult);
                                }
                                break;
                            }

                        case "GET_SYS_INFO":
                            SendJson(socket, "SYS_INFO", SystemHelper.GetSystemInfo());
                            break;

                        case "GET_PERFORMANCE":
                            SendJson(socket, "PERF_STATS", SystemHelper.GetPerformanceStats());
                            break;
                        
                        case "UPLOAD_FILE":
                            try 
                            {
                                // Client sẽ gửi một chuỗi JSON chứa { fileName, path, data } trong packet.param
                                // Ta dùng dynamic để đọc nhanh mà không cần tạo class mới
                                dynamic uploadInfo = JsonConvert.DeserializeObject(packet.param);
                                
                                string targetFolder = uploadInfo.path;
                                string fileName = uploadInfo.fileName;
                                string base64Data = uploadInfo.data;

                                Console.WriteLine($">> Đang nhận file upload: {fileName}...");

                                string resultUpLoad = FileManagerService.SaveFileFromBase64(targetFolder, fileName, base64Data);

                                if (resultUpLoad == "OK")
                                {
                                    SendJson(socket, "LOG", $"Upload thành công: {fileName}");
                                    
                                    // Gửi lại danh sách file mới nhất để Client cập nhật giao diện ngay
                                    SendJson(socket, "FILE_LIST", FileManagerService.GetDirectoryContent(targetFolder));
                                }
                                else
                                {
                                    SendJson(socket, "LOG", resultUpLoad);
                                }
                            }
                            catch (Exception ex)
                            {
                                SendJson(socket, "LOG", "Lỗi xử lý Upload: " + ex.Message);
                            }
                            break;
                        
                        case "CREATE_FOLDER":
                            try
                            {
                                // Client gửi JSON: { path: "D:\\Data", name: "NewFolder" }
                                dynamic folderInfo = JsonConvert.DeserializeObject(packet.param);
                                string currentPath = folderInfo.path;
                                string newName = folderInfo.name;

                                string createResult = FileManagerService.CreateDirectory(currentPath, newName);

                                if (createResult == "OK")
                                {
                                    SendJson(socket, "LOG", $"Đã tạo thư mục: {newName}");
                                    // Tự động tải lại danh sách file để hiện thư mục mới
                                    SendJson(socket, "FILE_LIST", FileManagerService.GetDirectoryContent(currentPath));
                                }
                                else
                                {
                                    SendJson(socket, "LOG", createResult);
                                }
                            }
                            catch (Exception ex)
                            {
                                SendJson(socket, "LOG", "Lỗi xử lý tạo folder: " + ex.Message);
                            }
                            break;

                        case "MOUSE_MOVE":
                            try
                            {
                                dynamic pos = JsonConvert.DeserializeObject(packet.param);
                                SystemHelper.SetCursorPosition((double)pos.x, (double)pos.y);
                            }
                            catch { }
                            break;

                        case "MOUSE_CLICK":
                            try
                            {
                                dynamic clickInfo = JsonConvert.DeserializeObject(packet.param);
                                SystemHelper.MouseClick((string)clickInfo.btn, (string)clickInfo.action);
                            }
                            catch { }
                            break;

                        case "KEY_PRESS":
                            try
                            {
                                SystemHelper.SimulateKeyPress(packet.param);
                            }
                            catch { }
                            break;
                    }
                }
            }
            catch (Exception ex) { Console.WriteLine("Lỗi Handle: " + ex.Message); }
        }

        

        private static void ScreenStreamLoop()
        {
            byte[] lastSentFrame = null; 

            while (true)
            {
                if (isStreaming && allSockets.Count > 0)
                {
                    try 
                    {
                        byte[] currentFrame = SystemHelper.GetScreenShot(90L); 

                        if (currentFrame != null)
                        {
                            if (lastSentFrame != null && currentFrame.SequenceEqual(lastSentFrame))
                            {
                                Thread.Sleep(100); 
                                continue; 
                            }

                            lastSentFrame = currentFrame;

                            // --- CODE CŨ (Bạn đang gửi raw mà không có header) ---
                            // foreach (var socket in allSockets.ToList())
                            // {
                            //     if (socket.IsAvailable) socket.Send(currentFrame);
                            // }

                            // --- CODE MỚI (Dùng Binary Header 0x01) ---
                            BroadcastBinary(0x01, currentFrame);
                        }
                    }
                    catch (Exception ex) { Console.WriteLine("Lỗi Stream: " + ex.Message); }
                    Thread.Sleep(60); 
                }
                else
                {
                    Thread.Sleep(500);
                    lastSentFrame = null; 
                }
            }
        }
    }
}