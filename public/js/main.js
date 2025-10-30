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
    showScreen('MENU');
    
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