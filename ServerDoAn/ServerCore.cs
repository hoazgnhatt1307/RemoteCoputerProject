using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Fleck;
using Newtonsoft.Json;

namespace RemoteControlServer
{
    public class ServerCore
    {
        private static List<IWebSocketConnection> allSockets = new List<IWebSocketConnection>();
        private static bool isStreaming = false;
        private const string SERVER_PASSWORD = "123";

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

            // Khởi chạy tác vụ Stream chạy ngầm
            Task.Run(() => ScreenStreamLoop());
        }

        public static void BroadcastLog(string message)
        {
            BroadcastJson("LOG", message);
        }

        private static void BroadcastJson(string type, object payload)
        {
            var json = JsonConvert.SerializeObject(new { type = type, payload = payload });
            foreach (var socket in allSockets.ToList()) socket.Send(json);
        }

        private static void SendJson(IWebSocketConnection socket, string type, object payload)
        {
            if (socket.IsAvailable)
            {
                var json = JsonConvert.SerializeObject(new { type = type, payload = payload });
                socket.Send(json);
            }
        }

        private static void HandleClientCommand(IWebSocketConnection socket, string jsonMessage)
        {
            try
            {
                var packet = JsonConvert.DeserializeObject<WebPacket>(jsonMessage);

                // 1. Auth
                if (packet.type == "AUTH")
                {
                    if (packet.payload == SERVER_PASSWORD)
                    {
                        SendJson(socket, "AUTH_RESULT", "OK");
                        Console.WriteLine("-> Login OK");
                    }
                    else SendJson(socket, "AUTH_RESULT", "FAIL");
                    return;
                }

                // 2. Command Processing
                if (!string.IsNullOrEmpty(packet.command))
                {
                    Console.WriteLine($"[CMD]: {packet.command} | {packet.param}");
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
                            var imgBytes = SystemHelper.GetScreenShot(85L);
                            if (imgBytes != null)
                                SendJson(socket, "SCREEN_CAPTURE", Convert.ToBase64String(imgBytes));
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
                    }
                }
            }
            catch (Exception ex) { Console.WriteLine("Lỗi Handle: " + ex.Message); }
        }

        

        private static void ScreenStreamLoop()
        {
            while (true)
            {
                if (isStreaming && allSockets.Count > 0)
                {
                    byte[] frame = SystemHelper.GetScreenShot(40L); // Chất lượng thấp để mượt
                    if (frame != null)
                    {
                        foreach (var socket in allSockets.ToList())
                            if (socket.IsAvailable) socket.Send(frame);
                    }
                    Thread.Sleep(60); // ~15 FPS
                }
                else
                {
                    Thread.Sleep(500);
                }
            }
        }


    }
}

