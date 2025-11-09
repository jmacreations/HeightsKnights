// server/game_logic/game.js
const { SCORE_TO_WIN, POWERUP_SPAWN_DELAY, POWERUP_DROP_TABLE, WALL_SIZE, WALL_HEALTH, WEAPONS,
    WALL_RESPAWN_TIME_MIN, WALL_RESPAWN_TIME_MAX, WALL_RESPAWN_PREVIEW_TIME, WALL_PLAYER_CHECK_TIME } = require('../utils/constants');
const { getMapById } = require('../utils/maps');
const { updateKnights } = require('./player');
const { updateProjectiles } = require('./projectiles');
const { updateLasers, updateSwordSlashes, updateMines } = require('./weapons');
const { updateBots } = require('./bot_ai');

// Sanitize players object to remove circular refs from bot AI state
function sanitizePlayers(players) {
    const sanitized = {};
    for (const id in players) {
        const player = players[id];
        sanitized[id] = {
            id: player.id,
            name: player.name,
            color: player.color,
            x: player.x,
            y: player.y,
            vx: player.vx,
            vy: player.vy,
            angle: player.angle,
            isAlive: player.isAlive,
            score: player.score,
            weapon: player.weapon,
            isLunging: player.isLunging,
            lungeEndTime: player.lungeEndTime,
            lastLungeTime: player.lastLungeTime,
            hasShield: player.hasShield,
            shieldActive: player.shieldActive,
            shieldEnergy: player.shieldEnergy,
            bowChargeStartTime: player.bowChargeStartTime,
            grenadeChargeStartTime: player.grenadeChargeStartTime,
            laserChargeTime: player.laserChargeTime,
            parryEndTime: player.parryEndTime,
            isInvulnerable: player.isInvulnerable,
            invulnerableUntil: player.invulnerableUntil,
            respawnTime: player.respawnTime,
            teamId: player.teamId,
            socketId: player.socketId,
            isAI: player.isAI,
            aiDifficulty: player.aiDifficulty
            // Exclude: aiState, aiTarget, aiMemory, aiDecisionTimer, etc.
        };
    }
    return sanitized;
}

function createNewRoom(hostId, roomCode, playerName, availableColors) {
    const { createNewPlayer } = require('./player');
    const player = createNewPlayer(hostId, playerName, availableColors[0]);
    const room = {
        players: { [hostId]: player }, hostId: hostId, state: 'LOBBY', lastUpdateTime: Date.now(),
        walls: [], wallIdCounter: 0, destroyedWalls: [], // Track destroyed walls for respawn
        projectiles: [], powerups: [], swordSlashes: [], laserBeams: [], mines: [],
        powerupLocations: [], spawnPoints: [], lastPowerupTime: 0, roundWinner: null,
        teams: [
            { id: 'red', name: 'Red Team', color: '#ff4444', score: 0, players: [] },
            { id: 'blue', name: 'Blue Team', color: '#4444ff', score: 0, players: [] }
        ],
        matchSettings: {
            playType: 'individual', // 'individual' or 'team'
            friendlyFire: false,
            minPlayersPerTeam: 1,
            maxPlayersPerTeam: 4
        }
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
    
    // Reset team scores for modes where scores accumulate within rounds
    // (KILL_BASED and TIME_BASED), but not for LMS where scores are round wins
    const resetWinType = room.matchSettings?.winType || 'LAST_KNIGHT_STANDING';
    if (room.matchSettings?.playType === 'team' && 
        (resetWinType === 'KILL_BASED' || resetWinType === 'TIME_BASED')) {
        room.teams.forEach(team => {
            team.score = 0;
        });
    }
    
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

    // Spawn point assignments - always use unique spawn points for each player
    const INVULNERABILITY_DURATION = 1500; // 1.5 seconds
    
    // Shuffle spawn points to randomize starting positions
    const shuffledSpawnPoints = [...room.spawnPoints].sort(() => Math.random() - 0.5);
    const usedSpawnIndices = new Set(); // Track which spawns have been used
    
    Object.values(room.players).forEach((player, playerIndex) => {
        // Find an unused spawn point
        let spawnIndex = playerIndex % shuffledSpawnPoints.length;
        let attempts = 0;
        
        // Keep looking for an unused spawn (in case we have more players than spawns)
        while (usedSpawnIndices.has(spawnIndex) && attempts < shuffledSpawnPoints.length) {
            spawnIndex = (spawnIndex + 1) % shuffledSpawnPoints.length;
            attempts++;
        }
        
        usedSpawnIndices.add(spawnIndex);
        const spawnPoint = shuffledSpawnPoints[spawnIndex];
        
        player.x = spawnPoint.x;
        player.y = spawnPoint.y;
        player.isAlive = true;
        player.weapon = { ...WEAPONS.sword };
        player.hasShield = false;
        player.shieldEnergy = 0;
        player.isInvulnerable = true;
        player.invulnerableUntil = 0; // Will be set when match actually starts
        player.respawnTime = 0;
        player.bowChargeStartTime = 0;
        player.grenadeChargeStartTime = 0;
        player.laserChargeTime = 0;
    });

    room.projectiles = [];
    room.swordSlashes = [];
    room.laserBeams = [];
    room.mines = [];
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
    // Apply weapon spawn rate multiplier to delay
    const spawnRateMultiplier = room.matchSettings?.weaponSpawnRate || 100;
    const adjustedDelay = POWERUP_SPAWN_DELAY / (spawnRateMultiplier / 100);
    
    if (Date.now() > room.lastPowerupTime + adjustedDelay) {
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
            
            // Check if there's a mine on this wall location
            const mineOnWall = room.mines.some(mine => {
                const dist = getDistance(mine, wallCenter);
                return dist < WALL_SIZE;
            });
            
            // If mine is present, prevent respawn
            if (mineOnWall) {
                continue;
            }
            
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
    
    // Find spawn point - always use random individual spawn points
    // This ensures players don't cluster at the same location
    const shuffledSpawnPoints = [...room.spawnPoints].sort(() => Math.random() - 0.5);
    
    // In team mode, prefer spawn points that are:
    // 1. Not currently occupied by an enemy
    // 2. Not too close to enemies (avoid spawn camping)
    let spawnPoint = shuffledSpawnPoints[0];
    
    if (room.matchSettings?.playType === 'team' && player.teamId) {
        // Try to find a spawn point that's safer (not near enemies)
        const safeSpawns = shuffledSpawnPoints.filter(spawn => {
            let isSafe = true;
            
            Object.values(room.players).forEach(other => {
                if (other.teamId !== player.teamId && other.isAlive) {
                    const dist = Math.sqrt((spawn.x - other.x) ** 2 + (spawn.y - other.y) ** 2);
                    if (dist < 150) { // Too close to enemy
                        isSafe = false;
                    }
                }
            });
            
            return isSafe;
        });
        
        // Use a safe spawn if available, otherwise use random
        if (safeSpawns.length > 0) {
            spawnPoint = safeSpawns[0];
        }
    }
    
    player.x = spawnPoint.x;
    player.y = spawnPoint.y;
    player.isAlive = true;
    player.weapon = { ...WEAPONS.sword };
    player.hasShield = false;
    player.shieldEnergy = 0;
    player.isInvulnerable = true;
    player.invulnerableUntil = now + INVULNERABILITY_DURATION;
    player.respawnTime = 0;
    player.bowChargeStartTime = 0;
    player.grenadeChargeStartTime = 0;
    player.laserChargeTime = 0;
}

function handleAutoRespawn(room) {
    const now = Date.now();
    const BASE_RESPAWN_DELAY = 2000;
    
    // Calculate team balancing for respawn delay
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
        if (!player.isAlive && player.respawnTime === 0) {
            // Mark player for respawn with team balancing
            let respawnDelay = BASE_RESPAWN_DELAY;
            if (room.matchSettings?.playType === 'team' && player.teamId === smallerTeamId) {
                const delayReduction = Math.min(1.0, teamSizeDiff * 0.15); // Increased cap to 100%, higher multiplier
                respawnDelay *= (1 - delayReduction);
            }
            player.respawnTime = now + respawnDelay;
        } else if (!player.isAlive && player.respawnTime > 0 && now >= player.respawnTime) {
            // Time to respawn
            respawnPlayer(player, room);
        }
    });
}

function gameLoop(room, deltaTime) {
    if (room.state !== 'PLAYING') return;

    updateLasers(room);
    updateBots(room, deltaTime); // Update bot AI before physics
    updateKnights(room, deltaTime);
    updateProjectiles(room);
    updateSwordSlashes(room);
    updateMines(room);
    updatePowerups(room);
    updateWallRespawns(room); // Check for wall respawns
    
    // Clean up old explosions
    if (room.explosions) {
        const now = Date.now();
        room.explosions = room.explosions.filter(exp => now - exp.startTime < 500);
    }

    const winType = room.matchSettings?.winType || 'LAST_KNIGHT_STANDING';
    const now = Date.now();
    
    // Sanitize players for client emissions (removes bot AI circular refs)
    const clientPlayers = sanitizePlayers(room.players);

    // Handle auto-respawn for time-based and kill-based modes
    if (winType === 'TIME_BASED' || winType === 'KILL_BASED') {
        handleAutoRespawn(room);
    }

    // Win condition checks based on mode
    if (winType === 'LAST_KNIGHT_STANDING') {
        const livingKnights = Object.values(room.players).filter(p => p.isAlive);
        
        // Check for team elimination in team mode
        let teamElimination = false;
        if (room.matchSettings?.playType === 'team') {
            const livingByTeam = {};
            room.teams.forEach(team => {
                livingByTeam[team.id] = livingKnights.filter(p => p.teamId === team.id).length;
            });
            
            const redLiving = livingByTeam.red || 0;
            const blueLiving = livingByTeam.blue || 0;
            
            // Round ends if one team has no living players
            if ((redLiving > 0 && blueLiving === 0) || (blueLiving > 0 && redLiving === 0)) {
                teamElimination = true;
            }
        }
        
        // Original logic: last knight standing wins the round (or team elimination)
        if (livingKnights.length <= 1 || teamElimination) {
            room.state = 'ROUND_OVER';
            
            if (room.matchSettings?.playType === 'team') {
                // Team-based LMS: check if one team has living players
                const livingByTeam = {};
                room.teams.forEach(team => {
                    livingByTeam[team.id] = livingKnights.filter(p => p.teamId === team.id).length;
                });
                
                const redLiving = livingByTeam.red || 0;
                const blueLiving = livingByTeam.blue || 0;
                
                if (redLiving > 0 && blueLiving === 0) {
                    // Red team wins
                    const redTeam = room.teams.find(t => t.id === 'red');
                    if (redTeam) {
                        redTeam.score++;
                        room.roundWinner = redTeam;
                        
                        const scoreTarget = room.matchSettings?.scoreTarget || SCORE_TO_WIN;
                        if (redTeam.score >= scoreTarget) {
                            room.state = 'MATCH_OVER';
                            io.to(room.code).emit('matchOver', { winnerId: redTeam.id, players: clientPlayers, hostId: room.hostId, isTeam: true });
                            return;
                        }
                        
                        io.to(room.code).emit('roundOver', { winnerId: redTeam.id, players: clientPlayers, isTeam: true });
                    }
                } else if (blueLiving > 0 && redLiving === 0) {
                    // Blue team wins
                    const blueTeam = room.teams.find(t => t.id === 'blue');
                    if (blueTeam) {
                        blueTeam.score++;
                        room.roundWinner = blueTeam;
                        
                        const scoreTarget = room.matchSettings?.scoreTarget || SCORE_TO_WIN;
                        if (blueTeam.score >= scoreTarget) {
                            room.state = 'MATCH_OVER';
                            io.to(room.code).emit('matchOver', { winnerId: blueTeam.id, players: clientPlayers, hostId: room.hostId, isTeam: true });
                            return;
                        }
                        
                        io.to(room.code).emit('roundOver', { winnerId: blueTeam.id, players: clientPlayers, isTeam: true });
                    }
                } else if (livingKnights.length === 1) {
                    // Single player survives (shouldn't happen in team mode, but handle it)
                    const winner = livingKnights[0];
                    winner.score++;
                    
                    // Award team points if in team mode
                    if (winner.teamId) {
                        const team = room.teams.find(t => t.id === winner.teamId);
                        if (team) {
                            team.score++;
                        }
                    }
                    
                    room.roundWinner = winner;
                    io.to(room.code).emit('roundOver', { winnerId: winner.id, players: clientPlayers });
                } else {
                    // Draw - no team has clear advantage
                    room.roundWinner = null;
                    io.to(room.code).emit('roundOver', { winnerId: null, players: clientPlayers, isDraw: true });
                }
            } else {
                // Individual LMS mode
                if (livingKnights.length === 1) {
                    const winner = livingKnights[0];
                    winner.score++;
                    room.roundWinner = winner;
                    
                    const scoreTarget = room.matchSettings?.scoreTarget || SCORE_TO_WIN;
                    if (winner.score >= scoreTarget) {
                        room.state = 'MATCH_OVER';
                        io.to(room.code).emit('matchOver', { winnerId: winner.id, players: clientPlayers, hostId: room.hostId });
                    }
                } else {
                    room.roundWinner = null;
                }
                
                if (room.state === 'ROUND_OVER') {
                    io.to(room.code).emit('roundOver', { winnerId: room.roundWinner?.id, players: clientPlayers });
                }
            }
            
            if (room.state === 'ROUND_OVER') {
                setTimeout(() => resetRound(room), 3000);
            }
        }
    } else if (winType === 'KILL_BASED') {
        // Check if any player has reached the kill target
        const scoreTarget = room.matchSettings?.scoreTarget || 10;
        let winner = Object.values(room.players).find(p => p.score >= scoreTarget);
        
        // For team mode, check if any team has reached the target
        if (room.matchSettings?.playType === 'team') {
            const winningTeam = room.teams.find(t => t.score >= scoreTarget);
            if (winningTeam) {
                room.state = 'MATCH_OVER';
                io.to(room.code).emit('matchOver', { winnerId: winningTeam.id, players: clientPlayers, hostId: room.hostId, isTeam: true });
                return;
            }
        } else if (winner) {
            room.state = 'MATCH_OVER';
            io.to(room.code).emit('matchOver', { winnerId: winner.id, players: clientPlayers, hostId: room.hostId });
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
            // Find player with most kills or team with most kills
            if (room.matchSettings?.playType === 'team') {
                const winningTeam = room.teams.reduce((prev, current) => (prev.score > current.score) ? prev : current);
                io.to(room.code).emit('matchOver', { winnerId: winningTeam.id, players: clientPlayers, hostId: room.hostId, isTeam: true });
            } else {
                const players = Object.values(room.players);
                players.sort((a, b) => b.score - a.score);
                const winner = players[0];
                io.to(room.code).emit('matchOver', { winnerId: winner.id, players: clientPlayers, hostId: room.hostId });
            }
        }
    }
}

module.exports = { gameLoop, createNewRoom, resetRound };