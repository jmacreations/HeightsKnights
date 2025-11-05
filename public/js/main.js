// public/js/main.js
import { initializeSocket } from './network.js';
import { showScreen } from './ui/uiManager.js';
import { startGame } from './scenes/gameScene.js';
import { gamepadManager } from './input/gamepadManager.js';

// Global state
window.socket = io();
window.myId = null;
window.roomCode = null;
window.gameState = {};
window.uiState = 'MENU';
window.playerName = '';
window.selectedGameMode = null;
window.matchSettings = null;

function main() {
    initializeSocket();
    
    // Parse URL parameters for pre-filled room code
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomCode = urlParams.get('room');
    
    // If URL has a room code, auto-join by going to INPUT_SELECTION
    if (urlRoomCode) {
        window.joiningRoomCode = urlRoomCode.toUpperCase().slice(0, 4);
        showScreen('INPUT_SELECTION');
    } else {
        showScreen('MENU');
    }
    
    // Display gamepad connection status
    if (gamepadManager.isConnected()) {
        const info = gamepadManager.getGamepadInfo();
        console.log('🎮 Controller connected:', info);
    }
    
    socket.on('gameStarting', () => {
        showScreen('GAME');
        startGame();
    });
}

window.onload = main;