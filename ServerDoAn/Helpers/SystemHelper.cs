// using System;
// using System.Drawing;
// using System.Drawing.Imaging;
// using System.IO;
// using System.Linq;
// using System.Windows.Forms;
// using System.Diagnostics;
// using System.Runtime.InteropServices;

// namespace RemoteControlServer.Helpers
// {
//     public static class SystemHelper
//     {
//         // Hàm chụp màn hình ĐA NĂNG (Đã sửa để nhận 2 tham số)
//         // - quality: Chất lượng ảnh (0-100)
//         // - scaleFactor: Tỉ lệ kích thước (1.0 = Gốc, 0.6 = Nhỏ hơn để Stream nhanh)
//         public static byte[] GetScreenShot(long quality, double scaleFactor = 1.0)
//         {
//             try
//             {
//                 // Lấy kích thước màn hình
//                 Rectangle bounds = Screen.PrimaryScreen.Bounds;

//                 using (Bitmap bitmap = new Bitmap(bounds.Width, bounds.Height))
//                 {
//                     using (Graphics g = Graphics.FromImage(bitmap))
//                     {
//                         g.CopyFromScreen(Point.Empty, Point.Empty, bounds.Size);
//                     }

//                     // Nếu scaleFactor < 1.0 thì thực hiện thu nhỏ ảnh (Dùng cho Stream)
//                     if (scaleFactor < 1.0)
//                     {
//                         int newW = (int)(bounds.Width * scaleFactor);
//                         int newH = (int)(bounds.Height * scaleFactor);
//                         using (Bitmap resized = new Bitmap(bitmap, newW, newH))
//                         {
//                             return CompressBitmap(resized, quality);
//                         }
//                     }
                    
//                     // Nếu scaleFactor = 1.0 thì giữ nguyên kích thước (Dùng cho Capture HD)
//                     return CompressBitmap(bitmap, quality);
//                 }
//             }
//             catch { return null; }
//         }

//         // Hàm nén ảnh JPEG riêng biệt
//         private static byte[] CompressBitmap(Bitmap bmp, long quality)
//         {
//             using (MemoryStream ms = new MemoryStream())
//             {
//                 ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
//                 EncoderParameters myEncoderParameters = new EncoderParameters(1);
//                 myEncoderParameters.Param[0] = new EncoderParameter(Encoder.Quality, quality);
                
//                 bmp.Save(ms, jpgEncoder, myEncoderParameters);
//                 return ms.ToArray();
//             }
//         }

//         private static ImageCodecInfo GetEncoder(ImageFormat format)
//         {
//             return ImageCodecInfo.GetImageEncoders().FirstOrDefault(codec => codec.FormatID == format.Guid);
//         }

//         private static PerformanceCounter cpuCounter;
//         private static PerformanceCounter ramCounter;

//         public static void InitCounters()
//         {
//             try
//             {
//                 // Khởi tạo bộ đếm hiệu năng (chỉ chạy trên Windows)
//                 cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
//                 ramCounter = new PerformanceCounter("Memory", "Available MBytes");
//                 cpuCounter.NextValue(); // Gọi lần đầu thường trả về 0, cần gọi mồi
//             }
//             catch { }
//         }

//         public static object GetSystemInfo()
//         {
//             // Lấy tổng dung lượng RAM (Cách đơn giản cho .NET Core/5+)
//             long totalRam = 0;
//             try {
//                  totalRam = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024 / 1024; // MB
//             } catch {}

//             return new
//             {
//                 machineName = Environment.MachineName,
//                 userName = Environment.UserName,
//                 osVal = RuntimeInformation.OSDescription + " " + RuntimeInformation.OSArchitecture,
//                 totalRam = totalRam + " MB",
//                 cpuName = "Standard Processor" // Lấy tên CPU chính xác cần WMI, tạm thời để placeholder
//             };
//         }

//         public static object GetPerformanceStats()
//         {
//             float cpu = 0;
//             float ramAvail = 0;
//             try
//             {
//                 if (cpuCounter == null) InitCounters();
//                 cpu = cpuCounter.NextValue();
//                 ramAvail = ramCounter.NextValue();
//             }
//             catch { }

//             return new
//             {
//                 cpu = Math.Round(cpu, 1),
//                 ramFree = ramAvail
//             };
//         }

//         [DllImport("user32.dll")]
//         static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

//         private const int MOUSEEVENTF_MOVE = 0x0001;
//         private const int MOUSEEVENTF_LEFTDOWN = 0x0002;
//         private const int MOUSEEVENTF_LEFTUP = 0x0004;
//         private const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
//         private const int MOUSEEVENTF_RIGHTUP = 0x0010;
//         private const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
//         private const int MOUSEEVENTF_MIDDLEUP = 0x0040;
//         private const int MOUSEEVENTF_ABSOLUTE = 0x8000;

//         // 1. Hàm di chuyển chuột
//         public static void SetCursorPosition(double xPercent, double yPercent)
//         {
//             // Lấy độ phân giải màn hình Server
//             int screenWidth = 1920; // Giá trị mặc định nếu không lấy được
//             int screenHeight = 1080;
            
//             // Cách lấy độ phân giải thực tế (nếu dùng Windows Forms)
//             // screenWidth = System.Windows.Forms.Screen.PrimaryScreen.Bounds.Width;
//             // screenHeight = System.Windows.Forms.Screen.PrimaryScreen.Bounds.Height;
//             // Tạm thời hardcode hoặc bạn tự thêm thư viện System.Windows.Forms

//             int x = (int)(xPercent * screenWidth);
//             int y = (int)(yPercent * screenHeight);

//             // Set vị trí con trỏ
//             SetCursorPos(x, y);
//         }

//         [DllImport("user32.dll")]
//         [return: MarshalAs(UnmanagedType.Bool)]
//         static extern bool SetCursorPos(int x, int y);

//         // 2. Hàm Click chuột
//         public static void MouseClick(string button, string action)
//         {
//             int flags = 0;
//             if (button == "left")
//             {
//                 if (action == "down") flags = MOUSEEVENTF_LEFTDOWN;
//                 else if (action == "up") flags = MOUSEEVENTF_LEFTUP;
//             }
//             else if (button == "right")
//             {
//                 if (action == "down") flags = MOUSEEVENTF_RIGHTDOWN;
//                 else if (action == "up") flags = MOUSEEVENTF_RIGHTUP;
//             }

//             mouse_event(flags, 0, 0, 0, 0);
//         }

//         // 3. Hàm Gõ phím
//         public static void SimulateKeyPress(string key)
//         {
//             // Sử dụng SendKeys cho đơn giản (Cần add reference System.Windows.Forms)
//             // Hoặc dùng keybd_event nếu muốn chuyên sâu hơn
//             try
//             {
//                 // Xử lý các phím đặc biệt từ Client gửi về
//                 switch (key)
//                 {
//                     case "Enter": System.Windows.Forms.SendKeys.SendWait("{ENTER}"); break;
//                     case "Backspace": System.Windows.Forms.SendKeys.SendWait("{BACKSPACE}"); break;
//                     case "Escape": System.Windows.Forms.SendKeys.SendWait("{ESC}"); break;
//                     case "Tab": System.Windows.Forms.SendKeys.SendWait("{TAB}"); break;
//                     default: 
//                         // Chỉ gửi ký tự thường (a, b, c, 1, 2...)
//                         if(key.Length == 1) System.Windows.Forms.SendKeys.SendWait(key);
//                         break;
//                 }
//             }
//             catch { }
//         }
//     }
// }

using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace RemoteControlServer.Helpers
{
    public static class SystemHelper
    {
        // --- PHẦN 1: CHỤP MÀN HÌNH (CŨ) ---
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
                    if (scaleFactor < 1.0)
                    {
                        int newW = (int)(bounds.Width * scaleFactor);
                        int newH = (int)(bounds.Height * scaleFactor);
                        using (Bitmap resized = new Bitmap(bitmap, newW, newH))
                        {
                            return ImageToByte(resized, quality);
                        }
                    }
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
            EncoderParameter myEncoderParameter = new EncoderParameter(myEncoder, quality);
            myEncoderParameters.Param[0] = myEncoderParameter;

            using (MemoryStream ms = new MemoryStream())
            {
                img.Save(ms, jpgEncoder, myEncoderParameters);
                return ms.ToArray();
            }
        }

        private static ImageCodecInfo GetEncoder(ImageFormat format)
        {
            ImageCodecInfo[] codecs = ImageCodecInfo.GetImageDecoders();
            foreach (ImageCodecInfo codec in codecs)
            {
                if (codec.FormatID == format.Guid) return codec;
            }
            return null;
        }

        public static object GetSystemInfo()
        {
            return new
            {
                os = Environment.OSVersion.ToString(),
                machine = Environment.MachineName,
                user = Environment.UserName,
                cpu = Environment.ProcessorCount + " Cores",
                drives = string.Join(", ", DriveInfo.GetDrives().Where(d => d.IsReady).Select(d => d.Name))
            };
        }

        public static object GetPerformanceStats()
        {
            var ram = new Microsoft.VisualBasic.Devices.ComputerInfo();
            float cpuUsage = 0; // Cần PerformanceCounter nhưng để đơn giản ta bỏ qua hoặc fix cứng
            
            return new
            {
                cpu = cpuUsage + "%",
                ram = $"{ram.AvailablePhysicalMemory / 1024 / 1024} MB free / {ram.TotalPhysicalMemory / 1024 / 1024} MB total"
            };
        }

        public static void InitCounters() { } // Placeholder

        // --- PHẦN 2: ĐIỀU KHIỂN CHUỘT & PHÍM (MỚI THÊM) ---

        [DllImport("user32.dll")]
        static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

        // Các cờ sự kiện chuột
        private const int MOUSEEVENTF_MOVE = 0x0001;
        private const int MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const int MOUSEEVENTF_LEFTUP = 0x0004;
        private const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const int MOUSEEVENTF_RIGHTUP = 0x0010;
        private const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const int MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const int MOUSEEVENTF_ABSOLUTE = 0x8000; // <--- Cờ quan trọng nhất

        // Hàm di chuyển chuột MỚI: Dùng tọa độ chuẩn hóa (0 - 65535)
        public static void SetCursorPosition(double xPercent, double yPercent)
        {
            // Windows quy định toàn màn hình là từ 0 đến 65535
            int dx = (int)(xPercent * 65535);
            int dy = (int)(yPercent * 65535);

            // Gửi lệnh di chuyển tuyệt đối
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
                // Mapping đơn giản một số phím đặc biệt
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
                    default:
                        if (key.Length == 1) SendKeys.SendWait(key);
                        break;
                }
            }
            catch { }
        }
    }
}