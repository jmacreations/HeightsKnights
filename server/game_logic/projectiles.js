// server/game_logic/projectiles.js
const { MAP_WIDTH, MAP_HEIGHT, KNIGHT_RADIUS, WEAPONS } = require('../utils/constants');
const { getDistance } = require('../utils/helpers');
const { handlePlayerHit } = require('./player');

function createProjectile(owner, room, angle, speed, type) {
    const projectile = {
        x: owner.x + Math.cos(angle) * (KNIGHT_RADIUS + 5),
        y: owner.y + Math.sin(angle) * (KNIGHT_RADIUS + 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ownerId: owner.id,
        speed: speed,
        type: type
    };
    
    // Add grenade-specific properties
    if (type === 'grenade') {
        projectile.createdTime = Date.now();
        projectile.fuseTime = WEAPONS.grenade.fuseTime;
        projectile.bounced = false;
    }
    
    room.projectiles.push(projectile);
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
        
        // Handle grenade explosions
        if (p.type === 'grenade') {
            const now = Date.now();
            if (now - p.createdTime >= p.fuseTime) {
                // Explode!
                explodeGrenade(p, room);
                room.projectiles.splice(i, 1);
                continue;
            }
        }
        
        p.x += p.vx; p.y += p.vy;

        // Grenade bouncing off walls and map boundaries
        if (p.type === 'grenade') {
            let bounced = false;
            
            // Map boundary bouncing
            if (p.x < 0 || p.x > MAP_WIDTH) {
                p.vx *= -WEAPONS.grenade.bounceDecay;
                p.x = Math.max(0, Math.min(MAP_WIDTH, p.x));
                bounced = true;
            }
            if (p.y < 0 || p.y > MAP_HEIGHT) {
                p.vy *= -WEAPONS.grenade.bounceDecay;
                p.y = Math.max(0, Math.min(MAP_HEIGHT, p.y));
                bounced = true;
            }
            
            // Wall bouncing
            for (const wall of room.walls) {
                if (p.x > wall.x && p.x < wall.x + wall.width && p.y > wall.y && p.y < wall.y + wall.height) {
                    // Determine bounce direction based on which side was hit
                    const fromLeft = p.x - p.vx < wall.x;
                    const fromRight = p.x - p.vx > wall.x + wall.width;
                    const fromTop = p.y - p.vy < wall.y;
                    const fromBottom = p.y - p.vy > wall.y + wall.height;
                    
                    if (fromLeft || fromRight) {
                        p.vx *= -WEAPONS.grenade.bounceDecay;
                    }
                    if (fromTop || fromBottom) {
                        p.vy *= -WEAPONS.grenade.bounceDecay;
                    }
                    
                    // Push grenade out of wall
                    if (fromLeft) p.x = wall.x - 1;
                    else if (fromRight) p.x = wall.x + wall.width + 1;
                    if (fromTop) p.y = wall.y - 1;
                    else if (fromBottom) p.y = wall.y + wall.height + 1;
                    
                    bounced = true;
                    break;
                }
            }
            
            // Apply friction when grenade bounces or is on ground
            if (bounced || p.bounced) {
                p.vx *= 0.95;
                p.vy *= 0.95;
                p.bounced = true;
            }
            
            continue; // Grenades don't hit players until explosion
        }

        // Regular projectile out of bounds check
        if (p.x < 0 || p.x > MAP_WIDTH || p.y < 0 || p.y > MAP_HEIGHT) {
            room.projectiles.splice(i, 1); continue;
        }

        let hitObject = false;

        // Wall collision (for non-grenade projectiles)
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

        // Player collision (for non-grenade projectiles)
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

function explodeGrenade(grenade, room) {
    const explosionRadius = WEAPONS.grenade.explosionRadius;
    
    // Store explosion data for client rendering
    if (!room.explosions) room.explosions = [];
    room.explosions.push({
        x: grenade.x,
        y: grenade.y,
        radius: explosionRadius,
        startTime: Date.now()
    });
    
    // Damage all players in radius
    for (const player of Object.values(room.players)) {
        if (player.isAlive && getDistance(grenade, player) < explosionRadius) {
            handlePlayerHit(player);
        }
    }
    
    // Damage walls in radius
    for (let j = room.walls.length - 1; j >= 0; j--) {
        const wall = room.walls[j];
        const wallCenter = {
            x: wall.x + wall.width / 2,
            y: wall.y + wall.height / 2
        };
        
        if (getDistance(grenade, wallCenter) < explosionRadius) {
            wall.hp--;
            if (wall.hp <= 0) room.walls.splice(j, 1);
        }
    }
}

module.exports = { createProjectile, updateProjectiles };