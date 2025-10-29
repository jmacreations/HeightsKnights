// server/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const os = require('os');
const { gameLoop, createNewRoom, resetRound } = require('./game_logic/game');
const { createNewPlayer, handleLunge } = require('./game_logic/player');
const { handleAttackStart, handleAttackEnd } = require('./game_logic/weapons');

const app = express();
const server = http.createServer(app);
global.io = socketIO(server); // Make io global for game.js to use

app.use(express.static('public'));

const gameRooms = {};
const availableColors = ['#4ade80', '#f87171', '#60aeff', '#fbbf24', '#a78bfa', '#f472b6', '#6134d3ff', '#9ca3af'];


io.on('connection', (socket) => {
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
        
        // Set up match settings with defaults
        room.matchSettings = {
            winType: matchSettings?.winType || 'LAST_KNIGHT_STANDING',
            scoreTarget: matchSettings?.scoreTarget || 5,
            timeLimit: matchSettings?.timeLimit || 5, // in minutes
            enabledWeapons: Array.isArray(matchSettings?.enabledWeapons) 
                ? matchSettings.enabledWeapons.filter(w => typeof w === 'string')
                : ['sword', 'bow', 'shotgun', 'laser', 'minigun', 'grenade']
        };
        
        // Ensure sword is always included
        if (!room.matchSettings.enabledWeapons.includes('sword')) {
            room.matchSettings.enabledWeapons.push('sword');
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
        room.players[socket.id] = player;
        socket.emit('joinSuccess', { roomCode, roomState: room, myId: socket.id });
        socket.to(roomCode).emit('updateLobby', room);
    });
    
    socket.on('startGame', (roomCode) => {
        const room = gameRooms[roomCode];
        if (room && room.hostId === socket.id && room.state === 'LOBBY') {
            if (Object.keys(room.players).length < 2) {
                socket.emit('startError', 'Need at least 2 players to start.');
                return;
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

    socket.on('playAgain', (roomCode) => {
        const room = gameRooms[roomCode];
        if (room && room.hostId === socket.id) {
            // Reset scores and state for a new match
            Object.values(room.players).forEach(p => {
                p.score = 0;
                p.isAlive = true;
            });
            room.state = 'LOBBY';
            // Send everyone back to the lobby screen
            io.to(roomCode).emit('returnToLobby', room);
        }
    });

    // Host-only: update match settings while in lobby
    socket.on('updateMatchSettings', ({ roomCode, settings }, ack) => {
        try {
            const room = gameRooms[roomCode];
            if (!room) throw new Error('Room not found');
            if (room.hostId !== socket.id) throw new Error('Only the host can change settings');
            if (room.state !== 'LOBBY') throw new Error('Settings can only be changed in the lobby');

            const next = { ...(room.matchSettings || { winType: 'LAST_KNIGHT_STANDING', scoreTarget: 5, timeLimit: 5 }), ...(settings || {}) };
            
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

        for (const code in gameRooms) {
            if (gameRooms[code].players[socket.id]) {
                roomCodeOfDisconnectedPlayer = code;
                roomOfDisconnectedPlayer = gameRooms[code];
                break;
            }
        }

        if (roomOfDisconnectedPlayer) {
            console.log(`Player ${socket.id} disconnected from room ${roomCodeOfDisconnectedPlayer}`);
            delete roomOfDisconnectedPlayer.players[socket.id];

            if (Object.keys(roomOfDisconnectedPlayer.players).length === 0) {
                delete gameRooms[roomCodeOfDisconnectedPlayer];
                console.log(`Room ${roomCodeOfDisconnectedPlayer} is empty and has been deleted.`);
            } else {
                // If the host disconnected, assign a new host
                if (roomOfDisconnectedPlayer.hostId === socket.id) {
                    const newHostId = Object.keys(roomOfDisconnectedPlayer.players)[0];
                    roomOfDisconnectedPlayer.hostId = newHostId;
                    console.log(`Host disconnected. New host is ${newHostId}`);
                }
                
                // MODIFIED: Force all players back to the lobby for a clean state reset
                roomOfDisconnectedPlayer.state = 'LOBBY';
                io.to(roomCodeOfDisconnectedPlayer).emit('returnToLobby', roomOfDisconnectedPlayer);
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