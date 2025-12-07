using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace RemoteControlServer
{
    public static class SystemHelper
    {
        // Hàm chụp màn hình và nén ảnh JPEG
        public static byte[] GetScreenShot(long quality)
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
                    using (MemoryStream ms = new MemoryStream())
                    {
                        ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
                        EncoderParameters myEncoderParameters = new EncoderParameters(1);
                        myEncoderParameters.Param[0] = new EncoderParameter(Encoder.Quality, quality);
                        
                        bitmap.Save(ms, jpgEncoder, myEncoderParameters);
                        return ms.ToArray();
                    }
                }
            }
            catch { return null; }
        }

        private static ImageCodecInfo GetEncoder(ImageFormat format)
        {
            return ImageCodecInfo.GetImageEncoders().FirstOrDefault(codec => codec.FormatID == format.Guid);
        }
    }
}