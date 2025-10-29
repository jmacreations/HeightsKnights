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
    
    Object.values(room.players).forEach((player, index) => {
        const spawnPoint = shuffledSpawnPoints[index % shuffledSpawnPoints.length];
        player.x = spawnPoint.x;
        player.y = spawnPoint.y;
        player.isAlive = true;
        player.weapon = { ...WEAPONS.sword };
        player.hasShield = false;
        player.shieldEnergy = 0;
    });

    room.projectiles = [];
    room.swordSlashes = [];
    room.laserBeams = [];
    room.powerups = [];
    room.lastPowerupTime = Date.now();
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
            let potentialSpawns = [...POWERUP_DROP_TABLE];
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

    const livingKnights = Object.values(room.players).filter(p => p.isAlive);
    if (livingKnights.length <= 1) {
        room.state = 'ROUND_OVER';
        if (livingKnights.length === 1) {
            const winner = livingKnights[0];
            winner.score++;
            room.roundWinner = winner;
            if (winner.score >= SCORE_TO_WIN) {
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
}

module.exports = { gameLoop, createNewRoom, resetRound };