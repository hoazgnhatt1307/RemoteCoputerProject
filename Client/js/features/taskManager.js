import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';

let currentMode = "apps"; // apps | processes

export const TaskManagerFeature = {
    init() {
        SocketService.on('APP_LIST', (data) => { 
            if(currentMode === "apps") this.render(data.payload || data); 
        });
        SocketService.on('PROCESS_LIST', (data) => { 
            if(currentMode === "processes") this.render(data.payload || data); 
        });

        document.getElementById('btn-get-apps')?.addEventListener('click', () => {
            currentMode = "apps";
            SocketService.send("GET_APPS");
        });

        document.getElementById('btn-get-processes')?.addEventListener('click', () => {
            currentMode = "processes";
            SocketService.send("GET_PROCESS");
        });
    },

    render(dataList) {
        const tbody = document.querySelector("#procTable tbody");
        if(!tbody) return;
        tbody.innerHTML = "";
        
        dataList.forEach((item) => {
            const tr = document.createElement("tr");

            // ID
            const tdId = document.createElement("td");
            tdId.innerHTML = `<span class="badge bg-secondary">${item.id}</span>`;
            
            // Name (Safe)
            const tdName = document.createElement("td");
            tdName.className = "fw-bold";
            tdName.textContent = item.title || item.name;

            // Memory
            const tdMem = document.createElement("td");
            tdMem.textContent = item.memory || "N/A";

            // Action
            const tdAction = document.createElement("td");
            const btnKill = document.createElement("button");
            btnKill.className = "btn btn-danger btn-sm";
            btnKill.innerHTML = '<i class="fas fa-trash"></i> Kill';
            btnKill.onclick = () => {
                if(confirm(`Kill process ID ${item.id}?`)) SocketService.send('KILL', item.id);
            };
            tdAction.appendChild(btnKill);

            tr.append(tdId, tdName, tdMem, tdAction);
            tbody.appendChild(tr);
        });
    }
};