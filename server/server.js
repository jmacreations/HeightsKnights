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
const { getRandomBotName, DIFFICULTY_SETTINGS } = require('./game_logic/bot_ai');

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
                : ['sword', 'bow', 'shotgun', 'laser', 'minigun', 'grenade', 'mine'],
            friendlyFire: matchSettings?.friendlyFire || false,
            playerSpeed: matchSettings?.playerSpeed || 100,
            weaponSpawnRate: matchSettings?.weaponSpawnRate || 100
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

    // Check if room exists (before player enters name)
    socket.on('checkRoom', (roomCode, callback) => {
        const room = gameRooms[roomCode];
        if (!room) {
            callback({ exists: false, error: 'Room not found' });
        } else {
            const playerCount = Object.keys(room.players).length;
            if (playerCount >= 8) {
                callback({ exists: false, error: 'Room is full' });
            } else {
                callback({ exists: true });
            }
        }
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
        const sanitizedRoom = sanitizeGameState(room);
        socket.to(roomCode).emit('updateLobby', sanitizedRoom);
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
        
        // First, remove any existing players from this socket that are already in THIS room
        // This prevents duplicates when re-registering
        Object.keys(room.players).forEach(playerId => {
            if (room.players[playerId].socketId === socket.id) {
                console.log(`  Removing existing local player: ${room.players[playerId].name} (${playerId})`);
                delete room.players[playerId];
            }
        });
        
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
        const sanitizedRoom = sanitizeGameState(room);
        io.to(roomCode).emit('updateLobby', sanitizedRoom);
    });
    
    socket.on('addBot', ({ roomCode, difficulty, name }) => {
        const room = gameRooms[roomCode];
        if (!room) {
            socket.emit('botError', 'Room not found');
            return;
        }
        
        // Only host can add bots
        if (room.hostId !== socket.id) {
            socket.emit('botError', 'Only the host can add bots');
            return;
        }
        
        // Check player limit
        const currentPlayerCount = Object.keys(room.players).length;
        if (currentPlayerCount >= 8) {
            socket.emit('botError', 'Room is full (8/8 players)');
            return;
        }
        
        // Validate difficulty
        const validDifficulty = difficulty || 'medium';
        if (!['easy', 'medium', 'hard'].includes(validDifficulty)) {
            socket.emit('botError', 'Invalid difficulty');
            return;
        }
        
        // Generate bot name
        const existingNames = Object.values(room.players).map(p => p.name);
        const botName = name || getRandomBotName(existingNames);
        
        // Create bot ID
        const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create bot player
        const usedColors = Object.values(room.players).map(p => p.color);
        const availColor = availableColors.find(c => !usedColors.includes(c)) || availableColors[0];
        
        const bot = createNewPlayer(botId, botName, availColor);
        bot.isAI = true;
        bot.aiDifficulty = validDifficulty;
        bot.socketId = botId;
        
        // Assign team if team mode
        if (room.matchSettings?.playType === 'team') {
            assignTeamToPlayer(bot, room, botName, roomCode);
        }
        
        room.players[botId] = bot;
        
        console.log(`Bot '${botName}' (${validDifficulty}) added to room ${roomCode} by ${socket.id}`);
        
        // Notify all players
        io.to(roomCode).emit('playerJoined', { 
            players: room.players, 
            teams: room.teams,
            hostId: room.hostId 
        });
    });
    
    socket.on('removeBot', ({ roomCode, botId }) => {
        const room = gameRooms[roomCode];
        if (!room) {
            socket.emit('botError', 'Room not found');
            return;
        }
        
        // Only host can remove bots
        if (room.hostId !== socket.id) {
            socket.emit('botError', 'Only the host can remove bots');
            return;
        }
        
        const bot = room.players[botId];
        if (!bot) {
            socket.emit('botError', 'Bot not found');
            return;
        }
        
        if (!bot.isAI) {
            socket.emit('botError', 'Cannot remove human players this way');
            return;
        }
        
        const botName = bot.name;
        delete room.players[botId];
        
        console.log(`Bot '${botName}' removed from room ${roomCode} by ${socket.id}`);
        
        // Notify all players
        io.to(roomCode).emit('playerLeft', { 
            playerId: botId, 
            players: room.players,
            teams: room.teams,
            hostId: room.hostId
        });
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
            // Sanitize room state before sending to clients
            const sanitizedRoom = sanitizeGameState(room);
            io.to(data.roomCode).emit('updateLobby', sanitizedRoom);
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
            room.mines = [];
            room.explosions = [];
            
            // Sanitize room state before sending to clients
            const sanitizedRoom = sanitizeGameState(room);
            io.to(roomCode).emit('returnToLobby', sanitizedRoom);
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
            
            // Remove all players associated with this socket (main player + local players)
            const leavingPlayerIds = [];
            for (const playerId in room.players) {
                const player = room.players[playerId];
                if (!player.isAI && (player.id === socket.id || player.socketId === socket.id)) {
                    leavingPlayerIds.push(playerId);
                }
            }
            
            leavingPlayerIds.forEach(playerId => {
                delete room.players[playerId];
                console.log(`  Player left: ${playerId}`);
            });
            
            // Check if any human players remain
            const humanPlayers = Object.values(room.players).filter(p => !p.isAI);
            
            // If no human players remain, delete the room (removes all bots)
            if (humanPlayers.length === 0) {
                delete gameRooms[roomCode];
                console.log(`Room ${roomCode} has no human players left and has been deleted.`);
                ack && ack({ ok: true });
                return;
            }
            
            // If no players left at all, delete room
            if (Object.keys(room.players).length === 0) {
                delete gameRooms[roomCode];
                ack && ack({ ok: true });
                return;
            }
            
            // Reassign host if needed (must be a human player)
            if (room.hostId === socket.id) {
                const humanPlayer = humanPlayers[0];
                if (humanPlayer) {
                    const newHostId = humanPlayer.socketId || humanPlayer.id;
                    room.hostId = newHostId;
                    console.log(`Host left. New host is ${newHostId}`);
                    io.to(roomCode).emit('hostChanged', { 
                        newHostId: newHostId,
                        roomCode: roomCode
                    });
                }
            }
            
            // Only send remaining players to lobby if just one human player remains
            if (humanPlayers.length === 1 && (room.state === 'PLAYING' || room.state === 'GAME' || room.state === 'COUNTDOWN' || room.state === 'ROUND_OVER')) {
                // Clear any countdown intervals
                if (room.countdownInterval) {
                    try { clearInterval(room.countdownInterval); } catch {}
                    room.countdownInterval = null;
                }
                
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
                
                // Clear game entities
                room.walls = [];
                room.projectiles = [];
                room.powerups = [];
                room.swordSlashes = [];
                room.laserBeams = [];
                room.mines = [];
                room.explosions = [];
                room.destroyedWalls = [];
                
                room.state = 'LOBBY';
                
                // Sanitize room state before sending to clients
                const sanitizedRoom = sanitizeGameState(room);
                io.to(roomCode).emit('returnToLobby', sanitizedRoom);
            } else {
                // Notify remaining players
                const sanitizedRoom = sanitizeGameState(room);
                io.to(roomCode).emit('updateLobby', sanitizedRoom);
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
                next.enabledWeapons = ['sword', 'bow', 'shotgun', 'laser', 'minigun', 'grenade', 'mine'];
            }

            // Sanitize playerSpeed
            if (typeof next.playerSpeed !== 'number') next.playerSpeed = Number(next.playerSpeed) || 100;
            next.playerSpeed = Math.max(100, Math.min(200, next.playerSpeed));

            // Sanitize weaponSpawnRate
            if (typeof next.weaponSpawnRate !== 'number') next.weaponSpawnRate = Number(next.weaponSpawnRate) || 100;
            next.weaponSpawnRate = Math.max(100, Math.min(200, next.weaponSpawnRate));

            room.matchSettings = next;
            // Broadcast updated settings and lobby state for UI refresh
            io.to(roomCode).emit('matchSettingsUpdated', next);
            const sanitizedRoom = sanitizeGameState(room);
            io.to(roomCode).emit('updateLobby', sanitizedRoom);
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
            // Explicitly skip bots - they can only be removed via removeBot command
            const disconnectedPlayerIds = [];
            for (const playerId in roomOfDisconnectedPlayer.players) {
                const player = roomOfDisconnectedPlayer.players[playerId];
                if (!player.isAI && (player.id === socket.id || player.socketId === socket.id)) {
                    disconnectedPlayerIds.push(playerId);
                }
            }
            
            disconnectedPlayerIds.forEach(playerId => {
                delete roomOfDisconnectedPlayer.players[playerId];
                console.log(`  Removed player: ${playerId}`);
            });

            const remaining = Object.keys(roomOfDisconnectedPlayer.players).length;
            const humanPlayers = Object.values(roomOfDisconnectedPlayer.players).filter(p => !p.isAI);
            
            // If no human players remain, delete the room (remove all bots)
            if (humanPlayers.length === 0) {
                delete gameRooms[roomCodeOfDisconnectedPlayer];
                console.log(`Room ${roomCodeOfDisconnectedPlayer} has no human players left and has been deleted.`);
                return;
            }
            
            if (remaining === 0) {
                delete gameRooms[roomCodeOfDisconnectedPlayer];
                console.log(`Room ${roomCodeOfDisconnectedPlayer} is empty and has been deleted.`);
            } else {
                // If the host disconnected, assign a new host (must be a human player)
                if (roomOfDisconnectedPlayer.hostId === socket.id) {
                    // Find a human player to be the new host
                    const humanPlayer = humanPlayers[0];
                    
                    if (humanPlayer) {
                        // Get the socket ID: for primary players it's their id, for local players it's socketId
                        const newHostSocketId = humanPlayer.socketId || humanPlayer.id;
                        roomOfDisconnectedPlayer.hostId = newHostSocketId;
                        console.log(`Host disconnected. New host is ${newHostSocketId}`);
                        
                        // Notify all players of the new host
                        io.to(roomCodeOfDisconnectedPlayer).emit('hostChanged', { 
                            newHostId: newHostSocketId,
                            roomCode: roomCodeOfDisconnectedPlayer
                        });
                    }
                }
                
                // Return to lobby if only ONE HUMAN remains (bots don't count)
                // This allows local multiplayer to continue even if the only client has multiple players
                if (humanPlayers.length === 1 && (roomOfDisconnectedPlayer.state === 'PLAYING' || roomOfDisconnectedPlayer.state === 'GAME' || roomOfDisconnectedPlayer.state === 'COUNTDOWN' || roomOfDisconnectedPlayer.state === 'ROUND_OVER')) {
                    console.log(`Only 1 human player remains - returning to lobby`);
                    
                    // Clear any countdown intervals
                    if (roomOfDisconnectedPlayer.countdownInterval) {
                        try { clearInterval(roomOfDisconnectedPlayer.countdownInterval); } catch {}
                        roomOfDisconnectedPlayer.countdownInterval = null;
                    }
                    
                    // Reset scores when returning to lobby
                    Object.values(roomOfDisconnectedPlayer.players).forEach(p => {
                        p.score = 0;
                    });
                    
                    // Reset team scores
                    if (roomOfDisconnectedPlayer.teams) {
                        roomOfDisconnectedPlayer.teams.forEach(team => {
                            team.score = 0;
                        });
                    }
                    
                    // Clear game entities
                    roomOfDisconnectedPlayer.walls = [];
                    roomOfDisconnectedPlayer.projectiles = [];
                    roomOfDisconnectedPlayer.powerups = [];
                    roomOfDisconnectedPlayer.swordSlashes = [];
                    roomOfDisconnectedPlayer.laserBeams = [];
                    roomOfDisconnectedPlayer.mines = [];
                    roomOfDisconnectedPlayer.explosions = [];
                    roomOfDisconnectedPlayer.destroyedWalls = [];
                    
                    roomOfDisconnectedPlayer.state = 'LOBBY';
                    
                    // Sanitize room state before sending to clients
                    const sanitizedRoom = sanitizeGameState(roomOfDisconnectedPlayer);
                    io.to(roomCodeOfDisconnectedPlayer).emit('returnToLobby', sanitizedRoom);
                } else {
                    // Otherwise, continue the match; lobby UI can be refreshed if needed
                    const sanitizedLobbyRoom = sanitizeGameState(roomOfDisconnectedPlayer);
                    io.to(roomCodeOfDisconnectedPlayer).emit('updateLobby', sanitizedLobbyRoom);
                }
            }
        }
    });
});

// Function to sanitize game state for client (remove circular refs and AI internals)
function sanitizeGameState(room) {
    // Create a clean object with only serializable data
    const sanitized = {
        state: room.state,
        hostId: room.hostId,
        code: room.code,
        gameMode: room.gameMode,
        mapId: room.mapId,
        mapWidth: room.mapWidth,
        mapHeight: room.mapHeight,
        matchSettings: room.matchSettings,
        roundWinner: room.roundWinner ? { id: room.roundWinner.id, name: room.roundWinner.name } : null,
        countdownRemaining: room.countdownRemaining,
        matchEndTime: room.matchEndTime,
        
        // Sanitize players - remove AI internal state
        players: {},
        
        // Copy arrays/objects that are safe
        walls: room.walls,
        projectiles: room.projectiles,
        powerups: room.powerups,
        swordSlashes: room.swordSlashes,
        laserBeams: room.laserBeams,
        mines: room.mines,
        explosions: room.explosions,
        teams: room.teams,
        destroyedWalls: room.destroyedWalls
    };
    
    // Clean up player objects - remove AI internal state
    for (const id in room.players) {
        const player = room.players[id];
        sanitized.players[id] = {
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
            // Exclude: aiState, aiTarget, aiMemory, etc.
        };
    }
    
    return sanitized;
}

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
        
        // Sanitize state before sending to clients
        const clientState = sanitizeGameState(room);
        io.to(roomCode).emit('gameState', clientState);
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
    console.log(`\nServer Commands:`);
    console.log(`  setHost <roomCode> <playerId> - Set a new host for a room`);
    console.log(`  listRooms - List all active rooms`);
    console.log(`  addBot <roomCode> [difficulty] [name] - Add a bot (easy/medium/hard)`);
    console.log(`  Type 'help' for all commands`);
});

// CLI Command Handler
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ''
});

rl.on('line', (line) => {
    const args = line.trim().split(' ');
    const command = args[0];

    if (command === 'setHost') {
        const roomCode = args[1]?.toUpperCase();
        const playerId = args[2];
        
        if (!roomCode || !playerId) {
            console.log('Usage: setHost <roomCode> <playerId>');
            return;
        }
        
        const room = gameRooms[roomCode];
        if (!room) {
            console.log(`Error: Room ${roomCode} not found`);
            return;
        }
        
        const player = room.players[playerId];
        if (!player) {
            console.log(`Error: Player ${playerId} not found in room ${roomCode}`);
            console.log(`Available players:`, Object.keys(room.players).join(', '));
            return;
        }
        
        const oldHostId = room.hostId;
        const newHostSocketId = player.socketId || player.id;
        room.hostId = newHostSocketId;
        
        console.log(`✓ Host changed from ${oldHostId} to ${newHostSocketId} (${player.name}) in room ${roomCode}`);
        
        // Notify all players in the room
        io.to(roomCode).emit('hostChanged', { 
            newHostId: newHostSocketId,
            roomCode: roomCode
        });
        
    } else if (command === 'listRooms') {
        if (Object.keys(gameRooms).length === 0) {
            console.log('No active rooms');
            return;
        }
        
        console.log('\nActive Rooms:');
        for (const [code, room] of Object.entries(gameRooms)) {
            const playerCount = Object.keys(room.players).length;
            const hostPlayer = Object.values(room.players).find(p => 
                (p.socketId || p.id) === room.hostId
            );
            console.log(`  ${code} - ${playerCount} player(s), State: ${room.state}, Host: ${hostPlayer?.name || 'Unknown'} (${room.hostId})`);
            console.log(`    Players: ${Object.entries(room.players).map(([id, p]) => `${p.name} (${id})`).join(', ')}`);
        }
        
    } else if (command === 'addBot') {
        const roomCode = args[1]?.toUpperCase();
        const difficulty = args[2]?.toLowerCase() || 'medium';
        const customName = args.slice(3).join(' ');
        
        if (!roomCode) {
            console.log('Usage: addBot <roomCode> [difficulty] [name]');
            console.log('Difficulties: easy, medium, hard');
            return;
        }
        
        const room = gameRooms[roomCode];
        if (!room) {
            console.log(`Error: Room ${roomCode} not found`);
            return;
        }
        
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            console.log(`Error: Invalid difficulty '${difficulty}'. Use: easy, medium, hard`);
            return;
        }
        
        // Check max player limit
        const currentPlayerCount = Object.keys(room.players).length;
        if (currentPlayerCount >= 8) {
            console.log(`Error: Room ${roomCode} is full (8/8 players)`);
            return;
        }
        
        // Generate bot name
        const existingNames = Object.values(room.players).map(p => p.name);
        const botName = customName || getRandomBotName(existingNames);
        
        // Create bot ID
        const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create bot player
        const availableColors = ['#4ade80', '#f87171', '#60aeff', '#fbbf24', '#a78bfa', '#f472b6', '#6134d3ff', '#9ca3af'];
        const usedColors = Object.values(room.players).map(p => p.color);
        const availColor = availableColors.find(c => !usedColors.includes(c)) || availableColors[0];
        
        const bot = createNewPlayer(botId, botName, availColor);
        bot.isAI = true;
        bot.aiDifficulty = difficulty;
        bot.socketId = botId; // Bots use their ID as socket ID
        
        // Assign team if team mode
        if (room.matchSettings?.playType === 'team') {
            assignTeamToPlayer(bot, room, botName, roomCode);
        }
        
        room.players[botId] = bot;
        
        console.log(`✓ Bot '${botName}' (${difficulty}) added to room ${roomCode} [ID: ${botId}]`);
        
        // Notify all players
        io.to(roomCode).emit('playerJoined', { 
            players: room.players, 
            teams: room.teams,
            hostId: room.hostId 
        });
        
    } else if (command === 'removeBot') {
        const roomCode = args[1]?.toUpperCase();
        const botId = args[2];
        
        if (!roomCode || !botId) {
            console.log('Usage: removeBot <roomCode> <botId>');
            return;
        }
        
        const room = gameRooms[roomCode];
        if (!room) {
            console.log(`Error: Room ${roomCode} not found`);
            return;
        }
        
        const bot = room.players[botId];
        if (!bot) {
            console.log(`Error: Bot ${botId} not found in room ${roomCode}`);
            console.log(`Available bots:`, Object.entries(room.players)
                .filter(([_, p]) => p.isAI)
                .map(([id, p]) => `${p.name} (${id})`)
                .join(', ') || 'None');
            return;
        }
        
        if (!bot.isAI) {
            console.log(`Error: ${botId} is not a bot`);
            return;
        }
        
        const botName = bot.name;
        delete room.players[botId];
        
        console.log(`✓ Bot '${botName}' removed from room ${roomCode}`);
        
        // Notify all players
        io.to(roomCode).emit('playerLeft', { 
            playerId: botId, 
            players: room.players,
            teams: room.teams,
            hostId: room.hostId
        });
        
    } else if (command === 'listBots') {
        const roomCode = args[1]?.toUpperCase();
        
        if (!roomCode) {
            console.log('Usage: listBots <roomCode>');
            return;
        }
        
        const room = gameRooms[roomCode];
        if (!room) {
            console.log(`Error: Room ${roomCode} not found`);
            return;
        }
        
        const bots = Object.entries(room.players).filter(([_, p]) => p.isAI);
        
        if (bots.length === 0) {
            console.log(`No bots in room ${roomCode}`);
            return;
        }
        
        console.log(`\nBots in room ${roomCode}:`);
        bots.forEach(([id, bot]) => {
            const state = bot.aiState || 'N/A';
            const target = bot.aiTarget ? 
                (bot.aiTarget.name || `(${bot.aiTarget.x?.toFixed(0)}, ${bot.aiTarget.y?.toFixed(0)})`) : 
                'None';
            console.log(`  ${bot.name} [${id}]`);
            console.log(`    Difficulty: ${bot.aiDifficulty}, State: ${state}, Target: ${target}`);
            console.log(`    Alive: ${bot.isAlive}, Score: ${bot.score}, Weapon: ${bot.weapon?.type || 'none'}`);
        });
        
    } else if (command === 'debugBot') {
        const roomCode = args[1]?.toUpperCase();
        const botId = args[2];
        
        if (!roomCode || !botId) {
            console.log('Usage: debugBot <roomCode> <botId>');
            return;
        }
        
        const room = gameRooms[roomCode];
        if (!room) {
            console.log(`Error: Room ${roomCode} not found`);
            return;
        }
        
        const bot = room.players[botId];
        if (!bot) {
            console.log(`Error: Bot ${botId} not found`);
            return;
        }
        
        if (!bot.isAI) {
            console.log(`Error: ${botId} is not a bot`);
            return;
        }
        
        console.log(`\n=== Bot Debug: ${bot.name} [${botId}] ===`);
        console.log(`Difficulty: ${bot.aiDifficulty}`);
        console.log(`Position: (${bot.x?.toFixed(1)}, ${bot.y?.toFixed(1)})`);
        console.log(`Velocity: (${bot.vx?.toFixed(2)}, ${bot.vy?.toFixed(2)})`);
        console.log(`Angle: ${(bot.angle * 180 / Math.PI)?.toFixed(1)}°`);
        console.log(`Alive: ${bot.isAlive}, Score: ${bot.score}`);
        console.log(`Weapon: ${bot.weapon?.type}, Ammo: ${bot.weapon?.ammo}`);
        console.log(`Shield: ${bot.hasShield}, Active: ${bot.shieldActive}`);
        console.log(`\nAI State: ${bot.aiState}`);
        if (bot.aiTarget) {
            console.log(`Target: ${bot.aiTarget.name || 'Object'}`);
            if (bot.aiTarget.x !== undefined) {
                console.log(`  Position: (${bot.aiTarget.x.toFixed(1)}, ${bot.aiTarget.y.toFixed(1)})`);
            }
        } else {
            console.log(`Target: None`);
        }
        if (bot.aiMemory) {
            console.log(`Strafe Direction: ${bot.aiMemory.strafeDirection}`);
            console.log(`Danger Zones: ${bot.aiMemory.dangerZones?.length || 0}`);
        }
        
    } else if (command === 'help') {
        console.log('\nAvailable Commands:');
        console.log('  setHost <roomCode> <playerId> - Set a new host for a room');
        console.log('  listRooms - List all active rooms with players');
        console.log('  addBot <roomCode> [difficulty] [name] - Add a bot to a room (difficulty: easy/medium/hard)');
        console.log('  removeBot <roomCode> <botId> - Remove a bot from a room');
        console.log('  listBots <roomCode> - List all bots in a room with their state');
        console.log('  debugBot <roomCode> <botId> - Show detailed debug info for a bot');
        console.log('  help - Show this help message');
        
    } else if (command) {
        console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
    }
});