// server/game_logic/weapons.js
const { WEAPONS, KNIGHT_RADIUS, WALL_SIZE } = require('../utils/constants');
const { createProjectile } = require('./projectiles');
const { isCollidingWithWall, getDistance } = require('../utils/helpers');
const { handlePlayerHit } = require('./player');

function handleAttackStart(player, room) {
    const now = Date.now();
    if (now < player.lastAttackTime + player.weapon.cooldown) return;
    if (player.weapon.ammo <= 0) return;

    if (player.weapon.type === 'bow') {
        player.bowChargeStartTime = now;
    } else if (player.weapon.type === 'grenade') {
        player.grenadeChargeStartTime = now;
    } else if (player.weapon.type === 'laser') {
        player.laserChargeTime = now + WEAPONS.laser.chargeTime;
        player.lastAttackTime = now; // Set cooldown start time immediately
    } else {
        attack(player, room);
    }
}

function handleAttackEnd(player, room) {
    const now = Date.now();
    
    if (player.weapon.type === 'bow' && player.bowChargeStartTime > 0) {
        if (now < player.lastAttackTime + player.weapon.cooldown) return;
        if (player.weapon.ammo <= 0) return;

        const chargeDuration = now - player.bowChargeStartTime;
        const maxChargeTime = 500;
        const chargeProgress = Math.min(1, chargeDuration / maxChargeTime);
        const baseSpeed = 10;
        const maxSpeed = 25;
        const speed = baseSpeed + (chargeProgress * (maxSpeed - baseSpeed));

        createProjectile(player, room, player.angle, speed, player.weapon.type);
        
        player.bowChargeStartTime = 0;
        player.lastAttackTime = now;
        player.weapon.ammo--;
        if (player.weapon.ammo === 0) player.weapon = { ...WEAPONS.sword };
    } else if (player.weapon.type === 'grenade' && player.grenadeChargeStartTime > 0) {
        if (now < player.lastAttackTime + player.weapon.cooldown) return;
        if (player.weapon.ammo <= 0) return;

        const chargeDuration = now - player.grenadeChargeStartTime;
        const maxChargeTime = 1000;
        const chargeProgress = Math.min(1, chargeDuration / maxChargeTime);
        const baseSpeed = 5;
        const maxSpeed = 15;
        const speed = baseSpeed + (chargeProgress * (maxSpeed - baseSpeed));

        createProjectile(player, room, player.angle, speed, player.weapon.type);
        
        player.grenadeChargeStartTime = 0;
        player.lastAttackTime = now;
        player.weapon.ammo--;
        if (player.weapon.ammo === 0) player.weapon = { ...WEAPONS.sword };
    }
}

function attack(player, room) {
    const weapon = player.weapon;
    const now = Date.now();

    if (now < player.lastAttackTime + weapon.cooldown) return;
    if (weapon.ammo <= 0) return;

    player.lastAttackTime = now;
    if (weapon.type !== 'sword') weapon.ammo--;

    if (weapon.type === 'sword') {
        room.swordSlashes.push({ ownerId: player.id, startAngle: player.angle, startTime: now, weapon: weapon, hitWalls: [] });
        player.parryEndTime = now + WEAPONS.sword.parryDuration;
    } else if (weapon.type === 'shotgun') {
        for (let i = 0; i < weapon.count; i++) {
            const angle = player.angle + (Math.random() - 0.5) * weapon.spread;
            createProjectile(player, room, angle, 8 + Math.random() * 2, weapon.type);
        }
        player.x -= Math.cos(player.angle) * weapon.recoil;
        player.y -= Math.sin(player.angle) * weapon.recoil;
    } else if (weapon.type === 'minigun') {
        const angle = player.angle + (Math.random() - 0.5) * 0.2;
        createProjectile(player, room, angle, 12, weapon.type);
    }

    if (weapon.ammo === 0) player.weapon = { ...WEAPONS.sword };
}

function updateLasers(room) {
    const now = Date.now();
    Object.values(room.players).forEach(player => {
        if (player.laserChargeTime > 0 && now >= player.laserChargeTime) {
            player.laserChargeTime = 0;
            if (player.weapon.ammo <= 0) { player.weapon = {...WEAPONS.sword}; return; }
            player.weapon.ammo--;
            
            let endPos = { x: player.x, y: player.y };
            for (let i = 0; i < 200; i++) {
                endPos.x += Math.cos(player.angle) * 10;
                endPos.y += Math.sin(player.angle) * 10;
                let hit = false;

                // Check player collision
                for (const target of Object.values(room.players)) {
                    if (target.id !== player.id && target.isAlive && getDistance(endPos, target) < KNIGHT_RADIUS) {
                        handlePlayerHit(target, player, room);
                        hit = true; break;
                    }
                }
                if (hit) break;

                // Check wall collision
                 if(isCollidingWithWall(endPos, room.walls, 0)) {
                    hit = true; break;
                }
            }
            room.laserBeams.push({ x1: player.x, y1: player.y, x2: endPos.x, y2: endPos.y, startTime: now });
            if (player.weapon.ammo === 0) player.weapon = { ...WEAPONS.sword };
        }
    });
}

function updateSwordSlashes(room){
     const now = Date.now();
     for (let i = room.swordSlashes.length - 1; i >= 0; i--) {
        const slash = room.swordSlashes[i];
        const owner = room.players[slash.ownerId];

        if(!owner || now > slash.startTime + slash.weapon.duration){ room.swordSlashes.splice(i, 1); continue; }

         for(const player of Object.values(room.players)){
             if(player.isAlive && player.id !== slash.ownerId && getDistance(owner, player) < KNIGHT_RADIUS + slash.weapon.range){
                 let angleToKnight = Math.atan2(player.y - owner.y, player.x - owner.x);
                 let diff = angleToKnight - slash.startAngle;
                 while (diff < -Math.PI) diff += 2 * Math.PI; while (diff > Math.PI) diff -= 2 * Math.PI;
                 if(Math.abs(diff) < slash.weapon.arc/2) handlePlayerHit(player, owner, room);
             }
         }
        for (const wall of room.walls) {
            if (slash.hitWalls.includes(wall.id)) continue;

            const closestX = Math.max(wall.x, Math.min(owner.x, wall.x + WALL_SIZE));
            const closestY = Math.max(wall.y, Math.min(owner.y, wall.y + WALL_SIZE));
            const distance = getDistance({x: closestX, y: closestY}, owner);

            if (distance < slash.weapon.range) {
                const angleToWall = Math.atan2(closestY - owner.y, closestX - owner.x);
                let diff = angleToWall - slash.startAngle;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                while (diff > Math.PI) diff -= 2 * Math.PI;

                if (Math.abs(diff) < slash.weapon.arc / 2) {
                    wall.hp--;
                    slash.hitWalls.push(wall.id);
                }
            }
        }
        
        // Garbage collect dead walls from the room
        room.walls = room.walls.filter(w => w.hp > 0);
     }
}

module.exports = { handleAttackStart, handleAttackEnd, updateLasers, updateSwordSlashes };