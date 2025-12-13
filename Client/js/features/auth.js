import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';
import { CONFIG } from '../config.js';

export const AuthFeature = {
    init() {
        // Tự động điền thông tin mặc định từ Config (Dev mode)
        const ipInput = document.getElementById('server-ip');
        const portInput = document.getElementById('server-port');
        
        if(ipInput) ipInput.value = CONFIG.DEFAULT_IP;
        if(portInput) portInput.value = CONFIG.DEFAULT_PORT;

        // Lắng nghe sự kiện submit form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Chặn reload trang
                this.handleLogin();
            });
        }
    },

    async handleLogin() {
        const ip = document.getElementById('server-ip').value.trim();
        const port = document.getElementById('server-port').value.trim();
        const pass = document.getElementById('auth-pass').value.trim();

        if (!ip || !port) {
            UIManager.setLoginError("Vui lòng nhập IP và Port!");
            return;
        }

        UIManager.setLoginState("Đang kết nối...");

        try {
            // Gọi Service để kết nối
            await SocketService.connect(ip, port, pass);
            
            // Nếu thành công:
            UIManager.hideLoginScreen();
            
        } catch (error) {
            // Nếu thất bại:
            UIManager.setLoginError("Lỗi kết nối: " + error.message);
        }
    }
};