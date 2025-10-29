// public/js/scenes/gameScene.js
import { updateScoreboard } from '../ui/scoreboard.js';
import { updateHud } from '../ui/hud.js';
import { WEAPONS_CONFIG, KNIGHT_RADIUS, WALL_SIZE, SHIELD_MAX_ENERGY } from '../config.js';

let ctx, gameCanvas;
const keys = {};
const mouse = { x: 0, y: 0, down: false };
let lastAttackStart = false;
let lastAttackEnd = false;

export function startGame() {
    gameCanvas = document.getElementById('gameCanvas');
    if (!gameCanvas) return;
    ctx = gameCanvas.getContext('2d');
    
    resizeCanvas();
    window.onresize = resizeCanvas;
    
    document.addEventListener('keydown', e => keys[e.code] = true);
    document.addEventListener('keyup', e => keys[e.code] = false);
    
    gameCanvas.addEventListener('mousemove', e => {
        const rect = gameCanvas.getBoundingClientRect();
        mouse.x = (e.clientX - rect.left) / (rect.width / gameCanvas.width);
        mouse.y = (e.clientY - rect.top) / (rect.height / gameCanvas.height);
    });
    
    gameCanvas.addEventListener('mousedown', e => mouse.down = true);
    gameCanvas.addEventListener('mouseup', e => mouse.down = false);

    gameLoop();
}

function handleInput() {
    const me = gameState.players?.[myId];
    if (!me || !me.isAlive) return;

    let vx = 0; let vy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) vy = -1;
    if (keys['KeyS'] || keys['ArrowDown']) vy = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) vx = -1;
    if (keys['KeyD'] || keys['ArrowRight']) vx = 1;
    
    const mag = Math.sqrt(vx*vx + vy*vy);
    if(mag > 0) { vx /= mag; vy /= mag; }

    const angle = Math.atan2(mouse.y - me.y, mouse.x - me.x);

    const inputData = {
        vx: vx, vy: vy, angle: angle,
        attackStart: mouse.down && !lastAttackStart,
        attackEnd: !mouse.down && lastAttackStart,
        lunge: keys['Space'],
        shieldHeld: keys['ShiftLeft'] || keys['ShiftRight'],
        roomCode: roomCode
    };

    socket.emit('playerInput', inputData);
    lastAttackStart = mouse.down;
}

function draw() {
    if(!gameState.players || uiState !== 'GAME') return; 
    const now = Date.now();
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    ctx.fillStyle = '#2c2c2c'; ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    const wallColors = ['#9ca3af', '#6b7280', '#4b5563'];
    gameState.walls?.forEach(wall => {
        ctx.fillStyle = wallColors[wall.hp - 1] || '#374151';
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    });
    gameState.powerups?.forEach(p => {
        ctx.fillStyle = WEAPONS_CONFIG[p.type]?.color || 'white';
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI*2); ctx.fill();
    });
    gameState.laserBeams?.forEach(beam => {
        const age = now - beam.startTime;
        if (age > 500) return;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${1 - (age / 500)})`;
        ctx.lineWidth = 5;
        ctx.stroke();
    });
    
    // Draw explosions
    gameState.explosions?.forEach(explosion => {
        const age = now - explosion.startTime;
        if (age > 500) return; // Explosion lasts 0.5 seconds
        const progress = age / 500;
        const alpha = 1 - progress;
        const currentRadius = explosion.radius * (0.5 + progress * 0.5); // Expand from 50% to 100%
        
        // Orange explosion circle
        ctx.fillStyle = `rgba(251, 146, 60, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Yellow inner circle
        ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, currentRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Explosion ring
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
    });
    
    Object.values(gameState.players).forEach(p => {
        if(!p.isAlive) return;
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.fillStyle = 'white'; ctx.font = '12px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillText(p.name, 0, -KNIGHT_RADIUS - 15);
        if (p.weapon.type !== 'sword') {
            ctx.fillStyle = WEAPONS_CONFIG[p.weapon.type]?.color || 'white';
            ctx.beginPath(); ctx.arc(0, -KNIGHT_RADIUS-5, 4, 0, Math.PI*2); ctx.fill();
        }
        if (p.shieldActive) {
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, KNIGHT_RADIUS + 5, 0, Math.PI*2); ctx.stroke();
        }
        
        // MODIFIED: Draw laser charge indicator
        const laserChargeStartTime = p.laserChargeTime - 800; // 800 is new chargeTime
        if (p.laserChargeTime > 0 && now > laserChargeStartTime && now < p.laserChargeTime) {
            // Thin aiming line
            ctx.beginPath(); ctx.moveTo(0,0);
            ctx.lineTo(Math.cos(p.angle) * 1000, Math.sin(p.angle) * 1000);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 1; ctx.stroke();
            // Red charging circle
            const chargeAmount = (now - laserChargeStartTime) / 800;
            ctx.fillStyle = `rgba(239, 68, 68, ${chargeAmount * 0.4})`;
            ctx.beginPath(); ctx.arc(0, 0, KNIGHT_RADIUS + 5 + (chargeAmount * 5), 0, 2*Math.PI); ctx.fill();
        }

        if (p.bowChargeStartTime > 0 && p.id === myId) {
                const chargeAmount = Math.min(1, (now - p.bowChargeStartTime) / 500);
                ctx.fillStyle = `rgba(250, 204, 21, ${chargeAmount * 0.5})`;
                ctx.beginPath(); ctx.arc(0, 0, KNIGHT_RADIUS + 5 + (chargeAmount * 5), 0, 2*Math.PI); ctx.fill();
        }
        
        // Draw grenade charge indicator
        if (p.grenadeChargeStartTime > 0 && p.id === myId) {
                const chargeAmount = Math.min(1, (now - p.grenadeChargeStartTime) / 1000);
                ctx.fillStyle = `rgba(34, 197, 94, ${chargeAmount * 0.5})`;
                ctx.beginPath(); ctx.arc(0, 0, KNIGHT_RADIUS + 5 + (chargeAmount * 5), 0, 2*Math.PI); ctx.fill();
                
                // Draw throw trajectory arc
                ctx.beginPath();
                ctx.moveTo(0, 0);
                const throwDistance = 100 + (chargeAmount * 200); // Visual only
                ctx.lineTo(Math.cos(p.angle) * throwDistance, Math.sin(p.angle) * throwDistance);
                ctx.strokeStyle = `rgba(34, 197, 94, ${chargeAmount * 0.3})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
        }
        
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, KNIGHT_RADIUS, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(p.angle);
        ctx.fillStyle = WEAPONS_CONFIG[p.weapon.type]?.color || '#d1d5db';
        ctx.fillRect(KNIGHT_RADIUS - 5, -5, 20, 10);
        ctx.restore();
        if (p.id === myId) {
            if (p.weapon.ammo !== Infinity) {
                const maxAmmo = WEAPONS_CONFIG[p.weapon.type]?.ammo || 1;
                const ammoPercentage = p.weapon.ammo / maxAmmo;
                ctx.fillStyle = 'black'; ctx.fillRect(p.x - 26, p.y + KNIGHT_RADIUS + 8, 52, 10);
                ctx.fillStyle = WEAPONS_CONFIG[p.weapon.type]?.color || 'white';
                ctx.fillRect(p.x - 25, p.y + KNIGHT_RADIUS + 9, 50 * ammoPercentage, 8);
            }
            if (p.hasShield) {
                const shieldPercentage = p.shieldEnergy / SHIELD_MAX_ENERGY;
                ctx.fillStyle = 'black'; ctx.fillRect(p.x - 26, p.y + KNIGHT_RADIUS + 20, 52, 10);
                ctx.fillStyle = '#0ea5e9';
                ctx.fillRect(p.x - 25, p.y + KNIGHT_RADIUS + 21, 50 * shieldPercentage, 8);
            }
        }
    });
    
    gameState.projectiles?.forEach(p => {
        if (p.type === 'grenade') {
            // Draw grenade as a green circle with fuse indicator
            const fuseProgress = (now - p.createdTime) / p.fuseTime;
            const radius = 8;
            
            ctx.fillStyle = WEAPONS_CONFIG.grenade.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw fuse progress ring
            ctx.strokeStyle = fuseProgress > 0.7 ? '#ef4444' : '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2 * fuseProgress);
            ctx.stroke();
            
            // Spark effect when close to exploding
            if (fuseProgress > 0.7) {
                ctx.fillStyle = `rgba(239, 68, 68, ${Math.random()})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Original arrow rendering for other projectiles
            const speedPercent = (p.speed - 10) / 15; // 0 for min speed, 1 for max
            const length = 10 + (speedPercent * 5);   // Arrow length scales from 10 to 15
            const lineWidth = 2 + (speedPercent * 2);   // Line width scales from 2 to 4
            const angle = Math.atan2(p.vy, p.vx);

            // Calculate the tail position of the arrow
            const tailX = p.x - length * Math.cos(angle);
            const tailY = p.y - length * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(p.x, p.y); // p.x, p.y is the arrowhead
            ctx.strokeStyle = '#ffdd00';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    });

    gameState.swordSlashes?.forEach(slash => {
            const owner = gameState.players[slash.ownerId];
            if(!owner) return;
            const progress = (now - slash.startTime) / slash.weapon.duration;
            if(progress > 1) return;
            ctx.save();
            ctx.translate(owner.x, owner.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, slash.weapon.range, slash.startAngle - slash.weapon.arc / 2, slash.startAngle + slash.weapon.arc / 2);
            ctx.stroke();
            ctx.restore();
    });
    updateScoreboard(gameState.players);
    updateHud();
}

function gameLoop() {
    if (uiState !== 'GAME') return;
    handleInput();
    draw();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas(){
    const mapPixelWidth = 16 * WALL_SIZE;
    const mapPixelHeight = 14 * WALL_SIZE;
    const scoreboard = document.getElementById('scoreboard');
    const availableHeight = window.innerHeight - (scoreboard.offsetHeight + 60); 
    const availableWidth = window.innerWidth;
    let scale = Math.min(availableWidth / mapPixelWidth, availableHeight / mapPixelHeight);
    if(gameCanvas) {
        gameCanvas.width = mapPixelWidth;
        gameCanvas.height = mapPixelHeight;
        gameCanvas.style.width = `${mapPixelWidth * scale}px`;
        gameCanvas.style.height = `${mapPixelHeight * scale}px`;
    }
}