// public/js/network.js
import { showScreen, showMessage } from './ui/uiManager.js';
import { updateLobbyUI } from './scenes/lobbyScene.js';
import { updateScoreboard } from './ui/scoreboard.js';

export function initializeSocket() {
    socket.on('roomCreated', (data) => {
        myId = data.myId;
        roomCode = data.roomCode;
        gameState = data.roomState;
        showScreen('LOBBY');
        updateLobbyUI();
    });

    socket.on('joinSuccess', (data) => {
        myId = data.myId;
        roomCode = data.roomCode;
        gameState = data.roomState;
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
        showScreen('LOBBY');
        updateLobbyUI();
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
        updateScoreboard(data.players);
        showMessage(data.winnerId ? `${data.players[data.winnerId]?.name} wins!` : "DRAW!", 2000);
    });

    socket.on('matchOver', (data) => {
        updateScoreboard(data.players);
        showMessage(`${data.players[data.winnerId]?.name} IS VICTORIOUS!`, Infinity, true, data);
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