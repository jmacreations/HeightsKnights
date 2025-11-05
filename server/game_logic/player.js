// server/game_logic/player.js
const {
    KNIGHT_RADIUS, KNIGHT_SPEED, LUNGE_SPEED_MULTIPLIER, LUNGE_DURATION, LUNGE_COOLDOWN,
    WEAPONS, SHIELD_MAX_ENERGY
} = require('../utils/constants');
const { isCollidingWithWall, getDistance } = require('../utils/helpers');

function createNewPlayer(id, name, color, teamId = null) {
    return {
        id, name, color, teamId, x: 0, y: 0, angle: 0, vx: 0, vy: 0,
        isAlive: true, score: 0, weapon: { ...WEAPONS.sword }, lastAttackTime: 0,
        isLunging: false, lungeEndTime: 0, lastLungeTime: 0,
        hasShield: false, shieldActive: false, shieldEnergy: 0,
        bowChargeStartTime: 0, grenadeChargeStartTime: 0, laserChargeTime: 0, parryEndTime: 0,
        isInvulnerable: false, invulnerableUntil: 0, // Invulnerability window
        respawnTime: 0, // Time when player should respawn
    };
}

function updateKnights(room, deltaTime) {
    const now = Date.now();
    
    // Calculate team balancing bonuses for team mode
    let teamSizeDiff = 0;
    let smallerTeamId = null;
    if (room.matchSettings?.playType === 'team') {
        const teamSizes = {};
        room.teams.forEach(team => {
            teamSizes[team.id] = Object.values(room.players).filter(p => p.teamId === team.id).length;
        });
        
        const teamIds = Object.keys(teamSizes);
        if (teamIds.length === 2) {
            const size1 = teamSizes[teamIds[0]];
            const size2 = teamSizes[teamIds[1]];
            teamSizeDiff = Math.abs(size1 - size2);
            smallerTeamId = size1 < size2 ? teamIds[0] : teamIds[1];
        }
    }
    
    Object.values(room.players).forEach(player => {
        // Check for invulnerability expiration
        if (player.isInvulnerable && now > player.invulnerableUntil) {
            player.isInvulnerable = false;
        }
        
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
        if (player.isLunging && now > player.lungeEndTime) player.isLunging = false;
        
        // Movement and Collision
        let speedMultiplier = player.isLunging ? LUNGE_SPEED_MULTIPLIER : 1;
        if (player.weapon.type === 'minigun') speedMultiplier *= WEAPONS.minigun.speedPenalty;
        
        // Apply team balancing speed bonus
        if (room.matchSettings?.playType === 'team' && player.teamId === smallerTeamId) {
            const speedBonus = Math.min(1.0, teamSizeDiff * 0.15); // Increased cap to 100%, higher multiplier
            speedMultiplier *= (1 + speedBonus);
        }
        
        // Apply match speed modifier
        if (room.matchSettings?.playerSpeed) {
            speedMultiplier *= (room.matchSettings.playerSpeed / 100);
        }
        
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
    const MAP_WIDTH = room.mapWidth || 0;
    const MAP_HEIGHT = room.mapHeight || 0;
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

function handlePlayerHit(player, attacker = null, room = null) {
    // Check invulnerability
    if (player.isInvulnerable) {
        return false; // No damage dealt
    }
    
    // Check friendly fire
    if (room && room.matchSettings?.playType === 'team' && 
        attacker && attacker.teamId && player.teamId === attacker.teamId && 
        !room.matchSettings.friendlyFire) {
        return false; // No damage to teammates when friendly fire is off
    }
    
    if (player.shieldActive) {
        player.shieldActive = false;
        player.hasShield = false;
        player.shieldEnergy = 0;
        return false;
    }
    player.isAlive = false;
    
    // Award kill to attacker in kill-based or time-based modes
    if (attacker && room) {
        const winType = room.matchSettings?.winType || 'LAST_KNIGHT_STANDING';
        if (winType === 'KILL_BASED' || winType === 'TIME_BASED') {
            attacker.score++;
            
            // Award team points if in team mode
            if (room.matchSettings?.playType === 'team' && attacker.teamId) {
                const team = room.teams.find(t => t.id === attacker.teamId);
                if (team) {
                    team.score++;
                }
            }
        }
    }
    
    return true;
}

module.exports = { createNewPlayer, updateKnights, handleLunge, handlePlayerHit };