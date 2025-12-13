using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace RemoteControlServer.Services
{
    public static class FileManagerService
    {
        // Struct đơn giản để trả về dữ liệu cho Client
        public class FileItem
        {
            public string Name { get; set; }
            public string Path { get; set; }
            public string Type { get; set; } // "DRIVE", "FOLDER", "FILE"
            public string Size { get; set; }
        }

        // 1. Lấy danh sách ổ đĩa (Gốc)
        public static List<FileItem> GetDrives()
        {
            var list = new List<FileItem>();
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady)
                {
                    list.Add(new FileItem {
                        Name = $"{drive.Name} ({drive.VolumeLabel})",
                        Path = drive.Name,
                        Type = "DRIVE",
                        Size = FormatSize(drive.TotalSize)
                    });
                }
            }
            return list;
        }

        // 2. Lấy nội dung trong thư mục
        public static object GetDirectoryContent(string path)
        {
            var list = new List<FileItem>();
            try
            {
                // Thêm nút ".." để quay lại (nếu không phải gốc ổ đĩa)
                DirectoryInfo di = new DirectoryInfo(path);
                if (di.Parent != null)
                {
                    list.Add(new FileItem { Name = "... (Back)", Path = di.Parent.FullName, Type = "BACK" });
                }

                // Lấy thư mục con
                foreach (var dir in Directory.GetDirectories(path))
                {
                    list.Add(new FileItem {
                        Name = Path.GetFileName(dir),
                        Path = dir,
                        Type = "FOLDER"
                    });
                }

                // Lấy file
                foreach (var file in Directory.GetFiles(path))
                {
                    FileInfo fi = new FileInfo(file);
                    list.Add(new FileItem {
                        Name = Path.GetFileName(file),
                        Path = file,
                        Type = "FILE",
                        Size = FormatSize(fi.Length)
                    });
                }
            }
            catch (Exception ex)
            {
                return new { error = "Lỗi truy cập: " + ex.Message };
            }
            return list;
        }

        // 3. Đọc file để tải về (Chuyển sang Base64)
        public static string GetFileContentBase64(string path)
        {
            try
            {
                if (!File.Exists(path)) return null;
                // Giới hạn dung lượng tải để tránh treo Server (Ví dụ: < 50MB)
                FileInfo fi = new FileInfo(path);
                if (fi.Length > 50 * 1024 * 1024) return "ERROR_SIZE_LIMIT";

                byte[] bytes = File.ReadAllBytes(path);
                return Convert.ToBase64String(bytes);
            }
            catch { return null; }
        }

        // 4. Xóa file
        public static string DeleteFile(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                    return "OK";
                }
                return "File không tồn tại!";
            }
            catch (Exception ex) { return "Lỗi: " + ex.Message; }
        }

        // Helper: Format dung lượng cho đẹp
        private static string FormatSize(long bytes)
        {
            string[] sizes = { "B", "KB", "MB", "GB", "TB" };
            double len = bytes;
            int order = 0;
            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len = len / 1024;
            }
            return $"{len:0.##} {sizes[order]}";
        }

        // 5. Lưu file từ Base64 (Upload)
        public static string SaveFileFromBase64(string folderPath, string fileName, string base64Data)
        {
            try
            {
                // Kiểm tra đường dẫn
                if (!Directory.Exists(folderPath)) return "Thư mục không tồn tại!";

                string fullPath = Path.Combine(folderPath, fileName);

                // Chuyển Base64 -> Byte array
                byte[] bytes = Convert.FromBase64String(base64Data);

                // Ghi xuống ổ cứng
                File.WriteAllBytes(fullPath, bytes);

                return "OK";
            }
            catch (Exception ex)
            {
                return "Lỗi Upload: " + ex.Message;
            }
        }

        // [THÊM MỚI] 6. Tạo thư mục mới
        public static string CreateDirectory(string parentPath, string folderName)
        {
            try
            {
                if (!Directory.Exists(parentPath)) return "Thư mục cha không tồn tại!";
                
                string fullPath = Path.Combine(parentPath, folderName);
                
                if (Directory.Exists(fullPath)) return "Thư mục này đã tồn tại!";
                
                Directory.CreateDirectory(fullPath);
                return "OK";
            }
            catch (Exception ex)
            {
                return "Lỗi tạo folder: " + ex.Message;
            }
        }
    }
}

