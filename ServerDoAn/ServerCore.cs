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
                            var appList = Process.GetProcesses()
                                .Where(p => !string.IsNullOrEmpty(p.MainWindowTitle))
                                .Select(p => new { id = p.Id, name = p.ProcessName, title = p.MainWindowTitle }).ToList();
                            SendJson(socket, "APP_LIST", appList);
                            break;
                        case "GET_PROCESS":
                            var procList = Process.GetProcesses().Select(p => new {
                                id = p.Id,
                                name = p.ProcessName,
                                memory = (p.WorkingSet64 / 1024 / 1024) + " MB"
                            }).OrderByDescending(p => p.id).ToList();
                            SendJson(socket, "PROCESS_LIST", procList);
                            break;
                        case "KILL":
                            try {
                                Process.GetProcessById(int.Parse(packet.param)).Kill();
                                SendJson(socket, "LOG", $"Đã diệt ID {packet.param}");
                            } catch { SendJson(socket, "LOG", "Lỗi Kill Process"); }
                            break;
                        case "START_APP":
                            try {
                                Process.Start(new ProcessStartInfo { FileName = packet.param, UseShellExecute = true });
                                SendJson(socket, "LOG", $"Đã mở: {packet.param}");
                            } catch { SendJson(socket, "LOG", "Lỗi mở App"); }
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