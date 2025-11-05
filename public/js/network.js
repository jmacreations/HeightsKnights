// public/js/network.js
import { showScreen, showMessage } from './ui/uiManager.js';
import { updateLobbyUI } from './scenes/lobbyScene.js';
import { updateScoreboard } from './ui/scoreboard.js';
import { localPlayerManager } from './input/localPlayerManager.js';

export function initializeSocket() {
    socket.on('roomCreated', (data) => {
        myId = data.myId;
        roomCode = data.roomCode;
        gameState = data.roomState;
        
        // Register local players if any
        registerLocalPlayersWithServer();
        
        showScreen('LOBBY');
        updateLobbyUI();
    });

    socket.on('joinSuccess', (data) => {
        myId = data.myId;
        roomCode = data.roomCode;
        gameState = data.roomState;
        
        // Register local players if any
        registerLocalPlayersWithServer();
        
        showScreen('LOBBY');
        updateLobbyUI();
    });

    socket.on('joinError', (message) => {
        const errorEl = document.getElementById('menu-error');
        if (errorEl) errorEl.textContent = message;
    });
    
    socket.on('updateLobby', (updatedState) => {
        gameState = updatedState;
        updateLobbyUI();
    });

    socket.on('returnToLobby', (updatedState) => {
        gameState = updatedState;
        window.roomCode = updatedState.roomCode || window.roomCode; // Preserve room code
        showScreen('LOBBY');
        updateLobbyUI();
    });
    
    socket.on('hostChanged', ({ newHostId, roomCode }) => {
        console.log(`New host: ${newHostId}`);
        if (gameState.hostId !== undefined) {
            gameState.hostId = newHostId;
        }
        window.roomCode = roomCode; // Make sure room code is preserved
        if (uiState === 'LOBBY') {
            updateLobbyUI();
        }
    });

    // Settings updated while in lobby
    socket.on('matchSettingsUpdated', (nextSettings) => {
        gameState.matchSettings = nextSettings;
        if (uiState === 'LOBBY') {
            // Re-render lobby to reflect new settings
            showScreen('LOBBY');
            updateLobbyUI();
        }
    });

    // Timer update for time-based mode
    socket.on('timerUpdate', ({ remainingTime }) => {
        window.gameRemainingTime = remainingTime;
    });

    socket.on('gameState', (serverState) => {
        gameState = serverState;
    });

    socket.on('countdown', (count) => {
        showMessage(count > 0 ? count : "FIGHT!", 950);
    });

    socket.on('roundOver', (data) => {
        const isTeamMode = gameState.matchSettings?.playType === 'team';
        updateScoreboard(data.players, gameState.teams, isTeamMode, gameState.matchSettings);
        if (isTeamMode && data.winnerId && !data.isDraw) {
            const team = gameState.teams?.find(t => t.id === data.winnerId);
            showMessage(team ? `${team.name} wins the round!` : "Round Over!", 2000);
        } else if (data.isDraw) {
            showMessage("Round Draw!", 2000);
        } else {
            showMessage(data.winnerId ? `${data.players[data.winnerId]?.name} wins the round!` : "Round Over!", 2000);
        }
    });

    socket.on('matchOver', (data) => {
        const isTeamMode = gameState.matchSettings?.playType === 'team';
        updateScoreboard(data.players, gameState.teams, isTeamMode, gameState.matchSettings);
        if (isTeamMode && data.winnerId) {
            const team = gameState.teams?.find(t => t.id === data.winnerId);
            showMessage(team ? `${team.name} IS VICTORIOUS!` : "MATCH OVER!", Infinity, true, data);
        } else {
            showMessage(`${data.players[data.winnerId]?.name} IS VICTORIOUS!`, Infinity, true, data);
        }
    });

    // Pause/Resume handling
    socket.on('gamePaused', () => {
        showMessage('Paused', Infinity, false);
    });
    socket.on('gameResumed', () => {
        // Hide message overlay if visible
        showMessage('', 0, false);
    });
}

/**
 * Register local players with the server
 */
function registerLocalPlayersWithServer() {
    const localPlayers = localPlayerManager.getAllPlayers();
    
    if (localPlayers.length === 0) {
        return; // No local players to register
    }
    
    const playersData = localPlayers.map(player => ({
        id: player.id,
        socketId: player.socketId,
        localIndex: player.localIndex,
        name: player.name,
        color: player.color,
        inputMethod: player.inputMethod,
        controllerIndex: player.controllerIndex
    }));
    
    socket.emit('registerLocalPlayers', {
        roomCode: roomCode,
        players: playersData
    });
    
    console.log(`Registered ${localPlayers.length} local players with server`);
}

/**
 * Send input for all local players
 * @param {Array} playerInputs - Array of input objects for each local player
 */
export function sendPlayerInputs(playerInputs) {
    if (!playerInputs || playerInputs.length === 0) return;
    
    socket.emit('playerInputs', {
        roomCode: roomCode,
        inputs: playerInputs
    });
}