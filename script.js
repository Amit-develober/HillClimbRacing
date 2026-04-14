/* script.js */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Game State ---
const startX = 100;
let car = {};
let camera = { x: 0, y: 0 };
let keys = {};
let gameOver = false;
let maxDistance = 0;
let wasGrounded = false;
let wheelAngle = 0; // Tracks rotation for rims

// --- Terrain Generation ---
const noise = (x) => {
    return Math.sin(x / 400) * 80 + 
           Math.sin(x / 800) * 150 + 
           Math.sin(x / 1400) * 200 +
           Math.sin(x / 150) * 20 +  // Medium hills
           Math.sin(x / 60) * 6 +    // Light smooth bumps
           Math.sin(x / 20) * 3;     // Micro gravel roughness
};

function getTerrain(x) {
    return 400 + noise(x);
}

function initGame() {
    let p1 = getTerrain(startX - 10);
    let p2 = getTerrain(startX + 10);
    let slope = Math.atan2(p2 - p1, 20);

    car = {
        x: startX, 
        y: getTerrain(startX) - 29, 
        vx: 0, 
        vy: 0,
        angle: slope, 
        angularVelocity: 0,
        width: 80, 
        height: 30
    };
    camera = { 
        x: car.x - canvas.width / 4, 
        y: car.y - canvas.height / 2 
    };
    gameOver = false;
    maxDistance = 0;
    wasGrounded = true;
    wheelAngle = 0;
    
    keys = {};
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('score').innerText = `Distance: 0m`;
    
    let speedEl = document.getElementById('speedometer');
    speedEl.style.color = "#FFD700";
    speedEl.style.borderColor = "#FFD700";
}

// --- Inputs ---
window.addEventListener('keydown', e => {
    if ((e.code === 'Space' || e.code === 'Enter') && gameOver) {
        initGame();
        return; 
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

// --- Update Logic ---
function update() {
    if (gameOver) return;

    let accel = 0.35; 
    // Massive gyroscope control buff mid-air so player can actively fight against crash orientations
    let airControlRatio = wasGrounded ? 1.0 : 3.0; 

    if (keys['ArrowRight']) {
        if (wasGrounded) {
            car.vx += Math.cos(car.angle) * accel;
            car.vy += Math.sin(car.angle) * accel;
        }
        car.angularVelocity -= 0.0035 * airControlRatio; 
    }
    if (keys['ArrowLeft']) {
        if (wasGrounded) {
            car.vx -= Math.cos(car.angle) * accel;
            car.vy -= Math.sin(car.angle) * accel;
        }
        car.angularVelocity += 0.0035 * airControlRatio; 
    }

    let currentGravity = (car.vy < 0) ? 0.30 : 0.48;
    car.vy += currentGravity; 
    car.vx *= 0.99; 
    car.vy *= 0.99;
    car.angularVelocity *= 0.96; 
    
    car.angularVelocity = Math.max(-0.15, Math.min(car.angularVelocity, 0.15));

    car.x += car.vx;
    car.y += car.vy;
    car.angle += car.angularVelocity;

    // Visual wheels spinning physics
    let forwardSpeed = car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
    wheelAngle += forwardSpeed / 14; 

    // Collisions
    let cos = Math.cos(car.angle);
    let sin = Math.sin(car.angle);
    let w = car.width / 2;
    let h = car.height / 2;
    let r = 14; // Larger aesthetic wheel radius

    let rxRear = -w * cos - h * sin;
    let ryRear = -w * sin + h * cos;
    let rearX = car.x + rxRear;
    let rearY = car.y + ryRear + r; 
    let tyRear = getTerrain(rearX);

    let groundedThisFrame = false;

    const resolveWheel = (wx, wy, ty, rotX) => {
        let pen = wy - ty;
        if (pen > 0) {
            let wheelVy = car.vy + car.angularVelocity * rotX;
            let springK = 0.08; 
            let damping = 0.18; 
            let forceY = (pen * springK) + (wheelVy * damping);
            
            if (forceY > 0) {
                car.vy -= forceY; 
                car.angularVelocity -= rotX * forceY * 0.0003; 
            }
            
            if (pen > 10) {
                car.y -= (pen - 10) * 0.5;
            }
            groundedThisFrame = true;
        }
    };

    resolveWheel(rearX, rearY, tyRear, rxRear);
    
    let rxFront = w * Math.cos(car.angle) - h * Math.sin(car.angle);
    let frontX = car.x + rxFront;
    let frontY = car.y + w * Math.sin(car.angle) + h * Math.cos(car.angle) + r;
    let tyFront = getTerrain(frontX);

    resolveWheel(frontX, frontY, tyFront, rxFront);

    wasGrounded = groundedThisFrame;

    if (wasGrounded) {
        if (!keys['ArrowRight'] && !keys['ArrowLeft']) {
            car.vx *= 0.96; 
        }
    }

    let normalizedAngle = ((car.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (normalizedAngle > Math.PI) normalizedAngle -= Math.PI * 2;
    
    // Check Top Head limit using new Roll Cage boundary
    let headX = car.x + 40 * Math.sin(car.angle);
    let headY = car.y - 40 * Math.cos(car.angle);

    if (Math.abs(normalizedAngle) > Math.PI / 1.4 || headY > getTerrain(headX)) {
        gameOver = true;
        document.getElementById('game-over').classList.remove('hidden');
    }

    // UI Updates
    let dist = Math.floor((car.x - startX) / 50);
    if (dist > maxDistance) {
        maxDistance = dist;
        document.getElementById('score').innerText = `Distance: ${maxDistance}m`;
    }

    let speedMag = Math.sqrt(car.vx*car.vx + car.vy*car.vy);
    if (speedMag < 1.5) speedMag = 0;
    
    let speedPercent = Math.min(speedMag / 25, 1);
    let displaySpeed = Math.floor(speedPercent * 500); 
    let speedStr = displaySpeed.toLocaleString("en-US");
    
    let speedEl = document.getElementById('speedometer');
    if (speedPercent >= 0.99) {
        speedEl.innerText = `Speed: 500 km/h (MAX!)`;
        speedEl.style.color = "#FF4500";
        speedEl.style.borderColor = "#FF4500";
    } else {
        speedEl.innerText = `Speed: ${speedStr} km/h`;
        speedEl.style.color = "#FFD700";
        speedEl.style.borderColor = "#FFD700";
    }
}

// --- High Quality Game Style Drawing ---

function drawBackground(ctx) {
    // Parallax clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for(let i=0; i<8; i++) {
        let cx = ((i * 400) - camera.x * 0.2) % (canvas.width + 400);
        if (cx < -200) cx += canvas.width + 400;
        let cy = 150 + Math.sin(i)*50;
        
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI*2);
        ctx.arc(cx + 50, cy - 30, 80, 0, Math.PI*2);
        ctx.arc(cx + 100, cy, 60, 0, Math.PI*2);
        ctx.fill();
    }
}

function drawTerrain(ctx) {
    // Gradient Dirt depth
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height); 
    grad.addColorStop(0, "#5C3A21"); 
    grad.addColorStop(1, "#2A180C"); 
    
    ctx.fillStyle = grad; 
    ctx.beginPath();
    ctx.moveTo(0, canvas.height); 
    
    let start_x = camera.x - (camera.x % 20); 
    for (let x = start_x; x < camera.x + canvas.width + 40; x += 20) {
        let drawX = x - camera.x;
        let drawY = getTerrain(x) - camera.y;
        ctx.lineTo(drawX, drawY);
    }
    
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();
    
    // Thick stylised grass cover layer
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let x = start_x; x < camera.x + canvas.width + 40; x += 20) {
        let drawX = x - camera.x;
        let drawY = getTerrain(x) - camera.y;
        if (x === start_x) ctx.moveTo(drawX, drawY);
        else ctx.lineTo(drawX, drawY);
    }
    ctx.stroke();

    // Secondary lighter grass highlight
    ctx.strokeStyle = "#81C784";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = start_x; x < camera.x + canvas.width + 40; x += 20) {
        let drawX = x - camera.x;
        let drawY = getTerrain(x) - camera.y - 4;
        if (x === start_x) ctx.moveTo(drawX, drawY);
        else ctx.lineTo(drawX, drawY);
    }
    ctx.stroke();
}

function drawCar(ctx) {
    ctx.save();
    ctx.translate(car.x - camera.x, car.y - camera.y);
    ctx.rotate(car.angle);
    
    let wX = car.width / 2;
    let wY = car.height / 2;

    // Struts / Springs connected to wheels
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-wX, 0); ctx.lineTo(-wX, wY);
    ctx.moveTo(wX, 0); ctx.lineTo(wX, wY);
    ctx.stroke();
    
    // Sport Buggy Chassis Base
    ctx.fillStyle = "#E63946"; 
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-42, -15, 84, 25, 8); 
    else ctx.fillRect(-42, -15, 84, 25); // Fallback for really old edge browsers
    ctx.fill();
    ctx.shadowBlur = 0; 
    
    // Roll cage framework
    ctx.strokeStyle = "#1D3557";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-25, -15);
    ctx.lineTo(-15, -40);
    ctx.lineTo(15, -40);
    ctx.lineTo(25, -15);
    ctx.moveTo(0, -40);
    ctx.lineTo(0, -15);
    ctx.stroke();
    
    // Engine & Lights Detail
    ctx.fillStyle = "#A8DADC"; 
    ctx.fillRect(-35, -5, 20, 10);
    ctx.fillStyle = "#457B9D"; 
    ctx.fillRect(20, -5, 15, 8); 
    ctx.fillStyle = "#F1FAEE"; 
    ctx.fillRect(32, -3, 5, 4); 

    // Dynamic Spinning Wheels
    let r = 14; 
    const drawWheel = (wx, wy) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wheelAngle); 
        
        ctx.fillStyle = "#111"; // Thick Rubber
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        
        // Shiny Rim Spokes
        ctx.strokeStyle = "#DDD";
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            let angle = i * Math.PI * 2 / 5;
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            ctx.stroke();
        }
        
        // Hub bolts
        ctx.fillStyle = "#E63946";
        ctx.beginPath();
        ctx.arc(0, 0, r / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(0, 0, r / 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    };

    drawWheel(-wX, wY); 
    drawWheel(wX, wY);  

    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground(ctx);
    drawTerrain(ctx);
    drawCar(ctx);
}

// --- Main Game Loop ---
function loop() {
    update();
    
    camera.x += ((car.x - canvas.width / 4) - camera.x) * 0.1;
    let targetCamY = car.y - canvas.height / 2;
    camera.y += ((targetCamY) - camera.y) * 0.1;

    draw();
    requestAnimationFrame(loop);
}

initGame();
loop();
