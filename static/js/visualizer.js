window.renderSimulation = function (state) {
    const canvas = document.getElementById('sim-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!state) {
        console.warn("renderSimulation: No state provided");
        drawErrorMessage(ctx, canvas, "No simulation state");
        return;
    }

    if (!state.nodes || state.nodes.length === 0) {
        console.warn("renderSimulation: No nodes in state");
        drawErrorMessage(ctx, canvas, "No road network loaded");
        return;
    }

    console.log(`Rendering: ${state.nodes.length} nodes, ${state.edges ? state.edges.length : 0} edges, ${state.cars ? state.cars.length : 0} cars`);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    state.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
    });

    const gridWidth = Math.max(maxX - minX, 100);
    const gridHeight = Math.max(maxY - minY, 100);
    const padding = 60;
    const scaleX = (canvas.width - 2 * padding) / gridWidth;
    const scaleY = (canvas.height - 2 * padding) / gridHeight;
    const scale = Math.min(scaleX, scaleY, 2.5);

    const scaledWidth = gridWidth * scale;
    const scaledHeight = gridHeight * scale;
    const offsetX = (canvas.width - scaledWidth) / 2 - minX * scale;
    const offsetY = (canvas.height - scaledHeight) / 2 - minY * scale;

    const transform = (x, y) => {
        let tx = x * scale + offsetX;
        let ty = y * scale + offsetY;
        const safeLimit = 20000;
        return {
            x: Math.max(-safeLimit, Math.min(safeLimit, tx)),
            y: Math.max(-safeLimit, Math.min(safeLimit, ty))
        };
    };

    drawGrassBackground(ctx, canvas.width, canvas.height);

    if (state.edges && state.edges.length > 0) {
        state.edges.forEach(edge => {
            drawRealisticRoad(ctx, edge, transform, scale);
        });
    }

    state.nodes.forEach(node => {
        drawRealisticIntersection(ctx, node, transform, scale);
    });

    state.nodes.forEach(node => {
        if (node.type === 'intersection') {
            drawRealisticTrafficLight(ctx, node, transform, scale);
        }
    });

    if (state.cars && state.cars.length > 0) {
        state.cars.forEach(car => {
            drawRealisticVehicle(ctx, car, state.edges, transform, scale);
        });
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 16px 'Inter', sans-serif";
    ctx.fillText(`Time: ${state.tick || 0}`, canvas.width - 180, 35);

    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillText(`Vehicles: ${state.cars ? state.cars.length : 0}`, canvas.width - 180, 60);

    if (!state.cars || state.cars.length === 0) {
        ctx.fillStyle = 'rgba(255, 193, 7, 0.9)';
        ctx.fillRect(10, canvas.height - 50, 320, 40);
        ctx.fillStyle = '#000';
        ctx.font = "bold 14px 'Inter', sans-serif";
        ctx.fillText('⚠ No vehicles - Adjust spawn rate or wait', 20, canvas.height - 25);
    }
}

function drawErrorMessage(ctx, canvas, message) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ef4444';
    ctx.font = "bold 18px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
}

function drawGrassBackground(ctx, width, height) {
    const grassGradient = ctx.createLinearGradient(0, 0, 0, height);
    grassGradient.addColorStop(0, '#5a8f6a');
    grassGradient.addColorStop(0.5, '#4a7c59');
    grassGradient.addColorStop(1, '#3d6b4a');

    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 3;
        ctx.fillRect(x, y, size, size);
    }
}

function drawRealisticRoad(ctx, edge, transform, scale) {
    const from = transform(edge.from.x, edge.from.y);
    const to = transform(edge.to.x, edge.to.y);

    const roadWidth = 28 * scale;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4 * scale;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineWidth = roadWidth + 6;
    ctx.strokeStyle = '#2a2a2a';
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const gradient = ctx.createLinearGradient(
        from.x - Math.sin(angle) * roadWidth / 2,
        from.y + Math.cos(angle) * roadWidth / 2,
        from.x + Math.sin(angle) * roadWidth / 2,
        from.y - Math.cos(angle) * roadWidth / 2
    );
    gradient.addColorStop(0, '#4a4a4a');
    gradient.addColorStop(0.5, '#3a3a3a');
    gradient.addColorStop(1, '#4a4a4a');

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineWidth = roadWidth;
    ctx.strokeStyle = gradient;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineWidth = 2.5 * scale;
    ctx.strokeStyle = '#fbbf24';
    ctx.setLineDash([14 * scale, 10 * scale]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineWidth = roadWidth + 2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.stroke();
}

function drawRealisticIntersection(ctx, node, transform, scale) {
    if (node.type !== 'intersection') return;

    const pos = transform(node.x, node.y);
    const size = 32 * scale;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4 * scale;

    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size / 2);
    gradient.addColorStop(0, '#4a4a4a');
    gradient.addColorStop(0.7, '#3a3a3a');
    gradient.addColorStop(1, '#2a2a2a');

    ctx.fillStyle = gradient;
    ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);

    const crosswalkOffset = size / 2 + 2;
    const stripeWidth = 4 * scale;
    const stripeLength = 12 * scale;
    const stripeGap = 6 * scale;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;

    for (let i = -1; i <= 1; i++) {
        ctx.fillRect(pos.x + i * stripeGap - stripeWidth / 2, pos.y - crosswalkOffset - stripeLength, stripeWidth, stripeLength);
        ctx.fillRect(pos.x + i * stripeGap - stripeWidth / 2, pos.y + crosswalkOffset, stripeWidth, stripeLength);
        ctx.fillRect(pos.x - crosswalkOffset - stripeLength, pos.y + i * stripeGap - stripeWidth / 2, stripeLength, stripeWidth);
        ctx.fillRect(pos.x + crosswalkOffset, pos.y + i * stripeGap - stripeWidth / 2, stripeLength, stripeWidth);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

function drawRealisticTrafficLight(ctx, node, transform, scale) {
    if (node.type !== 'intersection') return;

    const pos = transform(node.x, node.y);
    const lightSize = 6 * scale;
    const offset = 42 * scale;
    const poleWidth = 3 * scale;
    const poleHeight = 15 * scale;
    const housingWidth = 10 * scale;
    const housingHeight = 24 * scale;

    const positions = [
        { x: pos.x, y: pos.y - offset, signal: node.signal_ns, angle: 0 },
        { x: pos.x, y: pos.y + offset, signal: node.signal_ns, angle: Math.PI },
        { x: pos.x - offset, y: pos.y, signal: node.signal_ew, angle: -Math.PI / 2 },
        { x: pos.x + offset, y: pos.y, signal: node.signal_ew, angle: Math.PI / 2 }
    ];

    positions.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;

        const poleGradient = ctx.createLinearGradient(-poleWidth / 2, 0, poleWidth / 2, 0);
        poleGradient.addColorStop(0, '#1a1a1a');
        poleGradient.addColorStop(0.5, '#2a2a2a');
        poleGradient.addColorStop(1, '#1a1a1a');

        ctx.fillStyle = poleGradient;
        ctx.fillRect(-poleWidth / 2, -poleHeight, poleWidth, poleHeight);

        const housingGradient = ctx.createLinearGradient(-housingWidth / 2, -housingHeight, housingWidth / 2, -housingHeight);
        housingGradient.addColorStop(0, '#1a1a1a');
        housingGradient.addColorStop(0.5, '#2a2a2a');
        housingGradient.addColorStop(1, '#1a1a1a');

        ctx.fillStyle = housingGradient;
        ctx.fillRect(-housingWidth / 2, -housingHeight - poleHeight, housingWidth, housingHeight);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-housingWidth / 2, -housingHeight - poleHeight, housingWidth, housingHeight);

        const lights = [
            { color: '#ef4444', active: p.signal === 'red', y: -housingHeight - poleHeight + 5 },
            { color: '#fbbf24', active: p.signal === 'yellow', y: -housingHeight - poleHeight + housingHeight / 2 },
            { color: '#22c55e', active: p.signal === 'green', y: -poleHeight - 5 }
        ];

        lights.forEach(light => {
            ctx.beginPath();
            ctx.arc(0, light.y, lightSize, 0, 2 * Math.PI);

            if (light.active) {
                const glowGradient = ctx.createRadialGradient(0, light.y, 0, 0, light.y, lightSize * 2);
                glowGradient.addColorStop(0, light.color);
                glowGradient.addColorStop(0.5, light.color + '88');
                glowGradient.addColorStop(1, 'transparent');

                ctx.fillStyle = glowGradient;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(0, light.y, lightSize, 0, 2 * Math.PI);
                ctx.fillStyle = light.color;
                ctx.fill();

                ctx.shadowColor = light.color;
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = '#1a1a1a';
                ctx.fill();
            }

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        ctx.restore();
    });
}

function drawRealisticVehicle(ctx, car, edges, transform, scale) {
    if (!edges || edges.length === 0) return;

    const edge = edges.find(e => e.id === car.edge_id);
    if (!edge) {
        return;
    }

    const t = (car.p) / (edge.length || 1);
    const dx = edge.to.x - edge.from.x;
    const dy = edge.to.y - edge.from.y;
    const x = edge.from.x + t * dx;
    const y = edge.from.y + t * dy;
    const pos = transform(x, y);

    ctx.save();
    ctx.translate(pos.x, pos.y);

    const angle = Math.atan2(dy, dx);
    ctx.rotate(angle);

    const carLength = 26 * scale;
    const carWidth = 13 * scale;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    const carColors = ['#ef4444', '#3b82f6', '#fbbf24', '#22c55e', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];
    const carIdNum = parseInt(car.id.split('_')[1]) || 0;
    const baseColor = carColors[carIdNum % carColors.length];

    const bodyGradient = ctx.createLinearGradient(0, -carWidth / 2, 0, carWidth / 2);
    bodyGradient.addColorStop(0, lightenColor(baseColor, 20));
    bodyGradient.addColorStop(0.5, baseColor);
    bodyGradient.addColorStop(1, darkenColor(baseColor, 20));

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, 2 * scale);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.fillRect(-carLength / 2 + carLength * 0.3, -carWidth / 2 + 2, carLength * 0.35, carWidth - 4);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(carLength / 2 - 4, -carWidth / 2 + 2, 3, 3);
    ctx.fillRect(carLength / 2 - 4, carWidth / 2 - 5, 3, 3);

    ctx.fillStyle = '#ff3333';
    ctx.fillRect(-carLength / 2 + 1, -carWidth / 2 + 2, 3, 3);
    ctx.fillRect(-carLength / 2 + 1, carWidth / 2 - 5, 3, 3);

    ctx.strokeStyle = darkenColor(baseColor, 40);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, 2 * scale);
    ctx.stroke();

    ctx.restore();
}

function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}