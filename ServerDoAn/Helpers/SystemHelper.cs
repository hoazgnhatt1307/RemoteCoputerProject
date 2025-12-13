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
        // Hàm chụp màn hình ĐA NĂNG (Đã sửa để nhận 2 tham số)
        // - quality: Chất lượng ảnh (0-100)
        // - scaleFactor: Tỉ lệ kích thước (1.0 = Gốc, 0.6 = Nhỏ hơn để Stream nhanh)
        public static byte[] GetScreenShot(long quality, double scaleFactor = 1.0)
        {
            try
            {
                // Lấy kích thước màn hình
                Rectangle bounds = Screen.PrimaryScreen.Bounds;

                using (Bitmap bitmap = new Bitmap(bounds.Width, bounds.Height))
                {
                    using (Graphics g = Graphics.FromImage(bitmap))
                    {
                        g.CopyFromScreen(Point.Empty, Point.Empty, bounds.Size);
                    }

                    // Nếu scaleFactor < 1.0 thì thực hiện thu nhỏ ảnh (Dùng cho Stream)
                    if (scaleFactor < 1.0)
                    {
                        int newW = (int)(bounds.Width * scaleFactor);
                        int newH = (int)(bounds.Height * scaleFactor);
                        using (Bitmap resized = new Bitmap(bitmap, newW, newH))
                        {
                            return CompressBitmap(resized, quality);
                        }
                    }
                    
                    // Nếu scaleFactor = 1.0 thì giữ nguyên kích thước (Dùng cho Capture HD)
                    return CompressBitmap(bitmap, quality);
                }
            }
            catch { return null; }
        }

        // Hàm nén ảnh JPEG riêng biệt
        private static byte[] CompressBitmap(Bitmap bmp, long quality)
        {
            using (MemoryStream ms = new MemoryStream())
            {
                ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
                EncoderParameters myEncoderParameters = new EncoderParameters(1);
                myEncoderParameters.Param[0] = new EncoderParameter(Encoder.Quality, quality);
                
                bmp.Save(ms, jpgEncoder, myEncoderParameters);
                return ms.ToArray();
            }
        }

        private static ImageCodecInfo GetEncoder(ImageFormat format)
        {
            return ImageCodecInfo.GetImageEncoders().FirstOrDefault(codec => codec.FormatID == format.Guid);
        }

        private static PerformanceCounter cpuCounter;
        private static PerformanceCounter ramCounter;

        public static void InitCounters()
        {
            try
            {
                // Khởi tạo bộ đếm hiệu năng (chỉ chạy trên Windows)
                cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                ramCounter = new PerformanceCounter("Memory", "Available MBytes");
                cpuCounter.NextValue(); // Gọi lần đầu thường trả về 0, cần gọi mồi
            }
            catch { }
        }

        public static object GetSystemInfo()
        {
            // Lấy tổng dung lượng RAM (Cách đơn giản cho .NET Core/5+)
            long totalRam = 0;
            try {
                 totalRam = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024 / 1024; // MB
            } catch {}

            return new
            {
                machineName = Environment.MachineName,
                userName = Environment.UserName,
                osVal = RuntimeInformation.OSDescription + " " + RuntimeInformation.OSArchitecture,
                totalRam = totalRam + " MB",
                cpuName = "Standard Processor" // Lấy tên CPU chính xác cần WMI, tạm thời để placeholder
            };
        }

        public static object GetPerformanceStats()
        {
            float cpu = 0;
            float ramAvail = 0;
            try
            {
                if (cpuCounter == null) InitCounters();
                cpu = cpuCounter.NextValue();
                ramAvail = ramCounter.NextValue();
            }
            catch { }

            return new
            {
                cpu = Math.Round(cpu, 1),
                ramFree = ramAvail
            };
        }
    }
}

