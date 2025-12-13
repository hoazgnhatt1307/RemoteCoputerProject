import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';

let currentPath = "";

export const FileManagerFeature = {
    init() {
        // Bind methods to this context
        SocketService.on('FILE_LIST', (data) => this.renderFiles(data));
        SocketService.on('FILE_DOWNLOAD_DATA', (data) => this.saveDownloadedFile(data));

        // UI Events
        document.getElementById('btn-file-home')?.addEventListener('click', () => this.getDrives());
        
        // Lazy load: Khi bấm vào tab Files lần đầu thì load ổ đĩa luôn
        const navFiles = document.getElementById('nav-files');
        if(navFiles) {
            let hasLoaded = false;
            navFiles.addEventListener('click', () => {
                if(!hasLoaded) {
                    hasLoaded = true;
                    setTimeout(() => this.getDrives(), 100);
                }
            });
        }
    },

    getDrives() {
        currentPath = "";
        this.updatePathLabel("My Computer");
        SocketService.send("GET_DRIVES");
    },

    openFolder(path) {
        currentPath = path;
        this.updatePathLabel(path);
        SocketService.send("GET_DIR", path);
    },

    updatePathLabel(path) {
        // Not used anymore - breadcrumb handles this in updateBreadcrumb()
        // Keep for backward compatibility if needed
    },

    renderFiles(data) {
        const items = data.payload || data;
        if(items.error) return UIManager.showToast(items.error, "error");

        const tbody = document.getElementById("file-list-body");
        if(!tbody) return;
        tbody.innerHTML = "";

        // Update breadcrumb
        this.updateBreadcrumb(currentPath);

        items.forEach(item => {
            const tr = document.createElement("tr");
            tr.style.cursor = (item.Type !== "FILE") ? "pointer" : "default";

            // 1. Type Icon Cell (centered, with padding)
            const tdIcon = document.createElement("td");
            tdIcon.className = "text-center ps-4";
            const icon = document.createElement("i");
            icon.style.fontSize = "1.25rem";
            
            // Colorful icons based on type
            if (item.Type === "DRIVE") {
                icon.className = "fas fa-hdd text-primary";
            } else if (item.Type === "FOLDER") {
                icon.className = "fas fa-folder text-warning";
            } else if (item.Type === "BACK") {
                icon.className = "fas fa-arrow-left text-secondary";
            } else {
                // File icons - different colors based on extension
                const ext = item.Name.split('.').pop().toLowerCase();
                if(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext)) {
                    icon.className = "fas fa-file-image text-info";
                } else if(['mp4', 'avi', 'mkv', 'mov'].includes(ext)) {
                    icon.className = "fas fa-file-video text-danger";
                } else if(['mp3', 'wav', 'flac', 'aac'].includes(ext)) {
                    icon.className = "fas fa-file-audio text-success";
                } else if(['pdf'].includes(ext)) {
                    icon.className = "fas fa-file-pdf text-danger";
                } else if(['doc', 'docx'].includes(ext)) {
                    icon.className = "fas fa-file-word text-primary";
                } else if(['xls', 'xlsx'].includes(ext)) {
                    icon.className = "fas fa-file-excel text-success";
                } else if(['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
                    icon.className = "fas fa-file-archive text-warning";
                } else if(['txt', 'log'].includes(ext)) {
                    icon.className = "fas fa-file-alt text-secondary";
                } else if(['exe', 'msi'].includes(ext)) {
                    icon.className = "fas fa-cog text-dark";
                } else {
                    icon.className = "fas fa-file text-muted";
                }
            }
            tdIcon.appendChild(icon);

            // Click to open folder/drive
            if (item.Type !== "FILE") {
                tdIcon.onclick = () => FileManagerFeature.openFolder(item.Path);
            }

            // 2. Name Cell (with padding)
            const tdName = document.createElement("td");
            tdName.className = "ps-3";
            tdName.textContent = item.Name;
            tdName.style.fontWeight = "500";
            tdName.style.color = "#202124";
            if (item.Type !== "FILE") {
                tdName.onclick = () => FileManagerFeature.openFolder(item.Path);
            }

            // 3. Last Modified Cell
            const tdModified = document.createElement("td");
            tdModified.className = "text-muted small";
            tdModified.textContent = item.LastModified || "—";

            // 4. Size Cell
            const tdSize = document.createElement("td");
            tdSize.className = "text-muted small";
            tdSize.textContent = item.Size || "—";

            // 5. Actions Cell (aligned right with subtle buttons)
            const tdAction = document.createElement("td");
            tdAction.className = "text-end pe-4";
            
            if (item.Type === "FILE") {
                // Download button
                const btnDown = document.createElement("button");
                btnDown.className = "btn btn-sm btn-light me-1";
                btnDown.title = "Download";
                btnDown.innerHTML = '<i class="fas fa-download text-primary"></i>';
                btnDown.onclick = (e) => {
                    e.stopPropagation();
                    if(confirm("Download this file?")) SocketService.send("DOWNLOAD_FILE", item.Path);
                };

                // Rename button
                const btnRename = document.createElement("button");
                btnRename.className = "btn btn-sm btn-light me-1";
                btnRename.title = "Rename";
                btnRename.innerHTML = '<i class="fas fa-edit text-secondary"></i>';
                btnRename.onclick = (e) => {
                    e.stopPropagation();
                    const newName = prompt("Enter new name:", item.Name);
                    if(newName && newName !== item.Name) {
                        UIManager.showToast("Rename function coming soon!", "info");
                        // TODO: Implement rename on server
                    }
                };

                // Delete button
                const btnDel = document.createElement("button");
                btnDel.className = "btn btn-sm btn-light";
                btnDel.title = "Delete";
                btnDel.innerHTML = '<i class="fas fa-trash text-danger"></i>';
                btnDel.onclick = (e) => {
                    e.stopPropagation();
                    if(confirm("Delete this file permanently?")) {
                        SocketService.send("DELETE_FILE", item.Path);
                        setTimeout(() => FileManagerFeature.openFolder(currentPath), 1000);
                    }
                };

                tdAction.append(btnDown, btnRename, btnDel);
            } else if (item.Type === "FOLDER") {
                // Folder actions - only delete
                const btnDel = document.createElement("button");
                btnDel.className = "btn btn-sm btn-light";
                btnDel.title = "Delete Folder";
                btnDel.innerHTML = '<i class="fas fa-trash text-danger"></i>';
                btnDel.onclick = (e) => {
                    e.stopPropagation();
                    if(confirm("Delete this folder and all its contents?")) {
                        UIManager.showToast("Folder delete function coming soon!", "info");
                        // TODO: Implement folder delete on server
                    }
                };
                tdAction.appendChild(btnDel);
            }

            tr.append(tdIcon, tdName, tdModified, tdSize, tdAction);
            tbody.appendChild(tr);
        });

        // Add hover effect styling
        if(items.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td colspan="5" class="text-center text-muted py-5">
                    <i class="fas fa-folder-open fa-3x mb-3 opacity-25"></i>
                    <p class="mb-0">This folder is empty</p>
                </td>
            `;
            tbody.appendChild(tr);
        }
    },

    updateBreadcrumb(path) {
        const breadcrumb = document.getElementById("current-path-breadcrumb");
        if(!breadcrumb) return;
        
        if(!path || path === "") {
            breadcrumb.textContent = "";
            breadcrumb.className = "breadcrumb-item active d-none";
        } else {
            breadcrumb.textContent = path;
            breadcrumb.className = "breadcrumb-item active";
        }
    },

    saveDownloadedFile(packet) {
        const payload = packet.payload || packet;
        const { fileName, data } = payload; // data là base64
        const link = document.createElement('a');
        link.href = 'data:application/octet-stream;base64,' + data;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        UIManager.showToast(`Đã tải xuống: ${fileName}`, "success");
    }
};

// Global functions for toolbar buttons (called from HTML)
window.uploadFile = function() {
    UIManager.showToast("Upload function coming soon!", "info");
    // TODO: Implement file upload
};

window.createNewFolder = function() {
    const folderName = prompt("Enter new folder name:");
    if(folderName) {
        UIManager.showToast("Create folder function coming soon!", "info");
        // TODO: Implement create folder on server
    }
};

window.searchFiles = function() {
    const searchInput = document.getElementById('file-search-input');
    const searchTerm = searchInput?.value.toLowerCase() || "";
    const tbody = document.getElementById("file-list-body");
    const rows = tbody?.getElementsByTagName("tr") || [];
    
    for(let row of rows) {
        const nameCell = row.cells[1]; // Name column
        if(nameCell) {
            const fileName = nameCell.textContent.toLowerCase();
            row.style.display = fileName.includes(searchTerm) ? "" : "none";
        }
    }
};