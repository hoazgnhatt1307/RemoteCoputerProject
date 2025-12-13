/**
 * UI UTILITIES MODULE
 * Quản lý các thành phần giao diện chung: Toast, Login Screen, Modal.
 */

export const UIManager = {
    
    /**
     * Hiển thị thông báo góc màn hình
     * @param {string} message - Nội dung
     * @param {string} type - 'info' | 'success' | 'error'
     */
    showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast-msg ${type}`;
        
        let icon = "info-circle";
        if (type === "success") icon = "check-circle";
        if (type === "error") icon = "exclamation-circle";

        // Map type sang màu class CSS (nếu cần xử lý thêm icon color)
        let colorClass = "text-primary";
        if (type === "success") colorClass = "text-success";
        if (type === "error") colorClass = "text-danger";

        toast.innerHTML = `<i class="fas fa-${icon} ${colorClass}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = "fadeOut 0.5s ease-out forwards";
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    /**
     * Cập nhật trạng thái màn hình Login
     * @param {string} text - Text hiển thị lỗi hoặc trạng thái
     */
    setLoginState(text) {
        const errorLabel = document.getElementById("login-error");
        if(errorLabel) errorLabel.textContent = text;
    },

    setLoginError(message) {
        this.setLoginState(message);
        this.showToast(message, "error");
    },

    /**
     * Ẩn màn hình Login và kích hoạt giao diện chính
     */
    hideLoginScreen() {
        const overlay = document.getElementById("login-overlay");
        if(overlay) {
            overlay.style.opacity = "0";
            setTimeout(() => {
                overlay.style.display = "none";
                document.getElementById("app-wrapper").classList.remove("disabled-ui");
            }, 500);
        }
        this.updateConnectionBadge(true);
        this.showToast("Connected to System!", "success");
    },

    /**
     * Hiện màn hình Login (khi disconnect)
     */
    showLoginScreen() {
        const overlay = document.getElementById("login-overlay");
        if(overlay) {
            overlay.style.display = "flex";
            setTimeout(() => overlay.style.opacity = "1", 10);
            document.getElementById("app-wrapper").classList.add("disabled-ui");
        }
        this.updateConnectionBadge(false);
    },

    updateConnectionBadge(isOnline) {
        const badge = document.getElementById("connection-badge");
        if(badge) {
            if(isOnline) {
                badge.className = "status-badge status-online";
                badge.innerHTML = '<i class="fas fa-circle"></i> Online';
            } else {
                badge.className = "status-badge status-offline";
                badge.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            }
        }
    }
};