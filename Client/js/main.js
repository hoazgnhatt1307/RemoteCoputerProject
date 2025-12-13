/**
 * MAIN ENTRY POINT
 * Chịu trách nhiệm khởi tạo ứng dụng và liên kết các module.
 */

import { SocketService } from './services/socket.js';
import { UIManager } from './utils/ui.js';

// Import Features (Các tính năng cụ thể)
import { AuthFeature } from './features/auth.js'; // (Nếu bạn tách logic login)
import { DashboardFeature } from './features/dashboard.js';
import { MonitorFeature } from './features/monitor.js';
import { WebcamFeature } from './features/webcam.js';
import { KeyloggerFeature } from './features/keylogger.js';
import { FileManagerFeature } from './features/fileManager.js';
import { TaskManagerFeature } from './features/taskManager.js';

// Import Global Bridge để HTML onclick hoạt động
import './utils/globalBridge.js';

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("RCS Client Initializing...");

    // 1. Setup UI Events (Tabs, Sidebar clicks)
    setupNavigation();

    // 2. Setup Theme Toggle
    setupThemeToggle();

    // 2.5 Setup Menu Toggle (Sidebar Collapse)
    setupMenuToggle();

    // 2.6 Setup Logo Click to return to Dashboard
    setupLogoClick();

    // 3. Setup Login Event
    AuthFeature.init();
   
    DashboardFeature.init();
    MonitorFeature.init();
    WebcamFeature.init();
    KeyloggerFeature.init();
    FileManagerFeature.init();
    TaskManagerFeature.init();
});
function setupMenuToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const appWrapper = document.getElementById('app-wrapper');
    
    if (menuToggle && appWrapper) {
        menuToggle.addEventListener('click', () => {
            appWrapper.classList.toggle('toggled');
        });
    }
}

// --- EVENT HANDLERS ---


function setupLogoClick() {
    const logo = document.getElementById('logo-heading');
    if (logo) {
        logo.addEventListener('click', () => {
            // Quay về Dashboard bằng cách trigger click vào nút Dashboard
            const dashboardBtn = document.querySelector('[data-tab="dashboard"]');
            if (dashboardBtn) {
                dashboardBtn.click();
            }
        });
    }
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('#sidebar .list-group-item');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Logic chuyển Tab
            // 1. Remove active class cũ
            document.querySelector('.list-group-item.active')?.classList.remove('active');
            document.querySelector('.tab-content.active')?.classList.remove('active');
            
            // 2. Add active class mới
            const targetId = btn.getAttribute('data-tab');
            btn.classList.add('active');
            document.getElementById(`tab-${targetId}`)?.classList.add('active');
            
            // 3. Update Title
            const titleMap = {
                'dashboard': 'Overview',
                'monitor': 'Screen Monitor',
                'files': 'File Explorer',
                // ...
            };
            document.getElementById('page-title').innerText = titleMap[targetId] || 'RCS';
            
            // 4. Trigger Feature Load (Lazy Load)
            if(targetId === 'files') {
                // FileManager.init(); // Gọi hàm load ổ đĩa
            }
        });
    });
    
    document.getElementById('btn-disconnect').addEventListener('click', () => {
        SocketService.disconnect();
        UIManager.showLoginScreen();
    });
}

// --- THEME TOGGLE SYSTEM ---
/**
 * Setup Dark Mode Toggle
 * Lưu preference vào localStorage để giữ theme sau khi reload
 */
function setupThemeToggle() {
    // Load saved theme từ localStorage
    const savedTheme = localStorage.getItem('rcs-theme') || 'light';
    applyTheme(savedTheme);

    // Bắt sự kiện click nút toggle (nút này bạn sẽ thêm vào HTML)
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('rcs-theme', newTheme);
        });
    }
}

/**
 * Áp dụng theme lên HTML root element
 * @param {string} theme - 'light' hoặc 'dark'
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        updateThemeIcon('light');
    }
}

/**
 * Cập nhật icon của nút toggle (nếu có)
 * @param {string} theme - Theme hiện tại
 */
function updateThemeIcon(theme) {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;

    const icon = themeToggleBtn.querySelector('i');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fas fa-sun'; // Icon mặt trời khi đang Dark Mode
        } else {
            icon.className = 'fas fa-moon'; // Icon mặt trăng khi đang Light Mode
        }
    }
}