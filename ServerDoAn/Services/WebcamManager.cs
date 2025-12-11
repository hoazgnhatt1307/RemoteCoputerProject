using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using OpenCvSharp;

namespace RemoteControlServer.Services
{
    public static class WebcamManager
    {
        private static VideoCapture _capture;
        private static bool _isStreaming = false;
        private static VideoWriter _writer;
        private static bool _isRecording = false;
        private static Thread _cameraThread;
        
        // Biến lưu thông tin ghi hình
        private static DateTime _stopRecordTime;
        private static string _currentSavePath;

        // Sự kiện: 
        // 1. Gửi ảnh Stream (xem live)
        // 2. Báo tin đã lưu file xong (để gửi qua socket)
        public static event Action<byte[]> OnFrameCaptured;
        public static event Action<string> OnVideoSaved; 

        public static void StartWebcam()
        {
            if (_isStreaming) return;
            _isStreaming = true;
            _cameraThread = new Thread(CameraLoop) { IsBackground = true };
            _cameraThread.Start();
        }

        public static void StopWebcam()
        {
            _isStreaming = false;
            _isRecording = false;
            Thread.Sleep(500); 

            _capture?.Release();
            _capture = null;
            _writer?.Release();
            _writer = null;
        }

        public static string StartRecording(int durationSeconds)
        {
            if (!_isStreaming) return "Lỗi: Hãy bật Webcam trước!";
            if (_isRecording) return "Đang ghi hình rồi!";

            try
            {
                // 1. Lưu vào thư mục Temp của hệ thống để tránh lỗi quyền truy cập
                string tempFolder = Path.GetTempPath(); 
                string fileName = $"Rec_{DateTime.Now:HHmmss}.avi";
                _currentSavePath = Path.Combine(tempFolder, fileName);

                // 2. Thiết lập thời gian dừng
                _stopRecordTime = DateTime.Now.AddSeconds(durationSeconds);
                _isRecording = true; 

                return $"Server đang xử lý... ({durationSeconds}s)";
            }
            catch (Exception ex)
            {
                return "Lỗi StartRecord: " + ex.Message;
            }
        }

        private static void StopRecording()
        {
            if (!_isRecording) return;
            _isRecording = false;
            
            // Đợi một chút để ghi nốt frame cuối
            Thread.Sleep(200); 

            if (_writer != null)
            {
                _writer.Release();
                _writer = null;
                
                Console.WriteLine($">> Đã tạo file tạm: {_currentSavePath}");
                
                // --- QUAN TRỌNG: Bắn sự kiện báo cho ServerCore biết để gửi file ---
                OnVideoSaved?.Invoke(_currentSavePath);
            }
        }

        private static void CameraLoop()
        {
            try 
            {
                // Mở Camera (Ưu tiên DSHOW cho Windows)
                _capture = new VideoCapture(0, VideoCaptureAPIs.DSHOW);
                if (!_capture.IsOpened()) _capture = new VideoCapture(0);

                if (!_capture.IsOpened())
                {
                    _isStreaming = false;
                    return;
                }

                Mat frame = new Mat();

                while (_isStreaming)
                {
                    _capture.Read(frame);
                    if (!frame.Empty())
                    {
                        // --- PHẦN GHI HÌNH (Lưu tạm ở Server) ---
                        if (_isRecording)
                        {
                            // Tự động khởi tạo Writer theo kích thước thật của Camera
                            if (_writer == null || !_writer.IsOpened())
                            {
                                int w = frame.Width;
                                int h = frame.Height;
                                // Dùng MJPG cho an toàn, tương thích mọi Windows
                                _writer = new VideoWriter(_currentSavePath, FourCC.MJPG, 15, new OpenCvSharp.Size(w, h));
                            }

                            if (_writer.IsOpened()) _writer.Write(frame);

                            // Kiểm tra thời gian dừng
                            if (DateTime.Now >= _stopRecordTime) StopRecording();
                        }

                        // --- PHẦN STREAM (Gửi ảnh xem live) ---
                        if (OnFrameCaptured != null)
                        {
                            var bytes = frame.ImEncode(".jpg", new int[] { (int)ImwriteFlags.JpegQuality, 50 });
                            OnFrameCaptured.Invoke(bytes);
                        }
                    }
                    else
                    {
                        Thread.Sleep(10);
                    }
                    // Giới hạn FPS để đỡ lag
                    Thread.Sleep(30); 
                }
            }
            catch { _isStreaming = false; }
        }
    }
}