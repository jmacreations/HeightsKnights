// server/game_logic/game.js
const { SCORE_TO_WIN, POWERUP_SPAWN_DELAY, POWERUP_DROP_TABLE, WALL_SIZE, WALL_HEALTH, WEAPONS,
    WALL_RESPAWN_TIME_MIN, WALL_RESPAWN_TIME_MAX, WALL_RESPAWN_PREVIEW_TIME, WALL_PLAYER_CHECK_TIME } = require('../utils/constants');
const { getMapById } = require('../utils/maps');
const { updateKnights } = require('./player');
const { updateProjectiles } = require('./projectiles');
const { updateLasers, updateSwordSlashes } = require('./weapons');

function createNewRoom(hostId, roomCode, playerName, availableColors) {
    const { createNewPlayer } = require('./player');
    const player = createNewPlayer(hostId, playerName, availableColors[0]);
    const room = {
        players: { [hostId]: player }, hostId: hostId, state: 'LOBBY', lastUpdateTime: Date.now(),
        walls: [], wallIdCounter: 0, destroyedWalls: [], // Track destroyed walls for respawn
        projectiles: [], powerups: [], swordSlashes: [], laserBeams: [],
        powerupLocations: [], spawnPoints: [], lastPowerupTime: 0, roundWinner: null,
    };
    // Non-enumerable field to avoid circular JSON in gameState
    Object.defineProperty(room, 'countdownInterval', { value: null, writable: true, enumerable: false, configurable: true });
    return room;
}

function resetRound(room) {
    room.walls = [];
    room.wallIdCounter = 0;
    room.destroyedWalls = [];
    room.powerupLocations = [];
    room.spawnPoints = [];
    // Resolve selected map
    const mapId = room.matchSettings?.mapId || 'classic';
    const map = getMapById(mapId);
    room.mapId = map.id;
    room.mapWidth = map.width;
    room.mapHeight = map.height;

    map.layout.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const char = row[x];
            const wallX = x * WALL_SIZE;
            const wallY = y * WALL_SIZE;
            if (char === '1') {
                // Destructible wall
                room.walls.push({ 
                    id: room.wallIdCounter++, 
                    x: wallX, 
                    y: wallY, 
                    width: WALL_SIZE, 
                    height: WALL_SIZE, 
                    hp: WALL_HEALTH,
                    destructible: true,
                    mapX: x,
                    mapY: y
                });
            } else if (char === 'N') {
                // Non-destructible wall (no hp, cannot be destroyed)
                room.walls.push({ 
                    id: room.wallIdCounter++, 
                    x: wallX, 
                    y: wallY, 
                    width: WALL_SIZE, 
                    height: WALL_SIZE,
                    destructible: false
                });
            } else if (char === 'P') {
                room.powerupLocations.push({ x: wallX + WALL_SIZE / 2, y: wallY + WALL_SIZE / 2 });
            } else if (char === 'S') {
                room.spawnPoints.push({ x: wallX + WALL_SIZE / 2, y: wallY + WALL_SIZE / 2 });
            }
        }
    });

    // Randomize spawn point assignments
    const shuffledSpawnPoints = [...room.spawnPoints].sort(() => Math.random() - 0.5);
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
        player.invulnerableUntil = 0; // Will be set when match actually starts
        player.respawnTime = 0;
    });

    room.projectiles = [];
    room.swordSlashes = [];
    room.laserBeams = [];
    room.powerups = [];
    room.lastPowerupTime = Date.now();
    
    // Initialize countdown state (PAUSE-aware)
    const winType = room.matchSettings?.winType || 'LAST_KNIGHT_STANDING';
    room.state = 'COUNTDOWN';
    room.countdownRemaining = 3;
    if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
    if (!Object.getOwnPropertyDescriptor(room, 'countdownInterval')) {
        Object.defineProperty(room, 'countdownInterval', { value: null, writable: true, enumerable: false, configurable: true });
    }
    io.to(room.code).emit('countdown', room.countdownRemaining);
    room.countdownInterval = setInterval(() => {
        if (room.state === 'PAUSED') return; // pause-aware countdown
        room.countdownRemaining -= 1;
        io.to(room.code).emit('countdown', Math.max(0, room.countdownRemaining));
        if (room.countdownRemaining <= 0) {
            clearInterval(room.countdownInterval); room.countdownInterval = null;
            room.state = 'PLAYING';
            // Set invulnerability start now
            const nowStart = Date.now();
            Object.values(room.players).forEach(p => {
                if (p.isAlive) {
                    p.isInvulnerable = true;
                    p.invulnerableUntil = nowStart + INVULNERABILITY_DURATION;
                }
            });
            // Initialize timer for time-based mode when match actually starts
            if (winType === 'TIME_BASED') {
                const timeLimit = room.matchSettings?.timeLimit || 5; // minutes
                room.matchStartTime = nowStart;
                room.matchEndTime = room.matchStartTime + (timeLimit * 60 * 1000);
            }
        }
    }, 1000);
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

function updateWallRespawns(room) {
    const now = Date.now();
    const { getDistance } = require('../utils/helpers');
    
    // Check destroyed walls for respawn
    for (let i = room.destroyedWalls.length - 1; i >= 0; i--) {
        const dWall = room.destroyedWalls[i];
        
        // Check if wall is ready to preview (respawn time - preview time)
        if (!dWall.previewStartTime && now >= dWall.respawnTime - WALL_RESPAWN_PREVIEW_TIME) {
            dWall.previewStartTime = now;
            dWall.lastPlayerCheckTime = now;
        }
        
        // If in preview mode, check for players nearby
        if (dWall.previewStartTime) {
            const wallCenter = {
                x: dWall.x + WALL_SIZE / 2,
                y: dWall.y + WALL_SIZE / 2
            };
            
            // Check if any player is near the wall
            let playerNearby = false;
            for (const player of Object.values(room.players)) {
                if (player.isAlive && getDistance(player, wallCenter) < WALL_SIZE * 1.5) {
                    playerNearby = true;
                    dWall.lastPlayerCheckTime = now; // Reset timer
                    break;
                }
            }
            
            // If no player nearby for required time and preview is complete, respawn the wall
            if (!playerNearby && now - dWall.lastPlayerCheckTime >= WALL_PLAYER_CHECK_TIME && now >= dWall.respawnTime) {
                // Respawn the wall
                room.walls.push({
                    id: room.wallIdCounter++,
                    x: dWall.x,
                    y: dWall.y,
                    width: WALL_SIZE,
                    height: WALL_SIZE,
                    hp: WALL_HEALTH,
                    destructible: true,
                    mapX: dWall.mapX,
                    mapY: dWall.mapY
                });
                room.destroyedWalls.splice(i, 1);
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
    updateWallRespawns(room); // Check for wall respawns
    
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