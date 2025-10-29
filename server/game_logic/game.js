// server/game_logic/game.js
const { SCORE_TO_WIN, POWERUP_SPAWN_DELAY, POWERUP_DROP_TABLE, MAP_LAYOUT, WALL_SIZE, WALL_HEALTH, WEAPONS } = require('../utils/constants');
const { updateKnights } = require('./player');
const { updateProjectiles } = require('./projectiles');
const { updateLasers, updateSwordSlashes } = require('./weapons');

function createNewRoom(hostId, roomCode, playerName, availableColors) {
    const { createNewPlayer } = require('./player');
    const player = createNewPlayer(hostId, playerName, availableColors[0]);
    return {
        players: { [hostId]: player }, hostId: hostId, state: 'LOBBY', lastUpdateTime: Date.now(),
        walls: [], wallIdCounter: 0,
        projectiles: [], powerups: [], swordSlashes: [], laserBeams: [],
        powerupLocations: [], spawnPoints: [], lastPowerupTime: 0, roundWinner: null,
    };
}

function resetRound(room) {
    room.walls = [];
    room.wallIdCounter = 0;
    room.powerupLocations = [];
    room.spawnPoints = [];

    MAP_LAYOUT.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const char = row[x];
            const wallX = x * WALL_SIZE;
            const wallY = y * WALL_SIZE;
            if (char === '1') {
                room.walls.push({ id: room.wallIdCounter++, x: wallX, y: wallY, width: WALL_SIZE, height: WALL_SIZE, hp: WALL_HEALTH });
            } else if (char === 'P') {
                room.powerupLocations.push({ x: wallX + WALL_SIZE / 2, y: wallY + WALL_SIZE / 2 });
            } else if (char === 'S') {
                room.spawnPoints.push({ x: wallX + WALL_SIZE / 2, y: wallY + WALL_SIZE / 2 });
            }
        }
    });

    // Randomize spawn point assignments
    const shuffledSpawnPoints = [...room.spawnPoints].sort(() => Math.random() - 0.5);
    const now = Date.now();
    const INVULNERABILITY_DURATION = 1500; // 1.5 seconds
    
    Object.values(room.players).forEach((player, index) => {
        const spawnPoint = shuffledSpawnPoints[index % shuffledSpawnPoints.length];
        player.x = spawnPoint.x;
        player.y = spawnPoint.y;
        player.isAlive = true;
        player.weapon = { ...WEAPONS.sword };
        player.hasShield = false;
        player.shieldEnergy = 0;
        player.isInvulnerable = true;
        player.invulnerableUntil = now + 3000 + INVULNERABILITY_DURATION; // After countdown + invuln window
        player.respawnTime = 0;
    });

    room.projectiles = [];
    room.swordSlashes = [];
    room.laserBeams = [];
    room.powerups = [];
    room.lastPowerupTime = Date.now();
    
    // Initialize timer for time-based mode
    const winType = room.matchSettings?.winType || 'LAST_KNIGHT_STANDING';
    if (winType === 'TIME_BASED') {
        const timeLimit = room.matchSettings?.timeLimit || 5; // minutes
        room.matchStartTime = Date.now() + 3000; // After countdown
        room.matchEndTime = room.matchStartTime + (timeLimit * 60 * 1000);
    }
    
    io.to(room.code).emit('countdown', 3);
    setTimeout(() => io.to(room.code).emit('countdown', 2), 1000);
    setTimeout(() => io.to(room.code).emit('countdown', 1), 2000);
    setTimeout(() => {
        io.to(room.code).emit('countdown', 0);
        room.state = 'PLAYING'; // Set state to PLAYING only AFTER countdown finishes
    }, 3000);
}

function updatePowerups(room) {
    if (Date.now() > room.lastPowerupTime + POWERUP_SPAWN_DELAY) {
        room.lastPowerupTime = Date.now();
        const occupied = room.powerups.map(p => `${p.x}-${p.y}`);
        const available = room.powerupLocations.filter(loc => !occupied.includes(`${loc.x}-${loc.y}`));
        const currentShields = Object.values(room.players).filter(p => p.hasShield || p.shieldActive).length;
        const maxShields = Math.ceil(Object.keys(room.players).length / 2);

        if (available.length > 0) {
            // Filter drop table by enabled weapons (exclude shield from this check - it's always allowed)
            const enabledWeapons = room.matchSettings?.enabledWeapons || ['sword', 'bow', 'shotgun', 'laser', 'minigun', 'grenade'];
            let potentialSpawns = POWERUP_DROP_TABLE.filter(type => 
                type === 'shield' || enabledWeapons.includes(type)
            );
            
            if (currentShields >= maxShields) {
                potentialSpawns = potentialSpawns.filter(t => t !== 'shield');
            }
            const powerupsInPlay = Object.values(room.players).map(p => p.weapon.type);
            if (powerupsInPlay.includes('minigun')) potentialSpawns = potentialSpawns.filter(t => t !== 'minigun');
            if (powerupsInPlay.includes('laser')) potentialSpawns = potentialSpawns.filter(t => t !== 'laser');
            if (powerupsInPlay.includes('grenade')) potentialSpawns = potentialSpawns.filter(t => t !== 'grenade');

            if (potentialSpawns.length > 0) {
                const spawnLoc = available[Math.floor(Math.random() * available.length)];
                const spawnType = potentialSpawns[Math.floor(Math.random() * potentialSpawns.length)];
                room.powerups.push({ ...spawnLoc, type: spawnType });
            }
        }
    }
}

function respawnPlayer(player, room) {
    const RESPAWN_DELAY = 2000; // 2 seconds
    const INVULNERABILITY_DURATION = 1500; // 1.5 seconds
    const now = Date.now();
    
    // Find random spawn point
    const shuffledSpawnPoints = [...room.spawnPoints].sort(() => Math.random() - 0.5);
    const spawnPoint = shuffledSpawnPoints[0];
    
    player.x = spawnPoint.x;
    player.y = spawnPoint.y;
    player.isAlive = true;
    player.weapon = { ...WEAPONS.sword };
    player.hasShield = false;
    player.shieldEnergy = 0;
    player.isInvulnerable = true;
    player.invulnerableUntil = now + INVULNERABILITY_DURATION;
    player.respawnTime = 0;
}

function handleAutoRespawn(room) {
    const now = Date.now();
    const RESPAWN_DELAY = 2000;
    
    Object.values(room.players).forEach(player => {
        if (!player.isAlive && player.respawnTime === 0) {
            // Mark player for respawn
            player.respawnTime = now + RESPAWN_DELAY;
        } else if (!player.isAlive && player.respawnTime > 0 && now >= player.respawnTime) {
            // Time to respawn
            respawnPlayer(player, room);
        }
    });
}

function gameLoop(room, deltaTime) {
    if (room.state !== 'PLAYING') return;

    updateLasers(room);
    updateKnights(room, deltaTime);
    updateProjectiles(room);
    updateSwordSlashes(room);
    updatePowerups(room);
    
    // Clean up old explosions
    if (room.explosions) {
        const now = Date.now();
        room.explosions = room.explosions.filter(exp => now - exp.startTime < 500);
    }

    const winType = room.matchSettings?.winType || 'LAST_KNIGHT_STANDING';
    const now = Date.now();

    // Handle auto-respawn for time-based and kill-based modes
    if (winType === 'TIME_BASED' || winType === 'KILL_BASED') {
        handleAutoRespawn(room);
    }

    // Win condition checks based on mode
    if (winType === 'LAST_KNIGHT_STANDING') {
        // Original logic: last knight standing wins the round
        const livingKnights = Object.values(room.players).filter(p => p.isAlive);
        if (livingKnights.length <= 1) {
            room.state = 'ROUND_OVER';
            if (livingKnights.length === 1) {
                const winner = livingKnights[0];
                winner.score++;
                room.roundWinner = winner;
                
                const scoreTarget = room.matchSettings?.scoreTarget || SCORE_TO_WIN;
                if (winner.score >= scoreTarget) {
                    room.state = 'MATCH_OVER';
                    io.to(room.code).emit('matchOver', { winnerId: winner.id, players: room.players, hostId: room.hostId });
                }
            } else {
                room.roundWinner = null;
            }
            
            if (room.state === 'ROUND_OVER') {
                io.to(room.code).emit('roundOver', { winnerId: room.roundWinner?.id, players: room.players });
                setTimeout(() => resetRound(room), 3000);
            }
        }
    } else if (winType === 'KILL_BASED') {
        // Check if any player has reached the kill target
        const scoreTarget = room.matchSettings?.scoreTarget || 10;
        const winner = Object.values(room.players).find(p => p.score >= scoreTarget);
        
        if (winner) {
            room.state = 'MATCH_OVER';
            io.to(room.code).emit('matchOver', { winnerId: winner.id, players: room.players, hostId: room.hostId });
        }
    } else if (winType === 'TIME_BASED') {
        // Emit timer updates every second
        if (!room.lastTimerUpdate || now - room.lastTimerUpdate > 1000) {
            const remainingTime = Math.max(0, room.matchEndTime - now);
            io.to(room.code).emit('timerUpdate', { remainingTime });
            room.lastTimerUpdate = now;
        }
        
        // Check if time has expired
        if (now >= room.matchEndTime) {
            room.state = 'MATCH_OVER';
            // Find player with most kills
            const players = Object.values(room.players);
            players.sort((a, b) => b.score - a.score);
            const winner = players[0];
            io.to(room.code).emit('matchOver', { winnerId: winner.id, players: room.players, hostId: room.hostId });
        }
    }
}

module.exports = { gameLoop, createNewRoom, resetRound };