// public/js/main.js
import { initializeSocket } from './network.js';
import { showScreen } from './ui/uiManager.js';
import { startGame } from './scenes/gameScene.js';

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
    
    socket.on('gameStarting', () => {
        showScreen('GAME');
        startGame(); // Starts the game loop
    });
}

window.onload = main;