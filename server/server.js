// server/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const os = require('os');
const { gameLoop, createNewRoom, resetRound } = require('./game_logic/game');
const { getMaps, getMapById } = require('./utils/maps');
const { createNewPlayer, handleLunge } = require('./game_logic/player');
const { handleAttackStart, handleAttackEnd } = require('./game_logic/weapons');
const { GAME_MODES } = require('../public/js/config.js');

const app = express();
const server = http.createServer(app);
global.io = socketIO(server); // Make io global for game.js to use

app.use(express.static('public'));

const gameRooms = {};
const availableColors = ['#4ade80', '#f87171', '#60aeff', '#fbbf24', '#a78bfa', '#f472b6', '#6134d3ff', '#9ca3af'];

// Helper function to assign team to a player
function assignTeamToPlayer(player, room, playerName, roomCode) {
    if (room.matchSettings?.playType !== 'team') return;
    
    // Host gets blue team by default
    if (player.id === room.hostId) {
        player.teamId = 'blue';
    } else {
        // Auto-balance other players
        const teamSizes = {};
        room.teams.forEach(team => {
            teamSizes[team.id] = Object.values(room.players).filter(p => p.teamId === team.id).length;
        });
        
        const redSize = teamSizes.red || 0;
        const blueSize = teamSizes.blue || 0;
        player.teamId = redSize <= blueSize ? 'red' : 'blue';
    }
}

io.on('connection', (socket) => {
    // Provide available maps to clients
    socket.on('getMaps', (ack) => {
        try {
            const maps = getMaps();
            if (typeof ack === 'function') ack({ ok: true, maps });
        } catch (e) {
            if (typeof ack === 'function') ack({ ok: false, error: e.message });
        }
    });

    // Provide a single map's full details (including layout) for preview
    socket.on('getMap', (mapId, ack) => {
        try {
            const map = getMapById(typeof mapId === 'string' ? mapId : (mapId?.id || 'classic'));
            if (typeof ack === 'function') ack({ ok: true, map });
        } catch (e) {
            if (typeof ack === 'function') ack({ ok: false, error: e.message });
        }
    });
    socket.on('createRoom', (data) => {
        // Support both old format (string) and new format (object)
        const playerName = typeof data === 'string' ? data : data.playerName;
        const gameMode = typeof data === 'object' ? data.gameMode : 'deathmatch';
        const matchSettings = typeof data === 'object' ? data.matchSettings : null;
        
        let roomCode;
        do { roomCode = Math.random().toString(36).substring(2, 6).toUpperCase(); } while (gameRooms[roomCode]);
        socket.join(roomCode);
        const room = createNewRoom(socket.id, roomCode, playerName, availableColors);
        room.gameMode = gameMode; // Store selected game mode
        
        console.log(`[ROOM CREATED] ${playerName} (${socket.id}) created room ${roomCode} with mode: ${gameMode}`);
        
        // Set up match settings with defaults
        room.matchSettings = {
            playType: gameMode === 'teamBattle' ? 'team' : 'individual',
            winType: matchSettings?.winType || 'LAST_KNIGHT_STANDING',
            scoreTarget: matchSettings?.scoreTarget || 5,
            timeLimit: matchSettings?.timeLimit || 5, // in minutes
            mapId: (matchSettings?.mapId && getMapById(matchSettings.mapId)?.id) || 'classic',
            enabledWeapons: Array.isArray(matchSettings?.enabledWeapons) 
                ? matchSettings.enabledWeapons.filter(w => typeof w === 'string')
                : ['sword', 'bow', 'shotgun', 'laser', 'minigun', 'grenade'],
            friendlyFire: matchSettings?.friendlyFire || false
        };
        
        // Ensure sword is always included
        if (!room.matchSettings.enabledWeapons.includes('sword')) {
            room.matchSettings.enabledWeapons.push('sword');
        }
        
        // Assign host to team if in team mode
        const hostPlayer = room.players[socket.id];
        if (hostPlayer) {
            assignTeamToPlayer(hostPlayer, room, playerName, roomCode);
        }
        
        gameRooms[roomCode] = room;
        socket.emit('roomCreated', { roomCode, roomState: room, myId: socket.id });
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = gameRooms[roomCode];
        if (!room) { socket.emit('joinError', 'Room not found.'); return; }
        if (Object.values(room.players).some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            socket.emit('joinError', 'Name is already taken.');
            return;
        }
        const playerCount = Object.keys(room.players).length;
        if (playerCount >= 8) { socket.emit('joinError', 'Room is full.'); return; }
        
        socket.join(roomCode);
        const player = createNewPlayer(socket.id, playerName, availableColors[playerCount]);
        
        // Auto-assign to team if in team mode
        assignTeamToPlayer(player, room, playerName, roomCode);
        
        room.players[socket.id] = player;
        socket.emit('joinSuccess', { roomCode, roomState: room, myId: socket.id });
        socket.to(roomCode).emit('updateLobby', room);
    });
    
    // Register local players for local multiplayer
    socket.on('registerLocalPlayers', ({ roomCode, players }) => {
        const room = gameRooms[roomCode];
        if (!room) return;
        
        console.log(`[LOCAL PLAYERS] ${socket.id} registering ${players.length} local players`);
        
        // Remove the socket's original player (it will be replaced by local players)
        if (room.players[socket.id]) {
            delete room.players[socket.id];
        }
        
        // Add each local player
        players.forEach((playerData, index) => {
            const playerId = playerData.id;
            const playerCount = Object.keys(room.players).length;
            const color = playerData.color || availableColors[playerCount % availableColors.length];
            
            const player = createNewPlayer(playerId, playerData.name, color);
            player.socketId = socket.id;
            player.localIndex = playerData.localIndex;
            player.inputMethod = playerData.inputMethod;
            player.controllerIndex = playerData.controllerIndex;
            
            // Auto-assign to team if in team mode
            assignTeamToPlayer(player, room, playerData.name, roomCode);
            
            room.players[playerId] = player;
            
            console.log(`  Added local player: ${playerData.name} (${playerId})`);
        });
        
        // Update lobby for all clients
        io.to(roomCode).emit('updateLobby', room);
    });
    
    socket.on('startGame', (roomCode) => {
        const room = gameRooms[roomCode];
        if (room && room.hostId === socket.id && room.state === 'LOBBY') {
            const playerCount = Object.keys(room.players).length;
            const gameModeConfig = GAME_MODES[room.gameMode] || GAME_MODES.deathmatch;
            
            if (playerCount < gameModeConfig.minPlayers) {
                socket.emit('startError', `Need at least ${gameModeConfig.minPlayers} players to start.`);
                return;
            }
            
            // Check team balance for team mode
            if (room.matchSettings?.playType === 'team') {
                if (playerCount < gameModeConfig.minPlayers) {
                    socket.emit('startError', `Need at least ${gameModeConfig.minPlayers} players for team mode.`);
                    return;
                }
                
                // Allow unbalanced teams - balancing bonuses will help smaller teams
            }
            
            io.to(roomCode).emit('gameStarting');
            resetRound(room);
        }
    });

    socket.on('playerInput', (data) => {
        const room = gameRooms[data.roomCode];
        const player = room?.players[socket.id];
        if (player) {
            player.angle = data.angle;
            if (room.state === 'PLAYING' && player.isAlive) {
                player.vx = data.vx;
                player.vy = data.vy;
                if (data.attackStart) handleAttackStart(player, room);
                if (data.attackEnd) handleAttackEnd(player, room);
                if (data.lunge) handleLunge(player);
                player.shieldActive = data.shieldHeld && player.hasShield && player.shieldEnergy > 0;
            }
        }
    });
    
    // Handle multiple player inputs (local multiplayer)
    socket.on('playerInputs', ({ roomCode, inputs }) => {
        const room = gameRooms[roomCode];
        if (!room) return;
        
        inputs.forEach(inputData => {
            const player = room.players[inputData.playerId];
            if (player && player.socketId === socket.id) {
                player.angle = inputData.angle;
                if (room.state === 'PLAYING' && player.isAlive) {
                    player.vx = inputData.vx;
                    player.vy = inputData.vy;
                    if (inputData.attackStart) handleAttackStart(player, room);
                    if (inputData.attackEnd) handleAttackEnd(player, room);
                    if (inputData.lunge) handleLunge(player);
                    player.shieldActive = inputData.shieldHeld && player.hasShield && player.shieldEnergy > 0;
                }
            }
        });
    });

    // Host-only: assign player to team
    socket.on('assignTeam', (data) => {
        const room = gameRooms[data.roomCode];
        if (!room || room.hostId !== socket.id) return;
        
        const player = room.players[data.playerId];
        if (player) {
            player.teamId = data.teamId;
            io.to(data.roomCode).emit('updateLobby', room);
        }
    });

    socket.on('playAgain', (roomCode, ack) => {
        const room = gameRooms[roomCode];
        if (room && room.hostId === socket.id) {
            // Reset scores and immediately start a fresh match (countdown + resetRound)
            Object.values(room.players).forEach(p => {
                p.score = 0;
                p.isAlive = true;
            });
            // Reset team scores for team modes
            if (room.teams) {
                room.teams.forEach(team => {
                    team.score = 0;
                });
            }
            room.state = 'LOBBY';
            // Kick off a new round
            io.to(roomCode).emit('gameStarting');
            resetRound(room);
            ack && ack({ ok: true });
        } else {
            ack && ack({ ok: false, error: 'Only host can play again' });
        }
    });

    // Host-only: end current game and return all players to lobby
    socket.on('endGame', (roomCode, ack) => {
        try {
            const room = gameRooms[roomCode];
            if (!room) throw new Error('Room not found');
            if (room.hostId !== socket.id) throw new Error('Only the host can end the game');
            // Stop gameplay and return to lobby
            room.state = 'LOBBY';
            if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
            // Reset all player scores when returning to lobby
            Object.values(room.players).forEach(p => {
                p.score = 0;
            });
            // Reset team scores for team modes
            if (room.teams) {
                room.teams.forEach(team => {
                    team.score = 0;
                });
            }
            room.walls = [];
            room.projectiles = [];
            room.powerups = [];
            room.swordSlashes = [];
            room.laserBeams = [];
            room.destroyedWalls = [];
            io.to(roomCode).emit('returnToLobby', room);
            ack && ack({ ok: true });
        } catch (e) {
            ack && ack({ ok: false, error: e.message });
        }
    });

    // Player leaves the current game/room
    socket.on('leaveGame', ({ roomCode }, ack) => {
        try {
            const room = gameRooms[roomCode];
            if (!room) {
                ack && ack({ ok: true });
                return;
            }
            // Remove player
            delete room.players[socket.id];
            // If no players left, delete room
            if (Object.keys(room.players).length === 0) {
                delete gameRooms[roomCode];
                ack && ack({ ok: true });
                return;
            }
            // Reassign host if needed
            if (room.hostId === socket.id) {
                const newHostId = Object.keys(room.players)[0];
                room.hostId = newHostId;
            }
            // Only send remaining players to lobby if just one player remains
            if (Object.keys(room.players).length === 1) {
                // Reset scores when returning to lobby
                Object.values(room.players).forEach(p => {
                    p.score = 0;
                });
                // Reset team scores for team modes
                if (room.teams) {
                    room.teams.forEach(team => {
                        team.score = 0;
                    });
                }
                room.state = 'LOBBY';
                io.to(roomCode).emit('returnToLobby', room);
            }
            // Acknowledge to the leaver so client can go to MENU
            ack && ack({ ok: true });
        } catch (e) {
            ack && ack({ ok: false, error: e.message });
        }
    });

    // Host-only: pause and resume gameplay
    socket.on('pauseGame', (roomCode, ack) => {
        try {
            const room = gameRooms[roomCode];
            if (!room) throw new Error('Room not found');
            if (room.hostId !== socket.id) throw new Error('Only host can pause');
            if (room.state !== 'PLAYING' && room.state !== 'COUNTDOWN') throw new Error('Can only pause during gameplay or countdown');
            room.prevState = room.state;
            room.state = 'PAUSED';
            io.to(roomCode).emit('gamePaused');
            ack && ack({ ok: true });
        } catch (e) {
            ack && ack({ ok: false, error: e.message });
        }
    });
    socket.on('resumeGame', (roomCode, ack) => {
        try {
            const room = gameRooms[roomCode];
            if (!room) throw new Error('Room not found');
            if (room.hostId !== socket.id) throw new Error('Only host can resume');
            if (room.state !== 'PAUSED') throw new Error('Game is not paused');
            room.state = room.prevState || 'PLAYING';
            delete room.prevState;
            io.to(roomCode).emit('gameResumed');
            ack && ack({ ok: true });
        } catch (e) {
            ack && ack({ ok: false, error: e.message });
        }
    });

    // Host-only: update match settings while in lobby
    socket.on('updateMatchSettings', ({ roomCode, settings }, ack) => {
        try {
            const room = gameRooms[roomCode];
            if (!room) throw new Error('Room not found');
            if (room.hostId !== socket.id) throw new Error('Only the host can change settings');
            if (room.state !== 'LOBBY') throw new Error('Settings can only be changed in the lobby');

            const next = { ...(room.matchSettings || { winType: 'LAST_KNIGHT_STANDING', scoreTarget: 5, timeLimit: 5, mapId: 'classic' }), ...(settings || {}) };
            
            // Sanitize winType
            const validWinTypes = ['LAST_KNIGHT_STANDING', 'KILL_BASED', 'TIME_BASED'];
            if (!validWinTypes.includes(next.winType)) {
                next.winType = 'LAST_KNIGHT_STANDING';
            }
            
            // Sanitize scoreTarget
            if (typeof next.scoreTarget !== 'number') next.scoreTarget = Number(next.scoreTarget) || 5;
            next.scoreTarget = Math.max(1, Math.min(20, next.scoreTarget));

            // Sanitize timeLimit (in minutes)
            if (typeof next.timeLimit !== 'number') next.timeLimit = Number(next.timeLimit) || 5;
            next.timeLimit = Math.max(1, Math.min(15, next.timeLimit));

            // Sanitize mapId
            if (next.mapId && typeof next.mapId === 'string') {
                const found = getMapById(next.mapId);
                next.mapId = found?.id || room.matchSettings.mapId || 'classic';
            } else {
                next.mapId = room.matchSettings.mapId || 'classic';
            }

            // Sanitize enabledWeapons: ensure it's an array and includes 'sword'
            if (Array.isArray(next.enabledWeapons)) {
                // Validate each weapon is a string and ensure sword is always included
                next.enabledWeapons = next.enabledWeapons.filter(w => typeof w === 'string' && w.length > 0);
                if (!next.enabledWeapons.includes('sword')) {
                    next.enabledWeapons.push('sword');
                }
            } else {
                // Default to all weapons if not provided
                next.enabledWeapons = ['sword', 'bow', 'shotgun', 'laser', 'minigun', 'grenade'];
            }

            room.matchSettings = next;
            // Broadcast updated settings and lobby state for UI refresh
            io.to(roomCode).emit('matchSettingsUpdated', next);
            io.to(roomCode).emit('updateLobby', room);
            ack && ack({ ok: true });
        } catch (err) {
            ack && ack({ ok: false, error: err.message });
        }
    });

    socket.on('disconnect', () => {
        let roomCodeOfDisconnectedPlayer = null;
        let roomOfDisconnectedPlayer = null;

        // Find all players belonging to this socket (including local players)
        for (const code in gameRooms) {
            const room = gameRooms[code];
            const hasPlayer = Object.values(room.players).some(p => 
                p.id === socket.id || p.socketId === socket.id
            );
            
            if (hasPlayer) {
                roomCodeOfDisconnectedPlayer = code;
                roomOfDisconnectedPlayer = room;
                break;
            }
        }

        if (roomOfDisconnectedPlayer) {
            console.log(`Socket ${socket.id} disconnected from room ${roomCodeOfDisconnectedPlayer}`);
            
            // Remove all players associated with this socket (main player + local players)
            const disconnectedPlayerIds = [];
            for (const playerId in roomOfDisconnectedPlayer.players) {
                const player = roomOfDisconnectedPlayer.players[playerId];
                if (player.id === socket.id || player.socketId === socket.id) {
                    disconnectedPlayerIds.push(playerId);
                }
            }
            
            disconnectedPlayerIds.forEach(playerId => {
                delete roomOfDisconnectedPlayer.players[playerId];
                console.log(`  Removed player: ${playerId}`);
            });

            const remaining = Object.keys(roomOfDisconnectedPlayer.players).length;
            if (remaining === 0) {
                delete gameRooms[roomCodeOfDisconnectedPlayer];
                console.log(`Room ${roomCodeOfDisconnectedPlayer} is empty and has been deleted.`);
            } else {
                // If the host disconnected, assign a new host
                if (roomOfDisconnectedPlayer.hostId === socket.id) {
                    const newHostId = Object.keys(roomOfDisconnectedPlayer.players)[0];
                    roomOfDisconnectedPlayer.hostId = newHostId;
                    console.log(`Host disconnected. New host is ${newHostId}`);
                }
                // Only return to lobby if only one player remains
                if (remaining === 1) {
                    // Reset scores when returning to lobby
                    Object.values(roomOfDisconnectedPlayer.players).forEach(p => {
                        p.score = 0;
                    });
                    roomOfDisconnectedPlayer.state = 'LOBBY';
                    if (roomOfDisconnectedPlayer.countdownInterval) { try { clearInterval(roomOfDisconnectedPlayer.countdownInterval); } catch {} }
                    io.to(roomCodeOfDisconnectedPlayer).emit('returnToLobby', roomOfDisconnectedPlayer);
                } else {
                    // Otherwise, continue the match; lobby UI can be refreshed if needed
                    io.to(roomCodeOfDisconnectedPlayer).emit('updateLobby', roomOfDisconnectedPlayer);
                }
            }
        }
    });
});

// Main Game Loop Interval
setInterval(() => {
    const now = Date.now();
    for (const roomCode in gameRooms) {
        const room = gameRooms[roomCode];
        const deltaTime = now - (room.lastUpdateTime || now);
        room.lastUpdateTime = now;
        room.code = roomCode;
        gameLoop(room, deltaTime);
        room.laserBeams = room.laserBeams.filter(beam => now - beam.startTime < 500);
        io.to(roomCode).emit('gameState', room);
    }
}, 1000 / 30);


const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    // Find the local IPv4 address of the machine
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address;
                break;
            }
        }
        if(localIp !== 'localhost') break;
    }
    console.log(`\nGame available at: http://${localIp}:${PORT}`);
    console.log(`Open this on other devices on the same Wi-Fi network to join!`);
});