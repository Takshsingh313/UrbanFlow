let ws = null;
let isConnected = false;

window.onload = function () {
    if (document.getElementById('sim-canvas') || document.getElementById('stat-flow') || document.getElementById('chart-velocity')) {
        setupWebSocket();
    }
    if (document.getElementById('sim-canvas')) {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    if (window.setupCharts) window.setupCharts();
};

function setupWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log("WebSocket already active");
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    let host = window.location.host;
    const port = parseInt(window.location.port);
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && port !== 8000) {
        console.log("Detected local frontend dev server. Pointing WebSocket to localhost:8000");
        host = 'localhost:8000';
    }

    const wsUrl = `${protocol}//${host}/ws/simulation`;
    console.log("Connecting to:", wsUrl);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("Connected to Simulation Engine");
        isConnected = true;

        const canvas = document.getElementById('sim-canvas');
        if (canvas) {
        }
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'init') {
            try {
                console.log("Received INIT state. Keys:", Object.keys(data.state));
                if (data.state.nodes) console.log("Node count:", data.state.nodes.length);
                else console.error("CRITICAL: state.nodes is undefined!");

                window.worldMap = data.state;
                resizeCanvas();
                if (window.renderSimulation) window.renderSimulation(data.state);

                const btn = document.getElementById('btn-start');
                if (btn) {
                    btn.innerText = "Start Simulation";
                    btn.classList.remove('danger');
                }
            } catch (e) {
                console.error("Error processing INIT state:", e);
            }
        } else if (data.type === 'update') {

            try {
                if (window.worldMap) {
                    window.worldMap.tick = data.tick;
                    window.worldMap.cars = data.cars;

                    if (data.lights && window.worldMap.nodes) {
                        data.lights.forEach(light => {
                            const node = window.worldMap.nodes.find(n => n.id === light.id);
                            if (node) {
                                node.signal_ns = light.ns;
                                node.signal_ew = light.ew;
                            }
                        });
                    }

                    if (window.renderSimulation) window.renderSimulation(window.worldMap);
                }

                updateStats(data);
            } catch (e) {
                console.error("Error processing UPDATE:", e);
            }
        } else if (data.type === 'error') {
            console.error("Server Error:", data.message);
            alert("Error: " + data.message);
            location.reload();
        }
    };

    ws.onclose = () => {
        console.log("Disconnected");
        isConnected = false;
    };

    ws.onerror = (err) => {
        console.error("WebSocket Error:", err);
    };
}

function safeSend(message) {
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        console.warn("WebSocket closed. Attempting to reconnect...");
        setupWebSocket();

        const canvas = document.getElementById('sim-canvas');
        if (canvas && message.action !== "set_spawn_rate" && message.action !== "set_light_timing") {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = "16px 'Inter', sans-serif";
            ctx.textAlign = 'center';
            ctx.fillText('Reconnecting to server...', canvas.width / 2, canvas.height / 2);
        }

        setTimeout(() => safeSend(message), 1500);
        return;
    }

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else if (ws.readyState === WebSocket.CONNECTING) {
        console.log("WebSocket connecting, queuing message...");
        setTimeout(() => safeSend(message), 500);
    }
}


function toggleSimulation() {
    const btn = document.getElementById('btn-start');

    const isStart = btn && (btn.innerText.toUpperCase().includes("START") || btn.innerText.toUpperCase().includes("INITIALIZE"));

    if (isStart) {
        safeSend({ action: "start" });
        if (btn) {
            btn.innerText = "Halt Simulation";
            btn.classList.add('danger');
        }
    } else {
        safeSend({ action: "stop" });
        if (btn) {
            btn.innerText = "Start Simulation";
            btn.classList.remove('danger');
        }
    }
}

function updateStats(data) {
    if (!data.stats) return;

    const flowEl = document.getElementById('stat-flow');
    const speedEl = document.getElementById('stat-speed');

    if (flowEl) flowEl.innerText = data.stats.flow;
    if (speedEl) speedEl.innerText = data.stats.speed;

    const countEl = document.getElementById('stat-vehicles');
    if (countEl && data.stats.vehicleCount !== undefined) {
        countEl.innerText = data.stats.vehicleCount;
    }

    if (window.updateCharts) {
        window.updateCharts(data.tick, data.stats);
    }
}

function resizeCanvas() {
    const canvas = document.getElementById('sim-canvas');
    if (canvas) {
        const parent = canvas.parentElement;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 600;

        canvas.width = width;
        canvas.height = height;

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        console.log(`Canvas resized to: ${width}x${height}`);
    }
}

function resetSimulation() {
    safeSend({ action: "reset" });
}

function regenerateGrid() {
    console.log('regenerateGrid called');

    const rowEl = document.getElementById('grid-rows-slider');
    const colEl = document.getElementById('grid-cols-slider');
    const vehicleEl = document.getElementById('initial-vehicles-slider');

    const rows = rowEl ? parseInt(rowEl.value) : 4;
    const cols = colEl ? parseInt(colEl.value) : 4;
    const initialVehicles = vehicleEl ? parseInt(vehicleEl.value) : 8;

    console.log(`Regenerating grid with: ${rows}x${cols}, ${initialVehicles} cars`);

    const message = {
        action: "regenerate_grid",
        rows: isNaN(rows) ? 4 : Math.max(2, rows),
        cols: isNaN(cols) ? 4 : Math.max(2, cols),
        initial_vehicles: isNaN(initialVehicles) ? 8 : initialVehicles
    };

    safeSend(message);
    console.log('Regenerate command sent');
}

function loadCityLayout() {
    const select = document.getElementById('city-layout-select');
    const selectedOption = select.options[select.selectedIndex];
    const layoutFile = selectedOption.value;
    const layoutType = selectedOption.getAttribute('data-type');

    const canvas = document.getElementById('sim-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#4a7c59';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = "20px 'Inter', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('Loading city layout...', canvas.width / 2, canvas.height / 2);
    }

    safeSend({
        action: "load_city_layout",
        file: layoutFile,
        layout_type: layoutType
    });
}

window.addEventListener('load', () => {
    const gridRowsSlider = document.getElementById('grid-rows-slider');
    const gridRowsValue = document.getElementById('grid-rows-value');
    const gridColsSlider = document.getElementById('grid-cols-slider');
    const gridColsValue = document.getElementById('grid-cols-value');
    const initialVehiclesSlider = document.getElementById('initial-vehicles-slider');
    const initialVehiclesValue = document.getElementById('initial-vehicles-value');
    const spawnSlider = document.getElementById('spawn-rate-slider');
    const spawnValue = document.getElementById('spawn-rate-value');
    const lightSlider = document.getElementById('light-timing-slider');
    const lightValue = document.getElementById('light-timing-value');

    if (gridRowsSlider) {
        gridRowsSlider.addEventListener('input', (e) => {
            gridRowsValue.textContent = e.target.value;
        });
    }

    if (gridColsSlider) {
        gridColsSlider.addEventListener('input', (e) => {
            gridColsValue.textContent = e.target.value;
        });
    }

    if (initialVehiclesSlider) {
        initialVehiclesSlider.addEventListener('input', (e) => {
            initialVehiclesValue.textContent = e.target.value;
        });
    }

    if (spawnSlider) {
        spawnSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            spawnValue.textContent = `${e.target.value}%`;
            safeSend({ action: "set_spawn_rate", value: value });
        });
    }

    if (lightSlider) {

        lightSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            lightValue.textContent = `${value} ticks`;
            safeSend({ action: "set_light_timing", value: value });
        });
    }
});

let mapInstance = null;

function openMapSelector() {
    const modal = document.getElementById('map-modal');
    modal.style.display = 'block';

    if (!mapInstance) {
        mapInstance = L.map('leaflet-map').setView([40.7580, -73.9855], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(mapInstance);
    }

    setTimeout(() => {
        mapInstance.invalidateSize();
    }, 100);
}

function closeMapSelector() {
    document.getElementById('map-modal').style.display = 'none';
}

function confirmMapSelection() {
    if (!mapInstance) return;

    const mapBounds = mapInstance.getBounds();
    const bounds = {
        north: mapBounds.getNorth(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        west: mapBounds.getWest()
    };

    closeMapSelector();

    const canvas = document.getElementById('sim-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = "20px 'Inter', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('Fetching real-world map data...', canvas.width / 2, canvas.height / 2);
    }

    safeSend({
        action: "generate_from_osm",
        bounds: bounds
    });
}
