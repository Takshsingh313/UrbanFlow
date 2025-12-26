let velocityChart = null;
let flowChart = null;
let vehiclesChart = null;
let densityChart = null;

window.setupCharts = function () {
    setupVelocityChart();
    setupFlowChart();
    setupVehiclesChart();
    setupDensityChart();
}

function setupVelocityChart() {
    const ctx = document.getElementById('chart-velocity');
    if (!ctx) return;

    velocityChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Avg Velocity',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('Velocity (cells/tick)')
    });
}

function setupFlowChart() {
    const ctx = document.getElementById('chart-flow');
    if (!ctx) return;

    flowChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Flow Rate',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('Flow (vehicles/tick)')
    });
}

function setupVehiclesChart() {
    const ctx = document.getElementById('chart-vehicles');
    if (!ctx) return;

    vehiclesChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Vehicle Count',
                data: [],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('Vehicles')
    });
}

function setupDensityChart() {
    const ctx = document.getElementById('chart-density');
    if (!ctx) return;

    densityChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Density',
                data: [],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('Density (vehicles/cell)')
    });
}

function getChartOptions(yAxisLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: {
                    color: 'rgba(148, 163, 184, 0.1)',
                    drawBorder: false
                },
                ticks: {
                    color: '#94a3b8',
                    font: { family: 'Inter', size: 11 },
                    maxTicksLimit: 8
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(148, 163, 184, 0.1)',
                    drawBorder: false
                },
                ticks: {
                    color: '#94a3b8',
                    font: { family: 'Inter', size: 11 }
                },
                title: {
                    display: true,
                    text: yAxisLabel,
                    color: '#cbd5e1',
                    font: { family: 'Inter', size: 12 }
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#f1f5f9',
                bodyColor: '#cbd5e1',
                borderColor: '#475569',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                titleFont: { family: 'Inter', size: 13 },
                bodyFont: { family: 'Inter', size: 12 }
            }
        },
        animation: false,
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };
}

window.updateCharts = function (tick, stats) {
    if (!velocityChart) return;

    const maxDataPoints = 60;

    updateChart(velocityChart, tick, stats.speed);
    updateChart(flowChart, tick, stats.flow);
    updateChart(vehiclesChart, tick, stats.vehicleCount || 0);
    updateChart(densityChart, tick, stats.density);

    document.getElementById('stat-velocity').textContent = stats.speed.toFixed(2);
    document.getElementById('stat-flow-rate').textContent = stats.flow.toFixed(3);
    document.getElementById('stat-density').textContent = stats.density.toFixed(3);
    document.getElementById('stat-vehicles').textContent = stats.vehicleCount || 0;
}

function updateChart(chart, tick, value) {
    chart.data.labels.push(tick);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > 60) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update('none');
}

window.downloadChart = function (canvasId, fileName) {
    const originalCanvas = document.getElementById(canvasId);
    if (!originalCanvas) {
        console.error("Canvas not found:", canvasId);
        return;
    }

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = originalCanvas.width;
    compositeCanvas.height = originalCanvas.height;
    const ctx = compositeCanvas.getContext('2d');

    const isLightMode = document.body.classList.contains('light-mode');
    ctx.fillStyle = isLightMode ? '#ffffff' : '#16161a';
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    ctx.drawImage(originalCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = fileName + '.png';
    link.href = compositeCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
