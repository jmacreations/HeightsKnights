// public/js/scenes/matchSettingsScene.js
import { showScreen } from '../ui/uiManager.js';
import { updateLobbyUI } from './lobbyScene.js';

export function getMatchSettingsHTML(playerName, gameMode) {
    const modeDisplay = gameMode === 'deathmatch' ? 'Deathmatch' : gameMode;
    const inLobby = window.settingsContext === 'lobby';
    
    return `
        <div id="MATCH_SETTINGS" class="ui-screen flex flex-col items-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-2xl">
            <button id="back-settings-btn" class="self-start mb-4 text-gray-400 hover:text-white">
                ← ${inLobby ? 'Back to Lobby' : 'Back'}
            </button>
            <h1 class="text-4xl mb-2">Match Settings</h1>
            <p class="text-gray-400 mb-2">Mode: <span class="text-white">${modeDisplay}</span></p>
            <p class="text-gray-400 mb-6">Host: <span class="text-white">${playerName}</span></p>
            
            <div class="w-full max-w-md space-y-6">
                <!-- Score Target Setting -->
                <div class="bg-gray-700 p-4 rounded-lg">
                    <label class="block text-lg font-bold mb-3">Score to Win</label>
                    <div class="flex items-center justify-between gap-4">
                        <button id="score-decrease" class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-2xl">
                            −
                        </button>
                        <div class="flex-1 text-center">
                            <div id="score-display" class="text-4xl font-bold text-green-400">5</div>
                            <div class="text-sm text-gray-400">rounds</div>
                        </div>
                        <button id="score-increase" class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-2xl">
                            +
                        </button>
                    </div>
                    <div class="mt-2 text-xs text-gray-400 text-center">
                        First player to reach this score wins the match
                    </div>
                </div>
                
                <button id="save-settings-btn" class="btn btn-green w-full mt-6 text-xl py-3">
                    ${inLobby ? 'Save Settings' : 'Create Room'}
                </button>
            </div>
        </div>
    `;
}

export function addMatchSettingsListeners() {
    let currentScore = 5;
    if (window.settingsContext === 'lobby' && window.gameState?.matchSettings?.scoreTarget) {
        currentScore = Number(window.gameState.matchSettings.scoreTarget) || 5;
    }
    const minScore = 1;
    const maxScore = 10;
    
    const scoreDisplay = document.getElementById('score-display');
    const decreaseBtn = document.getElementById('score-decrease');
    const increaseBtn = document.getElementById('score-increase');
    
    function updateScoreDisplay() {
        scoreDisplay.textContent = currentScore;
        decreaseBtn.disabled = currentScore <= minScore;
        increaseBtn.disabled = currentScore >= maxScore;
        
        if (currentScore <= minScore) {
            decreaseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            decreaseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        
        if (currentScore >= maxScore) {
            increaseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            increaseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
    
    decreaseBtn.onclick = () => {
        if (currentScore > minScore) {
            currentScore--;
            updateScoreDisplay();
        }
    };
    
    increaseBtn.onclick = () => {
        if (currentScore < maxScore) {
            currentScore++;
            updateScoreDisplay();
        }
    };
    
    // Preset buttons
    
    // Back button
    document.getElementById('back-settings-btn').onclick = () => {
        if (window.settingsContext === 'lobby') {
            showScreen('LOBBY');
            // Immediately refresh lobby UI with current state
            updateLobbyUI();
        } else {
            showScreen('MODE_SELECT');
        }
    };

    // Save/Create button
    document.getElementById('save-settings-btn').onclick = () => {
        const playerName = window.playerName;
        const gameMode = window.selectedGameMode;
        // Store match settings globally
        window.matchSettings = { scoreTarget: currentScore };
        
        if (window.settingsContext === 'lobby' && window.roomCode) {
            // Update settings for existing room
            socket.emit('updateMatchSettings', { roomCode, settings: window.matchSettings }, (res) => {
                if (res?.ok) {
                    // Optimistically update local state and re-render lobby immediately
                    gameState.matchSettings = { ...gameState.matchSettings, ...window.matchSettings };
                    showScreen('LOBBY');
                    updateLobbyUI();
                } else {
                    // Optional: show error feedback
                    console.warn('Failed to update settings:', res?.error);
                }
            });
        } else {
            // Create room with settings
            socket.emit('createRoom', { playerName, gameMode, matchSettings: window.matchSettings });
        }
    };
    
    updateScoreDisplay();
}
