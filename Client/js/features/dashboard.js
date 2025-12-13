import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';

let allInstalledApps = [];

export const DashboardFeature = {
    init() {
        // Listen to socket events
        SocketService.on('INSTALLED_LIST', (data) => {
            allInstalledApps = data.payload || data;
            this.renderAppGrid(allInstalledApps);
        });

        SocketService.on('LOG', (data) => {
            const text = data.payload || data;
            this.logToTerminal(text);
            if (text.includes('Lỗi') || text.includes('Error')) {
                UIManager.showToast(text, 'error');
            } else if (text.includes('Đã')) {
                UIManager.showToast(text, 'success');
            }
        });

        // Listen for filter event from global bridge
        window.addEventListener('filterApps', (e) => {
            const keyword = e.detail.keyword;
            const filtered = allInstalledApps.filter(app => 
                app.name.toLowerCase().includes(keyword)
            );
            this.renderAppGrid(filtered);
        });

        // Power Controls
        document.getElementById('btn-shutdown')?.addEventListener('click', () => {
            if(confirm('Tắt máy Server?')) SocketService.send('SHUTDOWN');
        });
        
        document.getElementById('btn-restart')?.addEventListener('click', () => {
            if(confirm('Khởi động lại Server?')) SocketService.send('RESTART');
        });

        // Quick Launch
        document.getElementById('btn-run-app')?.addEventListener('click', this.runApp);
        document.getElementById('quickAppInput')?.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') this.runApp();
        });

        // Web Shortcuts (Sử dụng Event Delegation cho gọn)
        document.querySelectorAll('.btn-web-launch').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.getAttribute('data-url');
                this.openWeb(url);
            });
        });
    },

    runApp() {
        const input = document.getElementById("quickAppInput");
        const appName = input.value.trim();
        if (appName) {
            SocketService.send("START_APP", appName);
            UIManager.showToast(`Đang mở: ${appName}...`, "info");
            input.value = "";
        } else {
            UIManager.showToast("Vui lòng nhập tên ứng dụng!", "error");
        }
    },

    openWeb(url) {
        SocketService.send("START_APP", url);
        UIManager.showToast(`Đang mở trình duyệt: ${url}...`, "info");
    },

    renderAppGrid(appList) {
        const container = document.getElementById("app-grid");
        if(!container) return;
        
        container.innerHTML = "";
        if (!appList || appList.length === 0) {
            container.innerHTML = '<p class="text-center w-100">No apps found.</p>';
            return;
        }
        
        appList.forEach(app => {
            const div = document.createElement("div");
            div.className = "app-item-btn";
            div.onclick = () => {
                SocketService.send("START_APP", app.path);
                window.closeAppLibrary();
                UIManager.showToast(`Launching ${app.name}...`, "success");
            };
            
            const icon = document.createElement("i");
            icon.className = "fas fa-cube app-item-icon";
            const span = document.createElement("span");
            span.className = "app-item-name";
            span.textContent = app.name;
            
            div.appendChild(icon);
            div.appendChild(span);
            container.appendChild(div);
        });
    },

    logToTerminal(text) {
        const term = document.getElementById("terminal-output");
        if(!term) return;
        
        const div = document.createElement("div");
        div.style.color = "#10b981";
        div.textContent = `[${new Date().toLocaleTimeString()}] > ${text}`;
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
    }
};