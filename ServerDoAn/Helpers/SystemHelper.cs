using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Management;
using System.Windows.Forms;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace RemoteControlServer.Helpers
{
    public static class SystemHelper
    {
        // --- 1. PERFORMANCE COUNTERS (CPU & RAM) ---
        private static PerformanceCounter cpuCounter;
        private static PerformanceCounter ramCounter;

        public static void InitCounters()
        {
            try
            {
                // Cần gói NuGet: System.Diagnostics.PerformanceCounter (nếu chạy .NET Core/5/6/7/8)
                cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                ramCounter = new PerformanceCounter("Memory", "Available MBytes");
                cpuCounter.NextValue(); // Gọi lần đầu để khởi động bộ đếm
            }
            catch { }
        }

        // --- 2. HỆ THỐNG & PHẦN CỨNG (Sử dụng WMI) ---
        public static object GetSystemInfo()
        {
            string gpuName = "Unknown GPU";
            string vram = "N/A";

            // Lấy thông tin GPU
            try
            {
                using (var searcher = new ManagementObjectSearcher("select * from Win32_VideoController"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        gpuName = obj["Name"]?.ToString();
                        
                        // Lấy VRAM (AdapterRAM trả về byte -> đổi sang GB)
                        if (obj["AdapterRAM"] != null)
                        {
                            long bytes = Convert.ToInt64(obj["AdapterRAM"]);
                            // Nếu VRAM quá nhỏ (<0) do lỗi đọc, lấy trị tuyệt đối hoặc bỏ qua
                            if (bytes > 0) 
                                vram = (bytes / 1024 / 1024 / 1024) + " GB";
                        }
                        break; // Chỉ lấy GPU đầu tiên
                    }
                }
            }
            catch { gpuName = "Standard Graphics"; }

            // Lấy thông tin ổ cứng C:
            var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady && d.Name.StartsWith("C"));
            string diskInfo = drive != null ? $"{drive.TotalSize / 1024 / 1024 / 1024} GB" : "N/A";

            return new
            {
                os = Environment.OSVersion.ToString(),
                pcName = Environment.MachineName,
                cpuName = "Intel/AMD Processor", // WMI lấy tên CPU hơi chậm nên tạm để text này
                gpuName = gpuName,
                vram = vram,
                totalDisk = diskInfo
            };
        }

        public static object GetPerformanceStats()
        {
            float cpu = 0;
            float ramAvailable = 0;

            try 
            {
                if (cpuCounter != null) cpu = cpuCounter.NextValue();
                if (ramCounter != null) ramAvailable = ramCounter.NextValue();
            } 
            catch { }

            // Tính % Disk C usage
            var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady && d.Name.StartsWith("C"));
            double diskPercent = 0;
            if(drive != null)
            {
                diskPercent = 100 * (1.0 - ((double)drive.TotalFreeSpace / drive.TotalSize));
            }

            return new
            {
                cpu = (int)cpu,
                ramFree = (int)ramAvailable, // Trả về số MB còn trống
                diskUsage = (int)diskPercent
            };
        }

        // --- 3. CHỤP MÀN HÌNH (Đã tối ưu Scale) ---
        public static byte[] GetScreenShot(long quality, double scaleFactor = 1.0)
        {
            try
            {
                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                using (Bitmap bitmap = new Bitmap(bounds.Width, bounds.Height))
                {
                    using (Graphics g = Graphics.FromImage(bitmap))
                    {
                        g.CopyFromScreen(Point.Empty, Point.Empty, bounds.Size);
                    }

                    // Nếu cần thu nhỏ (để stream nhanh hơn)
                    if (scaleFactor < 1.0)
                    {
                        int newW = (int)(bounds.Width * scaleFactor);
                        int newH = (int)(bounds.Height * scaleFactor);
                        using (Bitmap resized = new Bitmap(bitmap, newW, newH))
                        {
                            return ImageToByte(resized, quality);
                        }
                    }
                    
                    // Giữ nguyên kích thước
                    return ImageToByte(bitmap, quality);
                }
            }
            catch { return null; }
        }

        private static byte[] ImageToByte(Bitmap img, long quality)
        {
            ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
            System.Drawing.Imaging.Encoder myEncoder = System.Drawing.Imaging.Encoder.Quality;
            EncoderParameters myEncoderParameters = new EncoderParameters(1);
            myEncoderParameters.Param[0] = new EncoderParameter(myEncoder, quality);

            using (MemoryStream ms = new MemoryStream())
            {
                img.Save(ms, jpgEncoder, myEncoderParameters);
                return ms.ToArray();
            }
        }

        private static ImageCodecInfo GetEncoder(ImageFormat format)
        {
            return ImageCodecInfo.GetImageDecoders().FirstOrDefault(codec => codec.FormatID == format.Guid);
        }

        // --- 4. ĐIỀU KHIỂN CHUỘT & PHÍM (WinAPI) ---
        
        [DllImport("user32.dll")]
        static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

        private const int MOUSEEVENTF_MOVE = 0x0001;
        private const int MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const int MOUSEEVENTF_LEFTUP = 0x0004;
        private const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const int MOUSEEVENTF_RIGHTUP = 0x0010;
        private const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const int MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const int MOUSEEVENTF_ABSOLUTE = 0x8000;

        // Hàm di chuyển chuột tuyệt đối (dựa trên % màn hình)
        public static void SetCursorPosition(double xPercent, double yPercent)
        {
            // Windows map toàn bộ màn hình vào tọa độ 0-65535
            int dx = (int)(xPercent * 65535);
            int dy = (int)(yPercent * 65535);
            mouse_event(MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE, dx, dy, 0, 0);
        }

        public static void MouseClick(string button, string action)
        {
            int flags = 0;
            if (button == "left")
                flags = (action == "down") ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
            else if (button == "right")
                flags = (action == "down") ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
            else if (button == "middle")
                flags = (action == "down") ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;

            mouse_event(flags, 0, 0, 0, 0);
        }

        public static void SimulateKeyPress(string key)
        {
            try
            {
                switch (key)
                {
                    case "Enter": SendKeys.SendWait("{ENTER}"); break;
                    case "Backspace": SendKeys.SendWait("{BACKSPACE}"); break;
                    case "Escape": SendKeys.SendWait("{ESC}"); break;
                    case "Tab": SendKeys.SendWait("{TAB}"); break;
                    case "ArrowUp": SendKeys.SendWait("{UP}"); break;
                    case "ArrowDown": SendKeys.SendWait("{DOWN}"); break;
                    case "ArrowLeft": SendKeys.SendWait("{LEFT}"); break;
                    case "ArrowRight": SendKeys.SendWait("{RIGHT}"); break;
                    // Xử lý các ký tự thường
                    default:
                        if (key.Length == 1) SendKeys.SendWait(key);
                        break;
                }
            }
            catch { }
        }
    }
}

// using System;
// using System.Drawing;
// using System.Drawing.Imaging;
// using System.IO;
// using System.Linq;
// using System.Management;
// using System.Windows.Forms;
// using System.Diagnostics;
// using System.Runtime.InteropServices;

// namespace RemoteControlServer.Helpers
// {
//     public static class SystemHelper
//     {
//         // --- PHẦN 1: CHỤP MÀN HÌNH (CŨ) ---
//         public static byte[] GetScreenShot(long quality, double scaleFactor = 1.0)
//         {
//             try
//             {
//                 Rectangle bounds = Screen.PrimaryScreen.Bounds;
//                 using (Bitmap bitmap = new Bitmap(bounds.Width, bounds.Height))
//                 {
//                     using (Graphics g = Graphics.FromImage(bitmap))
//                     {
//                         g.CopyFromScreen(Point.Empty, Point.Empty, bounds.Size);
//                     }
//                     if (scaleFactor < 1.0)
//                     {
//                         int newW = (int)(bounds.Width * scaleFactor);
//                         int newH = (int)(bounds.Height * scaleFactor);
//                         using (Bitmap resized = new Bitmap(bitmap, newW, newH))
//                         {
//                             return ImageToByte(resized, quality);
//                         }
//                     }
//                     return ImageToByte(bitmap, quality);
//                 }
//             }
//             catch { return null; }
//         }

//         private static byte[] ImageToByte(Bitmap img, long quality)
//         {
//             ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
//             System.Drawing.Imaging.Encoder myEncoder = System.Drawing.Imaging.Encoder.Quality;
//             EncoderParameters myEncoderParameters = new EncoderParameters(1);
//             EncoderParameter myEncoderParameter = new EncoderParameter(myEncoder, quality);
//             myEncoderParameters.Param[0] = myEncoderParameter;

//             using (MemoryStream ms = new MemoryStream())
//             {
//                 img.Save(ms, jpgEncoder, myEncoderParameters);
//                 return ms.ToArray();
//             }
//         }

//         private static ImageCodecInfo GetEncoder(ImageFormat format)
//         {
//             ImageCodecInfo[] codecs = ImageCodecInfo.GetImageDecoders();
//             foreach (ImageCodecInfo codec in codecs)
//             {
//                 if (codec.FormatID == format.Guid) return codec;
//             }
//             return null;
//         }

//         public static object GetSystemInfo()
//         {
//             return new
//             {
//                 os = Environment.OSVersion.ToString(),
//                 machine = Environment.MachineName,
//                 user = Environment.UserName,
//                 cpu = Environment.ProcessorCount + " Cores",
//                 drives = string.Join(", ", DriveInfo.GetDrives().Where(d => d.IsReady).Select(d => d.Name))
//             };
//         }

//         public static object GetPerformanceStats()
//         {
//             var ram = new Microsoft.VisualBasic.Devices.ComputerInfo();
//             float cpuUsage = 0; // Cần PerformanceCounter nhưng để đơn giản ta bỏ qua hoặc fix cứng
            
//             return new
//             {
//                 cpu = cpuUsage + "%",
//                 ram = $"{ram.AvailablePhysicalMemory / 1024 / 1024} MB free / {ram.TotalPhysicalMemory / 1024 / 1024} MB total"
//             };
//         }

//         public static void InitCounters() { } // Placeholder

//         // --- PHẦN 2: ĐIỀU KHIỂN CHUỘT & PHÍM (MỚI THÊM) ---

//         [DllImport("user32.dll")]
//         static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

//         // Các cờ sự kiện chuột
//         private const int MOUSEEVENTF_MOVE = 0x0001;
//         private const int MOUSEEVENTF_LEFTDOWN = 0x0002;
//         private const int MOUSEEVENTF_LEFTUP = 0x0004;
//         private const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
//         private const int MOUSEEVENTF_RIGHTUP = 0x0010;
//         private const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
//         private const int MOUSEEVENTF_MIDDLEUP = 0x0040;
//         private const int MOUSEEVENTF_ABSOLUTE = 0x8000; // <--- Cờ quan trọng nhất

//         // Hàm di chuyển chuột MỚI: Dùng tọa độ chuẩn hóa (0 - 65535)
//         public static void SetCursorPosition(double xPercent, double yPercent)
//         {
//             // Windows quy định toàn màn hình là từ 0 đến 65535
//             int dx = (int)(xPercent * 65535);
//             int dy = (int)(yPercent * 65535);

//             // Gửi lệnh di chuyển tuyệt đối
//             mouse_event(MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE, dx, dy, 0, 0);
//         }

//         public static void MouseClick(string button, string action)
//         {
//             int flags = 0;
//             if (button == "left")
//                 flags = (action == "down") ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
//             else if (button == "right")
//                 flags = (action == "down") ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
//             else if (button == "middle")
//                 flags = (action == "down") ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;

//             mouse_event(flags, 0, 0, 0, 0);
//         }

//         public static void SimulateKeyPress(string key)
//         {
//             try
//             {
//                 // Mapping đơn giản một số phím đặc biệt
//                 switch (key)
//                 {
//                     case "Enter": SendKeys.SendWait("{ENTER}"); break;
//                     case "Backspace": SendKeys.SendWait("{BACKSPACE}"); break;
//                     case "Escape": SendKeys.SendWait("{ESC}"); break;
//                     case "Tab": SendKeys.SendWait("{TAB}"); break;
//                     case "ArrowUp": SendKeys.SendWait("{UP}"); break;
//                     case "ArrowDown": SendKeys.SendWait("{DOWN}"); break;
//                     case "ArrowLeft": SendKeys.SendWait("{LEFT}"); break;
//                     case "ArrowRight": SendKeys.SendWait("{RIGHT}"); break;
//                     default:
//                         if (key.Length == 1) SendKeys.SendWait(key);
//                         break;
//                 }
//             }
//             catch { }
//         }
//     }
// }