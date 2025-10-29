// server/game_logic/player.js
const {
    KNIGHT_RADIUS, KNIGHT_SPEED, LUNGE_SPEED_MULTIPLIER, LUNGE_DURATION, LUNGE_COOLDOWN, MAP_WIDTH, MAP_HEIGHT,
    WEAPONS, SHIELD_MAX_ENERGY
} = require('../utils/constants');
const { isCollidingWithWall, getDistance } = require('../utils/helpers');

function createNewPlayer(id, name, color) {
    return {
        id, name, color, x: 0, y: 0, angle: 0, vx: 0, vy: 0,
        isAlive: true, score: 0, weapon: { ...WEAPONS.sword }, lastAttackTime: 0,
        isLunging: false, lungeEndTime: 0, lastLungeTime: 0,
        hasShield: false, shieldActive: false, shieldEnergy: 0,
        bowChargeStartTime: 0, grenadeChargeStartTime: 0, laserChargeTime: 0, parryEndTime: 0,
    };
}

function updateKnights(room, deltaTime) {
    Object.values(room.players).forEach(player => {
        if (!player.isAlive) return;

        // Shield energy drain
        if (player.shieldActive) {
            player.shieldEnergy -= deltaTime;
            if (player.shieldEnergy <= 0) {
                player.shieldEnergy = 0;
                player.hasShield = false;
                player.shieldActive = false;
            }
        }

        // Lunge logic
        const now = Date.now();
        if (player.isLunging && now > player.lungeEndTime) player.isLunging = false;
        
        // Movement and Collision
        let speedMultiplier = player.isLunging ? LUNGE_SPEED_MULTIPLIER : 1;
        if (player.weapon.type === 'minigun') speedMultiplier *= WEAPONS.minigun.speedPenalty;
        
        const moveX = player.vx * KNIGHT_SPEED * speedMultiplier;
        const moveY = player.vy * KNIGHT_SPEED * speedMultiplier;
        
        let finalX = player.x;
        let finalY = player.y;

        if (!isCollidingWithWall({x: player.x + moveX, y: player.y}, room.walls)) {
            finalX += moveX;
        }
        if (!isCollidingWithWall({x: finalX, y: player.y + moveY}, room.walls)) {
            finalY += moveY;
        }

        player.x = finalX;
        player.y = finalY;

        // Map boundaries
        player.x = Math.max(KNIGHT_RADIUS, Math.min(MAP_WIDTH - KNIGHT_RADIUS, player.x));
        player.y = Math.max(KNIGHT_RADIUS, Math.min(MAP_HEIGHT - KNIGHT_RADIUS, player.y));

        // Powerup collection
        for (let i = room.powerups.length - 1; i >= 0; i--) {
            const p = room.powerups[i];
            if (getDistance(player, p) < KNIGHT_RADIUS + 15) {
                if (p.type === 'shield') { player.hasShield = true; player.shieldEnergy = SHIELD_MAX_ENERGY; }
                else { player.weapon = { ...WEAPONS[p.type] }; }
                room.powerups.splice(i, 1);
            }
        }
    });
}

function handleLunge(player) {
    const now = Date.now();
    if (now > player.lastLungeTime + LUNGE_COOLDOWN) {
        player.isLunging = true;
        player.lastLungeTime = now;
        player.lungeEndTime = now + LUNGE_DURATION;
    }
}

function handlePlayerHit(player) {
    if (player.shieldActive) {
        player.shieldActive = false;
        player.hasShield = false;
        player.shieldEnergy = 0;
        return false;
    }
    player.isAlive = false;
    return true;
}

module.exports = { createNewPlayer, updateKnights, handleLunge, handlePlayerHit };