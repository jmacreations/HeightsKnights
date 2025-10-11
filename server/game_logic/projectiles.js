// server/game_logic/projectiles.js
const { MAP_WIDTH, MAP_HEIGHT, KNIGHT_RADIUS, WEAPONS } = require('../utils/constants');
const { getDistance } = require('../utils/helpers');
const { handlePlayerHit } = require('./player');

function createProjectile(owner, room, angle, speed, type) {
    room.projectiles.push({
        x: owner.x + Math.cos(angle) * (KNIGHT_RADIUS + 5),
        y: owner.y + Math.sin(angle) * (KNIGHT_RADIUS + 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ownerId: owner.id,
        speed: speed,
        type: type
    });
}

function isProjectileInParryArc(projectile, player) {
    let angleToProjectile = Math.atan2(projectile.y - player.y, projectile.x - player.x);
    let diff = angleToProjectile - player.angle;
    while (diff < -Math.PI) diff += 2 * Math.PI; while (diff > Math.PI) diff -= 2 * Math.PI;
    return Math.abs(diff) < (WEAPONS.sword.arc / 2 + 0.5);
}

function updateProjectiles(room) {
     for (let i = room.projectiles.length - 1; i >= 0; i--) {
        const p = room.projectiles[i];
        p.x += p.vx; p.y += p.vy;

        if (p.x < 0 || p.x > MAP_WIDTH || p.y < 0 || p.y > MAP_HEIGHT) {
            room.projectiles.splice(i, 1); continue;
        }

        let hitObject = false;

        // Wall collision
        for (let j = room.walls.length - 1; j >= 0; j--) {
            const wall = room.walls[j];
            if (p.x > wall.x && p.x < wall.x + wall.width && p.y > wall.y && p.y < wall.y + wall.height) {
                wall.hp--;
                if (wall.hp <= 0) room.walls.splice(j, 1);
                hitObject = true;
                break;
            }
        }
        if (hitObject) { room.projectiles.splice(i, 1); continue; }

        // Player collision
        for(const player of Object.values(room.players)){
            if(player.isAlive && player.id !== p.ownerId && getDistance(p, player) < KNIGHT_RADIUS){
                if (Date.now() < player.parryEndTime && isProjectileInParryArc(p, player)) {
                    // Parry success
                } else {
                    handlePlayerHit(player);
                }
                hitObject = true;
                break;
            }
        }
        if (hitObject) { room.projectiles.splice(i, 1); }
    }
}

module.exports = { createProjectile, updateProjectiles };