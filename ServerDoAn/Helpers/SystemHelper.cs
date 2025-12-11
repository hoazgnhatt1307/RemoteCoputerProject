using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Windows.Forms;

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
    }
}