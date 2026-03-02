document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const canvas = document.getElementById('riverCanvas');
    const ctx = canvas.getContext('2d');

    // Controls
    const sliderWidth = document.getElementById('sliderRiverWidth');
    const sliderCurrent = document.getElementById('sliderCurrentSpeed');
    const sliderBoat = document.getElementById('sliderBoatSpeed');
    const sliderAngle = document.getElementById('sliderBoatAngle');

    // Displays
    const valWidth = document.getElementById('valRiverWidth');
    const valCurrent = document.getElementById('valCurrentSpeed');
    const valBoat = document.getElementById('valBoatSpeed');
    const valAngle = document.getElementById('valBoatAngle');

    // Outputs
    const outTime = document.getElementById('outTime');
    const outDistX = document.getElementById('outDistX');
    const outDisp = document.getElementById('outDisp');

    // Buttons
    const btnRun = document.getElementById('btnRun');
    const btnReset = document.getElementById('btnReset');

    // --- State ---
    let state = {
        width: parseFloat(sliderWidth.value),
        vCurrent: parseFloat(sliderCurrent.value),
        vBoat: parseFloat(sliderBoat.value),
        angleDeg: parseFloat(sliderAngle.value),

        isRunning: false,
        timeElapsed: 0,

        // Calculated physics
        timeTotal: 0,
        distXTotal: 0,
        dispTotal: 0,

        // Animation
        lastTimestamp: 0,
        reqFrameId: null,

        // Scaling and positioning
        scaleFactor: 1,
        yStart: 0,
        yBankTarget: 0
    };

    // Make canvas responsive to display size while maintaining internal coordinate system
    function resizeCanvas() {
        const parent = canvas.parentElement;
        canvas.style.width = '100%';
        // keeping aspect ratio approximately 16:10
        canvas.style.height = (parent.clientWidth * 10 / 16) + 'px';

        // The internal logical size remains constant to simplify physics drawing
        // We'll calculate a scale factor to fit the River Width into the view height
        updateScale();
        if (!state.isRunning) drawInitialState();
    }

    window.addEventListener('resize', resizeCanvas);


    function updateScale() {
        // Leave margins top and bottom for banks
        const topMargin = 50;
        const bottomMargin = 50;
        const availableHeight = canvas.height - topMargin - bottomMargin;

        // Scale factor: pixels per meter
        state.scaleFactor = availableHeight / state.width;
        state.yStart = canvas.height - bottomMargin;
        state.yBankTarget = topMargin;
    }

    // --- Physics ---
    function updatePhysics() {
        const radians = state.angleDeg * Math.PI / 180;

        // Resolve boat velocity vector
        const vb_x = state.vBoat * Math.sin(radians);
        const vb_y = state.vBoat * Math.cos(radians); // y is "across the river"

        // Resultant velocity
        const v_res_x = vb_x + state.vCurrent;
        const v_res_y = vb_y;

        if (v_res_y <= 0) {
            // Boat is pointing completely downstream or backwards, won't cross
            state.timeTotal = Infinity;
            state.distXTotal = Infinity;
            state.dispTotal = Infinity;
            return;
        }

        // Time to cross (d / v_y)
        state.timeTotal = state.width / v_res_y;

        // Downstream drift (v_x * t)
        state.distXTotal = v_res_x * state.timeTotal;

        // Resultant displacement (sqrt(d^2 + dx^2)) directly calculated
        // Or could be total velocity * time
        state.dispTotal = Math.sqrt(Math.pow(state.width, 2) + Math.pow(state.distXTotal, 2));

        updateOutputs();
    }

    function updateOutputs() {
        if (!isFinite(state.timeTotal)) {
            outTime.innerText = "Never";
            outDistX.innerText = "∞";
            outDisp.innerText = "∞";
            return;
        }

        // If simulation is running, we might want to show running values,
        // but showing the final prediction is usually better for students.
        outTime.innerText = state.timeTotal.toFixed(2) + " s";
        outDistX.innerText = state.distXTotal.toFixed(2) + " m";
        outDisp.innerText = state.dispTotal.toFixed(2) + " m";
    }


    // --- Drawing ---
    function drawBackground() {
        // Clear
        ctx.fillStyle = '#0b1120'; // matches CSS Simulation View
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw River (the water part)
        ctx.fillStyle = 'rgba(14, 165, 233, 0.2)'; // semi transparent blue
        ctx.fillRect(0, state.yBankTarget, canvas.width, state.yStart - state.yBankTarget);

        // Draw Banks
        ctx.fillStyle = '#22c55e'; // green banks
        // Top bank
        ctx.fillRect(0, 0, canvas.width, state.yBankTarget);
        // Bottom bank
        ctx.fillRect(0, state.yStart, canvas.width, canvas.height - state.yStart);

        // Water texture/lines to show flow (simplified)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            let y = state.yBankTarget + (state.yStart - state.yBankTarget) * (0.2 * i + 0.1);
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();

        // Target line (perpendicular straight across)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, state.yStart);
        ctx.lineTo(canvas.width / 2, state.yBankTarget);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawBoat(xMeter, yMeter) {
        // Convert physical meters to canvas pixels
        // x starts middle of screen
        const pxX = canvas.width / 2 + (xMeter * state.scaleFactor);
        const pxY = state.yStart - (yMeter * state.scaleFactor); // y is UP in physics, DOWN in canvas

        // Draw trail if running
        if (state.isRunning && state.timeElapsed > 0) {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, state.yStart);
            ctx.lineTo(pxX, pxY);
            ctx.stroke();
        }

        // Draw Boat
        ctx.fillStyle = '#f59e0b'; // orange boat

        ctx.save();
        ctx.translate(pxX, pxY);

        // Rotate boat to face its resultant velocity vector
        const radians = state.angleDeg * Math.PI / 180;
        const v_res_x = state.vBoat * Math.sin(radians) + state.vCurrent;
        const v_res_y = state.vBoat * Math.cos(radians);

        const heading = Math.atan2(v_res_x, v_res_y);
        ctx.rotate(heading);

        // Boat shape (simple polygon)
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(10, 10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawVectors(xMeter, yMeter) {
        // Only draw vectors at start position to not clutter the screen
        if (state.isRunning) return;

        const startX = canvas.width / 2;
        const startY = state.yStart;
        const vecScale = 15; // pixels per m/s

        // Boat vector (relative to water)
        const radians = state.angleDeg * Math.PI / 180;
        const vbX = state.vBoat * Math.sin(radians) * vecScale;
        const vbY = -state.vBoat * Math.cos(radians) * vecScale; // minus because y goes up

        // Draw Boat Vector (Red)
        drawArrow(startX, startY, startX + vbX, startY + vbY, '#ef4444', 'v_boat');

        // Current vector (Water relative to bank)
        const vcX = state.vCurrent * vecScale;
        const vcY = 0;
        // Draw Current vector starting from the tip of the boat vector
        drawArrow(startX + vbX, startY + vbY, startX + vbX + vcX, startY + vbY + vcY, '#3b82f6', 'v_current');

        // Resultant vector
        drawArrow(startX, startY, startX + vbX + vcX, startY + vbY + vcY, '#22c55e', 'v_res', true);
    }

    function drawArrow(fromX, fromY, toX, toY, color, label, isDashed = false) {
        const headlen = 10;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;

        if (isDashed) ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(toX, toY);
        ctx.fill();
    }

    function drawInitialState() {
        drawBackground();
        drawBoat(0, 0);
        drawVectors(0, 0);
    }

    // --- Animation Loop ---
    function animate(timestamp) {
        if (!state.lastTimestamp) state.lastTimestamp = timestamp;
        const dt = (timestamp - state.lastTimestamp) / 1000; // seconds
        state.lastTimestamp = timestamp;

        if (state.isRunning) {
            // Determine "Simulation Time". We want the visual to take about 3-5 seconds in real life 
            // regardless of the physics time to keep it engaging.
            // A multiplier: 1 real sec = N sim secs
            const targetRealTime = 4.0;
            const simSpeed = state.timeTotal / targetRealTime;

            state.timeElapsed += dt * simSpeed;

            if (state.timeElapsed >= state.timeTotal) {
                state.timeElapsed = state.timeTotal;
                state.isRunning = false;
                btnRun.innerText = "Run Simulation";
                btnRun.disabled = false;
            }

            drawBackground();

            // Calculate current physical position
            const radians = state.angleDeg * Math.PI / 180;
            const v_res_x = state.vBoat * Math.sin(radians) + state.vCurrent;
            const v_res_y = state.vBoat * Math.cos(radians);

            const currX = v_res_x * state.timeElapsed;
            const currY = v_res_y * state.timeElapsed;

            drawBoat(currX, currY);

            // Update live numbers (optional, but requested is to display output at end, we show final statically)
            // But we can show running time out of total if we want
            // outTime.innerText = state.timeElapsed.toFixed(2) + " s";
        }

        if (state.isRunning) {
            state.reqFrameId = requestAnimationFrame(animate);
        }
    }


    // --- Event Listeners ---
    function getInputs() {
        state.width = parseFloat(sliderWidth.value);
        state.vCurrent = parseFloat(sliderCurrent.value);
        state.vBoat = parseFloat(sliderBoat.value);
        state.angleDeg = parseFloat(sliderAngle.value);

        valWidth.innerHTML = `${state.width} m`;
        valCurrent.innerHTML = `${state.vCurrent.toFixed(1)} m/s`;
        valBoat.innerHTML = `${state.vBoat.toFixed(1)} m/s`;
        valAngle.innerHTML = `${state.angleDeg}&deg;`;

        updateScale();
        updatePhysics();
        if (!state.isRunning) drawInitialState();
    }

    [sliderWidth, sliderCurrent, sliderBoat, sliderAngle].forEach(el => {
        el.addEventListener('input', () => {
            // If they change a slider while running, stop it and reset visually to show vectors
            if (state.isRunning) {
                resetSimulation();
            }
            getInputs();
        });
    });

    function resetSimulation() {
        state.isRunning = false;
        state.timeElapsed = 0;
        state.lastTimestamp = 0;
        if (state.reqFrameId) {
            cancelAnimationFrame(state.reqFrameId);
        }
        btnRun.innerText = "Run Simulation";
        btnRun.disabled = false;

        getInputs();
    }

    btnRun.addEventListener('click', () => {
        if (!isFinite(state.timeTotal)) return; // Don't run if it will never cross

        if (!state.isRunning) {
            // Start from beginning
            state.timeElapsed = 0;
            state.lastTimestamp = 0;
            state.isRunning = true;
            btnRun.innerText = "Running...";
            btnRun.disabled = true;
            state.reqFrameId = requestAnimationFrame(animate);
        }
    });

    btnReset.addEventListener('click', resetSimulation);

    // Initial setup
    resizeCanvas();
    getInputs();
});
